import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";

/**
 * CodeMirror 6 canvas wired to the debounced save.
 *
 * A plain notepad surface: line wrapping on, no line numbers, no gutters,
 * no active-line highlight, no decorations, no Markdown language mode, no
 * autocompletion — per D-04 the double-Enter boundary is the blank line in
 * the text itself and needs zero rendering treatment in this phase.
 */
export function EditorCanvas(props: {
  date: Date;
  initialText: string;
  onScheduleSave: (text: string) => void;
  onFlush: () => void;
  readOnly?: boolean;
}) {
  const { initialText, onScheduleSave, onFlush, readOnly = false } = props;

  const themeExtension = useMemo(
    () =>
      EditorView.theme(
        {
          "&": {
            backgroundColor: "var(--bg)",
            color: "var(--fg)",
            height: "100%",
          },
          ".cm-content": {
            caretColor: "var(--fg)",
            fontFamily: "inherit",
            fontSize: "inherit",
            lineHeight: "inherit",
            padding: 0,
          },
          ".cm-cursor, .cm-dropCursor": {
            borderLeftColor: "var(--fg)",
          },
          "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
            backgroundColor: "var(--selection) !important",
          },
          ".cm-gutters": {
            display: "none",
          },
          ".cm-scroller": {
            fontFamily: "inherit",
          },
          "&.cm-editor.cm-focused": {
            outline: "none",
          },
        },
        { dark: true },
      ),
    [],
  );

  const behaviorExtensions = useMemo(
    () => [
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onScheduleSave(update.state.doc.toString());
        }
      }),
      EditorView.domEventHandlers({
        blur: () => {
          onFlush();
          return false;
        },
      }),
    ],
    [onScheduleSave, onFlush],
  );

  return (
    <CodeMirror
      value={initialText}
      autoFocus
      editable={!readOnly}
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        autocompletion: false,
        closeBrackets: false,
        bracketMatching: false,
      }}
      extensions={[themeExtension, ...behaviorExtensions]}
    />
  );
}
