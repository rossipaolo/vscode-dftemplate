/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import { ExtensionContext } from "vscode";
import { Tables } from "./tables";
import { Language } from "./language";
import { Modules } from "./modules";

/**
 * Holder for all the language data.
 */
export class LanguageData {

    /**
     * Tables imported from `StreamingAssets/Tables`.
     */
    public readonly tables = new Tables();

    /**
     * Data shipped with the extension.
     */
    public readonly language = new Language(this.tables);

    /**
     * Imported modules with actions/conditions and other data.
     */
    public readonly modules = new Modules();

    private constructor() {
    }

    /**
     * Loads all the language data.
     * @param context Context of the running extension.
     */
    public static async load(context: ExtensionContext): Promise<LanguageData> {
        const data = new LanguageData();
        await Promise.all([
            data.tables.load(),
            data.language.load(context),
            data.modules.load(context)
        ]);
        return data;
    }
}