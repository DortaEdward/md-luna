import { useEffect } from "react";
import { ChevronLeft, ChevronRight, List, Maximize2, Minimize2, PanelLeft, Share } from "lucide-react";
import { useApp, type ViewMode } from "@renderer/stores/globalStore";
import { goBack, goForward, useHistory } from "@renderer/stores/historyStore";
import MarkdownHelp from "@renderer/components/MarkdownHelp";
import { NoDrag } from "@renderer/components/Toolbar";

/*
 * The one title bar across the top of the window:
 *
 *   ● ● ●  [sidebar][notes] ‹ ›      Note title      [focus] [share] [?] [Editor|Split|Preview]
 *
 * The macOS window buttons always sit in the reserved space on the left, and the
 * panels below start under this bar, so nothing ever crosses or crowds them.
 */

const btn =
  "p-1.5 rounded-md text-muted hover:bg-hover hover:text-fg disabled:opacity-30 disabled:pointer-events-none";

/** A title-bar toggle that looks pressed while its panel is open */
function PanelToggle({
  open,
  onClick,
  label,
  shortcut,
  children,
}: {
  open: boolean;
  onClick: () => void;
  label: string;
  shortcut: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      aria-pressed={open}
      title={`${open ? "Hide" : "Show"} ${label} (${shortcut})`}
      className={`p-1.5 rounded-md hover:bg-hover hover:text-fg ${open ? "text-fg" : "text-muted"}`}
    >
      {children}
    </button>
  );
}

const MODES: { value: ViewMode; label: string; title: string }[] = [
  { value: "edit", label: "Editor", title: "Editor only (⌘1)" },
  { value: "split", label: "Split", title: "Editor and preview (⌘2)" },
  { value: "preview", label: "Preview", title: "Preview only (⌘3)" },
];

function ModeSwitcher({ disabled }: { disabled: boolean }): React.JSX.Element {
  const mode = useApp((s) => s.viewMode);
  const setMode = useApp((s) => s.setViewMode);
  return (
    <div
      role="tablist"
      className={`flex items-center rounded-md bg-hover p-0.5 text-sm ${disabled ? "opacity-40 pointer-events-none" : ""}`}
    >
      {MODES.map((m) => (
        <button
          key={m.value}
          role="tab"
          aria-selected={mode === m.value}
          title={m.title}
          onClick={() => setMode(m.value)}
          className={`px-2.5 py-0.5 rounded ${mode === m.value ? "bg-bg text-fg shadow-sm" : "text-muted hover:text-fg"}`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

export default function TitleBar(): React.JSX.Element {
  const sidebarOpen = useApp((s) => s.sidebarOpen);
  const notesOpen = useApp((s) => s.notesOpen);
  const toggleSidebar = useApp((s) => s.toggleSidebar);
  const toggleNotes = useApp((s) => s.toggleNotes);
  const toggleFocus = useApp((s) => s.toggleFocus);
  const inFocus = !sidebarOpen && !notesOpen;
  const activeNote = useApp((s) => s.activeNote);
  const helpOpen = useApp((s) => s.helpOpen);
  const setHelpOpen = useApp((s) => s.setHelpOpen);
  const canGoBack = useHistory((s) => s.index > 0);
  const canGoForward = useHistory((s) => s.index < s.entries.length - 1);

  const noteName = activeNote ? (activeNote.split(/[\\/]/).pop() ?? "").replace(/\.md$/i, "") : "";

  // Keyboard: ⌘1/2/3 view · ⌘/ Markdown reference · ⌘⌥1 sidebar · ⌘⌥2 notes list · ⌘\ focus
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey) return;
      const { toggleSidebar, toggleNotes, toggleFocus, setViewMode, setHelpOpen, helpOpen } = useApp.getState();

      if (e.altKey) {
        // Option changes e.key on a Mac ("¡", "™"...), so use the physical key
        if (e.code === "Digit1") toggleSidebar();
        else if (e.code === "Digit2") toggleNotes();
        else return;
        e.preventDefault();
        return;
      }
      if (e.key === "\\") {
        e.preventDefault();
        e.stopPropagation();
        toggleFocus();
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        setHelpOpen(!helpOpen);
        return;
      }
      const mode = ({ "1": "edit", "2": "split", "3": "preview" } as const)[e.key];
      if (mode) {
        e.preventDefault();
        setViewMode(mode);
      }
    }
    window.addEventListener("keydown", onKey, true); // capture: works inside the editor too
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return (
    <>
    <header className="h-10 shrink-0 flex items-center gap-2 pr-3 pl-20 bg-side border-b border-line select-none drag">
      <NoDrag>
        <div className="flex items-center">
          <PanelToggle open={sidebarOpen} onClick={toggleSidebar} label="sidebar" shortcut="⌘⌥1">
            <PanelLeft size={17} />
          </PanelToggle>
          <PanelToggle open={notesOpen} onClick={toggleNotes} label="notes list" shortcut="⌘⌥2">
            <List size={17} />
          </PanelToggle>
        </div>
        <div className="flex items-center">
          <button onClick={goBack} disabled={!canGoBack} title="Back (⌘[)" className={btn}>
            <ChevronLeft size={18} />
          </button>
          <button onClick={goForward} disabled={!canGoForward} title="Forward (⌘])" className={btn}>
            <ChevronRight size={18} />
          </button>
        </div>
      </NoDrag>

      {/* The middle stays draggable, so the window can be moved by its title */}
      <div className="flex-1 min-w-0 text-center text-sm text-muted truncate px-4">{noteName}</div>

      <NoDrag>
        <button
          onClick={toggleFocus}
          title={inFocus ? "Leave focus: bring the panels back (⌘\\)" : "Focus: hide both panels (⌘\\)"}
          className={btn}
        >
          {inFocus ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        <button
          onClick={() => activeNote && window.api.aegis.showExportMenu(activeNote)}
          disabled={!activeNote}
          title="Export as PDF or HTML"
          className={btn}
        >
          <Share size={16} />
        </button>
        <button
          onClick={() => setHelpOpen(true)}
          title="Markdown reference (⌘/)"
          className="w-6 h-6 rounded-full text-sm text-muted border border-line hover:bg-hover hover:text-fg"
        >
          ?
        </button>
        <ModeSwitcher disabled={!activeNote} />
      </NoDrag>
    </header>

    {/* Outside the bar: the bar is a window-drag area, the popup must not be */}
    <MarkdownHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
