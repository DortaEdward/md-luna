import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "@renderer/components/MdViewer";
import { stripFrontMatter } from "@renderer/lib/frontmatter";
import { useToastStore } from "@renderer/stores/toastStore";

export type ExportFormat = "pdf" | "html";

/** Export a note as PDF or HTML. Renders it exactly like the preview, then the main process saves it. */
export async function exportNote(notePath: string, format: ExportFormat): Promise<void> {
  const { showToast } = useToastStore.getState();
  try {
    // Save unsaved edits first so the export has the latest text
    window.dispatchEvent(new Event("note:flush"));
    await new Promise((r) => setTimeout(r, 150));

    const text = await window.api.aegis.readNote(notePath);
    const body = renderToStaticMarkup(
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents(notePath)}>
        {stripFrontMatter(text)}
      </ReactMarkdown>
    );
    const title = (notePath.split(/[\\/]/).pop() ?? "Note").replace(/\.md$/i, "");

    const saved = await window.api.aegis.exportNote(notePath, title, body, format);
    if (saved) showToast(`Exported “${saved.split(/[\\/]/).pop()}”`, "success");
  } catch (err) {
    console.error("Export failed:", err);
    showToast("Export failed", "error");
  }
}
