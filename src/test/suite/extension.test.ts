/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { Position } from 'vscode';
import { LanguageData } from '../../language/static/languageData';
import { IContext } from '../../extension';
import { Quests } from '../../language/quests';
import { TemplateDefinitionProvider } from '../../providers/definitionProvider';
import { TemplateReferenceProvider } from '../../providers/referenceProvider';
import { TemplateHoverProvider } from '../../providers/hoverProvider';

suite('Extension Test Suite', () => {

    let context: IContext;
    let data: LanguageData;
    let quests: Quests;
    let uri: vscode.Uri;
    let textDocument: vscode.TextDocument;
    let token: vscode.CancellationToken;

    suiteSetup(async () => {
        const tablesPath = vscode.workspace.getConfiguration('dftemplate').get<string>('tablesPath');
        if (tablesPath === undefined) {
            throw new Error("Can't run tests if dftemplate.tablesPath is not set.");
        }

        context = {
            subscriptions: [],
            extensionPath: path.join(__dirname, '../../..')
        };
        data = await LanguageData.load(context);
        quests = new Quests(data);
        uri = vscode.Uri.file(path.join(context.extensionPath, 'src', 'test', 'suite', 'TEST.txt'));
        textDocument = await vscode.workspace.openTextDocument(uri);
        const tokenSource = new vscode.CancellationTokenSource();
        token = tokenSource.token;
    });

    suiteTeardown(() => {
        for (const subscription of context.subscriptions) {
            subscription.dispose();
        }
    });

    test('DefinitionProvider', async () => {
        const provider = new TemplateDefinitionProvider(quests, data);

        const testCases: [Position, Position][] = [
            [new Position(16, 9), new Position(13, 9)],
            [new Position(17, 12), new Position(11, 5)],
            [new Position(18, 8), new Position(4, 10)],
            [new Position(6, 34), new Position(11, 5)]
        ];

        await Promise.all(testCases.map(async ([position, expectedPosition]) => {
            const definitionInfo = await provider.provideDefinition(textDocument, position, token) as vscode.Location | undefined;
            if (definitionInfo === undefined) {
                assert.fail('definitionInfo is undefined.');
            }

            assert.strictEqual(definitionInfo.uri.path.toLowerCase(), uri.path.toLowerCase());
            assert.strictEqual(definitionInfo.range.start.line, expectedPosition.line);
            assert.strictEqual(definitionInfo.range.start.character, expectedPosition.character);
        }));
    });

    test('ReferenceProvider', async () => {
        const provider = new TemplateReferenceProvider(quests);

        const testCases: [Position, Position[]][] = [
            [new Position(6, 34), [new Position(6, 34), new Position(17, 12)]],
            [new Position(13, 9), [new Position(16, 9)]]
        ];

        await Promise.all(testCases.map(async ([position, expectedReferences]) => {
            const references = await provider.provideReferences(textDocument, position, { includeDeclaration: false }, token);
            if (references === undefined) {
                assert.fail('references result is undefined.');
            }

            assert.strictEqual(references.length, expectedReferences.length);
            for (let index = 0; index < references.length; index++) {
                const reference = references[index];
                const expectedReference = expectedReferences[index];
                assert.strictEqual(reference.uri.path.toLowerCase(), uri.path.toLowerCase());
                assert.strictEqual(reference.range.start.line, expectedReference.line);
                assert.strictEqual(reference.range.start.character, expectedReference.character);
            }
        }));
    });

    test('HoverProvider', async () => {
        const provider = new TemplateHoverProvider(data, quests);

        const hover = await provider.provideHover(textDocument, new Position(11, 5), token);
        if (hover === undefined) {
            assert.fail('hover is undefined.');
        }

        assert.strictEqual(hover.contents.length, 2);
        assert.strictEqual((hover.contents[0] as vscode.MarkdownString).value, '\n```dftemplate\n(symbol) Item _gold_ gold range 1 to 1\n```\n');
        assert.strictEqual((hover.contents[1] as vscode.MarkdownString).value, 'Item description');
    });
});