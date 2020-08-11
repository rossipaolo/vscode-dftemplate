# Change Log

## Unreleased

### Improved

- Use Semantic Highlighting instead of decoration styling for conditions and actions that affect quest workflow, action and symbol parameters and symbols that don't follow standard syntax and can't benefit of syntax highlighting.

### Fixed

- Fixed action `change foe`.

## 0.14.0

### Improved

- Updated list of actions.

## 0.13.0

### Added

- Go to definition and Peek definition can resolve TEMPLATE actions to their C# source if Daggerfall Unity project is part of current workspace.
- Added action `Find action references` that finds TEMPLATE references from a C# action definition if Daggerfall Unity project is part of current workspace.
- Tables path is found automatically if Daggerfall Unity project is part of current workspace.

## 0.12.0

### Added

- Added diagnostic information for obsolete action `create npc at _place_` and obsolete overload `get item _item_ from _person_` with severity level of 'Information'.
- Added syntax highlighting for global variables.
- Added decoration styling to conditions and actions that affect quest workflow, action and symbol parameters and sybols that don't follow standard syntax and can't benefit of syntax highlighting. Colors can be themed (`dftemplate.stringParameter`, `dftemplate.controlAction` and `dftemplate.otherSymbol`).
- Show completion proposals inside actions for message ids that follow standard pattern (1xxx).

### Improved

- Tooltips for message references and completion proposals now include a preview of the text content.
- Use case insensitive comparison for completion proposals of static message names.

### Fixed

- Fixed issue which could cause code action `Convert to task` not to appear.

## 0.11.0

### Added

- Implemented provider of folding ranges for QRC, QBN, message, task and comment blocks.
- Numeric identifiers of additional messages can now be "renamed". Static messages can't be renamed because id is associated to alias.
- Added word highlight for symbol types.
- Added diagnostic for quest names inside quest tables. Quests are seeked in the directory where the table is located.
- Added hovers, find definition and references for quest names inside quest tables.
- Issue a warning and a quick fix if the value of the `Quest:` directive is different than the name of file without extension.

### Improved

- Improved resource seeking at position. Now words inside messages or comments are not considered references to symbols with the same name but valid only in other parts of the file.
- Updated list of actions and effects.

## 0.10.0

### Added

- Diagnostics for references to undefined quests.
- QuickFix: suggest best match for reference to unknown quest.
- When `entry` is typed inside a table a snippet insertion and signature info following the table schema are prompted.
- Added command **Generate messages** (`dftemplate.generateMessages`), also available as a code action on the `QRC` directive, which generates missing messages selected from a prompt.
- Refactoring: switch among message text aliases if more than one is available.
- Added command **Order messages** (`dftemplate.orderMessages`), also available as a code action, which sorts messages by id.
- Added command **Generate global variables** (`dftemplate.generateGlobalVariables`), also available as a code action on the `QBN` directive, which generates missing global variables selected from a prompt.

### Improved

- Go to Definition shows both symbol and task for clocks.
- Improved documentation support for actions with multiple overloads.
- Improved documentation for several actions.
- Default name of global variables is formed from their aliases. For example the proposed name for `FinishedMantellanCrux` is `_finishedMantellanCrux_`.
- Improved syntax highlighting.

### Fixed

- Fixed formatting of `DisplayName` directive.
- Fixed hover when the symbol below the cursor is the name of a quest which is not found in the workspace.
- Fixed quest rename.
- Fixed symbol rename from `symbol` to `_symbol_` syntax.
- Fixed an issue that caused all overloads to show the same description in the signature help window.

## 0.9.0

### Added

- Completion proposals and diagnostics for attributes and skills (from _Spells-Entity_ table).
- Symbol completion proposals are suggested with all variations inside the `QRC` block.
- QuickFix: insert `+` when sign for a number is required but missing.
- QuickFix: make new task or variable for a clock resource.
- QuickFix: suggest best match for unknown value in symbol definition or action.
- QuickFix: suggest best match for reference to unknown message, symbol or task.
- QuickFix: suggest correct spelling for a message text alias.
- QuickFix: convert empty task to variable.
- Refactoring: convert variable to task.
- Refactoring: switch `start task` and `setvar` when appropriate (`dftemplate.diagnostics.hintTaskActivationForm`).
- Refactoring: extract group of actions to a new task.
- If `dftemplate.tablesPath` is not set a open dialog is prompted at startup.

### Improved

- Use stored quest instances for the following providers:
    - RenameProvider
    - CodeLensProvider
    - CompletionItemProvider
    - HoverProvider
- Improvements to CodeActionProvider.
- Improvements to CompletionItemProvider.
- Improved quest parsing to detect invalid multiple `QRC` or `QBN` directives.
- Description for symbol variation inside hover is shown only inside the `QRC` block.
- Updated list of actions and effects.

### Fixed

- Fixed completion proposals for symbol definitions.
- Fixed diagnostics for `Foe` type.
- Fixed auto removal of unused variables.

## 0.8.0

### Added

- ReferenceProvider provides references for symbol macros.
- DocumentHighlightProvider provides document highlighting for messages, tasks, actions and symbol macros.
- Provide diagnostics for undefined `%symbol` macros.

### Improved

- Use stored quest instances for the following providers:
    - DefinitionProvider
    - CodeActionProvider
    - ReferenceProvider
    - DocumentHighlightProvider
- References of actions and symbol macros are seeked in the entire workspace.
- Updated list of actions and effects.

### Fixed

- ReferenceProvider and DocumentHighlightProvider now correctly highlight prefix of `____symbol_` variation.

## 0.7.0

### Added

- When a symbol or message is incorrectly defined multiple times, diagnostics show the locations in the hover box.

### Improved

- Improved performance of diagnostics.
- Parsed quests are stored for accesses from diagnostics, DocumentSymbolProvider and WorkspaceSymbolProvider.
- Updated list of actions and effects.

## 0.6.0

### Added

- Completion proposals and diagnostics for spells (from _Quests-Spells_ table).
- Completion proposals and diagnostics for effect keys.

### Improved

- Modules dependencies are now only listed with their name. Module files, when not provided by the extension, are seeked in a folder named **_Modules_** in the workspace root directory.
- Updated list of actions and conditions.

### Fixed

- Fixed seek of references of quests and global variables in the workspace.

## 0.5.0

### Added

- Action provider now proposes suggestions where an unknown expression could be a result of case mismatch or incorrect use of parameters.
- Added context menu command to toggle message `<ce>` tokens for the selection.
- Automatically insert task indentation on new line.
- A line or block is formatted when Enter is pressed to make a new line. This behaviour is controlled with the setting `editor.formatOnType`.
- Added implementation of Signature Help Provider. When a symbol definition or action/condition is accepted from completion proposals, a UI element shows the signature and, when available, the current parameter with a description based on the parameter "type". This functionality can be manually triggered on existing invocations with the keboard shortcut associated to `editor.action.triggerParameterHints`.

### Improved

- Diagnostics now distinguish between natural and integer numbers and provide appropriate error messages.
- Added overload for **_restore npc_**.
- Hover and highlighting for action `start quest ${1:questIndex} ${2:questIndex}`.
- Quest references are now also seeked by index for **S000nnnn** family quests.
- When a selection format is requested on a part of a block, formatter now seeks context in the previous lines to detect the start of the block.
- Hovers now show a comment block located above a definition and not only a single comment line.
- Added completion proposals and diagnostics for exterior location types (**when pc enters/exits**).

### Fixed

- Added a few missing actions.

## 0.4.0

### Added

- Introduced support for quest list tables.
- Message formatting: align split token (`<--->`) to left or center
- Message formatting: enforce a single space char to mark a empty line in the text block.
- Use tabs or spaces for task indentation following formatting options.
- Formatting: remove unnecessary empty lines.
- Static message references are now seeked by id and text aliases at the same time.
- Added default value of `false` for `editor.suggest.snippetsPreventQuickSuggestions`.

### Improved

- Diagnostics detects missing QRC/QBN blocks.
- Diagnostics and Code Action provider suggest to use text alias when a static message is defined with a message id.
- Formatter makes smaller text edits for some language elements.
- Completion proposals are suggested for all parameters if an action/condition supports any number of ending parameters of the same type.

### Fixed

- Fixed regression which caused incorrect symbol renaming.
- `=$_` is now correctly identified as gold amount.
- `____$_` is now correctly identified as the name of the region where a person is found.
- Fixed issue which caused code outline to fail initialization on file open.

## 0.3.0

### Added

- Data is now read from local installation of Daggerfall Unity (_StreamingAssets/Tables_).
- Automatic rename of symbols to change prefixes and suffixes is proposed as code action; diagnostics detect incorrect symbol variations usage for symbol type.
- Find all quests in the workspace from command palette.
- Find references to global variables.
- Find references to actions and conditions.
- CodeLenses with references and other details.
- Unreferenced symbols are rendered faded out.
- Completion proposals provider now suggests an available message id.
- Diagnostics now detect expressions outside of a message block.

### Improved

- Format document/selection now detects the quest headless entry point.
- Completion Proposals provider detects parameter type (symbol definitions and actions/conditions) to offer more fitting suggestions.
- Quests are seeked in all workspace folders and subfolders.
- Improved documentation for some actions.
- Find definition and references of symbols which don't use `_symbol_` standard syntax.
- Find definition of standard messages from text alias.
- Detects actions whose first word is a parameter (example: `${1:_item_} used do ${2:task}`). Hover is shown on the first word that is not a parameter.
- Static messages table is read and used to link id to text alias; diagnostics now detects mismatches and unknown aliases.

### Fixed

- A few action/definition signatures.
- Fixed an issue which caused diagnostics to consider a symbol unused if its only references are with `=` prefix.
- Fixed an issue which caused a word defined in the same line as a message reference to be also considered a message reference.
- Highlighting is now correctly applied to all strings that match static message definition syntax.

## 0.2.0

### Added

- Show hover on reference to default message via number: signature and summary taken from table.
- Show hover on reference to additional message via number: signature and, if present, a comment on previous line as a summary.
- Go to/peek definition of messages.
- Format centered messages, keywords, symbol definitions, tasks and comments.
- Support for quests in the workspace: autocomplete, hover, go to/peek definition and references.
- Import modules for actions/conditions autocomplete and hover.
- `%symbol` autocomplete.
- Diagnostics for actions/conditions/keywords signature. Checks format and definition of symbols, messages, tasks etc.
- Suggests actions on diagnostic messages.
- Support for params: `...` repeat the last signature word to match full line.

### Improved

- Detection of language symbols (prefix: `%`) and quest symbols with prefix `=` or `==`.

## 0.1.0

- Initial release.