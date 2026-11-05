import { Vim, getCM } from "@replit/codemirror-vim";
import { EditorView } from "@codemirror/view";
import { Prec, type Extension } from "@codemirror/state";
import { useApp } from "@renderer/stores/globalStore";
import { openCommandPalette } from "@renderer/components/CommandPalette";
import { DEFAULT_VIM_CONFIG } from "./vimDefaults";
import { exportNote } from "./exportNote";

/*
 * User Vim config (Settings → Editor → Vim keymaps).
 *
 * Accepts the common Neovim Lua and Vimscript ways of writing key mappings:
 *   vim.g.mapleader = " "
 *   vim.keymap.set("n", "<leader>pv", vim.cmd.Ex)
 *   vim.keymap.set({ "n", "v" }, "<leader>y", '"+y')
 *   let mapleader = ","
 *   nnoremap <leader>w :w<CR>
 *   inoremap jk <Esc>
 */

export { DEFAULT_VIM_CONFIG };

export type VimConfigError = { line: number; message: string };

/** Options a config can set, like vim.opt.relativenumber = true or set rnu */
const OPTIONS: Record<string, "lineNumbers" | "relativeLineNumbers"> = {
  number: "lineNumbers",
  nu: "lineNumbers",
  relativenumber: "relativeLineNumbers",
  rnu: "relativeLineNumbers",
};
type OptionSetting = { pref: "lineNumbers" | "relativeLineNumbers"; value: boolean };


/* ---------- App commands (:Ex, :w, ...) ---------- */

let commandsRegistered = false;

function registerAppCommands(): void {
  if (commandsRegistered) return;
  commandsRegistered = true;

  const save = (): boolean => window.dispatchEvent(new Event("note:flush"));
  const close = (): void => useApp.getState().setActiveNote(null);
  const setMode = (mode: "edit" | "split" | "preview"): void => useApp.getState().setViewMode(mode);

  // :set nu / :set rnu / :set rnu! / :set nonu ... drive the editor settings
  const boolOption = (name: string, alias: string, pref: "lineNumbers" | "relativeLineNumbers"): void =>
    Vim.defineOption(name, undefined, "boolean", [alias], (value?: boolean) => {
      if (value === undefined) return useApp.getState().prefs[pref];
      if (useApp.getState().prefs[pref] !== value) useApp.getState().setPref(pref, value);
      return undefined;
    });
  boolOption("number", "nu", "lineNumbers");
  boolOption("relativenumber", "rnu", "relativeLineNumbers");

  Vim.defineEx("write", "w", save);
  Vim.defineEx("quit", "q", close);
  Vim.defineEx("wq", "wq", () => {
    save();
    close();
  });
  Vim.defineEx("xit", "x", () => {
    save();
    close();
  });
  Vim.defineEx("Explore", "Ex", () => openCommandPalette());
  // Panels. No argument toggles; "open"/"close" (or "show"/"hide", "on"/"off") set it.
  //   :Sidebar   :Sidebar close   :Notes   :Notes open   :Focus
  const panelCommand =
    (set: (open: boolean) => void, toggle: () => void) =>
    (_cm: unknown, params: { args?: string[] }): void => {
      const arg = (params.args?.[0] ?? "").toLowerCase();
      if (["open", "show", "on"].includes(arg)) set(true);
      else if (["close", "hide", "off"].includes(arg)) set(false);
      else toggle();
    };
  Vim.defineEx(
    "Sidebar",
    "Side",
    panelCommand(
      (open) => useApp.getState().setSidebarOpen(open),
      () => useApp.getState().toggleSidebar()
    )
  );
  Vim.defineEx(
    "Notes",
    "Notes",
    panelCommand(
      (open) => useApp.getState().setNotesOpen(open),
      () => useApp.getState().toggleNotes()
    )
  );
  Vim.defineEx("Focus", "Focus", () => useApp.getState().toggleFocus());
  Vim.defineEx("Editor", "Editor", () => setMode("edit"));
  Vim.defineEx("Split", "Split", () => setMode("split"));
  Vim.defineEx("Preview", "Preview", () => setMode("preview"));
  Vim.defineEx("ExportPdf", "ExportP", () => {
    const { activeNote } = useApp.getState();
    if (activeNote) void exportNote(activeNote, "pdf");
  });
  Vim.defineEx("ExportHtml", "ExportH", () => {
    const { activeNote } = useApp.getState();
    if (activeNote) void exportNote(activeNote, "html");
  });
  Vim.defineEx("Settings", "Settings", () => useApp.getState().setSettingsOpen(true));
  Vim.defineEx("Favorite", "Favorite", () => {
    const { activeNote, toggleFavorite } = useApp.getState();
    if (activeNote) void toggleFavorite(activeNote);
  });
}

/* ---------- Parsing helpers ---------- */

type Mapping = { line: number; lhs: string; rhs: string; ctx?: string; noremap: boolean };
type Unmap = { line: number; lhs: string; ctx?: string };

const MODE_CTX: Record<string, string | undefined | null> = {
  "": undefined, // all modes
  n: "normal",
  i: "insert",
  v: "visual",
  x: "visual",
  o: "operatorPending",
  // anything else (c, t, s, ...) is unsupported → null
};

function modeToCtx(mode: string): string | undefined | null {
  return mode in MODE_CTX ? MODE_CTX[mode] : null;
}

/** Split a Lua argument list on top-level commas, keeping strings/tables/calls intact */
function splitArgs(src: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      cur += src.slice(i, j + 1);
      i = j;
      continue;
    }
    if (c === "[" && src[i + 1] === "[") {
      const end = src.indexOf("]]", i + 2);
      const j = end === -1 ? src.length : end + 2;
      cur += src.slice(i, j);
      i = j - 1;
      continue;
    }
    if (c === "(" || c === "{" || c === "[") depth++;
    if (c === ")" || c === "}" || c === "]") depth--;
    if (c === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Read a Lua string literal ("x", 'x', [[x]]); null if it isn't one */
function luaString(src: string): string | null {
  const s = src.trim();
  const long = s.match(/^\[\[([\s\S]*)\]\]$/);
  if (long) return long[1];
  const q = s[0];
  if ((q !== '"' && q !== "'") || s[s.length - 1] !== q || s.length < 2) return null;
  return s
    .slice(1, -1)
    .replace(/\\(.)/g, (_, ch: string) => ({ n: "\n", t: "\t" })[ch] ?? ch);
}

/** Vimscript-style quoted value, e.g. " ", ",", "\<Space>" */
function vimString(src: string): string | null {
  const s = src.trim();
  const m = s.match(/^"(.*)"$/) ?? s.match(/^'(.*)'$/);
  if (!m) return null;
  return m[1].replace(/\\<([^>]+)>/g, "<$1>");
}

/** Turn a leader value into the key notation the Vim plugin uses */
function leaderKey(value: string): string {
  if (value === " ") return "<Space>";
  if (value === "<") return "<lt>";
  return value;
}

/** Turn a Lua right-hand side into keys to type */
function luaRhs(src: string): string | null {
  const s = src.trim();

  // vim.cmd.Ex  →  :Ex<CR>
  let m = s.match(/^vim\.cmd\.(\w+)$/);
  if (m) return `:${m[1]}<CR>`;

  // vim.cmd("Ex") / vim.cmd "Ex" / function() vim.cmd("Ex") end
  m = s.match(/^(?:function\s*\(\s*\)\s*)?vim\.cmd\s*\(?\s*(.+?)\s*\)?\s*(?:end)?$/);
  if (m) {
    const cmd = luaString(m[1]);
    if (cmd !== null) return `:${cmd}<CR>`;
  }
  // function() vim.cmd.Ex() end
  m = s.match(/^function\s*\(\s*\)\s*vim\.cmd\.(\w+)\s*\(\s*\)\s*end$/);
  if (m) return `:${m[1]}<CR>`;

  const str = luaString(s);
  if (str === null) return null;
  return keysRhs(str);
}

/** "<cmd>w<CR>" → ":w<CR>" (the plugin has no <cmd>, a : command does the same) */
function keysRhs(rhs: string): string {
  return rhs.replace(/<cmd>/gi, ":").replace(/<nop>/gi, "");
}

function withLeader(keys: string, leader: string, localLeader: string): string {
  return keys.replace(/<localleader>/gi, localLeader).replace(/<leader>/gi, leader);
}

/* ---------- Parse ---------- */

type Parsed = {
  mappings: (Mapping | (Unmap & { unmap: true }))[];
  options: OptionSetting[];
  errors: VimConfigError[];
};

export function parseVimConfig(config: string): Parsed {
  const result: Parsed = { mappings: [], options: [], errors: [] };
  let leader = "\\";
  let localLeader = "\\";

  // Join Lua statements that span lines (unbalanced brackets) into one
  const statements: { line: number; text: string }[] = [];
  let buf = "";
  let start = 0;
  let depth = 0;
  config.split(/\r?\n/).forEach((raw, i) => {
    const t = raw.trim();
    // Comments and blank lines never continue a statement
    if (!buf && (!t || t.startsWith("--") || t.startsWith('"'))) return;
    if (!buf) start = i + 1;
    buf += (buf ? " " : "") + raw.trim();
    const stripped = raw.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "");
    for (const c of stripped) {
      if (c === "(" || c === "{") depth++;
      if (c === ")" || c === "}") depth--;
    }
    if (depth <= 0) {
      statements.push({ line: start, text: buf.trim() });
      buf = "";
      depth = 0;
    }
  });
  if (buf.trim()) statements.push({ line: start, text: buf.trim() });

  const err = (line: number, message: string): number => result.errors.push({ line, message });

  for (const { line, text } of statements) {
    if (!text || text.startsWith("--") || text.startsWith('"')) continue;

    // vim.g.mapleader = " "
    let m = text.match(/^vim\.g\.(map(?:local)?leader)\s*=\s*(.+?)\s*;?$/);
    if (m) {
      const v = luaString(m[2]);
      if (v === null || !v) err(line, "Leader must be a string, e.g. \" \"");
      else if (m[1] === "mapleader") leader = leaderKey(v);
      else localLeader = leaderKey(v);
      continue;
    }

    // let mapleader = " "
    m = text.match(/^let\s+(?:g:)?(map(?:local)?leader)\s*=\s*(.+)$/);
    if (m) {
      const v = vimString(m[2]);
      if (v === null || !v) err(line, "Leader must be a string, e.g. \" \"");
      else if (m[1] === "mapleader") leader = leaderKey(v === "<Space>" ? " " : v);
      else localLeader = leaderKey(v === "<Space>" ? " " : v);
      continue;
    }

    // vim.opt.relativenumber = true  (also vim.o / vim.wo)
    m = text.match(/^vim\.(?:opt|o|wo)\.(\w+)\s*=\s*(true|false)\s*;?$/);
    if (m) {
      if (Object.hasOwn(OPTIONS, m[1])) result.options.push({ pref: OPTIONS[m[1]], value: m[2] === "true" });
      else err(line, `Option "${m[1]}" isn't supported (number and relativenumber are)`);
      continue;
    }

    // set number relativenumber / set nornu / set rnu!
    m = text.match(/^set?\s+(.+)$/);
    if (m) {
      for (const word of m[1].trim().split(/\s+/)) {
        const w = word.match(/^(no)?(\w+)(!)?$/);
        if (w && Object.hasOwn(OPTIONS, w[2]) && !(w[1] && w[3])) {
          const pref = OPTIONS[w[2]];
          // "!" toggles relative to what earlier lines set (or off)
          const before = [...result.options].reverse().find((o) => o.pref === pref)?.value ?? false;
          result.options.push({ pref, value: w[3] ? !before : !w[1] });
        } else {
          err(line, `Option "${word}" isn't supported (number and relativenumber are)`);
        }
      }
      continue;
    }

    // vim.keymap.set(mode, lhs, rhs, opts)
    m = text.match(/^vim\.keymap\.set\s*\(([\s\S]*)\)\s*;?$/);
    if (m) {
      const args = splitArgs(m[1]);
      if (args.length < 3) {
        err(line, "vim.keymap.set needs a mode, keys and an action");
        continue;
      }
      const modeArg = args[0].trim();
      const modes = modeArg.startsWith("{")
        ? splitArgs(modeArg.slice(1, -1)).map(luaString)
        : [luaString(modeArg)];
      const lhs = luaString(args[1]);
      const rhs = luaRhs(args[2]);
      const noremap = !/remap\s*=\s*true/.test(args[3] ?? "");

      if (modes.some((x) => x === null)) {
        err(line, 'Mode must be a string like "n" or a list like { "n", "v" }');
        continue;
      }
      if (lhs === null || !lhs) {
        err(line, "Keys must be a string, e.g. \"<leader>pv\"");
        continue;
      }
      if (rhs === null) {
        err(
          line,
          'Lua functions can\'t run here. Use a command (vim.cmd.Ex, "<cmd>w<CR>") or keys ("yy")'
        );
        continue;
      }
      for (const mode of modes as string[]) {
        const ctx = modeToCtx(mode);
        if (ctx === null) {
          err(line, `Mode "${mode}" isn't supported (use n, i, v, x or o)`);
          continue;
        }
        result.mappings.push({ line, lhs: withLeader(lhs, leader, localLeader), rhs, ctx, noremap });
      }
      continue;
    }

    // vim.keymap.del("n", "x")
    m = text.match(/^vim\.keymap\.del\s*\(([\s\S]*)\)\s*;?$/);
    if (m) {
      const args = splitArgs(m[1]);
      const mode = luaString(args[0] ?? "");
      const lhs = luaString(args[1] ?? "");
      const ctx = mode === null ? null : modeToCtx(mode);
      if (ctx === null || !lhs) err(line, "Couldn't read this vim.keymap.del");
      else result.mappings.push({ line, unmap: true, lhs: withLeader(lhs, leader, localLeader), ctx });
      continue;
    }

    // nnoremap <silent> <leader>w :w<CR>
    m = text.match(/^([nivxo]?)(nore)?map\s+(.+)$/);
    if (m) {
      const ctx = modeToCtx(m[1]);
      const rest = m[3].replace(/^(?:<(?:silent|buffer|nowait|unique|expr|script)>\s*)+/i, "");
      const sp = rest.search(/\s/);
      if (sp === -1) {
        err(line, "A mapping needs keys and what they do, e.g. nnoremap <leader>w :w<CR>");
        continue;
      }
      const lhs = rest.slice(0, sp);
      const rhs = rest.slice(sp).trim();
      result.mappings.push({
        line,
        lhs: withLeader(lhs, leader, localLeader),
        rhs: keysRhs(rhs),
        ctx: ctx ?? undefined,
        noremap: !!m[2],
      });
      continue;
    }

    // nunmap x
    m = text.match(/^([nivxo]?)unmap\s+(\S+)$/);
    if (m) {
      result.mappings.push({
        line,
        unmap: true,
        lhs: withLeader(m[2], leader, localLeader),
        ctx: modeToCtx(m[1]) ?? undefined,
      });
      continue;
    }

    err(line, "Not supported here. Leader, key mappings, number and relativenumber work.");
  }

  result.errors.sort((a, b) => a.line - b.line);
  return result;
}

/* ---------- Apply ---------- */

/*
 * Normal/visual mappings are matched here rather than by the Vim plugin.
 * The plugin runs a built-in command as soon as one key matches (Space moves
 * right, "," repeats a search), so "<leader>pv" with a Space or "," leader
 * would never fire. Like real Vim, we wait for the rest of the sequence
 * (up to TIMEOUT ms) and fall back to the built-in key if nothing matches.
 * Each mapping's action is registered with the plugin under a private key
 * name (<luna0>, <luna1>, ...) so it still runs with full Vim semantics.
 */
const TIMEOUT = 1000;

type KeyMap = { keys: string[]; id: string; ctx?: string };
let keyMaps: KeyMap[] = [];

/** Compare keys case-insensitively inside <...> (<C-p> == <c-P>), exactly otherwise */
function normKey(k: string): string {
  return k.length > 1 && k[0] === "<" ? k.toLowerCase() : k;
}
function tokenize(keys: string): string[] {
  return (keys.match(/<[^<>\s]+>|[\s\S]/g) ?? []).map(normKey);
}
function startsWith(full: string[], part: string[]): boolean {
  return part.length <= full.length && part.every((k, i) => full[i] === k);
}

let lastApplied: string | null = null;
let lastErrors: VimConfigError[] = [];

/** Replace all user Vim mappings with the ones in `config`. Returns any problems found. */
export function applyVimConfig(config: string): VimConfigError[] {
  registerAppCommands();
  if (config === lastApplied) return lastErrors;

  const { mappings, options, errors } = parseVimConfig(config);

  // Like a vimrc, options in the config apply when it loads or changes
  const { prefs, setPref } = useApp.getState();
  for (const o of options) if (prefs[o.pref] !== o.value) setPref(o.pref, o.value);
  Vim.mapclear();
  keyMaps = [];
  const pluginMaps: { lhs: string; ctx?: string }[] = []; // insert / operator-pending
  let n = 0;

  for (const m of mappings) {
    const handledHere = m.ctx === undefined || m.ctx === "normal" || m.ctx === "visual";
    const keys = tokenize(m.lhs);
    const same = (k: { keys?: string[]; lhs?: string; ctx?: string }): boolean =>
      k.ctx === m.ctx && (k.keys ? k.keys.join("\u0000") === keys.join("\u0000") : k.lhs === m.lhs);

    try {
      if ("unmap" in m) {
        const list: { keys?: string[]; lhs?: string; ctx?: string }[] = handledHere ? keyMaps : pluginMaps;
        if (!list.some(same)) {
          errors.push({ line: m.line, message: `${m.lhs}: only mappings made above can be removed` });
          continue;
        }
        if (handledHere) keyMaps = keyMaps.filter((k) => !same(k));
        else {
          Vim.unmap(m.lhs, m.ctx as string);
          pluginMaps.splice(pluginMaps.findIndex(same), 1);
        }
        continue;
      }

      const lhs = handledHere ? `<luna${n++}>` : m.lhs;
      if (m.noremap) Vim.noremap(lhs, m.rhs, m.ctx as string);
      else Vim.map(lhs, m.rhs, m.ctx as string);

      if (handledHere) {
        keyMaps = keyMaps.filter((k) => !same(k)); // a later mapping replaces an earlier one
        keyMaps.push({ keys, id: lhs, ctx: m.ctx });
      } else pluginMaps.push({ lhs: m.lhs, ctx: m.ctx });
    } catch (e) {
      errors.push({ line: m.line, message: `${m.lhs}: ${(e as Error).message}` });
    }
  }

  errors.sort((a, b) => a.line - b.line);
  lastApplied = config;
  lastErrors = errors;
  return errors;
}

/** Editor extension that matches the user's normal/visual mappings (see note above) */
export function vimMappings(): Extension {
  let events: KeyboardEvent[] = [];
  let typed: string[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  const reset = (): void => {
    clearTimeout(timer);
    events = [];
    typed = [];
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type CM = any;

  const run = (cm: CM, id: string): void => {
    Vim.handleKey(cm, id, "user");
    cm.state.vimPlugin?.updateStatus?.();
  };

  // Hand swallowed keys back to Vim as if no mapping existed
  const replay = (view: EditorView, cm: CM, evs: KeyboardEvent[]): void => {
    for (const e of evs) {
      const handled = cm.state.vimPlugin?.handleKey(e, view);
      const vs = Vim.maybeInitVimState_(cm);
      if (!handled && vs.insertMode && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        view.dispatch(view.state.replaceSelection(e.key));
      }
    }
  };

  return Prec.highest(
    EditorView.domEventHandlers({
      keydown(e, view) {
        const cm = getCM(view) as CM;
        const vs = cm?.state.vim;
        if (!cm || !vs || vs.insertMode || e.isComposing || e.target !== view.contentDOM) {
          reset();
          return false;
        }
        // Something is already pending in Vim (a count, operator, register...): let it finish
        const input = vs.inputState;
        if (
          !events.length &&
          (input.keyBuffer.length ||
            input.operator ||
            input.prefixRepeat.length ||
            input.registerName ||
            vs.expectLiteralNext)
        ) {
          return false;
        }

        const key = Vim.vimKeyFromEvent(e, vs);
        if (!key) return false; // a lone modifier
        const ctx = vs.visualMode ? "visual" : "normal";
        const next = [...typed, normKey(key)];
        const candidates = keyMaps.filter(
          (m) => (m.ctx === undefined || m.ctx === ctx) && startsWith(m.keys, next)
        );

        if (!candidates.length) {
          if (!events.length) return false; // not ours at all
          const evs = [...events, e];
          reset();
          e.preventDefault();
          replay(view, cm, evs);
          return true;
        }

        e.preventDefault();
        clearTimeout(timer);
        typed = next;
        events.push(e);

        const exact = [...candidates].reverse().find((m) => m.keys.length === next.length);
        const longer = candidates.some((m) => m.keys.length > next.length);

        if (exact && !longer) {
          reset();
          run(cm, exact.id);
          return true;
        }

        // Wait for more keys, like Vim's timeoutlen
        timer = setTimeout(() => {
          const evs = events;
          reset();
          if (exact) run(cm, exact.id);
          else replay(view, cm, evs);
        }, TIMEOUT);
        return true;
      },
    })
  );
}
