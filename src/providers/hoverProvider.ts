/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import { HoverProvider, Hover, TextDocument, Position, MarkdownString, CancellationToken } from 'vscode';
import { EOL } from 'os';
import { getWord, isQuestReference, tasks } from '../parser';
import { QuestResourceCategory, SymbolType } from '../language/static/common';
import { Modules } from '../language/static/modules';
import { Language } from '../language/static/language';
import { Symbol, Task } from '../language/common';
import { Quest } from '../language/quest';
import { first } from '../extension';

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

    public provideHover(document: TextDocument, position: Position, token: CancellationToken): Thenable<Hover> {
        return new Promise(resolve => {
            const word = getWord(document, position);
            if (word) {

                const quest = Quest.get(document);

                const symbol = quest.qbn.getSymbol(word);
                if (symbol) {
                    const item = {
                        category: 'symbol',
                        signature: document.lineAt(symbol.range.start.line).text,
                        summary: TemplateHoverProvider.getSymbolDescription(quest, word, symbol, position)
                    };
                    return resolve(TemplateHoverProvider.makeHover(item));
                }

                const task = quest.qbn.getTask(word);
                if (task) {
                    const item = {
                        category: 'task',
                        signature: document.lineAt(task.range.start).text.trim(),
                        summary: TemplateHoverProvider.getTaskDescription(quest, task)
                    };
                    return resolve(TemplateHoverProvider.makeHover(item));
                }

                const message = quest.qrc.getMessage(word);
                if (message) {
                    return resolve(TemplateHoverProvider.makeHover({
                        category: 'message',
                        signature: document.lineAt(message.range.start).text.trim(),
                        summary: quest.makeDocumentation(message)
                    }));
                }

                // Seek word in documentation files
                const definition = Language.getInstance().findDefinition(word, document.lineAt(position.line).text);
                if (definition) {
                    const item: TemplateDocumentationItem = {
                        category: 'definition',
                        signature: definition.signature
                    };
                    const overloads = Language.getInstance().numberOfOverloads(word) - 1;
                    if (overloads > 0) {
                        item.signature += TemplateHoverProvider.makeOverloadsCountInfo(overloads);
                    }
                    item.summary = definition.summary;
                    item.parameters = definition.parameters;
                    return resolve(TemplateHoverProvider.makeHover(item));
                }
                const languageItem = Language.getInstance().seekByName(word);
                if (languageItem) {
                    const item = {
                        category: QuestResourceCategory[languageItem.category].toLowerCase(),
                        signature: Language.prettySignature(languageItem.details.signature),
                        summary: languageItem.details.summary,
                    };
                    return resolve(TemplateHoverProvider.makeHover(item));
                }

                // Seek quest
                if (isQuestReference(document.lineAt(position.line).text, word)) {
                    return Quest.getAll(token).then(quests => {
                        const questName = Quest.indexToName(word);
                        const quest = quests.find(x => x.getName() === questName);
                        return resolve(quest ? TemplateHoverProvider.makeHover({
                            category: 'quest',
                            signature: 'Quest: ' + quest.getName(),
                            summary: TemplateHoverProvider.getQuestDescription(quest)
                        }) : undefined);
                    });
                }

                // Actions
                const result = Modules.getInstance().findAction(document.lineAt(position.line).text, word);
                if (result && Modules.isActionName(result, word)) {
                    let signature = result.moduleName + ' -> ' + result.getSignature();
                    const otherOverloads = result.details.overloads.length - 1;
                    if (otherOverloads > 0) {
                        signature += TemplateHoverProvider.makeOverloadsCountInfo(otherOverloads);
                    }
                    const item = {
                        category: QuestResourceCategory[result.category].toLowerCase(),
                        signature: Modules.prettySignature(signature),
                        summary: result.getSummary()
                    };
                    return resolve(TemplateHoverProvider.makeHover(item));
                }
            }

            return resolve();
        });
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
    private static getSymbolDescription(quest: Quest, name: string, symbol: Symbol, position: Position): string {
        let summary = quest.makeDocumentation(symbol) || '';
        
        if (quest.qrc.range && quest.qrc.range.contains(position)) {
            const variation = Language.getInstance().getSymbolVariations(name, symbol.type, x => '`' + x + '`').find(x => x.word === name);
            const meaning = variation ? variation.description + '.' : 'Undefined value for the type `' + symbol.type + '`.';
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