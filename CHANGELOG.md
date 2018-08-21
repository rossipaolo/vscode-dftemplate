# Change Log

## Unreleased

### Added
- Data is now read from local installation of Daggerfall Unity (_StreamingAssets/Tables_).
- Automatic rename of symbols to change prefixes and suffixes is proposed as code action; diagnostics detect incorrect symbol variations usage for symbol type.
- Find all quests in the workspace from command palette.
- Find references to global variables.
- Find references to actions and conditions.
- CodeLenses with references and other details.
- Unreferenced symbols are rendered faded out.

### Improved
- Format document/selection now detects the quest headless entry point.
- Completion Proposals provider detects parameter type (symbol definitions and actions/conditions) to offer more fitting suggestions.
- Quests are seeked in all workspace folders and subfolders.
- Improved documentation for some actions.
- Find definition and references of symbols which don't use `_symbol_` standard syntax.
- Find definition of standard messages from text alias.
- Detects actions whose first word is a parameter (example: `${1:_item_} used do ${2:task}`). Hover is shown on the first word that is not a parameter.

### Fixed
- A few action/definition signatures.
- Fixed an issue which caused diagnostics to consider a symbol unused if its only references are with `=` prefix.
- Fixed an issue which caused a word defined in the same line as a message reference to be also considered a message reference.
- Fixed incorrect letter case for the name of some standard messages.

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