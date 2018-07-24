/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';

import { ExtensionContext, TextDocument, Position, CompletionItem } from 'vscode';
import { loadTable } from '../extension';
import { Parser } from '../language/parser';
import { Modules } from '../language/modules';

class AttributeItem{
    public attribute:string = '';
    public values:string[] = [];
}

export class TemplateCompletionItemProvider implements vscode.CompletionItemProvider {
    
    private attributes:AttributeItem[] = [];

    constructor(context: ExtensionContext) {
        loadTable(context, 'tables/attributes.json').then((obj) => {
            this.attributes = obj;
        });
    }

    public provideCompletionItems(document: TextDocument, position: Position):Thenable<CompletionItem[]> {
        let instance:TemplateCompletionItemProvider = this;
        return new Promise(function(resolve, reject) {         
            let line = document.lineAt(position.line);
            let text = line.text.substring(0, line.text.length - 2);

            // attributes
            for (let i = 0; i < instance.attributes.length; i++) {
                let attributeItem = instance.attributes[i];
                if (text.endsWith(attributeItem.attribute)){
                    let items:CompletionItem[] = [];
                    for(let j = 0; j < attributeItem.values.length; j++){
                        items[j] = new vscode.CompletionItem(attributeItem.values[j], vscode.CompletionItemKind.Constant);
                    }
                    return resolve(items);
                }
            }

            // quests
            if (Parser.isQuest(document.lineAt(position.line).text)) {
                return Parser.findLinesInAllfiles(Parser.questDefinitionPattern, true).then(results => {
                    let items: CompletionItem[] = [];
                    for (const result of results) {
                        let idLIne = Parser.findLine(result.document, Parser.questDefinitionPattern);
                        if (idLIne) {
                            let id = Parser.questDefinitionPattern.exec(idLIne.text);
                            if (id) {
                                let item = new CompletionItem(id[2], vscode.CompletionItemKind.Class);
                                let nameLine = Parser.findLine(result.document, Parser.displayNamePattern);
                                if (nameLine) {
                                    let displayName = Parser.displayNamePattern.exec(nameLine.text);
                                    if (displayName) {
                                        item.detail = displayName[1];
                                    }
                                }
                                items.push(item);
                            }
                        }
                    }

                    return items.length > 0 ? resolve(items) : reject();
                }, () => { return reject(); });
            }

            // actions
            let items: CompletionItem[] = [];
            for (const result of Modules.getInstance().findActions(line.text.substring(line.text.length - 1))) {
                for (const overload of result.action.overloads) {
                    let signature = Modules.prettySignature(overload);
                    let kind = result.actionKind === Modules.ActionKind.Action ? vscode.CompletionItemKind.Method : vscode.CompletionItemKind.Event;
                    let item = new vscode.CompletionItem(signature, kind);
                    item.insertText = new vscode.SnippetString(overload);
                    item.detail = result.moduleName + ' -> ' + signature;
                    item.documentation = result.action.summary;
                    items.push(item);
                }
            }
            if (items.length > 0) {
                return resolve(items);
            }

            return reject();
        });
    }
}