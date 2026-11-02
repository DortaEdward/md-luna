import { Toolbar, NoDrag } from "@renderer/components/Toolbar";
import { useApp } from "@renderer/stores/globalStore";
import { useEffect, useRef, useState } from "react";
import TextEditor from "@renderer/components/TextEditor";
import MdViewer from "@renderer/components/MdViewer";
import MarkdownHelp from "@renderer/components/MarkdownHelp";
import { isInside } from "@renderer/lib/paths";
import { VIEW_MODE_EVENT } from "@renderer/lib/vimConfig";
import { ChevronLeft, ChevronRight, Share } from "lucide-react";
import { goBack, goForward, useHistory } from "@renderer/stores/historyStore";

type ViewMode = "edit" | "split" | "preview";

const MODES: { value: ViewMode; label: string; title: string }[] = [
  { value: "edit", label: "Editor", title: "Editor only" },
  { value: "split", label: "Split", title: "Editor and preview" },
  { value: "preview", label: "Preview", title: "Preview only" },
];

const toolbarBtn = "px-2 py-1 rounded text-muted hover:bg-hover hover:text-fg";

function NoteEditor({ notePath, mode }: { notePath: string; mode: ViewMode }) {
  const bumpNotes = useApp((s) => s.bumpNotes);
  const [initial, setInitial] = useState<string | null>(null);
  const [liveText, setLiveText] = useState("");
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Load the note; if it no longer exists, close it instead of hanging on "Loading…"
  useEffect(() => {
    let cancelled = false;
    window.api.aegis
      .readNote(notePath)
      .then((text) => {
        if (cancelled) return;
        setInitial(text);
        setLiveText(text);
      })
      .catch(() => {
        if (!cancelled) useApp.getState().setActiveNote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [notePath]);

  async function save() {
    clearTimeout(timer.current);
    if (pending.current === null) return;
    const text = pending.current;
    pending.current = null;
    try {
      await window.api.aegis.writeNote(notePath, text);
      bumpNotes();
    } catch (err) {
      // e.g. the note's folder was deleted outside the app
      console.warn("Could not save note:", err);
    }
  }

  function onChange(text: string) {
    setLiveText(text);
    pending.current = text;
    clearTimeout(timer.current);
    // Settings → Editor → Save changes (read fresh each time, so changes apply immediately)
    timer.current = setTimeout(save, useApp.getState().prefs.autosaveDelay);
  }

  // Flush unsaved edits when switching notes, closing the window, or starting a drag-move
  useEffect(() => {
    window.addEventListener("beforeunload", save);
    window.addEventListener("note:flush", save);
    return () => {
      window.removeEventListener("beforeunload", save);
      window.removeEventListener("note:flush", save);
      save();
    };
  }, []);

  // If this note (or its notebook) is being trashed, throw away unsaved edits
  // so the delayed save can't write the file back
  useEffect(() => {
    function onDiscard(e: Event) {
      const trashed = (e as CustomEvent<string>).detail;
      if (isInside(notePath, trashed)) {
        clearTimeout(timer.current);
        pending.current = null;
      }
    }
    window.addEventListener("note:discard", onDiscard);
    return () => window.removeEventListener("note:discard", onDiscard);
  }, [notePath]);

  if (initial === null) return <div className="flex-1 p-8 text-muted">Loading…</div>;

  const documentName = notePath.split(/[\\/]/).pop() ?? notePath;
  const showEditor = mode !== "preview";
  const showPreview = mode !== "edit";

  return (
    <div className="flex-1 min-h-0 flex">
      {/* Editor stays mounted in preview mode so edits and undo history survive */}
      <div
        className={`min-w-0 min-h-0 overflow-hidden ${
          !showEditor ? "hidden" : mode === "split" ? "w-1/2 border-r border-line" : "w-full"
        }`}
      >
        <TextEditor
          initialValue={initial}
          onChange={onChange}
          onImage={(file) => window.api.aegis.saveImage(notePath, file)}
          className="text-fg"
        />
      </div>

      {showPreview && (
        <div className={`${mode === "split" ? "w-1/2" : "w-full"} min-w-0 min-h-0 flex flex-col`}>
          <MdViewer content={liveText} documentName={documentName} notePath={notePath} />
        </div>
      )}
    </div>
  );
}

function ModeSwitcher({
  mode,
  onChange,
  disabled,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="tablist"
      className={`flex items-center rounded-md bg-hover p-0.5 text-sm ${
        disabled ? "opacity-40 pointer-events-none" : ""
      }`}
    >
      {MODES.map((m) => (
        <button
          key={m.value}
          role="tab"
          aria-selected={mode === m.value}
          title={m.title}
          onClick={() => onChange(m.value)}
          className={`px-2.5 py-0.5 rounded ${
            mode === m.value ? "bg-bg text-fg shadow-sm" : "text-muted hover:text-fg"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

export default function Homepage() {
  const activeNote = useApp((s) => s.activeNote);
  const canGoBack = useHistory((s) => s.index > 0);
  const canGoForward = useHistory((s) => s.index < s.entries.length - 1);
  // Settings → Editor → Open notes in (used when the app starts)
  const [mode, setMode] = useState<ViewMode>(() => useApp.getState().prefs.defaultMode);
  const [showHelp, setShowHelp] = useState(false);

  // Cmd/Ctrl + 1/2/3 switch modes, Cmd/Ctrl + / toggles the Markdown reference
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;

      if (e.key === "/") {
        e.preventDefault();
        setShowHelp((v) => !v);
        return;
      }

      const next = ({ "1": "edit", "2": "split", "3": "preview" } as const)[e.key];
      if (next) {
        e.preventDefault();
        setMode(next);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Vim commands :Editor, :Split and :Preview
  useEffect(() => {
    function onMode(e: Event) {
      const next = (e as CustomEvent<string>).detail;
      if (next === "edit" || next === "split" || next === "preview") setMode(next);
    }
    window.addEventListener(VIEW_MODE_EVENT, onMode);
    return () => window.removeEventListener(VIEW_MODE_EVENT, onMode);
  }, []);

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col">
      <Toolbar className="w-full shrink-0 gap-1">
        <NoDrag>
          <button
            onClick={goBack}
            disabled={!canGoBack}
            title="Back (⌘[)"
            className={`${toolbarBtn} disabled:opacity-30 disabled:pointer-events-none`}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={goForward}
            disabled={!canGoForward}
            title="Forward (⌘])"
            className={`${toolbarBtn} disabled:opacity-30 disabled:pointer-events-none`}
          >
            <ChevronRight size={18} />
          </button>
        </NoDrag>

        <div className="flex-1" />

        <NoDrag>
          <div className="flex items-center gap-2">
            <button
              onClick={() => activeNote && window.api.aegis.showExportMenu(activeNote)}
              disabled={!activeNote}
              title="Export as PDF or HTML"
              className={`${toolbarBtn} disabled:opacity-30 disabled:pointer-events-none`}
            >
              <Share size={16} />
            </button>
            <button
              onClick={() => setShowHelp(true)}
              title="Markdown reference (⌘/)"
              className="w-6 h-6 rounded-full text-sm text-muted border border-line hover:bg-hover hover:text-fg"
            >
              ?
            </button>
            <ModeSwitcher mode={mode} onChange={setMode} disabled={!activeNote} />
          </div>
        </NoDrag>
      </Toolbar>

      {!activeNote ? (
        <div className="flex-1 flex items-center justify-center text-muted">Select a note</div>
      ) : (
        <NoteEditor key={activeNote} notePath={activeNote} mode={mode} />
      )}

      <MarkdownHelp open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}