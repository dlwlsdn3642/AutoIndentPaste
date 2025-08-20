<div align="center">

# AutoIndentPaste

# 🚀 **Just Released — August 19, 2025!**

<br/>

<img src="icon.png" alt="AutoIndentPaste icon" width="240" alt="icon">

<br/>
<br/>

![Release](https://img.shields.io/badge/New%20Release-August%2019%2C%202025-ff69b4?style=for-the-badge&logo=rocket)

<p align="center">
  <a href="https://github.com/dlwlsdn3642/AutoIndentPaste">
    <img
      alt="GitHub Repo"
      src="https://img.shields.io/badge/GitHub-Repo-181717?logo=github&logoColor=white&labelColor=161B22&style=for-the-badge" />
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=jinjinmory.AutoIndentPaste">
    <img
      alt="VS Code Marketplace (Version)"
      src="https://img.shields.io/visual-studio-marketplace/v/jinjinmory.AutoIndentPaste?label=Marketplace&logo=visualstudiocode&logoColor=white&labelColor=1E1E1E&style=for-the-badge" />
  </a>
  <a href="https://code.visualstudio.com/">
    <img
      alt="VS Code ≥ 1.97.2"
      src="https://img.shields.io/badge/VS%20Code-%E2%89%A5%201.97.2-007ACC?logo=visualstudiocode&logoColor=white&labelColor=1E1E1E&style=for-the-badge" />
  </a>
  <a href="LICENSE">
    <img
      alt="License"
      src="https://img.shields.io/github/license/dlwlsdn3642/AutoIndentPaste?label=License&labelColor=161B22&style=for-the-badge" />
  </a>
</p>

<br/>
<br/>

![AutoIndentPaste Demo](https://github.com/dlwlsdn3642/AutoIndentPaste/raw/main/demo/demo.gif)

한국어로 읽기: [README.ko.md](https://github.com/dlwlsdn3642/AutoIndentPaste/blob/main/README.ko.md)

</div>

## Contents

- [Highlights](#highlights)
- [Demo](#demo)
- [How It Works](#how-it-works)
- [Examples](#examples)
- [Installation](#installation)
- [Usage](#usage)
- [Settings](#settings)
- [Known Behaviors & Trade‑offs](#known-behaviors--trade-offs)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Design Rationale](#design-rationale)
- [License](#license)

## Highlights

- Column‑accurate indentation: converts leading whitespace to visual columns using the active `tabSize`. Mixed tabs/spaces paste cleanly into any indentation level.
- “First line stays, rest align”: the first pasted line is kept as‑is; subsequent lines shift to align under each cursor’s current indent.
- Multi‑cursor aware: when `editor.multiCursorPaste: "spread"` and the clipboard newline count matches the selection count, the extension defers to VS Code’s native paste.
- Respects EOLs: clipboard line endings are normalized to the target document (LF/CRLF) to avoid diff noise.
- Format on paste friendly: if `editor.formatOnPaste` is enabled, requests range formatting only over pasted spans and merges overlaps to reduce churn.
- Clipboard‑safe: inserts via editor APIs; your system clipboard remains untouched.

## How It Works

1. Prebake the clipboard

   - Scan each line’s leading whitespace → record `(charsConsumed, visualColumns)`.
   - Derive a baseline `B` from non‑empty trailing lines (the first line’s indent isn’t used to shift itself).
   - For each line after the first, compute `C = max(0, indent − B)`.

2. Measure the target

   - For each cursor, if the text on the left isn’t indent‑only, paste verbatim at that position.

3. Assemble

   - Let `A` be the current cursor‑left columns.
   - First line: original text
   - Others: `makeIndent(A + C, preferTabs)` + original text
   - `preferTabs` becomes true when a tab exists to the left or the editor uses tabs.

4. Post‑paste polish
   - Move cursors to the ends of inserted blocks, reveal the last cursor, then (optionally) apply range formatting.

This is language‑agnostic: no syntax heuristics, only columns + editor settings.

## Examples

Clipboard

```
class qwe:
class asd:
class zxc:
```

Result (pasted at a 4‑space indent)

```
class qwe:
    class asd:
        class zxc:
```

Mixed tabs/spaces → preserved columns

```
\tfoo
bar
```

Pasted beneath a line indented with tabs will continue to use tabs; beneath spaces will use spaces.

Non‑indent positions → verbatim

```
const x = 1;▮ // cursor after code → no reindent, plain paste
```

## Installation

This extension is not published and no VSIX is provided.

- Build from source and run in an Extension Development Host.

```bash
npm install
npm run build
```

- In VS Code, press `F5` to launch an Extension Development Host.

## Usage

- Paste as usual: `Ctrl+V` / `Cmd+V`.
- When enabled, the extension replaces the default paste.
- If any cursor is not at pure indentation, that cursor receives a plain paste.

## Settings

Contribution (from `package.json`):

```jsonc
"AutoIndentPaste.enableIndentPasteBinding": {
  "type": "boolean",
  "default": true,
  "description": "Enable AutoIndentPaste Paste to replace the default Ctrl/Cmd+V keybinding."
}
```

Default keybinding when enabled:

```jsonc
{
  "command": "AutoIndentPaste.IndentPaste",
  "key": "ctrl+v",
  "mac": "cmd+v",
  "when": "(editorTextFocus || notebookCellEditorFocused) && !editorReadonly && config.AutoIndentPaste.enableIndentPasteBinding"
}
```

Respects editor preferences:

- `editor.insertSpaces` / `editor.tabSize`
- `editor.multiCursorPaste`
- `editor.formatOnPaste`

## Known Behaviors & Trade‑offs

- Multi‑cursor “spread”: when the newline count matches selection count in spread mode, native VS Code paste is used to match expectations.
- Non‑indent positions: any cursor after non‑whitespace receives a plain paste to avoid unintended shifting.
- Formatting: range formatting runs after paste when enabled. Slow formatters can add a brief delay; disable `editor.formatOnPaste` if undesirable.

## Troubleshooting

Format on paste didn’t run

- Ensure `"editor.formatOnPaste": true` (user or workspace).
- Confirm your language has a range formatter (DocumentRangeFormatting provider). Some formatters only implement whole‑document formatting.
- Try pasting into a small file or disabling other paste/format extensions to rule out conflicts.

Unexpected multi‑cursor behavior

- If `editor.multiCursorPaste: "spread"` and the clipboard’s newline count equals the number of selections (or `N-1` without a trailing newline), VS Code’s native spread paste intentionally takes over.

Tabs vs spaces look odd

- Check `editor.tabSize` and `editor.insertSpaces`. The extension targets visual column equivalence, not literal whitespace equivalence.

## Development

Requirement: VS Code 1.97.2+; APIs used target `^1.97.2`.

```bash
npm install
npm run build
npm run dev
```

- Press `F5` in VS Code to launch an Extension Development Host.
- Main entry: `./out/extension.js`.

## Design Rationale

- Deterministic: pure column math — no syntax parsing, no language servers.
- Safe: no clipboard mutation; edits apply via `TextEditorEdit`/`WorkspaceEdit`.
- Integrated: cooperates with native spread paste and format on paste.

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE).

This icon is licensed under the [Lucide License](LICENSE_icon).
