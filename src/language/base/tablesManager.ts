/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

// Standard variables for signatures in modules.
// Might be used for diagnostic in the future.
// SYMBOL_ANY = '_symbol_';
// SYMBOL_PERSON = '_person_';
// SYMBOL_ITEM = '_item_';
// SYMBOL_FOE = '_foe_';
// SYMBOL_CLOCK = '_clock_';
// NUMBER_GENERIC = 'dd';
// NUMBER_HOUR = 'hh';
// NUMBER_MINUTES = 'mm';
// STRING = 'ww';
// MESSAGE_ANY = 'message';
// MESSAGE_ID = 'messageID';
// MESSAGE_NAME = 'messageName';
// TASK = 'task';
// QUEST_INDEX = 'questID';
// QUEST_NAME = 'questName';

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
        signature = signature.replace(/\${\d\|/g, '(').replace(/\|}/g, ')').replace(/,/g, '|'); // ${d|a,b|} -> (a|b)
        signature = signature.replace(/\${\d:[a-zA-Z0-9_]+?}/g, '[a-zA-Z0-9_-]+');              // ${d:a}    -> [a-zA-Z0-9_-]+
        return new RegExp('^\\s*' + signature + '\\s*$');
    }
}