import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('AutoIndentPaste.IndentPaste', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
        return;
      }

      const raw = await vscode.env.clipboard.readText();
      if (!raw || shouldUseNativeSpread(raw, editor)) {
        await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
        return;
      }

      const indentText = normalizeEOL(raw, editor.document.eol);
      await indentPaste(indentText, editor);
    })
  );
}

function normalizeEOL(text: string, eol: vscode.EndOfLine): string {
  const LF = '\n';
  const CRLF = '\r\n';
  const lines = text.split(/\r?\n/);
  return lines.join(eol === vscode.EndOfLine.CRLF ? CRLF : LF);
}

const NL = 10 as const;
export function shouldUseNativeSpread(raw: string, editor: vscode.TextEditor): boolean {
  if (vscode.workspace.getConfiguration('editor')
        .get<'spread'|'full'>('multiCursorPaste', 'spread') !== 'spread') return false;

  const need = editor.selections.length;
  const endsWithNL = raw.length > 0 && raw.charCodeAt(raw.length - 1) === NL;
  const targetNewlines = endsWithNL ? need : need - 1;
  
  let from = 0;
  for (let seen = 0; seen < targetNewlines; seen++) {
    const i = raw.indexOf('\n', from);
    if (i === -1) return false;
    from = i + 1;
  }

  return raw.indexOf('\n', from) === -1;
}

async function indentPaste(indentText: string, editor: vscode.TextEditor) {
  const doc = editor.document;
  const sels = editor.selections;

  const tabSize = editor.options.tabSize as number;
  const insertSpaces =
    typeof editor.options.insertSpaces === "boolean" ? editor.options.insertSpaces : true;

  // Scan leading whitespace of a line → return {chars, cols}
  function scanIndent(line: string): { chars: number; cols: number } {
    let i = 0, col = 0;
    while (i < line.length) {
      const c = line.charCodeAt(i);
      if (c === 32 /* ' ' */) { col += 1; i++; }
      else if (c === 9 /* '\t' */) { col += tabSize - (col % tabSize); i++; }
      else break;
    }
    return { chars: i, cols: col };
  }

  // Check if string is only spaces/tabs
  function isAllIndent(s: string): boolean {
    if (s.length === 0) return false;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c !== 32 && c !== 9) return false;
    }
    return true;
  }

  // Scan cursor-left string (before) → return indent cols and whether it contains a tab
  function scanA(before: string): { Acols: number; hasTab: boolean } {
    let col = 0, hasTab = false;
    for (let i = 0; i < before.length; i++) {
      const c = before.charCodeAt(i);
      if (c === 32) col += 1;
      else if (c === 9) { hasTab = true; col += tabSize - (col % tabSize); }
      else break; // usually not reached (filtered by isAllIndent)
    }
    return { Acols: col, hasTab };
  }

  // Convert target column count to indentation string
  function makeIndent(targetCols: number, preferTabs: boolean): string {
    const cols = targetCols > 0 ? targetCols : 0;
    if (!preferTabs) return " ".repeat(cols);
    const tabs = Math.floor(cols / tabSize);
    const spaces = cols % tabSize;
    return "\t".repeat(tabs) + " ".repeat(spaces);
  }

  // Rebase text indentation relative to A:
  // - First line inserted at col=0
  // - From second line: A + (L - B)
  function rebase(text: string, Acols: number, preferTabs: boolean): string {
    const lines = text.split("\n");

    // Pass 1: determine Bcols
    const first = lines[0] ?? "";
    const firstIndent = scanIndent(first);
    let Bcols = 0;
    if (firstIndent.cols !== 0) {
      let min = Number.POSITIVE_INFINITY;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // skip blank line
        let j = 0; while (j < line.length) {
          const c = line.charCodeAt(j);
          if (c !== 32 && c !== 9) break;
          j++;
        }
        if (j === line.length) continue;
        const ind = scanIndent(line);
        if (ind.cols < min) min = ind.cols;
      }
      if (Number.isFinite(min)) Bcols = min;
    }

    // Pass 2: build output
    const out: string[] = new Array(lines.length);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const ind = scanIndent(line);
      const rest = line.slice(ind.chars);
      if (i === 0) { out[i] = rest; continue; } // first line at col=0
      const C = ind.cols > Bcols ? (ind.cols - Bcols) : 0;
      out[i] = makeIndent(Acols + C, preferTabs) + rest;
    }

    // Note: split-join preserves trailing newline if present in source
    return out.join("\n");
  }

  await editor.edit(
    (eb) => {
      for (const sel of sels) {
        const lineText = doc.lineAt(sel.start.line).text;
        const before = lineText.slice(0, sel.start.character);

        // If not inside indentation → paste raw text
        if (!isAllIndent(before)) {
          eb.replace(sel, indentText);
          continue;
        }

        const { Acols, hasTab } = scanA(before);
        const preferTabs = !insertSpaces || hasTab;
        eb.replace(sel, rebase(indentText, Acols, preferTabs));
      }
    },
    { undoStopBefore: true, undoStopAfter: true }
  );
}



export function deactivate() {}