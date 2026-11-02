import { useEffect, useRef } from "react";
import { EditorView, keymap } from "@codemirror/view";
import { Compartment, EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { vim } from "@replit/codemirror-vim";
import { applyVimConfig, vimMappings } from "@renderer/lib/vimConfig";
import { lineNumberGutter } from "@renderer/lib/lineNumbers";
import { languages } from "@codemirror/language-data";
import {
  history,
  defaultKeymap,
  historyKeymap,
  insertTab,
  indentLess,
} from "@codemirror/commands";
import { useApp } from "@renderer/stores/globalStore";
import { frontMatterLength } from "@renderer/lib/frontmatter";
import editorTheme from "./EditorTheme";

type TextEditorProps = {
  initialValue: string;
  onChange: (s: string) => void;
  className?: string;
  /** Save a pasted/dropped image and return the link to insert (e.g. "_attachments/x.png") */
  onImage?: (file: File) => Promise<string>;
};

const imageFiles = (list: FileList | null | undefined): File[] =>
  Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));

// Insert ![](link) for each image at `pos`, each on its own line
async function insertImages(view: EditorView, files: File[], pos: number, save: (f: File) => Promise<string>) {
  const links: string[] = [];
  for (const file of files) {
    try {
      const rel = await save(file);
      const alt = file.name && !/^image\.\w+$/i.test(file.name) ? file.name.replace(/\.[^.]+$/, "") : "";
      links.push(`![${alt.replace(/[[\]]/g, "")}](${rel.split("/").map(encodeURIComponent).join("/")})`);
    } catch (err) {
      console.error("Could not save image:", err);
    }
  }
  if (!links.length) return;
  const line = view.state.doc.lineAt(pos);
  const before = pos > line.from && line.text.trim() ? "\n" : "";
  const insert = before + links.join("\n") + "\n";
  view.dispatch({ changes: { from: pos, insert }, selection: { anchor: pos + insert.length } });
  view.focus();
}

// Builds the spellcheck attribute CodeMirror puts on the editable area
const spellcheckAttr = (on: boolean) =>
  EditorView.contentAttributes.of({ spellcheck: on ? "true" : "false" });

// Vim keys and motions (must come before other keymaps so it sees keys first)
const vimExt = (on: boolean) => (on ? [vimMappings(), vim()] : []);

export default function TextEditor({ initialValue, onChange, className, onImage }: TextEditorProps) {
  const spellcheck = useApp((s) => s.prefs.spellcheck);
  const vimMode = useApp((s) => s.prefs.vimMode);
  const vimConfig = useApp((s) => s.prefs.vimConfig);
  const showNumbers = useApp((s) => s.prefs.lineNumbers);
  const relativeNumbers = useApp((s) => s.prefs.relativeLineNumbers);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const spellcheckSlot = useRef(new Compartment()); // lets us swap spellcheck on/off later
  const vimSlot = useRef(new Compartment()); // lets us swap vim mode on/off later
  const numbersSlot = useRef(new Compartment()); // line number gutter
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onImageRef = useRef(onImage);
  onImageRef.current = onImage;

  // Create the editor once
  useEffect(() => {
    if (!containerRef.current) return;

    // Start the cursor just below the front matter (if the note has one)
    const start = Math.min(frontMatterLength(initialValue), initialValue.length);

    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: initialValue,
        selection: { anchor: start },
        extensions: [
          vimSlot.current.of(vimExt(vimMode)),
          numbersSlot.current.of(lineNumberGutter(showNumbers, relativeNumbers)),
          EditorView.lineWrapping,
          // Paste or drop images: saved next to the note and linked at the cursor / drop point
          EditorView.domEventHandlers({
            paste(e, view) {
              const files = imageFiles(e.clipboardData?.files);
              const save = onImageRef.current;
              if (!files.length || !save) return false;
              e.preventDefault();
              insertImages(view, files, view.state.selection.main.head, save);
              return true;
            },
            drop(e, view) {
              const files = imageFiles(e.dataTransfer?.files);
              const save = onImageRef.current;
              if (!files.length || !save) return false;
              e.preventDefault();
              const pos = view.posAtCoords({ x: e.clientX, y: e.clientY }) ?? view.state.selection.main.head;
              insertImages(view, files, pos, save);
              return true;
            },
          }),
          history(),
          // Keep Tab inside the editor: Tab inserts a tab (or indents a selection),
          // Shift+Tab outdents. Without this the browser moves focus away.
          keymap.of([
            { key: "Tab", run: insertTab, shift: indentLess },
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          markdown({ codeLanguages: languages }),
          editorTheme,
          spellcheckSlot.current.of(spellcheckAttr(spellcheck)),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
    });

    viewRef.current = view;
    view.focus();
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Toggle spell check without rebuilding the editor
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: spellcheckSlot.current.reconfigure(spellcheckAttr(spellcheck)),
    });
  }, [spellcheck]);

  // Toggle vim mode without rebuilding the editor
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: vimSlot.current.reconfigure(vimExt(vimMode)),
    });
  }, [vimMode]);

  // Line numbers / relative line numbers (Settings, or :set nu / :set rnu)
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: numbersSlot.current.reconfigure(lineNumberGutter(showNumbers, relativeNumbers)),
    });
  }, [showNumbers, relativeNumbers]);

  // Load the user's keymaps (Settings → Editor → Vim keymaps)
  useEffect(() => {
    applyVimConfig(vimConfig);
  }, [vimConfig]);

  return <div ref={containerRef} className={`h-full w-full min-w-0 ${className ?? ""}`} />;
}