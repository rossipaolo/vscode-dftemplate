/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as assert from 'assert';
import * as vscode from 'vscode';
import { Range } from 'vscode';
import { Directive } from '../../../language/common';
import { QuestResourceDetails, SymbolInfo } from '../../../language/static/common';
import { Language, LanguageTable } from '../../../language/static/language';
import { Tables } from '../../../language/static/tables';

suite('Language Test Suite', () => {
    let textDocument: vscode.TextDocument;
    let language: Language;

    setup(async () => {
        textDocument = await vscode.workspace.openTextDocument({
            content: '  Quest: QUESTNAME \n'
        });

        language = new Language(new Tables());
        language.load({
            loadTable(): Promise<LanguageTable> {
                const directives: Map<string, QuestResourceDetails> = new Map();
                directives.set('Quest', { summary: '', signature: 'Quest: ${1:pattern}' })

                return Promise.resolve({
                    symbols: new Map(),
                    symbolsVariations: new Map(),
                    directives: directives,
                    messages: new Map(),
                });
            },

            loadDefinitions(): Promise<Map<string, SymbolInfo[]>> {
                return Promise.resolve(new Map());
            }
        });
    });

    test('Directive test', () => {
        const directive: Directive | undefined = Directive.parse(textDocument.lineAt(0), language);
        if (directive === undefined) {
            assert.fail('directive is undefined.');
        } else {
            assert.strictEqual(directive.name, 'Quest');
            assert.deepStrictEqual(directive.parameter, { type: '${pattern}', value: 'QUESTNAME' });
            assert.strictEqual(directive.range.isEqual(new Range(0, 2, 0, 7)), true, 'range is not equal.');
            assert.strictEqual(directive.blockRange.isEqual(new Range(0, 2, 0, 18)), true, 'block range is not equal.');
            assert.strictEqual(directive.valueRange.isEqual(new Range(0, 9, 0, 18)), true, 'value range is not equal.');
        }
    });
});