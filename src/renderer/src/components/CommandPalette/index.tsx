import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Book, FileText, Search } from "lucide-react";
import { useApp } from "@renderer/stores/globalStore";
import type { Aegis } from "../../../../shared/types/aegis.types";
import { flattenAegis } from "../../../../shared/tree";
import type { Note } from "../../../../shared/types/shared";

type Result =
  | { kind: "aegis"; id: string; aegis: Aegis; score: number }
  | { kind: "note"; id: string; note: Note; aegis: Aegis; score: number; inContent: boolean };

export const OPEN_PALETTE_EVENT = "palette:open";

/** Call this from anywhere (e.g. the sidebar search box) to open the palette */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
}

function noteName(note: Note) {
  return note.name ?? note.path.split(/[\\/]/).pop()?.replace(/\.md$/i, "") ?? "";
}

// Higher = better match. 0 = no match.
function scoreText(text: string, q: string) {
  const t = text.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.split(/[\s\-_]+/).some((w) => w.startsWith(q))) return 60;
  if (t.includes(q)) return 40;
  return 0;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-accent/20 text-inherit rounded-sm">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export default function CommandPalette() {
  const navigate = useNavigate();
  const tree = useApp((s) => s.tree);
  const notebooks = useMemo(() => flattenAegis(tree), [tree]); // nested notebooks included
  const setActiveAegis = useApp((s) => s.setActiveAegis);
  const setActiveNote = useApp((s) => s.setActiveNote);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [allNotes, setAllNotes] = useState<{ note: Note; aegis: Aegis }[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  /* ----- open / close ----- */

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        setOpen((v) => !v);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey, true); // capture: works even inside the editor
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  // Load every note from every notebook each time the palette opens
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);

    let cancelled = false;
    Promise.all(
      notebooks.map((aegis) =>
        window.api.aegis
          .listNotes(aegis.path)
          .then((notes) => notes.map((note) => ({ note, aegis })))
          .catch(() => [])
      )
    ).then((groups) => {
      if (!cancelled) setAllNotes(groups.flat());
    });

    return () => {
      cancelled = true;
    };
  }, [open, notebooks]);

  /* ----- results ----- */

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();

    if (!q) {
      const recent = [...allNotes].sort((a, b) => b.note.updatedAt - a.note.updatedAt).slice(0, 8);
      return [
        ...notebooks.map((aegis) => ({ kind: "aegis" as const, id: `a:${aegis.path}`, aegis, score: 0 })),
        ...recent.map(({ note, aegis }) => ({
          kind: "note" as const,
          id: `n:${note.path}`,
          note,
          aegis,
          score: 0,
          inContent: false,
        })),
      ];
    }

    const aegisResults: Result[] = tree
      .map((aegis) => ({ kind: "aegis" as const, id: `a:${aegis.path}`, aegis, score: Math.max(scoreText(aegis.name, q), scoreText(aegis.trail, q) && 30) }))
      .filter((r) => r.score > 0);

    const noteResults: Result[] = allNotes
      .map(({ note, aegis }) => {
        const nameScore = scoreText(noteName(note), q);
        const contentHit = !nameScore && (note.preview ?? "").toLowerCase().includes(q);
        return {
          kind: "note" as const,
          id: `n:${note.path}`,
          note,
          aegis,
          score: nameScore || (contentHit ? 10 : 0),
          inContent: contentHit,
        };
      })
      .filter((r) => r.score > 0);

    const byScore = (a: Result, b: Result) => b.score - a.score;
    return [...aegisResults.sort(byScore), ...noteResults.sort(byScore).slice(0, 50)];
  }, [query, notebooks, allNotes]);

  useEffect(() => setIndex(0), [query]);

  // Keep the highlighted row visible
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  /* ----- actions ----- */

  function choose(r: Result | undefined) {
    if (!r) return;
    navigate("/");
    if (r.kind === "aegis") {
      setActiveAegis(r.aegis.path);
    } else {
      setActiveAegis(r.aegis.path);
      setActiveNote(r.note.path);
    }
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[index]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  if (!open) return null;

  const firstNoteIndex = results.findIndex((r) => r.kind === "note");
  const hasAegis = results.some((r) => r.kind === "aegis");

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh] px-4 no-drag"
      onMouseDown={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-bg text-fg rounded-xl border border-line shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-3 border-b border-line">
          <Search size={16} className="text-muted shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search notebooks and notes…"
            className="flex-1 min-w-0 bg-transparent outline-none py-3 text-sm placeholder:text-muted"
          />
          <kbd className="text-[10px] text-muted border border-line rounded px-1.5 py-0.5">esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
          {results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted">
              {query ? `Nothing matches “${query}”` : "No notebooks yet"}
            </div>
          )}

          {results.map((r, i) => (
            <div key={r.id}>
              {i === 0 && hasAegis && (
                <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-muted">Notebooks</div>
              )}
              {i === firstNoteIndex && (
                <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-muted">
                  {query ? "Notes" : "Recent notes"}
                </div>
              )}

              <button
                data-index={i}
                onMouseMove={() => setIndex(i)}
                onClick={() => choose(r)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left ${
                  i === index ? "bg-accent/10" : ""
                }`}
              >
                {r.kind === "aegis" ? (
                  <>
                    <Book size={16} className="shrink-0 text-muted" />
                    <span className="flex-1 min-w-0 truncate text-sm">
                      <Highlight text={r.aegis.trail} query={query} />
                    </span>
                    <span className="text-xs text-muted">{r.aegis.noteCount} notes</span>
                  </>
                ) : (
                  <>
                    <FileText size={16} className="shrink-0 text-muted" />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-sm">
                        <Highlight text={noteName(r.note)} query={query} />
                      </span>
                      {r.inContent && r.note.preview && (
                        <span className="block truncate text-xs text-muted">
                          <Highlight text={r.note.preview} query={query} />
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted truncate max-w-[35%]">{r.aegis.trail}</span>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-line px-3 py-1.5 text-[11px] text-muted flex gap-3">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>⌘K toggle</span>
        </div>
      </div>
    </div>
  );
}