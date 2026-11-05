import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { useApp } from "@renderer/stores/globalStore";
import { stripFrontMatter } from "@renderer/lib/frontmatter";
import { imageSize, imageSrc, resolveRelative } from "@renderer/lib/paths";
import { usePreviewVim } from "./PreviewVim";

type MdViewerProps = {
  content: string;
  documentName: string;
  notePath?: string;
  /** True in Preview mode (no editor on screen) */
  previewOnly?: boolean;
};

type TocItem = { id: string; text: string; level: number };

// Make Tailwind Typography follow the app's theme tokens instead of its fixed greys
const proseTheme = [
  "[--tw-prose-body:currentColor]",
  "[--tw-prose-headings:currentColor]",
  "[--tw-prose-lead:currentColor]",
  "[--tw-prose-bold:currentColor]",
  "[--tw-prose-counters:var(--fg-muted)]",
  "[--tw-prose-bullets:var(--fg-faint)]",
  "[--tw-prose-quotes:currentColor]",
  "[--tw-prose-quote-borders:var(--fg-faint)]",
  "[--tw-prose-hr:var(--line)]",
  "[--tw-prose-captions:var(--fg-muted)]",
  "[--tw-prose-code:currentColor]",
  "[--tw-prose-pre-code:currentColor]",
  "[--tw-prose-pre-bg:var(--hover)]",
  "[--tw-prose-th-borders:var(--fg-faint)]",
  "[--tw-prose-td-borders:var(--line)]",
].join(" ");

function slugify(text: string) {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/\s+/g, "-") || "section"
  );
}

function TocIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5h18M7 12h14M11 19h10" />
    </svg>
  );
}

type Props<T extends keyof React.JSX.IntrinsicElements> = React.ComponentPropsWithoutRef<T> & { node?: unknown };

/** How the preview (and exports) draw a few elements */
export function markdownComponents(notePath?: string) {
  return {
    // Wide tables scroll inside their own box instead of widening the preview
    table: ({ node: _node, ...props }: Props<"table">) => (
      <div className="overflow-x-auto">
        <table {...props} />
      </div>
    ),
    // Images saved next to the note (relative paths) load from the notes folder.
    // ![alt|300](x.png) or ![alt|300x200](x.png) or ![alt|50%](x.png) sets the size.
    img: ({ node: _node, src, alt, style, ...props }: Props<"img">) => {
      const size = imageSize(alt);
      return (
        <img
          {...props}
          alt={size.alt}
          src={imageSrc(typeof src === "string" ? src : undefined, notePath)}
          style={
            size.width
              ? { ...style, width: size.width, height: size.height ?? "auto", objectFit: size.height ? "contain" : undefined }
              : style
          }
          loading="lazy"
        />
      );
    },
  };
}

/* ---------- Contents modal ---------- */

function ContentsModal({
  toc,
  activeId,
  onSelect,
  onClose,
}: {
  toc: TocItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(() => Math.max(0, toc.findIndex((t) => t.id === activeId)));
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? toc.filter((t) => t.text.toLowerCase().includes(q)) : toc;
  }, [toc, query]);

  const minLevel = Math.min(...toc.map((t) => t.level));

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${index}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[index]) onSelect(items[index].id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div
      className="absolute inset-0 z-30 flex items-start justify-center bg-black/20 pt-16 px-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-sm bg-bg text-fg rounded-lg border border-line shadow-xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-line p-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Jump to section…"
            className="w-full bg-transparent outline-none text-sm px-1 py-1 placeholder:text-muted"
          />
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-1">
          {items.length === 0 && <div className="px-3 py-2 text-sm text-muted">No matching sections</div>}

          {items.map((item, i) => (
            <button
              key={item.id}
              data-index={i}
              onMouseEnter={() => setIndex(i)}
              onClick={() => onSelect(item.id)}
              style={{ paddingLeft: 12 + (query ? 0 : (item.level - minLevel) * 14) }}
              className={`w-full flex items-center gap-2 text-left text-sm py-1.5 pr-3 ${i === index ? "bg-accent/10 text-accent-fg" : "text-fg"
                }`}
            >
              <span className={`truncate flex-1 ${item.level === minLevel ? "font-medium" : ""}`}>{item.text}</span>
              {item.id === activeId && <span className="text-[10px] uppercase tracking-wide text-muted">current</span>}
            </button>
          ))}
        </div>

        <div className="border-t border-line px-3 py-1.5 text-[11px] text-muted flex gap-3">
          <span>↑↓ navigate</span>
          <span>↵ go</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Viewer ---------- */

export default function MdViewer({ content, documentName, notePath, previewOnly = false }: MdViewerProps) {
  const setActiveNote = useApp((s) => s.setActiveNote);
  // Settings → Appearance → Preview width
  const readable = useApp((s) => s.prefs.previewWidth === "readable");
  const scrollRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const vimBar = usePreviewVim(scrollRef, previewOnly); // Vim keys and : commands in the preview
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const components = useMemo(() => markdownComponents(notePath), [notePath]);

  // Build the list from the rendered headings and give each one an id
  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;

    const seen = new Map<string, number>();
    const items: TocItem[] = [];

    article.querySelectorAll<HTMLHeadingElement>("h1, h2, h3, h4").forEach((el) => {
      const text = el.textContent?.trim() ?? "";
      if (!text) return;
      let id = slugify(text);
      const count = seen.get(id) ?? 0;
      seen.set(id, count + 1);
      if (count) id = `${id}-${count}`;
      el.id = id;
      items.push({ id, text, level: Number(el.tagName[1]) });
    });

    setToc((prev) => (JSON.stringify(prev) === JSON.stringify(items) ? prev : items));
  }, [content]);

  function headingTop(id: string) {
    const scroller = scrollRef.current;
    const el = document.getElementById(id);
    if (!scroller || !el) return null;
    return el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
  }

  function currentHeading() {
    const scroller = scrollRef.current;
    if (!scroller || toc.length === 0) return null;
    const y = scroller.scrollTop + 48;
    let current = toc[0].id;
    for (const item of toc) {
      const top = headingTop(item.id);
      if (top !== null && top <= y) current = item.id;
      else break;
    }
    return current;
  }

  function openContents() {
    if (toc.length === 0) return;
    setActiveId(currentHeading());
    setOpen(true);
  }

  function goTo(id: string) {
    setOpen(false);
    const top = headingTop(id);
    if (top === null) return;
    scrollRef.current?.scrollTo({ top: top - 12, behavior: "smooth" });
  }

  // Handle every link click in the preview
  function onArticleClick(e: React.MouseEvent) {
    const link = (e.target as HTMLElement).closest("a");
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href) return;

    e.preventDefault(); // never let the app window navigate

    // In-page heading: #some-heading
    if (href.startsWith("#")) {
      const id = decodeURIComponent(href.slice(1));
      goTo(document.getElementById(id) ? id : slugify(id));
      return;
    }

    // Web / email links: open in the default browser
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      if (/^(https?|mailto):/i.test(href)) window.api.aegis.openExternal(href);
      return;
    }

    // Relative link to another note
    if (!notePath) return;
    const [file] = href.split("#");
    if (!file) return;
    const target = resolveRelative(notePath, decodeURIComponent(file));
    setActiveNote(/\.[a-z0-9]+$/i.test(target) ? target : `${target}.md`);
  }

  // Cmd/Ctrl + Shift + O opens the contents
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        openContents();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="relative flex-1 min-h-0 min-w-0 flex flex-col text-fg">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="sticky top-0 z-10 flex justify-end items-center gap-1 p-2 pointer-events-none">
          {toc.length > 0 && (
            <button
              onClick={openContents}
              title="Contents (⌘⇧O)"
              className="pointer-events-auto flex items-center gap-1 bg-hover backdrop-blur px-2 py-1 rounded text-xs text-muted hover:text-fg hover:bg-hover-strong"
            >
              <TocIcon />
              Contents
            </button>
          )}
          <span className="bg-hover backdrop-blur px-2 py-1 rounded text-xs text-muted truncate max-w-[60%]">
            {documentName}
          </span>
        </div>

        <article
          ref={articleRef}
          onClick={onArticleClick}
          className={`prose ${readable ? "max-w-[72ch] mx-auto" : "max-w-none" // Settings → Preview width
            } min-w-0 px-4 pb-8 ${proseTheme} [overflow-wrap:anywhere] prose-a:text-accent-fg prose-a:cursor-pointer hover:prose-a:underline prose-pre:whitespace-pre-wrap prose-pre:break-words`}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
            {stripFrontMatter(content)}
          </ReactMarkdown>
        </article>
      </div>

      {open && (
        <ContentsModal toc={toc} activeId={activeId} onSelect={goTo} onClose={() => setOpen(false)} />
      )}
      {vimBar}
    </div>
  );
}