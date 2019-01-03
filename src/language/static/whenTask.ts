/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import { ActionInfo } from "./common";

/**
 * Tries to parse an action with signature of `when task` condition.
 * @param text An action invocation.
 * @returns An action result if parse succesful.
 */
export function tryParseWhenTaskCondition(text: string): ActionInfo | undefined {
    if (/^\s*when( not)? [a-zA-Z0-9_.]+( (and|or)( not)? [a-zA-Z0-9_.]+)*/.test(text)) {
        return {
            moduleName: 'Daggerfall',
            actionKind: 'condition',
            details: {
                summary: 'A special condition that provides a boolean expression; checks set/unset state of tasks.',
                overloads: [makeSignature(text)]
            },
            overload: 0,
        };
    }
}

/**
 * Makes a signature for the given invocation.
 * @param text An invocation of `when task`.
 */
function makeSignature(text: string) {
    let signature = '';
    let arg: number = 0;
    for (const word of text.trim().split(' ')) {
        switch (word) {
            case 'when':
                signature += 'when';
                break;
            case 'and':
            case 'or':
            case 'not':
                signature += ' ' + word;
                break;
            default:
                signature += ' ${' + arg++ + ':task}';
                break;
        }
    }
    return signature;
}