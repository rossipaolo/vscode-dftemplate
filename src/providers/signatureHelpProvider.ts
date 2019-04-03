/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parser';
import { SignatureHelpProvider, TextDocument, Position, SignatureHelp } from 'vscode';
import { Language } from '../language/static/language';
import { Modules } from '../language/static/modules';
import { ParameterTypes } from '../language/static/parameterTypes';
import { Quest } from '../language/quest';

export class TemplateSignatureHelpProvider implements SignatureHelpProvider {

    public async provideSignatureHelp(document: TextDocument, position: Position): Promise<SignatureHelp | undefined> {

        if (Quest.isTable(document.uri)) {
            return;
        }

        const text = document.lineAt(position.line).text;
        if (parser.isEmptyOrComment(text)) {
            return;
        }

        // Symbol definition
        const symbolType = parser.getFirstWord(text);
        if (symbolType) {
            const overloads = Language.getInstance().getOverloads(symbolType);
            if (overloads.length > 0) {
                const definition = Language.getInstance().findDefinition(symbolType, text);
                const signatureHelp = new SignatureHelp();
                const summary = new vscode.MarkdownString(definition ? definition.summary : overloads[0].summary);
                signatureHelp.signatures = overloads.map(definition =>
                    new vscode.SignatureInformation(definition.signature, summary));
                signatureHelp.activeSignature = definition ? overloads.indexOf(definition) : 0;
                return signatureHelp;
            }
        }

        // Action/condition invocation
        const actionResult = Modules.getInstance().findAction(text);
        if (actionResult) {
            const signatureHelp = new SignatureHelp();
            const summary = new vscode.MarkdownString(actionResult.details.summary);
            signatureHelp.signatures = actionResult.details.overloads.map((signature, index) => {

                const signatureInformation = new vscode.SignatureInformation(Modules.prettySignature(signature), summary);
                const parameters = signature.split(' ');
                signatureInformation.parameters = parameters.map(parameter => {
                    const parameterInformation = new vscode.ParameterInformation(Modules.prettySignature(parameter));
                    parameterInformation.documentation = new vscode.MarkdownString(ParameterTypes.getDescription(Modules.formatParameter(parameter)));
                    return parameterInformation;
                });

                if (index === actionResult.overload) {
                    signatureHelp.activeSignature = actionResult.overload;
                    signatureHelp.activeParameter = Math.min(text.substring(0, position.character + 1).trim().split(' ').length - 1, parameters.length - 1);
                }
                return signatureInformation;
            });
            return signatureHelp;
        }
    }
}
