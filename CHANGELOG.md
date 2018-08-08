# Change Log

## Unreleased

### Added
- Data is now read from local installation of Daggerfall Unity (_StreamingAssets/Tables_).
- Automatic rename of symbols to change prefixes and suffixes is proposed as code action; diagnostics detect incorrect symbol variations usage for symbol type.

### Improved
- Format document/selection now detects the quest headless entry point.
- Completion Proposals provider detects parameter type (symbol definitions and actions/conditions) to offer more fitting suggestions.
- Quests are seeked in all workspace folders and subfolders.

### Fixed
- A few action/definition signatures.

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