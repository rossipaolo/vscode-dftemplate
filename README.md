# Daggerfall Unity Quest Scripting for Visual Studio Code

A Visual Studio Code extension with support for the quest scripting language used by [Daggerfall Unity](https://github.com/Interkarma/daggerfall-unity).

![QBN](images/qbn.png)

## Quick start

1. Download the latest version from [Releases](https://github.com/TheLacus/vscode-dftemplate/releases). Open the command palette (**View > Command Palette** or `Ctrl+Shift+P`), type **_Extensions: Install from VSIX_** and select the downloaded file.
2. Open the folder with your quests, then from **File > Preferences > Settings > Workspace Settings** search `files.associations` to associate the language to text files inside the folder.

    ```json
    "files.associations": {
        "*.txt": "dftemplate"
    }
    ```

    Daggerfall Unity quest files use .txt extension, but is possible to use glob patterns to target only a subsection of files.

3. When you open a quest file for the first time you will be asked to select the folder _StreamingAssets/Tables_. Alternatively, manually set `dftemplate.tablesPath`.

## References

* [Daggerfall Unity](https://github.com/Interkarma/daggerfall-unity/tree/master/Assets/Scripts/Game/Questing) by Gavin Clayton/Daggerfall Workshop.
* "_**template**_", Daggerfall quest compiler/decompiler by Donald Tipton ([documentation](https://www.dfworkshop.net/static_files/questing-source-docs.html), [download](https://en.uesp.net/wiki/Daggerfall:Files)).
