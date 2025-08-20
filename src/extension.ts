import * as vscode from "vscode";

/** Extension entry point: registers the command and routes to our paste flow */
export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("AutoIndentPaste.IndentPaste", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        await vscode.commands.executeCommand(
          "editor.action.clipboardPasteAction"
        );
        return;
      }

      const raw = await vscode.env.clipboard.readText();
      if (!raw || shouldUseNativeSpread(raw, editor)) {
        await vscode.commands.executeCommand(
          "editor.action.clipboardPasteAction"
        );
        return;
      }

      const indentText = normalizeEOL(raw, editor.document.eol);
      await indentPaste(indentText, editor);
    })
  );
}

/** Normalize incoming text EOLs to match the target document's EOL */
function normalizeEOL(text: string, eol: vscode.EndOfLine): string {
  const LF = "\n",
    CRLF = "\r\n";
  const lines = text.split(/\r?\n/);
  return lines.join(eol === vscode.EndOfLine.CRLF ? CRLF : LF);
}

/**
 * Fast check for when VS Code's native "spread" paste should handle it.
 * - Honors editor.getConfiguration == "spread"
 * - Requires multiple selections
 * - Verifies the clipboard has exactly N (or N-1) newlines
 */
const NL = 10 as const;
export function shouldUseNativeSpread(
  raw: string,
  editor: vscode.TextEditor
): boolean {
  const conf = vscode.workspace.getConfiguration("editor", editor.document);
  if (conf.get<"spread" | "full">("multiCursorPaste", "spread") !== "spread")
    return false;

  const need = editor.selections.length;
  if (need <= 1) return false;

  const endsWithNL = raw.length > 0 && raw.charCodeAt(raw.length - 1) === NL;
  const targetNewlines = endsWithNL ? need : need - 1;

  let from = 0;
  for (let seen = 0; seen < targetNewlines; seen++) {
    const i = raw.indexOf("\n", from);
    if (i === -1) return false;
    from = i + 1;
  }
  return raw.indexOf("\n", from) === -1;
}

/**
 * Perform indentation-aware paste:
 * - If cursor-left is not pure indent, paste as-is
 * - Else, align subsequent lines based on left indent and per-line delta
 * - Keep cursors at the end of each inserted block
 */
async function indentPaste(indentText: string, editor: vscode.TextEditor) {
  type PreLine = { rest: string; C: number };
  type Plan = {
    idx: number;
    sel: vscode.Selection;
    toInsert: string;
    baseEnd: vscode.Position;
    insertedNL: number;
    replacedNL: number;
  };

  const doc = editor.document;
  const sels = editor.selections;

  const tabSize = editor.options.tabSize as number;
  const insertSpaces =
    typeof editor.options.insertSpaces === "boolean"
      ? editor.options.insertSpaces
      : true;

  const sep = doc.eol === vscode.EndOfLine.CRLF ? "\r\n" : "\n";
  const pre = prebake(indentText);

  const plans: Plan[] = [];

  for (let i = 0; i < sels.length; i++) {
    const sel = sels[i];
    const lineText = doc.lineAt(sel.start.line).text;
    const before = lineText.slice(0, sel.start.character);

    let toInsert: string;
    if (!isAllIndent(before)) {
      toInsert = indentText;
    } else {
      const { Acols, hasTab } = scanA(before);
      const preferTabs = !insertSpaces || hasTab;
      toInsert = assemble(pre, Acols, preferTabs);
    }

    const baseEnd = endPositionFrom(sel.start, toInsert);
    const replacedText = doc.getText(sel);
    const insertedNL = countNewlines(toInsert);
    const replacedNL = countNewlines(replacedText);

    plans.push({ idx: i, sel, toInsert, baseEnd, insertedNL, replacedNL });
  }

  await editor.edit(
    (eb) => {
      for (const p of plans) eb.replace(p.sel, p.toInsert);
    },
    { undoStopBefore: true, undoStopAfter: true }
  );

  // Reposition cursors to the end of each inserted block, accounting for line deltas
  plans.sort((a, b) =>
    a.sel.start.line === b.sel.start.line
      ? a.sel.start.character - b.sel.start.character
      : a.sel.start.line - b.sel.start.line
  );

  let cumLineDelta = 0;
  const finalSelections: vscode.Selection[] = [];
  for (const p of plans) {
    const delta = p.insertedNL - p.replacedNL;
    const end = new vscode.Position(
      p.baseEnd.line + cumLineDelta,
      p.baseEnd.character
    );
    finalSelections.push(new vscode.Selection(end, end));
    cumLineDelta += delta;
  }
  editor.selections = finalSelections;
  const last = finalSelections[finalSelections.length - 1].active;
  editor.revealRange(
    new vscode.Range(last, last),
    vscode.TextEditorRevealType.Default
  );

  const formatOnPaste = vscode.workspace
    .getConfiguration("editor", doc)
    .get<boolean>("formatOnPaste", false);

  console.log(formatOnPaste);
  if (formatOnPaste) {
    const fmtOpts: vscode.FormattingOptions = {
      tabSize,
      insertSpaces: !!insertSpaces,
    };
    let cum2 = 0;
    const ranges: vscode.Range[] = [];
    for (const p of plans) {
      const start = new vscode.Position(
        p.sel.start.line + cum2,
        p.sel.start.character
      );
      const end = new vscode.Position(
        p.baseEnd.line + cum2,
        p.baseEnd.character
      );
      if (!start.isEqual(end)) ranges.push(new vscode.Range(start, end));
      cum2 += p.insertedNL - p.replacedNL;
    }

    // Merge overlapping/adjacent ranges to minimize formatter churn
    ranges.sort((r1, r2) =>
      r1.start.line === r2.start.line
        ? r1.start.character - r2.start.character
        : r1.start.line - r2.start.line
    );
    const merged: vscode.Range[] = [];
    for (const r of ranges) {
      const prev = merged[merged.length - 1];
      if (!prev) {
        merged.push(r);
      } else if (
        r.start.line < prev.end.line ||
        (r.start.line === prev.end.line &&
          r.start.character <= prev.end.character)
      ) {
        const end =
          r.end.line > prev.end.line ||
          (r.end.line === prev.end.line && r.end.character > prev.end.character)
            ? r.end
            : prev.end;
        merged[merged.length - 1] = new vscode.Range(prev.start, end);
      } else {
        merged.push(r);
      }
    }

    // Ask the active formatter(s) for edits and apply them
    for (const r of merged) {
      const edits = (await vscode.commands.executeCommand(
        "vscode.executeFormatRangeProvider",
        doc.uri,
        r,
        fmtOpts
      )) as vscode.TextEdit[] | undefined;

      if (edits && edits.length) {
        const we = new vscode.WorkspaceEdit();
        for (const e of edits) we.replace(doc.uri, e.range, e.newText);
        await vscode.workspace.applyEdit(we);
      }
    }
  }

  /** Count occurrences of document EOL in a string */
  function countNewlines(s: string): number {
    if (s.length === 0) return 0;
    let n = 0,
      i = -1;
    while ((i = s.indexOf(sep, i + 1)) !== -1) n++;
    return n;
  }

  /** Compute end position after inserting `text` at `start` */
  function endPositionFrom(
    start: vscode.Position,
    text: string
  ): vscode.Position {
    const parts = text.split(sep);
    if (parts.length === 1) {
      return new vscode.Position(start.line, start.character + parts[0].length);
    }
    const lastLen = parts[parts.length - 1].length;
    return new vscode.Position(start.line + (parts.length - 1), lastLen);
  }

  /** Preprocess clipboard text into (rest, C) rows; C is per-line indent delta after baseline removal */
  function prebake(text: string): { rows: PreLine[] } {
    const lines = text.split(/\r?\n/);

    // Pre-scan all lines
    const indents: number[] = new Array(lines.length);
    const charsArr: number[] = new Array(lines.length);
    const nonEmptyIdx: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      const { chars, cols } = scanIndent(lines[i]);
      indents[i] = cols;
      charsArr[i] = chars;
      if (chars < lines[i].length) nonEmptyIdx.push(i); // has non-whitespace
    }

    // Compute baseline B
    let Bcols = 0;
    if (nonEmptyIdx.length > 0) {
      const tailIndents: number[] = [];
      for (const idx of nonEmptyIdx)
        if (idx !== 0) tailIndents.push(indents[idx]);

      if (tailIndents.length > 0) {
        const minTail = Math.min(...tailIndents);
        let unit = 0;
        for (let a = 0; a < tailIndents.length; a++) {
          for (let b = a + 1; b < tailIndents.length; b++) {
            const d = Math.abs(tailIndents[a] - tailIndents[b]);
            if (d > 0) unit = unit === 0 ? d : gcd(unit, d);
          }
        }
        if (unit === 0) unit = tabSize;

        const indent0 = nonEmptyIdx[0] === 0 ? indents[0] : 0;

        Bcols = indent0 < minTail ? Math.max(0, minTail - unit) : minTail;
      } else {
        Bcols = 0;
      }
    }

    // Build rows: first line keeps C=0; others use max(0, indent - B)
    const rows = new Array<PreLine>(lines.length);
    for (let i = 0; i < lines.length; i++) {
      const rest = lines[i].slice(charsArr[i]);
      const C = i === 0 ? 0 : Math.max(0, indents[i] - Bcols);
      rows[i] = { rest, C };
    }
    return { rows };

    function gcd(a: number, b: number): number {
      a = Math.abs(a);
      b = Math.abs(b);
      while (b !== 0) {
        const t = a % b;
        a = b;
        b = t;
      }
      return a;
    }
  }

  /** Assemble final string using A (cursor-left cols) and each row's C */
  function assemble(
    pre: { rows: PreLine[] },
    Acols: number,
    preferTabs: boolean
  ): string {
    const out = new Array<string>(pre.rows.length);
    for (let i = 0; i < pre.rows.length; i++) {
      const r = pre.rows[i];
      out[i] = i === 0 ? r.rest : makeIndent(Acols + r.C, preferTabs) + r.rest;
    }
    return out.join(sep);
  }

  /** Scan leading whitespace of a line → {chars consumed, visual columns} */
  function scanIndent(line: string): { chars: number; cols: number } {
    let i = 0,
      col = 0;
    while (i < line.length) {
      const c = line.charCodeAt(i);
      if (c === 32 /* ' ' */) {
        col += 1;
        i++;
      } else if (c === 9 /* '\t' */) {
        col += tabSize - (col % tabSize);
        i++;
      } else {
        break;
      }
    }
    return { chars: i, cols: col };
  }

  /** True if string consists only of spaces/tabs */
  function isAllIndent(s: string): boolean {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c !== 32 /* ' ' */ && c !== 9 /* '\t' */) return false;
    }
    return true;
  }

  /** Scan cursor-left (indent only) → A (cols) and whether a tab exists to bias output */
  function scanA(before: string): { Acols: number; hasTab: boolean } {
    let col = 0,
      hasTab = false;
    for (let i = 0; i < before.length; i++) {
      const c = before.charCodeAt(i);
      if (c === 32) {
        col += 1;
      } else if (c === 9) {
        hasTab = true;
        col += tabSize - (col % tabSize);
      } else {
        break;
      }
    }
    return { Acols: col, hasTab };
  }

  /** Convert visual columns to an indent string, preferring tabs when requested/observed */
  function makeIndent(targetCols: number, preferTabs: boolean): string {
    const cols = targetCols > 0 ? targetCols : 0;
    if (!preferTabs) return " ".repeat(cols);
    const tabs = Math.floor(cols / tabSize);
    const spaces = cols % tabSize;
    return "\t".repeat(tabs) + " ".repeat(spaces);
  }
}

/** Extension exit point (no-op for now) */
export function deactivate() {}
