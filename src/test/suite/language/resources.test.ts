/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as assert from 'assert';
import * as vscode from 'vscode';
import { Range } from 'vscode';
import { Parameter } from '../../../language/common';
import { Action, Directive, Message, Symbol, Task } from '../../../language/resources';
import { QuestResourceDetails, SymbolInfo, SymbolType } from '../../../language/static/common';
import { Language, LanguageTable } from '../../../language/static/language';
import { Module, Modules } from '../../../language/static/modules';
import { Table, Tables } from '../../../language/static/tables';
import { BuiltinTypes, MessageBlockParser, NodeParser, TaskNode, TaskType } from '../../../parser';

suite('Resources Test Suite', () => {
    let textDocument: vscode.TextDocument;
    let tables: Tables;
    let language: Language;
    let modules: Modules;
    let nodeParser: NodeParser;

    setup(async () => {
        textDocument = await vscode.workspace.openTextDocument({
            content: [
                '  Quest: QUESTNAME ',
                '  Foe _spider_ is Spider  ',
                ' _task_ task:',
                '    clicked npc _npc_  ',
                ' Message:  1021 ',
                '<ce>  line 0',
                '<ce>  line 1  ',
                '   QuestorOffer:  [1000]  '
            ].join('\n')
        });

        tables = new Tables();
        await tables.load({
            loadTable<T extends Table>(table: T, tableName: string): Promise<void> {
                if (tableName === 'Quests-StaticMessages.txt') {
                    table.set([['1000', 'QuestorOffer']]);
                }

                return Promise.resolve();
            }
        });
        language = new Language(tables);
        await language.load({
            loadTable(): Promise<LanguageTable> {
                const directives: Map<string, QuestResourceDetails> = new Map();
                directives.set('Quest', { summary: '', signature: 'Quest: ${1:pattern}' })

                const messages: Map<string, string> = new Map();
                messages.set('1000', 'What the questor says when the PC makes contact for the quest.');

                return Promise.resolve({
                    symbols: new Map(),
                    symbolsVariations: new Map(),
                    directives: directives,
                    messages: messages,
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
        nodeParser = new NodeParser(new BuiltinTypes(tables.globalVarsTable.globalVars));
    });

    test('Directive test', () => {
        const directive: Directive | undefined = Directive.parse(textDocument.lineAt(0), nodeParser, language);
        if (directive === undefined) {
            assert.fail('directive is undefined.');
        } else {
            assert.strictEqual(directive.name, 'Quest');
            assert.deepStrictEqual(directive.parameter, { type: '${pattern}', value: 'QUESTNAME' });
            assert.strictEqual(directive.range.isEqual(new Range(0, 2, 0, 7)), true, 'range is not equal.');
            assert.strictEqual(directive.blockRange.isEqual(new Range(0, 2, 0, 18)), true, 'block range is not equal.');
            const parameterRange = new Range(0, 9, 0, 18);
            assert.strictEqual(directive.node.content.range.isEqual(parameterRange), true, 'value range is not equal.');
            assert.strictEqual(directive.getRange(0).isEqual(parameterRange), true, 'parameter range is not equal.');
            assert.strictEqual(directive.fromRange(parameterRange), directive.parameter);
        }
    });

    test('Symbol test', () => {
        const symbol: Symbol | undefined = Symbol.parse(textDocument.lineAt(1), nodeParser, language);
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
                const parameter: Parameter = signature[0];
                assert.strictEqual(parameter.type, '${foe}');
                assert.strictEqual(parameter.value, 'Spider');
                const parameterRange = new Range(1, 18, 1, 24);
                assert.strictEqual(symbol.getRange(0)?.isEqual(parameterRange), true, 'index range is not equal');
                assert.strictEqual(symbol.getRange(parameter)?.isEqual(parameterRange), true, 'parameter range is not equal');
                assert.strictEqual(symbol.fromRange(parameterRange), parameter);
            }
            assert.strictEqual(symbol.range.isEqual(new Range(1, 6, 1, 14)), true, 'range is not equal.');
            assert.strictEqual(symbol.blockRange.isEqual(new Range(1, 2, 1, 24)), true, 'block range is not equal.');
        }
    });

    test('Task test', () => {
        const task: Task | undefined = Task.parse(textDocument.lineAt(2), nodeParser);
        if (task === undefined) {
            assert.fail('task is undefined.');
        } else {
            assert.strictEqual(task.name, '_task_');
            assert.strictEqual(task.range.isEqual(new Range(2, 1, 2, 7)), true, 'range is not equal.');
            assert.strictEqual(task.blockRange.isEqual(new Range(2, 1, 2, 13)), true, 'block range is not equal.');
            const definition: TaskNode = task.node;
            assert.strictEqual(definition.symbol.value, '_task_');
            assert.strictEqual(definition.type, TaskType.Standard);
            assert.strictEqual(definition.globalVarName, undefined);
            assert.strictEqual(task.isVariable, false);
        }
    });

    test('Action test', () => {
        const action: Action | undefined = Action.parse(textDocument.lineAt(3), nodeParser, modules);
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

                const parameter: Parameter = signature[2];
                const parameterRange = new Range(3, 16, 3, 21);
                assert.strictEqual(action.getRange(2)?.isEqual(parameterRange), true, 'parameter range is not equal');
                assert.strictEqual(action.fromRange(parameterRange), parameter);
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
        const task: Task | undefined = Task.parse(textDocument.lineAt(2), nodeParser);
        if (task === undefined) {
            assert.fail('task is undefined.');
        } else {
            const action: Action | undefined = Action.parse(textDocument.lineAt(3), nodeParser, modules);
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

    test('Message test', () => {
        const message: Message | undefined = Message.parse(textDocument.lineAt(4), nodeParser, language);
        if (message === undefined) {
            assert.fail('message is undefined.');
        } else {
            const messageBlockParser = new MessageBlockParser(textDocument, message.node);
            messageBlockParser.parseBodyLine(5);
            messageBlockParser.parseBodyLine(6);
            assert.strictEqual(message.id, 1021);
            assert.strictEqual(message.range.isEqual(new Range(4, 11, 4, 15)), true, 'range is not equal.');
            assert.strictEqual(message.blockRange.isEqual(new Range(4, 1, 6, 12)), true, 'block range is not equal.');
            assert.strictEqual(message.alias, undefined, 'alias is not undefined.');
            assert.strictEqual(message.aliasRange, undefined, 'alias range is not undefined.');
            assert.strictEqual(message.makeDocumentation(language, ''), '', 'static message documentation is not an empty string.');
            assert.strictEqual(message.makePreview(textDocument.getText(message.node.bodyRange), true), 'Message: 1021 \n\nline 0 line 1');
            assert.strictEqual(message.makePreview(textDocument.getText(message.node.bodyRange), false), 'Message: 1021 \nline 0 line 1');
        }
    });

    test('Static Message test', () => {
        const message: Message | undefined = Message.parse(textDocument.lineAt(7), nodeParser, language);
        if (message === undefined) {
            assert.fail('message is undefined.');
        } else {
            assert.strictEqual(message.id, 1000);
            assert.strictEqual(message.range.isEqual(new Range(7, 19, 7, 23)), true, 'range is not equal.');
            assert.strictEqual(message.blockRange.isEqual(new Range(7, 3, 7, 24)), true, 'block range is not equal.');
            assert.strictEqual(message.alias, 'QuestorOffer');
            if (message.aliasRange === undefined) {
                assert.fail('alias range is undefined.');
            } else {
                assert.strictEqual(message.aliasRange.isEqual(new Range(7, 3, 7, 15)), true, 'alias range is not equal.');
            }
            assert.strictEqual(message.makeDocumentation(language, ''), 'What the questor says when the PC makes contact for the quest.');
            assert.strictEqual(message.makePreview(textDocument.getText(message.node.bodyRange), false), 'QuestorOffer: [1000]');
        }
    });
});