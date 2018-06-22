/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';

import { ExtensionContext, TextDocument, Position, CompletionItem } from 'vscode';
import { loadTable } from '../extension';

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
            return reject();
        });
    }
}