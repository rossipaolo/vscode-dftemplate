/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as assert from 'assert';
import * as vscode from 'vscode';
import { Range } from 'vscode';
import { Directive, Parameter, Symbol } from '../../../language/common';
import { QuestResourceDetails, SymbolInfo, SymbolType } from '../../../language/static/common';
import { Language, LanguageTable } from '../../../language/static/language';
import { Tables } from '../../../language/static/tables';

suite('Language Test Suite', () => {
    let textDocument: vscode.TextDocument;
    let language: Language;

    setup(async () => {
        textDocument = await vscode.workspace.openTextDocument({
            content: [
                '  Quest: QUESTNAME ',
                '  Foe _spider_ is Spider  '
            ].join('\n')
        });

        language = new Language(new Tables());
        await language.load({
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
                const definitions: Map<string, SymbolInfo[]> = new Map();
                definitions.set('Foe', [{
                    snippet: '',
                    match: '(Foe|foe) [a-zA-Z0-9_.-]+ is \\w+',
                    matches: [
                        {
                            regex: 'is (\\w+)',
                            signature: '${foe}'
                        }
                    ],
                    signature: '',
                    summary: '',
                    parameters: []
                }]);
                return Promise.resolve(definitions);
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

    test('Symbol test', () => {
        const symbol: Symbol | undefined = Symbol.parse(textDocument.lineAt(1), language);
        if (symbol === undefined) {
            assert.fail('symbol is undefined.');
        } else {
            assert.strictEqual(symbol.name, '_spider_');
            assert.strictEqual(symbol.type, SymbolType.Foe);
            const signature: readonly Parameter[] | undefined = symbol.signature;
            if (signature === undefined) {
                assert.fail('signature is undefined.');
            } else {
                assert.strictEqual(signature.length, 1);
                assert.strictEqual(signature[0].type, '${foe}');
                assert.strictEqual(signature[0].value, 'Spider');
            }
            assert.strictEqual(symbol.range.isEqual(new Range(1, 6, 1, 14)), true, 'range is not equal.');
            assert.strictEqual(symbol.blockRange.isEqual(new Range(1, 2, 1, 24)), true, 'block range is not equal.');
        }
    });
});