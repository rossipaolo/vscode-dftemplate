/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';

/**
 * Manages tables with language data for intellisense features.
 */
export abstract class TablesManager {

    /**
     * Convert a snippet string to a pretty signature definition.
     */
    public static prettySignature(signature: string): string {
        return signature.replace(/\${\d(:|\|)?/g, '').replace(/\|?}/g, '');
    }

    /**
     * Convert a snippet string to a regular expression that matches the signature.
     */
    protected static makeRegexFromSignature(signature: string): RegExp {
        signature = signature.replace('+', '\\+');
        
        // params: allows the last variable to be repeated
        if (/\$\{\d:\.\.\.[a-zA-Z0-9_-]+\}$/.test(signature)) {
           signature = signature.substring(0, signature.lastIndexOf(' ')) + "(\\s+[a-zA-Z0-9_\\-'\\.]+)+";
        }
        
        signature = signature.replace(/\$\{\d\|/g, '(').replace(/\|\}/g, ')').replace(/,/g, '|');     // ${d|a,b|} -> (a|b)
        signature = signature.replace(/\$\{\d:[a-zA-Z0-9_-]+?\}/g, "[a-zA-Z0-9_\\-'\\.]+");           // ${d:a}    -> [a-zA-Z0-9_-]+    
        return new RegExp('^\\s*' + signature + '\\s*$');
    }

    protected static parseFromJson(fullPath: string): Thenable<any> {
        return vscode.workspace.openTextDocument(fullPath).then((document) => {
            let obj = JSON.parse(document.getText());
            if (obj) {
                return obj;
            }
        }, () => console.log('Failed to parse ' + fullPath));
    }
}