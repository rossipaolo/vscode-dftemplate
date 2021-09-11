/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as assert from 'assert';
import { Range } from 'vscode';
import { Parameter } from '../../../language/common';
import { Qbn } from '../../../language/qbn';
import { Symbol } from '../../../language/resources';
import { QuestToken, SymbolNode } from '../../../parser';

suite('QBN Test Suite', () => {
    test('getParameter() test', () => {
        const symbolNode: SymbolNode = {
            range: new Range(0, 0, 0, 22),
            type: new QuestToken(0, 0, 'Foe'),
            name: new QuestToken(0, 4, '_spider_'),
            pattern: new QuestToken(0, 13, 'is Spider')
        };

        const signature: readonly Parameter[] = [{
            type: '${foe}',
            value: 'Spider'
        }];

        const qbn: Qbn = new Qbn();
        qbn.symbols.set('_place_', new Symbol(symbolNode, signature));
        const parameter: Parameter | undefined = qbn.getParameter(new Range(0, 16, 0, 22));
        assert.deepStrictEqual(parameter, signature[0]);
    });
});