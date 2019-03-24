/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parsers/parser';

import { HoverProvider, Hover, TextDocument, Position, MarkdownString, CancellationToken } from 'vscode';
import { EOL } from 'os';
import { Modules } from '../language/static/modules';
import { Language } from '../language/static/language';
import { QuestResourceCategory } from '../language/static/common';

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

    public provideHover(document: TextDocument, position: Position, token: CancellationToken): Thenable<Hover> {
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
                        item.summary = TemplateHoverProvider.getSymbolDescription(document, word, definition);
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
                            return resolve(instance.provideHover(document, new Position(line.lineNumber, 0), token));
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
                    const item = new TemplateDocumentationItem();
                    item.category = QuestResourceCategory[languageItem.category].toLowerCase();
                    item.signature = Language.prettySignature(languageItem.details.signature);
                    item.summary = languageItem.details.summary;
                    return resolve(TemplateHoverProvider.makeHover(item));
                }

                // Seek quest
                if (word !== 'start' && parser.isQuestReference(document.lineAt(position.line).text)) {
                    return parser.findQuestDefinition(word, token).then((quest) => {
                        let item = new TemplateDocumentationItem();
                        item.category = 'quest';
                        item.signature = 'Quest: ' + quest.pattern;
                        item.summary = quest.displayName;
                        return resolve(TemplateHoverProvider.makeHover(item));
                    }, () => reject());
                }

                // Actions
                const result = Modules.getInstance().findAction(document.lineAt(position.line).text, word);
                if (result && Modules.isActionName(result, word)) {
                    const item = new TemplateDocumentationItem();
                    item.category = QuestResourceCategory[result.category].toLowerCase();
                    let signature = result.moduleName + ' -> ' + result.getSignature();
                    if (result.details.overloads.length > 1) {
                        signature += '\n\nother overload(s):';
                        for (let i = 0; i < result.details.overloads.length; i++) {
                            if (i !== result.overload) {
                                signature += '\n' + result.details.overloads[i];
                            }
                        }
                    }
                    item.signature = Modules.prettySignature(signature);
                    item.summary = result.details.summary;
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
        const hovertext: MarkdownString[] = [];

        if (item.signature) {
            const signature = new MarkdownString();
            signature.appendCodeblock(item.category ? '(' + item.category + ') ' + item.signature : item.signature, 'dftemplate');
            hovertext.push(signature);
        }

        if (item.summary) {
            const summaryLines: string[] = [];

            summaryLines.push(item.summary);
            if (item.parameters) {
                item.parameters.map(x => '*@param* `' + x.name + '` - ' + x.description).forEach(x => summaryLines.push(x));
            }

            hovertext.push(new MarkdownString(summaryLines.join(EOL.repeat(2))));
        }

        return new Hover(hovertext);
    }
    
    /**
     * Get the summary and a description for symbol according to prefix and type.
     */
    private static getSymbolDescription(document: TextDocument, name: string, symbol: parser.Symbol): string {
        const variation = Language.getInstance().getSymbolVariations(name, symbol.type, x => '`' + x + '`').find(x => x.word === name);

        const summary = parser.makeSummary(document, symbol.location.range.start.line);
        const meaning = variation ? variation.description + '.' : 'Undefined value for the type `' + symbol.type + '`.';

        return summary ? [summary, meaning].join(EOL.repeat(2)) : meaning;
    }
}