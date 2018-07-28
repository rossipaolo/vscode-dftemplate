/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

/**
 * A special condition that provides a boolean expression.
 * Checks state of variables, meaning tasks wich are only set or unset.
 */
export var BooleanExpression = {

    /**
     * Matches a line. Return true if corresponds to a boolean expression.
     */
    match: (prefix: string, line: string): boolean =>
        prefix === 'when' && /^\s*when( not)? [a-zA-Z0-9_.]+( (and|or)( not)? [a-zA-Z0-9_.]+)*/.test(line),

    /**
     * Makes an action result with a signature that matches the given line.
     */
    makeResult: (line: string) => {
        return {
            moduleName: 'Daggerfall',
            actionKind: 'condition',
            action: {
                summary: 'A special condition that provides a boolean expression. ' +
                    'Checks state of variables, meaning tasks wich are only set or unset.',
                overloads: [
                    (() => {
                        let signature = '';
                        let arg: number = 0;
                        for (const word of line.trim().split(' ')) {
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
                    })()
                ]
            },
            overload: 0,
        };
    }
};