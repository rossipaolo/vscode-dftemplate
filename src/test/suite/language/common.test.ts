/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as assert from 'assert';
import * as vscode from 'vscode';
import { Range } from 'vscode';
import { Action, Directive, Parameter, Symbol, Task } from '../../../language/common';
import { QuestResourceDetails, SymbolInfo, SymbolType } from '../../../language/static/common';
import { Language, LanguageTable } from '../../../language/static/language';
import { Module, Modules } from '../../../language/static/modules';
import { Tables } from '../../../language/static/tables';
import { tasks } from '../../../parser';

suite('Language Test Suite', () => {
    let textDocument: vscode.TextDocument;
    let tables: Tables;
    let language: Language;
    let modules: Modules;

    setup(async () => {
        textDocument = await vscode.workspace.openTextDocument({
            content: [
                '  Quest: QUESTNAME ',
                '  Foe _spider_ is Spider  ',
                ' _task_ task:',
                '    clicked npc _npc_  '
            ].join('\n')
        });

        tables = new Tables();
        language = new Language(tables);
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
        modules = new Modules();
        await modules.load({
            loadModules(_: readonly string[]): Promise<Module[]> {
                const modules: Module[] = [{
                    displayName: 'Test',
                    conditions: [{
                        summary: '',
                        overloads: ['clicked npc ${1:_person_}']
                    }]
                }];
                return Promise.resolve(modules);
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

    test('Task test', () => {
        const task: Task | undefined = Task.parse(textDocument.lineAt(2), tables);
        if (task === undefined) {
            assert.fail('task is undefined.');
        } else {
            assert.strictEqual(task.name, '_task_');
            assert.strictEqual(task.range.isEqual(new Range(2, 1, 2, 7)), true, 'range is not equal.');
            assert.strictEqual(task.blockRange.isEqual(new Range(2, 1, 2, 13)), true, 'block range is not equal.');
            const definition: tasks.TaskDefinition = task.definition;
            assert.strictEqual(definition.symbol, '_task_');
            assert.strictEqual(definition.type, tasks.TaskType.Standard);
            assert.strictEqual(definition.globalVarName, undefined);
            assert.strictEqual(task.isVariable, false);
        }
    });

    test('Action test', () => {
        const action: Action | undefined = Action.parse(textDocument.lineAt(3), modules);
        if (action === undefined) {
            assert.fail('action is undefined.');
        } else {
            const signature: readonly Parameter[] | undefined = action.signature;
            if (signature === undefined) {
                assert.fail('signature is undefined.');
            } else {
                assert.strictEqual(signature.length, 3);
                assert.strictEqual(signature[0].type, 'clicked');
                assert.strictEqual(signature[0].value, 'clicked');
                assert.strictEqual(signature[1].type, 'npc');
                assert.strictEqual(signature[1].value, 'npc');
                assert.strictEqual(signature[2].type, '${_person_}');
                assert.strictEqual(signature[2].value, '_npc_');
            }
            assert.strictEqual(action.range.isEqual(new Range(3, 4, 3, 11)), true, 'range is not equal.');
            assert.strictEqual(action.blockRange.isEqual(new Range(3, 4, 3, 21)), true, 'block range is not equal.');
            assert.strictEqual(action.getRange().isEqual(new Range(3, 4, 3, 21)), true, 'getRange() is not equal.');
            assert.strictEqual(action.getRange(0).isEqual(new Range(3, 4, 3, 11)), true, 'getRange(0) is not equal.');
            assert.strictEqual(action.getRange(1).isEqual(new Range(3, 12, 3, 15)), true, 'getRange(1) is not equal.');
            assert.strictEqual(action.getRange(2).isEqual(new Range(3, 16, 3, 21)), true, 'getRange(2) is not equal.');
            assert.strictEqual(action.getName(), 'clicked');
            assert.strictEqual(action.getFullName(), 'clicked npc _person_');
            assert.strictEqual(action.isInvocationOf('clicked', 'npc', '${_person_}'), true);
        }
    });

    test('Task block test', () => {
        const task: Task | undefined = Task.parse(textDocument.lineAt(2), tables);
        if (task === undefined) {
            assert.fail('task is undefined.');
        } else {
            const action: Action | undefined = Action.parse(textDocument.lineAt(3), modules);
            if (action === undefined) {
                assert.fail('action is undefined.');
            } else {
                task.actions.push(action);
                assert.strictEqual(task.range.isEqual(new Range(2, 1, 2, 7)), true, 'range is not equal.');
                assert.strictEqual(task.blockRange.isEqual(new Range(2, 1, 3, 21)), true, 'block range is not equal.');
                assert.strictEqual(task.hasAnyCondition(modules), true, 'hasAnyCondition() is not true.');
                assert.strictEqual(task.isValidSubRange(action.blockRange), true, 'block range is not a valid subrange.');
                assert.strictEqual(task.isValidSubRange(action.range), false, 'task range is a valid subrange.');
            }
        }
    });
});