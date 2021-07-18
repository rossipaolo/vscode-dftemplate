/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as assert from 'assert';
import { ActionDetails, ActionInfo, QuestResourceCategory } from '../../../../language/static/common';

suite('Static Language Test Suite', () => {
    test('ActionInfo test', () => {
        const actionDetails: ActionDetails = {
            summary: 'Triggers when the player character clicks on an item.',
            overloads: [
                'clicked item ${1:_item_}',
                'clicked item ${1:_item_} say ${2:message}'
            ]
        };

        const actionInfo0: ActionInfo = new ActionInfo('Name', QuestResourceCategory.Action, actionDetails);
        const actionInfo1: ActionInfo = new ActionInfo('Name', QuestResourceCategory.Action, actionDetails, 1);
        
        assert.strictEqual(actionInfo1.getSignature(), 'clicked item ${1:_item_} say ${2:message}');
        assert.strictEqual(actionInfo1.getSummary(), 'Triggers when the player character clicks on an item.');
        assert.strictEqual(actionInfo1.isObsolete(), false);
        assert.strictEqual(actionInfo0.isSameAction(actionInfo1), true);
    });
});