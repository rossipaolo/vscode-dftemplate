/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as assert from 'assert';
import { parseCsvTable } from '../../../../language/static/tables';

suite('Tables Test Suite', () => {
    test('parseCsvTable test', () => {
        const content: string[][] = parseCsvTable([
            'schema: *name,p1,p2,p3',
            '',
            '--	Location classes for the Places section of a Qbn file.',
            'shop,               0, -1, 2',
            'house,              0, -1, 1'
        ]);

        assert.strictEqual(content.length, 2);
        assert.deepStrictEqual(content[0], ['shop', '0', '-1', '2']);
        assert.deepStrictEqual(content[1], ['house', '0', '-1', '1']);
    });
});