/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { ActionInfo } from './common';

/**
 * Manages tables with language data for intellisense features.
 */
export abstract class StaticData {

    /**
     * Convert a snippet string to a pretty signature definition.
     * @example '${1:example}' -> 'example'
     */
    public static prettySignature(signature: string): string {
        return signature.replace(/\${\d(:|\|)?/g, '').replace(/\|?}/g, '');
    }

    /**
     * Convert a snippet string to a standard signature definition.
     * @example '${1:example}' -> '${example}'
     */
    public static formatParameter(word: string): string {
        return word.replace(/\$\{\d:(\.\.\.)?/, '${');
    }

    /**
     * Gets the index of a parameter inside an invocation.
     * @param text A string with an invocation.
     * @param word A word in the invocation.
     * @returns `word` position as index or -1.
     */
    public static getWordIndex(text: string, word: string): number {
        return text.trim().split(' ').indexOf(word);
    }

    /**
     * Checks if action signature has at least one of the given parameter types at the given position.
     * @param action An action result.
     * @param index Index of the parameter.
     * @param parameters Parameters as signature words.
     */
    public static actionHasParameterAtPosition(action: ActionInfo, index: number, ...parameters: string[]): boolean {
        return parameters.indexOf(action.details.overloads[action.overload].split(' ')[index].replace(/\$\{\d:/, '${')) !== -1;
    }

    /**
     * Gets the parameter signature at the given position.
     * @param action An action result.
     * @param index Index of the parameter. Can be a virtual index if marked as params.
     */
    public static getParameterAtPosition(action: ActionInfo, index: number): string | undefined {
        const signatureWords = action.details.overloads[action.overload].split(' ');
        if (index > 0 && index < signatureWords.length) {
            return StaticData.formatParameter(signatureWords[index]);
        } else if (index >= signatureWords.length && /^\$\{\d:\.\.\./.test(signatureWords[signatureWords.length - 1])) {
            return StaticData.formatParameter(signatureWords[signatureWords.length - 1]);
        }
    }

    /**
     * Convert a snippet string to a regular expression that matches the signature.
     */
    protected static makeRegexFromSignature(signature: string): RegExp {        
        // params: allows the last variable to be repeated
        if (/\$\{\d:\.\.\.[a-zA-Z0-9_-]+\}$/.test(signature)) {
           signature = signature.substring(0, signature.lastIndexOf(' ')) + "(\\s+[a-zA-Z0-9_\\-\\+'\\.]+)+";
        }
        
        signature = signature.replace(/\$\{\d\|/g, '(').replace(/\|\}/g, ')').replace(/,/g, '|');           // ${d|a,b|} -> (a|b)
        signature = signature.replace(/\$\{\d:[a-zA-Z0-9_-]+?\}/g, "[a-zA-Z0-9_\\-\\+'\\.]+");              // ${d:a}    -> [a-zA-Z0-9_-]+    
        return new RegExp('^\\s*' + signature + '\\s*$');
    }

    protected static async parseFromJson(fullPath: string): Promise<any> {
        const document = await vscode.workspace.openTextDocument(fullPath);
        return JSON.parse(document.getText());
    }
}