import * as vscode from "vscode";

let offsetToPosition = (text: string, offset: number): vscode.Position => {
  const res = text.substr(0, offset);
  const lines = res.split(/\r\n|\r|\n/);
  const lineNumber = lines.length - 1;
  const charNumber = offset - res.lastIndexOf("\n") - 1;
  return new vscode.Position(lineNumber, charNumber);
};

let selectPattern = (editor: vscode.TextEditor, allText: string, pattern): string => {
  if (editor) {
    let match;
    let selectionTest;
    let cursorLine = editor.selection.active.line;
    while (match = pattern.exec(allText)) {
      let startPoint = offsetToPosition(allText, match.index);
      let endPoint = offsetToPosition(allText, pattern.lastIndex);
      if (startPoint.line <= cursorLine && cursorLine <= endPoint.line) {
        selectionTest = new vscode.Selection(startPoint, endPoint);
        editor.selection = selectionTest;
        return editor.document.getText(editor.selection);
      }
    }
  }
  return null;
};

export let selectAll = (editor: vscode.TextEditor): string => {
  const allText = editor.document.getText();
  editor.selection = new vscode.Selection(editor.document.positionAt(0), editor.document.positionAt(allText.length));
  return editor.document.getText(editor.selection);
};

export let selectCurrentStatement = (editor: vscode.TextEditor): string => {
  const allText = editor.document.getText();
  let selectedText = (editor.document.getText(editor.selection));
  if (!selectedText || selectedText.length === 0) {
    selectedText =
      (selectPattern(editor, allText, /(?<!\()(select|with|update|insert|delete|alter|grant|drop|truncate|revoke|explain)(.*?)(;|\n[\/]\s*?(\n|\z))/gis))
      ??
      (selectPattern(editor, allText, /(?=begin|declare|create|replace)(.*?)end\s*?;\s*?\n[\/]\s*?(\n|\z)/sig))
      ??
      selectAll(editor);
  }
  return selectedText;
};