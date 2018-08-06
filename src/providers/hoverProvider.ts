/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../language/parser';

import { HoverProvider, Hover, TextDocument, Position, MarkdownString } from 'vscode';
import { EOL } from 'os';
import { Modules } from '../language/modules';
import { Language } from '../language/language';

class TemplateDocumentationParameter {
    public name = '';
    public description = '';
}

class TemplateDocumentationItem {
    public category = '';
    public signature = '';
    public summary = '';
    public parameters: TemplateDocumentationParameter[] = [];
}

export class TemplateHoverProvider implements HoverProvider {

    public provideHover(document: TextDocument, position: Position): Thenable<Hover> {     
        let instance:TemplateHoverProvider = this;
        return new Promise(function (resolve, reject) {
            let word = parser.getWord(document, position);
            if (word) {
                // If is a symbol, show description according to prefix.
                if (parser.isSymbol(word)) {
                    let definition = parser.findSymbolDefinition(document, word);
                    if (definition) {
                        let item = new TemplateDocumentationItem();
                        item.category = 'symbol';
                        item.signature = document.lineAt(definition.location.range.start.line).text;
                        item.summary = TemplateHoverProvider.getSymbolDescription(word, definition.type);
                        return resolve(TemplateHoverProvider.makeHover(item));
                    }

                    const taskLine = parser.findTaskDefinition(document, word);
                    if (taskLine) {
                        const item = new TemplateDocumentationItem();
                        item.category = 'task';
                        item.signature = taskLine.text.trim();
                        item.summary = parser.makeSummary(document, taskLine.lineNumber);
                        return resolve(TemplateHoverProvider.makeHover(item));
                    }
                }

                // Seek message from number
                if (!isNaN(Number(word))) {           
                    let messageDefinition = parser.findMessageByIndex(document, word);
                    if (messageDefinition) {
                        let line = messageDefinition.line;
                        if (messageDefinition.isDefault) {
                            return resolve(instance.provideHover(document, new Position(line.lineNumber, 0)));
                        }
                        else {
                            let item = new TemplateDocumentationItem();
                            item.category = 'message';
                            item.signature = line.text;
                            const summary = parser.makeSummary(document, line.lineNumber);
                            if (summary) {
                                item.summary = summary;
                            }
                            return resolve(TemplateHoverProvider.makeHover(item));
                        }
                    }
                }

                // Seek word in documentation files
                const definition = Language.getInstance().findDefinition(word, document.lineAt(position.line).text);
                if (definition) {
                    const item = new TemplateDocumentationItem();
                    item.category = 'definition';
                    item.signature = definition.signature;
                    const overloads = Language.getInstance().numberOfOverloads(word) - 1;
                    if (overloads > 0) {
                        item.signature += ' (+' + overloads + ' overloads)';
                    }
                    item.summary = definition.summary;
                    item.parameters = definition.parameters;
                    return resolve(TemplateHoverProvider.makeHover(item));
                }
                const languageItem = Language.getInstance().seekByName(word);
                if (languageItem) {
                    languageItem.signature = Language.prettySignature(languageItem.signature);
                    return resolve(TemplateHoverProvider.makeHover(languageItem));
                }

                // Seek quest
                if (parser.isQuestReference(document.lineAt(position.line).text)) {
                    return parser.findQuestDefinition(word).then((quest) => {
                        let item = new TemplateDocumentationItem();
                        item.category = 'quest';
                        item.signature = 'Quest: ' +  quest.pattern;
                        item.summary = quest.displayName;
                        return resolve(TemplateHoverProvider.makeHover(item));
                    }, () => reject());
                }

                // Actions
                let result = Modules.getInstance().findAction(word, document.lineAt(position.line).text);
                if (result) {
                    let item = new TemplateDocumentationItem();
                    item.category = result.actionKind;
                    let signature = result.moduleName + ' -> ' + result.action.overloads[result.overload];
                    if (result.action.overloads.length > 1) {
                        signature += '\n\nother overload(s):';
                        for (let i = 0; i < result.action.overloads.length; i++) {
                            if (i !== result.overload) {
                                signature += '\n' + result.action.overloads[i];
                            }
                        }
                    }
                    item.signature = Modules.prettySignature(signature);
                    item.summary = result.action.summary;
                    return resolve(TemplateHoverProvider.makeHover(item));
                }
            }

            return reject();
        });
    }

    /**
     * Make a formatted markdown for the given documentation item.
     */
    private static makeHover(item: TemplateDocumentationItem): Hover {
        let hovertext: MarkdownString[] = [];

        if (item.signature) {
            let signature = new MarkdownString();
            let signatureText = item.category ? '(' + item.category + ') ' + item.signature : item.signature;
            hovertext.push(signature.appendMarkdown(['```dftemplate', signatureText, '```', ''].join(EOL)));
        }

        if (item.summary) {
            let summary = new MarkdownString();
            hovertext.push(summary.appendMarkdown(item.summary));
        }

        if (item.parameters) {
            let parameters: string[] = [];
            item.parameters.forEach(parameter => {
                parameters.push('*@param* `' + parameter.name + '` - ' + parameter.description);
            });
            hovertext.push(new MarkdownString(parameters.join('\n\n')));
        }

        return new Hover(hovertext);
    }

    /**
     * Get a description for symbol according to prefix and type.
     */
    private static getSymbolDescription(symbol: string, type: string): string {
        const variation = parser.getSupportedSymbolVariations(symbol, type, x => '`' + x + '`').find(x => x.word === symbol);
        return variation ? variation.description + '.' : 'Undefined value for the type `' + type + '`.';
    }
}