AutoIndentPaste

Auto‑align indentation on paste.Language‑agnostic, tab/space‑aware, and multi‑cursor friendly.

🎬 Demo (MP4) • VS Code ≥ 1.97.2 • MIT License

Table of contents

Highlights
How it works
Examples
Installation
Usage
Settings
Known behaviors & trade‑offs
Troubleshooting
Development
Why this approach?
License

Highlights

Column‑accurate indentation — Converts leading whitespace to visual columns using the active tabSize. Mixed tabs/spaces paste cleanly into any indentation level.
“First line stays, rest align” — The first pasted line is kept as‑is; subsequent lines are shifted to line up under each cursor’s current indent. Predictable for partial‑block pastes.
Multi‑cursor aware — When VS Code is in spread mode ("editor.multiCursorPaste": "spread") and the clipboard newline count matches the selection count, the extension intentionally defers to VS Code.
Respects EOLs — Normalizes clipboard line endings to the target document (LF / CRLF) to avoid diff noise.
Format‑on‑paste friendly — If "editor.formatOnPaste": true, it requests range formatting only over pasted spans and merges overlaps to reduce churn.
Clipboard‑safe — Inserts via editor APIs; your system clipboard stays untouched.

How it works

Prebake the clipboard
Scan each line’s leading whitespace ⇒ record (charsConsumed, visualColumns).
Derive a baseline B from non‑empty trailing lines (the first line’s indent isn’t used to shift itself).
For each line after the first, compute C = max(0, indent − B).

Measure the target
For each cursor, if the text on the left isn’t indent‑only, paste verbatim at that position.

Assemble
Let A be the current cursor‑left columns. Build lines as:
first line: <original text>
others: makeIndent(A + C, preferTabs) + <original text>

preferTabs becomes true when a tab exists to the left or the editor uses tabs.

Post‑paste polish
Move cursors to the ends of inserted blocks, reveal the last cursor, then (optionally) apply range formatting.

This is language‑agnostic: no syntax heuristics, only columns + editor settings.

Examples
Clipboard
class qwe:
class asd:
class zxc:

Result (pasted at a 4‑space indent)
class qwe:
class asd:
class zxc:

Mixed tabs/spaces → preserved columns
\tfoo
bar

Pasted beneath a line indented with tabs will continue to use tabs; beneath spaces will use spaces.
Non‑indent positions → verbatim
const x = 1;▮ // cursor after code → no reindent, plain paste

Installation
From VSIX (local)

Build: npm install && npm run build
(Optional) Package: vsce package
In VS Code: Extensions → ⋮ → Install from VSIX… → choose your .vsix.

Marketplace installation can be added after publishing.

Usage

Paste as usual: Ctrl+V / Cmd+V.
When enabled, the extension replaces the default paste.
If any cursor is not at pure indentation, the paste at that cursor is inserted verbatim.

Settings
// package.json contributes
"AutoIndentPaste.enableIndentPasteBinding": {
"type": "boolean",
"default": true,
"description": "Enable AutoIndentPaste Paste to replace the default Ctrl/Cmd+V keybinding."
}

When true (default), the command is bound to Ctrl+V / Cmd+V:
{
"command": "AutoIndentPaste.IndentPaste",
"key": "ctrl+v",
"mac": "cmd+v",
"when": "(editorTextFocus || notebookCellEditorFocused) && !editorReadonly && config.AutoIndentPaste.enableIndentPasteBinding"
}

Respects standard editor prefs:

"editor.insertSpaces" / "editor.tabSize"
"editor.multiCursorPaste"
"editor.formatOnPaste"

Known behaviors & trade‑offs

Multi‑cursor “spread”. When the newline count matches selection count in spread mode, native VS Code paste is used to match expectations.
Non‑indent positions. Any cursor after non‑whitespace receives a plain paste to avoid unintended shifting.
Formatting. Range formatting runs after paste when enabled. Slow formatters can add a brief delay; disable "editor.formatOnPaste" if undesirable.

Troubleshooting

Format‑on‑paste didn’t run.

Ensure "editor.formatOnPaste": true (user or workspace).
Confirm your language has a range formatter (DocumentRangeFormatting provider). Some formatters only implement whole‑document formatting.
Try pasting into a small file or disabling other paste/format extensions to rule out conflicts.

Unexpected multi‑cursor behavior.

If "editor.multiCursorPaste": "spread" and the clipboard’s newline count equals the number of selections (or N-1 without a trailing newline), VS Code’s native spread paste intentionally takes over.

Tabs vs spaces look odd.

Check "editor.tabSize" and "editor.insertSpaces". The extension targets visual column equivalence, not literal whitespace equivalence.

Development

# Install deps

npm install

# Build once / watch

npm run build
npm run dev

Press F5 in VS Code to launch an Extension Development Host.
Main entry: ./out/extension.js.

Requirement: VS Code 1.97.2+; APIs used target ^1.97.2.

Why this approach?

Deterministic. Pure column math — no syntax parsing, no language servers.
Safe. No clipboard mutation; edits apply via TextEditorEdit/WorkspaceEdit.
Integrated. Cooperates with native spread paste and format on paste.

License
MIT — see LICENSE.txt.
