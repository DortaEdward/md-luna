import { useEffect, useRef, useState } from "react";
import { Vim, getCM } from "@replit/codemirror-vim";
import { useApp } from "@renderer/stores/globalStore";
import { focusEditorSoon, getActiveEditor } from "@renderer/lib/activeEditor";

/*
 * Vim keys for the preview, so Preview mode isn't a dead end:
 *   :       command line, runs the same commands as the editor (:Split, :Editor, :w, :Ex, ...)
 *   i       back to the editor (Editor view if you're in Preview)
 *   j / k   scroll down / up          gg / G   top / bottom
 *   Ctrl-d / Ctrl-u   half a page down / up
 * Only active when Vim mode is on and nothing else has the keyboard (the editor, a text box, a popup).
 */

const LINE = 48; // px per j / k

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.isContentEditable ||
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    !!el.closest(".cm-editor")
  );
}

function runEx(command: string): string | null {
  const view = getActiveEditor();
  const cm = view ? getCM(view) : null;
  if (!cm) return "No note is open";
  try {
    Vim.handleEx(cm as Parameters<typeof Vim.handleEx>[0], command);
    return null;
  } catch (err) {
    return (err as Error).message || "Command failed";
  }
}

export function usePreviewVim(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  isPreviewOnly: boolean
): React.JSX.Element | null {
  const vimMode = useApp((s) => s.prefs.vimMode);
  const [commandOpen, setCommandOpen] = useState(false);
  const [command, setCommand] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const pendingG = useRef(false);

  useEffect(() => {
    if (!vimMode) return;

    function onKey(e: KeyboardEvent): void {
      if (commandOpen || isTyping(e.target) || useApp.getState().settingsOpen) return;
      const scroller = scrollRef.current;
      if (!scroller) return;

      const half = scroller.clientHeight / 2;
      const by = (top: number): void => scroller.scrollBy({ top, behavior: "auto" });

      if (e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === "d") by(half);
        else if (e.key === "u") by(-half);
        else return;
        e.preventDefault();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const wasG = pendingG.current;
      pendingG.current = false;

      switch (e.key) {
        case ":":
          setCommand("");
          setMessage(null);
          setCommandOpen(true);
          break;
        case "i":
          // In Preview, go to the editor; in Split, just put the cursor in it
          if (isPreviewOnly) useApp.getState().setViewMode("edit");
          focusEditorSoon();
          break;
        case "j":
          by(LINE);
          break;
        case "k":
          by(-LINE);
          break;
        case "G":
          scroller.scrollTo({ top: scroller.scrollHeight });
          break;
        case "g":
          if (wasG) scroller.scrollTo({ top: 0 });
          else pendingG.current = true;
          break;
        default:
          return;
      }
      e.preventDefault();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [vimMode, commandOpen, isPreviewOnly, scrollRef]);

  // Hide an error message after a moment
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message]);

  if (!vimMode || (!commandOpen && !message)) return null;

  return (
    <div className="absolute bottom-0 inset-x-0 z-20 border-t border-line bg-bg px-3 py-1 font-mono text-sm">
      {commandOpen ? (
        <form
          className="flex items-center"
          onSubmit={(e) => {
            e.preventDefault();
            setCommandOpen(false);
            const cmd = command.trim();
            if (!cmd) return;
            const error = runEx(cmd);
            if (error) setMessage(error);
            else if (/^(Editor|Split)$/.test(cmd)) focusEditorSoon(); // back where you can type
          }}
        >
          <span className="text-muted">:</span>
          <input
            autoFocus
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" || (e.key === "Backspace" && command === "")) {
                e.preventDefault();
                setCommandOpen(false);
              }
            }}
            onBlur={() => setCommandOpen(false)}
            spellCheck={false}
            className="flex-1 bg-transparent outline-none"
            aria-label="Vim command"
          />
        </form>
      ) : (
        <span className="text-red-500">{message}</span>
      )}
    </div>
  );
}
