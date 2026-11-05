import { useApp } from "@renderer/stores/globalStore";
import { useEffect, useRef, useState } from "react";
import TextEditor from "@renderer/components/TextEditor";
import MdViewer from "@renderer/components/MdViewer";
import { isInside } from "@renderer/lib/paths";

type ViewMode = "edit" | "split" | "preview";

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
          <MdViewer content={liveText} documentName={documentName} notePath={notePath} previewOnly={mode === "preview"} />
        </div>
      )}
    </div>
  );
}

export default function Homepage(): React.JSX.Element {
  const activeNote = useApp((s) => s.activeNote);
  // Editor / Split / Preview lives in the store, so the title bar can switch it
  const mode = useApp((s) => s.viewMode);

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col">
      {!activeNote ? (
        <div className="flex-1 flex items-center justify-center text-muted">Select a note</div>
      ) : (
        <NoteEditor key={activeNote} notePath={activeNote} mode={mode} />
      )}
    </div>
  );
}
