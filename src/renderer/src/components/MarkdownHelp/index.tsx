import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

type Example = {
  label: string;
  code: string;
  note?: string;
  render?: boolean; // false = don't render a preview (e.g. images)
};

type Section = { title: string; items: Example[] };

const SECTIONS: Section[] = [
  {
    title: "Text",
    items: [
      { label: "Bold", code: "**bold text**" },
      { label: "Italic", code: "*italic text*" },
      { label: "Bold + italic", code: "***both***" },
      { label: "Strikethrough", code: "~~crossed out~~" },
      { label: "Inline code", code: "Run `npm install` first" },
      { label: "Escape a symbol", code: "\\*not italic\\*", note: "Put \\ before a symbol to show it as-is." },
    ],
  },
  {
    title: "Headings",
    items: [
      { label: "Heading 1", code: "# Title" },
      { label: "Heading 2", code: "## Section" },
      { label: "Heading 3", code: "### Subsection" },
      { label: "Heading 4", code: "#### Smaller heading", note: "Headings 1–4 show up in Contents." },
    ],
  },
  {
    title: "Paragraphs",
    items: [
      { label: "New line", code: "First line\nSecond line", note: "Pressing Enter once starts a new line." },
      { label: "New paragraph", code: "First paragraph\n\nSecond paragraph", note: "Leave a blank line between paragraphs." },
    ],
  },
  {
    title: "Lists",
    items: [
      { label: "Bullet list", code: "- Apples\n- Oranges\n- Pears" },
      { label: "Numbered list", code: "1. First\n2. Second\n3. Third" },
      { label: "Nested list", code: "- Fruit\n  - Apples\n  - Pears\n- Vegetables", note: "Indent with 2 spaces." },
      { label: "Checklist", code: "- [x] Done\n- [ ] Not done" },
    ],
  },
  {
    title: "Links & images",
    items: [
      { label: "Link", code: "[Visit site](https://example.com)" },
      { label: "Plain URL", code: "https://example.com" },
      { label: "Link to a heading", code: "[Jump to section](#section)", note: "Lowercase, spaces become dashes." },
      { label: "Link to another note", code: "[Other note](Other%20note.md)", note: "Use %20 for spaces in the file name." },
      { label: "Image", code: "![Description](https://example.com/photo.png)", render: false },
    ],
  },
  {
    title: "Blocks",
    items: [
      { label: "Quote", code: "> This is a quote" },
      { label: "Code block", code: "```js\nconst x = 1;\nconsole.log(x);\n```", note: "Add a language after ``` for context." },
      { label: "Divider", code: "Above\n\n---\n\nBelow" },
    ],
  },
  {
    title: "Tables",
    items: [
      {
        label: "Table",
        code: "| Name  | Role   |\n| ----- | ------ |\n| Ana   | Design |\n| Leo   | Code   |",
      },
      {
        label: "Aligned columns",
        code: "| Left | Center | Right |\n| :--- | :----: | ----: |\n| a    |   b    |     c |",
        note: "Colons in the divider row set alignment.",
      },
    ],
  },
];

// Same theme colours as the preview, plus tight spacing for the small examples
const resultClass = [
  "prose prose-sm max-w-none",
  "[--tw-prose-body:currentColor] [--tw-prose-headings:currentColor] [--tw-prose-bold:currentColor]",
  "[--tw-prose-counters:var(--fg-muted)] [--tw-prose-bullets:var(--fg-faint)]",
  "[--tw-prose-quotes:currentColor] [--tw-prose-quote-borders:var(--fg-faint)]",
  "[--tw-prose-hr:var(--line)] [--tw-prose-code:currentColor]",
  "[--tw-prose-pre-code:currentColor] [--tw-prose-pre-bg:var(--hover)]",
  "[--tw-prose-th-borders:var(--fg-faint)] [--tw-prose-td-borders:var(--line)]",
  "prose-a:text-accent-fg prose-headings:my-0 prose-p:my-0 prose-ul:my-0 prose-ol:my-0",
  "prose-pre:my-0 prose-blockquote:my-0 prose-table:my-0 prose-hr:my-2",
  "[overflow-wrap:anywhere] pointer-events-none",
].join(" ");

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0.5 rounded bg-bg border border-line text-muted hover:text-fg opacity-0 group-hover:opacity-100 transition-opacity"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function MarkdownHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.map((s) => ({
      ...s,
      items: s.items.filter(
        (i) =>
          s.title.toLowerCase().includes(q) ||
          i.label.toLowerCase().includes(q) ||
          i.code.toLowerCase().includes(q)
      ),
    })).filter((s) => s.items.length > 0);
  }, [query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6 no-drag"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-bg text-fg rounded-xl border border-line shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
          <h2 className="font-semibold">Markdown reference</h2>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search… (e.g. table, link)"
            className="flex-1 min-w-0 text-sm bg-hover rounded-md px-2 py-1 outline-none placeholder:text-muted"
          />
          <button onClick={onClose} title="Close (Esc)" className="text-muted hover:text-fg px-1">
            ✕
          </button>
        </div>

        {/* Column labels */}
        <div className="grid grid-cols-[8rem_1fr_1fr] gap-3 px-4 py-1.5 text-[11px] uppercase tracking-wide text-muted border-b border-line">
          <span />
          <span>You type</span>
          <span>You get</span>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
          {sections.length === 0 && <div className="py-8 text-center text-sm text-muted">Nothing matches “{query}”</div>}

          {sections.map((section) => (
            <section key={section.title} className="pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">{section.title}</h3>

              <div className="flex flex-col divide-y divide-line border border-line rounded-lg">
                {section.items.map((item) => (
                  <div key={item.label} className="grid grid-cols-[8rem_1fr_1fr] gap-3 p-2.5 items-start">
                    <div className="text-sm font-medium pt-1">
                      {item.label}
                      {item.note && <div className="text-[11px] font-normal text-muted mt-0.5 leading-snug">{item.note}</div>}
                    </div>

                    <div className="group relative min-w-0">
                      <pre className="text-xs font-mono bg-hover rounded-md p-2 pr-12 whitespace-pre-wrap [overflow-wrap:anywhere]">
                        {item.code}
                      </pre>
                      <CopyButton text={item.code} />
                    </div>

                    <div className="min-w-0 text-sm pt-1">
                      {item.render === false ? (
                        <span className="text-muted italic">Shows the image</span>
                      ) : (
                        <div className={resultClass}>
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{item.code}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="px-4 py-2 border-t border-line text-[11px] text-muted">
          Press <kbd className="font-mono">⌘/</kbd> anytime to open this · <kbd className="font-mono">esc</kbd> to close
        </div>
      </div>
    </div>
  );
}