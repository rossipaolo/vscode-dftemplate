/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parser';
import { ParameterTypes } from '../language/static/parameterTypes';
import { QuestResourceCategory } from '../language/static/common';
import { Quests } from '../language/quests';
import { TemplateReferenceProvider } from './referenceProvider';

export const tokenTypesLegend = new vscode.SemanticTokensLegend(['string', 'keyword', 'variable']);

export class TemplateDocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {

    public constructor(private readonly quests: Quests) {
    }

    provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.ProviderResult<vscode.SemanticTokens> {
        const quest = this.quests.getIfQuest(document);
        if (quest !== undefined && quest.qbn.found === true) {
            const builder = new vscode.SemanticTokensBuilder(tokenTypesLegend);

            for (const symbol of quest.qbn.iterateSymbols()) {
                if (symbol.signature !== undefined) {
                    for (const parameter of symbol.signature) {
                        if (ParameterTypes.isRawInput(parameter.type, parameter.value)) {
                            const range = symbol.getParameterRange(parameter);
                            if (range !== undefined) {
                                builder.push(range, 'string');
                            }
                        }
                    }
                }

                if (!parser.symbols.symbolFollowsNamingConventions(symbol.name)) {
                    for (const location of TemplateReferenceProvider.symbolReferences(quest, symbol, true)) {
                        builder.push(location.range, 'variable');
                    }
                }
            }

            for (const task of quest.qbn.iterateTasks()) {
                if (!parser.symbols.symbolFollowsNamingConventions(task.name)) {
                    for (const location of TemplateReferenceProvider.taskReferences(quest, task, true)) {
                        builder.push(location.range, 'variable');
                    }
                }
            }

            for (const action of quest.qbn.iterateActions()) {
                let hasTaskReference: boolean = false;

                for (let index = 0; index < action.signature.length; index++) {
                    const parameter = action.signature[index];
                    if (ParameterTypes.isRawInput(parameter.type, parameter.value)) {
                        builder.push(action.getRange(index), 'string');
                    }

                    if (!hasTaskReference) {
                        hasTaskReference = parameter.type === ParameterTypes.task;
                    }
                }

                if (action.info.category === QuestResourceCategory.Condition || hasTaskReference) {
                    for (let index = 0; index < action.signature.length; index++) {
                        const parameter = action.signature[index];
                        if (/^([^\$]|\$\{\d\|)/.test(parameter.type)) {
                            builder.push(action.getRange(index), 'keyword');
                        }
                    }
                }
            }

            return builder.build();
        }
    }
}