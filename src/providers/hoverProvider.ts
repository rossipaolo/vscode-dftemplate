/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import { HoverProvider, Hover, TextDocument, Position, MarkdownString, CancellationToken } from 'vscode';
import { EOL } from 'os';
import { first } from '../extension';
import { tasks } from '../parser';
import { QuestResourceCategory, SymbolType } from '../language/static/common';
import { Modules } from '../language/static/modules';
import { Language } from '../language/static/language';
import { LanguageData } from '../language/static/languageData';
import { Symbol, Task } from '../language/common';
import { Quests } from '../language/quests';
import { Quest } from '../language/quest';

interface TemplateDocumentationParameter {
    name: string;
    description: string;
}

interface TemplateDocumentationItem {
    category: string;
    signature: string;
    summary?: string;
    parameters?: TemplateDocumentationParameter[];
}

export class TemplateHoverProvider implements HoverProvider {

    public constructor(private readonly data: LanguageData, private readonly quests: Quests) {
    }

    public async provideHover(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover | undefined> {

        if (Quests.isTable(document.uri)) {
            const quest = await this.quests.findFromTable(document, position, token);
            if (quest !== undefined) {
                return TemplateHoverProvider.makeHover({
                    category: 'quest',
                    signature: 'Quest: ' + quest.getName(),
                    summary: TemplateHoverProvider.getQuestDescription(quest)
                });
            }

            return undefined;
        }

        const quest = this.quests.get(document);

        if (this.quests.saveInspector.isSetup === true) {
            const saveDataMarkdown = this.quests.saveInspector.inspect(quest, position);
            if (saveDataMarkdown !== undefined) {
                return new Hover(saveDataMarkdown);
            }
        }

        let item: TemplateDocumentationItem | undefined = undefined;
        const resource = quest.getResource(position);
        if (resource) {
            switch (resource.kind) {
                case 'message':
                    item = {
                        category: 'message',
                        signature: resource.value.makePreview(false),
                        summary: quest.makeDocumentation(resource.value)
                    };
                    break;
                case 'type':
                    const definition = this.data.language.findDefinition(resource.value, document.lineAt(position.line).text);
                    if (definition) {
                        item = {
                            category: 'definition',
                            signature: definition.signature
                        };
                        const overloads = this.data.language.numberOfOverloads(resource.value) - 1;
                        if (overloads > 0) {
                            item.signature += TemplateHoverProvider.makeOverloadsCountInfo(overloads);
                        }
                        item.summary = definition.summary;
                        item.parameters = definition.parameters;
                    }
                    break;
                case 'symbol':
                    item = {
                        category: 'symbol',
                        signature: document.getText(resource.value.blockRange),
                        summary: this.getSymbolDescription(quest, resource.value, resource.variation)
                    };
                    break;
                case 'task':
                    item = {
                        category: 'task',
                        signature: document.lineAt(resource.value.range.start).text.trim(),
                        summary: TemplateHoverProvider.getTaskDescription(quest, resource.value)
                    };
                    break;
                case 'action':
                    const actionInfo = this.data.modules.findAction(resource.value.line.text);
                    if (actionInfo) {
                        let signature = actionInfo.moduleName + ' -> ' + actionInfo.getSignature();
                        const otherOverloads = actionInfo.details.overloads.length - 1;
                        if (otherOverloads > 0) {
                            signature += TemplateHoverProvider.makeOverloadsCountInfo(otherOverloads);
                        }
                        item = {
                            category: QuestResourceCategory[actionInfo.category].toLowerCase(),
                            signature: Modules.prettySignature(signature),
                            summary: actionInfo.getSummary()
                        };
                    }
                    break;
                case 'quest':
                    const targetQuest = await this.quests.find(resource.value);
                    if (targetQuest) {
                        item = {
                            category: 'quest',
                            signature: 'Quest: ' + targetQuest.getName(),
                            summary: TemplateHoverProvider.getQuestDescription(targetQuest)
                        };
                    }
                case 'directive':
                case 'macro':
                case 'globalVar':
                    const languageItem = this.data.language.seekByName(resource.value);
                    if (languageItem) {
                        item = {
                            category: QuestResourceCategory[languageItem.category].toLowerCase(),
                            signature: Language.prettySignature(languageItem.details.signature),
                            summary: languageItem.details.summary,
                        };
                    }
                    break;
            }
        }

        if (item !== undefined) {
            return TemplateHoverProvider.makeHover(item);
        }
    }

    /**
     * Make a formatted markdown for the given documentation item.
     */
    private static makeHover(item: TemplateDocumentationItem): Hover {
        const hovertext: MarkdownString[] = [];

        if (item.signature) {
            const signature = new MarkdownString();
            signature.appendCodeblock(item.category ? '(' + item.category + ') ' + item.signature : item.signature, 'dftemplate');
            hovertext.push(signature);
        }

        if (item.summary) {
            const summaryLines: string[] = [];

            summaryLines.push(item.summary);
            if (item.parameters) {
                item.parameters.map(x => '*@param* `' + x.name + '` - ' + x.description).forEach(x => summaryLines.push(x));
            }

            hovertext.push(new MarkdownString(summaryLines.join(EOL.repeat(2))));
        }

        return new Hover(hovertext);
    }

    private static getQuestDescription(quest: Quest): string | undefined {
        const displayName = quest.preamble.getDisplayName();

        const documentation = quest.makeDocumentation();
        if (documentation) {
            return displayName ? displayName + EOL.repeat(2) + documentation : documentation;
        }

        return displayName;
    }

    /**
     * Gets the summary for a symbol and, if inside the `QRC` block, a description for its variation based on prefix and type.
     */
    private getSymbolDescription(quest: Quest, symbol: Symbol, variation?: string): string {
        let summary = quest.makeDocumentation(symbol) || '';

        if (variation !== undefined) {
            const symbolVariation = this.data.language.getSymbolVariations(symbol.name, symbol.type, x => '`' + x + '`').find(x => x.word === variation);
            const meaning = symbolVariation ? symbolVariation.description + '.' : 'Undefined value for the type `' + symbol.type + '`.';
            summary = summary ? [summary, meaning].join(EOL.repeat(2)) : meaning;
        }

        if (symbol.type === SymbolType.Clock) {
            const task = quest.qbn.getTask(symbol.name);
            if (task !== undefined) {
                let taskSummary = quest.makeDocumentation(task);
                if (taskSummary) {
                    taskSummary = `*@onTimer* - ${taskSummary}`;
                    summary = summary ? [summary, taskSummary].join(EOL.repeat(2)) : taskSummary;
                }
            }
        }

        return summary;
    }

    private static getTaskDescription(quest: Quest, task: Task): string {
        let summary = quest.makeDocumentation(task) || '';

        const untilPerformed = first(quest.qbn.iterateTasks(), x => x.name === task.name && x.definition.type === tasks.TaskType.PersistUntil);
        if (untilPerformed !== undefined) {
            let untilPerformedSummary = quest.makeDocumentation(untilPerformed);
            if (untilPerformedSummary) {
                untilPerformedSummary = `*@untilPerformed* - ${untilPerformedSummary}`;
                summary = summary ? [summary, untilPerformedSummary].join(EOL.repeat(2)) : untilPerformedSummary;
            }
        }

        return summary;
    }

    /**
     * Makes a readable text showing the number of available overloads.
     * @param others Overloads count minus one.
     */
    private static makeOverloadsCountInfo(others: number): string {
        return others === 1 ? ` (+1 overload)` : ` (+${others} overloads)`;
    }
}