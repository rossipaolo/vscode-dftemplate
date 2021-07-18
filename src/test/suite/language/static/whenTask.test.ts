/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as assert from 'assert';
import { ActionDetails, ActionInfo, QuestResourceCategory } from '../../../../language/static/common';
import { tryParseWhenTaskCondition } from '../../../../language/static/whenTask';

suite('When Task Test Suite', () => {
    test('tryParseWhenTaskCondition test', () => {
        const text: string = 'when _task_ and not _otherTask_';
        const actionInfo: ActionInfo | undefined = tryParseWhenTaskCondition(text);
        if (actionInfo === undefined) {
            assert.fail('actionInfo is undefined.')
        } else {
            assert.strictEqual(actionInfo.moduleName, 'Daggerfall');
            assert.strictEqual(actionInfo.category, QuestResourceCategory.Condition);
            const actionDetails: ActionDetails = actionInfo.details;
            assert.strictEqual(actionDetails.summary, 'A special condition that provides a boolean expression; checks set/unset state of tasks.');
            assert.strictEqual(actionDetails.overloads.length, 1);
            assert.strictEqual(actionDetails.overloads[0], 'when ${1:task} and not ${2:task}');
            assert.strictEqual(actionDetails.sourceName, 'WhenTask');
        }
    });
});