/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import { ExtensionContext, HoverProvider, Hover, TextDocument, Position, MarkdownString } from 'vscode';
import { EOL } from 'os';
import { loadTable } from '../extension';
import { Parser, Types } from '../language/parser';

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

    private documentation = new Map<string, TemplateDocumentationItem>();

    constructor(context: ExtensionContext) {
        loadTable(context, 'tables/documentation.json').then((obj) => {
            for (let k of Object.keys(obj)) {
                this.documentation.set(k, obj[k]);
            }
        });
    }

    public provideHover(document: TextDocument, position: Position): Thenable<Hover> {     
        let instance:TemplateHoverProvider = this;
        return new Promise(function (resolve, reject) {
            let word = Parser.getWord(document, position);
            if (word) {
                // If is a symbol, show description according to prefix.
                if (Parser.isSymbol(word)) {
                    let definition = Parser.findDefinition(document, word);
                    if (definition) {
                        let item = new TemplateDocumentationItem();
                        item.category = 'symbol';
                        item.signature = document.lineAt(definition.location.range.start.line).text;
                        item.summary = TemplateHoverProvider.getSymbolDescription(word, definition.type);
                        return resolve(TemplateHoverProvider.makeHover(item));
                    }
                }

                // Seek message from number
                if (!isNaN(Number(word))) {                
                    
                    // Default message
                    let line = Parser.findLine(document, new RegExp('\\[\\s*' + word + '\\s*\\]', 'g'));
                    if (line) {
                        return resolve(instance.provideHover(document, new Position(line.lineNumber, 0)));         
                    }

                    // Additional message
                    line = Parser.findLine(document, new RegExp('^\\bMessage:\\s+' + word + '\\b', 'g'));
                    if (line) {
                        let item = new TemplateDocumentationItem();
                        item.category = 'message';
                        item.signature = line.text;
                        let comment = Parser.parseComment(document.lineAt(line.lineNumber - 1).text);
                        if (comment.isComment) {
                            item.summary = comment.text;
                        }
                        return resolve(TemplateHoverProvider.makeHover(item));
                    }
                }

                // Seek word in documentation file
                if (instance.documentation.has(word)) {
                    let item = instance.documentation.get(word);
                    if (item) {
                        return resolve(TemplateHoverProvider.makeHover(item));
                    }
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
            item.parameters.forEach(parameter => {
                let attributeText = new MarkdownString();
                hovertext.push(attributeText.appendMarkdown('*@param* `' + parameter.name + '` - ' + parameter.description));
            });
        }

        return new Hover(hovertext);
    }

    /**
     * Get a description for symbol according to prefix and type.
     */
    private static getSymbolDescription(symbol: string, type: string): string {
        if (symbol[0] === '_') {
            if (symbol.length > 1 && symbol[1] === '_') {
                if (symbol.length > 2 && symbol[2] === '_') {
                    if (symbol.length > 3 && symbol[3] === '_') {
                        if (type === Types.Place) {
                            return 'the name of the province where ' + this.formatSymbol(symbol, 3) + ' can be found.';
                        }
                    }
                    else {
                        if (type === Types.Place) {
                            return 'the dungeon name of ' + this.formatSymbol(symbol, 2) + '.';
                        }
                        else if (type === Types.Person) {
                            return 'the town name where ' + this.formatSymbol(symbol, 2) + ' can be found.';
                        }
                    }
                }
                else {
                    if (type === Types.Place) {
                        return 'the town where the shop ' + this.formatSymbol(symbol, 1) + ' can be found.';
                    }
                    else if (type === Types.Person) {
                        return 'the name of the house/shop in the town where ' + this.formatSymbol(symbol, 1) + ' can be found.';
                    }
                }
            }
            else {
                if (type === Types.Place) {
                    return 'the name of the shop ' + this.formatSymbol(symbol, 0) + '.';
                }
                else if (type === Types.Item || type === Types.Person || type === Types.Foe) {
                    return 'the name of ' + this.formatSymbol(symbol, 0) + '.';
                }
                else if (type === Types.Clock) {
                    return 'base definition of ' + this.formatSymbol(symbol, 0) + ' (use `=' + Parser.getSymbolName(symbol) + '_` to get the clock time).';
                }
            }
        }
        else if (symbol[0] === '=') {
            if (symbol.length > 1 && symbol[1] === '=') {
                if (type === Types.Person || type === Types.Foe) {
                    return 'The faction association of ' + this.formatSymbol(symbol, 1) + '.';
                }
            }
            else {
                if (type === Types.Person) {
                    return 'character class of ' + this.formatSymbol(symbol, 0);
                }
                else if (type === Types.Foe) {
                    return this.formatSymbol(symbol, 0) + "'s name.";
                }
                else if (type === Types.Clock) {
                    return 'the number of days ' + this.formatSymbol(symbol, 0) + ' will be active.';
                }
            }
        }

        return 'undefined value for the type `' + type + '`.';
    }

    /**
     * MarkDown format a symbol name from one of its derived form.
     * 
     * @param derived derived form of symbol
     * @param leftIndex index of char on the left of symbol name (nearest _ or =).
     */
    private static formatSymbol(derived: string, leftIndex: number): string {
        return '`' + derived.substring(leftIndex + 1, derived.length - 1) + '`';
    }
}