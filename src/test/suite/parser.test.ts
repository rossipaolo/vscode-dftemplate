/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as assert from 'assert';
import * as vscode from 'vscode';
import { Position, Range, TextDocument } from 'vscode';
import { BuiltinTypes, DirectiveNode, MessageBlockParser, MessageNode, NodeParser, QuestToken, SymbolNode, TaskNode, TaskType } from '../../parser';

suite('Parser Test Suite', () => {
    let nodeParser: NodeParser;
    let document: TextDocument;

    setup(async () => {
        const globalVars = new Map();
        globalVars.set('Example', 1);
        nodeParser = new NodeParser(new BuiltinTypes(globalVars));

        document = await vscode.workspace.openTextDocument({
            content: [
                ' example  ',
                'DisplayName: Quest Display Name',
                'Message:  1020',
                '  <ce>  line 0',
                '<ce>  line 1',
                '',
                '',
                '  <ce> %abc line 0',
                '<ce>  _symbol_ line 1',
                '',
                '- comment',
                '  <ce>  line 0',
                '<ce>  line 1',
                '',
                'QuestComplete: [1004]',
                'Place _place_',
                '_task_ task:',
                'until _task_ performed:',
                'variable _var_',
                'Example _example_'
            ].join('\n')
        });
    });

    test('Token test', () => {
        const lineNumber: number = 0;
        const token: QuestToken = nodeParser.parseToken(document.lineAt(lineNumber));
        assert.strictEqual(token.position.isEqual(new Position(lineNumber, 1)), true);
        assert.strictEqual(token.value, 'example');
        assert.strictEqual(token.range.isEqual(new Range(lineNumber, 1, lineNumber, 8)), true);
    });

    test('Directive test', () => {
        const lineNumber: number = 1;
        const directiveNode: DirectiveNode | undefined = nodeParser.parseDirective(document.lineAt(lineNumber));
        if (directiveNode === undefined) {
            assert.fail('directiveNode is undefined.');
        } else {
            assert.strictEqual(directiveNode.range.isEqual(new Range(lineNumber, 0, lineNumber, 31)), true);
            assert.strictEqual(directiveNode.name.value, 'DisplayName');
            assert.strictEqual(directiveNode.name.position.isEqual(new Position(lineNumber, 0)), true);
            assert.strictEqual(directiveNode.content.value, 'Quest Display Name');
            assert.strictEqual(directiveNode.content.position.isEqual(new Position(lineNumber, 13)), true);
        }
    });

    test('Message test', () => {
        const lineNumber: number = 2;
        const messageNode: MessageNode | undefined = nodeParser.parseMessage(document.lineAt(lineNumber));
        if (messageNode === undefined) {
            assert.fail('messageDefinition is undefined.');
        } else {
            assert.strictEqual(messageNode.id.position.isEqual(new Position(lineNumber, 10)), true);
            assert.strictEqual(messageNode.id.value, '1020');
            assert.strictEqual(messageNode.alias, undefined);
        }
    });

    test('Static message test', () => {
        const lineNumber: number = 14;
        const messageNode: MessageNode | undefined = nodeParser.parseMessage(document.lineAt(lineNumber));
        if (messageNode === undefined) {
            assert.fail('messageDefinition is undefined.');
        } else {
            assert.strictEqual(messageNode.id.position.isEqual(new Position(lineNumber, 16)), true);
            assert.strictEqual(messageNode.id.value, '1004');
            assert.strictEqual(messageNode.alias?.position.isEqual(new Position(lineNumber, 0)), true);
            assert.strictEqual(messageNode.alias?.value, 'QuestComplete');
        }
    });

    test('Message block test', () => {
        const messageNode: MessageNode | undefined = nodeParser.parseMessage(document.lineAt(2));
        if (messageNode === undefined) {
            assert.fail('messageDefinition is undefined.');
        } else {
            let messageBlockParser = new MessageBlockParser(document, messageNode);
            for (let index = 3; index < 6; index++) {
                assert.strictEqual(messageBlockParser.isEndOfBlock(index), index === 5, `Line ${index} is not detected correctly.`);
            }

            messageBlockParser = new MessageBlockParser(document, messageNode);
            for (let index = 7; index < 10; index++) {
                const isEndOfBlock: boolean = messageBlockParser.isEndOfBlock(index);
                assert.strictEqual(isEndOfBlock, index === 9, `Line ${index} is not detected correctly.`);
                if (isEndOfBlock === false) {
                    messageBlockParser.parseBodyLine(index);
                }
            }

            assert.notStrictEqual(messageNode.macros, undefined);
            assert.strictEqual(messageNode.macros?.length, 1);
            assert.strictEqual(messageNode.macros[0].position.isEqual(new Position(7, 7)), true);
            assert.strictEqual(messageNode.macros[0].value, '%abc');

            assert.notStrictEqual(messageNode.symbols, undefined);
            assert.strictEqual(messageNode.symbols?.length, 1);
            assert.strictEqual(messageNode.symbols[0].position.isEqual(new Position(8, 6)), true);
            assert.strictEqual(messageNode.symbols[0].value, '_symbol_');

            messageBlockParser = new MessageBlockParser(document, messageNode);
            for (let index = 11; index < 14; index++) {
                assert.strictEqual(messageBlockParser.isEndOfBlock(index), index === 13, `Line ${index} is not detected correctly.`);
            }
        }
    });

    test('Symbol test', () => {
        const lineNumber: number = 15;
        const symbolNode: SymbolNode | undefined = nodeParser.parseSymbol(document.lineAt(lineNumber));
        if (symbolNode === undefined) {
            assert.fail('symbolDefinition is undefined.');
        } else {
            assert.strictEqual(symbolNode.type.position.isEqual(new Position(lineNumber, 0)), true);
            assert.strictEqual(symbolNode.type.value, 'Place');
            assert.strictEqual(symbolNode.name.position.isEqual(new Position(lineNumber, 6)), true)
            assert.strictEqual(symbolNode.name.value, '_place_');
        }
    });

    test('Task test', () => {
        const lineNumber: number = 16;
        const taskNode: TaskNode | undefined = nodeParser.parseTask(document.lineAt(lineNumber));
        if (taskNode === undefined) {
            assert.fail('taskDefinition is undefined.');
        } else {
            assert.strictEqual(taskNode.type, TaskType.Standard);
            assert.strictEqual(taskNode.symbol.position.isEqual(new Position(lineNumber, 0)), true);
            assert.strictEqual(taskNode.symbol.value, '_task_');
            assert.strictEqual(taskNode.globalVarName, undefined);
        }
    });

    test('PersistUntil task test', () => {
        const lineNumber: number = 17;
        const taskNode: TaskNode | undefined = nodeParser.parseTask(document.lineAt(lineNumber));
        if (taskNode === undefined) {
            assert.fail('taskDefinition is undefined.');
        } else {
            assert.strictEqual(taskNode.type, TaskType.PersistUntil);
            assert.strictEqual(taskNode.symbol.position.isEqual(new Position(lineNumber, 6)), true);
            assert.strictEqual(taskNode.symbol.value, '_task_');
            assert.strictEqual(taskNode.globalVarName, undefined);
        }
    });

    test('Variable test', () => {
        const lineNumber: number = 18;
        const taskNode: TaskNode | undefined = nodeParser.parseTask(document.lineAt(lineNumber));
        if (taskNode === undefined) {
            assert.fail('taskDefinition is undefined.');
        } else {
            assert.strictEqual(taskNode.type, TaskType.Variable);
            assert.strictEqual(taskNode.symbol.position.isEqual(new Position(lineNumber, 9)), true);
            assert.strictEqual(taskNode.symbol.value, '_var_');
            assert.strictEqual(taskNode.globalVarName, undefined);
        }
    });

    test('Global variable test', () => {
        const lineNumber: number = 19;
        const taskNode: TaskNode | undefined = nodeParser.parseTask(document.lineAt(lineNumber));
        if (taskNode === undefined) {
            assert.fail('taskDefinition is undefined.');
        } else {
            assert.strictEqual(taskNode.type, TaskType.GlobalVarLink);
            assert.strictEqual(taskNode.symbol.position.isEqual(new Position(lineNumber, 8)), true);
            assert.strictEqual(taskNode.symbol.value, '_example_');
            assert.strictEqual(taskNode.globalVarName?.position.isEqual(new Position(lineNumber, 0)), true);
            assert.strictEqual(taskNode.globalVarName?.value, 'Example');
        }
    });
});