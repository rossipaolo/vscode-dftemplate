/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import { HoverProvider, Hover, TextDocument, Position, MarkdownString, CancellationToken } from 'vscode';
import { EOL } from 'os';
import { getWord, makeSummary, isQuestReference } from '../parser';
import { QuestResourceCategory } from '../language/static/common';
import { Modules } from '../language/static/modules';
import { Language } from '../language/static/language';
import { Symbol } from '../language/common';
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
                        summary: makeSummary(document, task.range.start.line)
                    };
                    return resolve(TemplateHoverProvider.makeHover(item));
                }

                const message = quest.qrc.getMessage(word);
                if (message) {

                    const item: TemplateDocumentationItem = {
                        category: 'message',
                        signature: document.lineAt(message.range.start).text.trim()
                    };

                    if (message.alias) {
                        const details = Language.getInstance().findMessage(message.alias);
                        if (details) {
                            item.summary = details.summary;
                        }
                    } else {
                        item.summary = makeSummary(document, message.range.start.line);
                    }

                    return resolve(TemplateHoverProvider.makeHover(item));
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
                        item.signature += ' (+' + overloads + ' overloads)';
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
                            summary: quest.preamble.getDisplayName() || quest.getName()
                        }) : undefined);
                    });
                }

                // Actions
                const result = Modules.getInstance().findAction(document.lineAt(position.line).text, word);
                if (result && Modules.isActionName(result, word)) {
                    let signature = result.moduleName + ' -> ' + result.getSignature();
                    if (result.details.overloads.length > 1) {
                        signature += '\n\nother overload(s):';
                        for (let i = 0; i < result.details.overloads.length; i++) {
                            if (i !== result.overload) {
                                signature += '\n' + result.details.overloads[i];
                            }
                        }
                    }
                    const item = {
                        category: QuestResourceCategory[result.category].toLowerCase(),
                        signature: Modules.prettySignature(signature),
                        summary: result.details.summary
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

    /**
     * Gets the summary for a symbol and, if inside the `QRC` block, a description for its variation based on prefix and type.
     */
    private static getSymbolDescription(quest: Quest, name: string, symbol: Symbol, position: Position): string {
        const summary = makeSummary(quest.document, symbol.range.start.line);
        
        if (quest.qrc.range && quest.qrc.range.contains(position)) {
            const variation = Language.getInstance().getSymbolVariations(name, symbol.type, x => '`' + x + '`').find(x => x.word === name);
            const meaning = variation ? variation.description + '.' : 'Undefined value for the type `' + symbol.type + '`.';
            return summary ? [summary, meaning].join(EOL.repeat(2)) : meaning;
        }

        return summary;
    }
}