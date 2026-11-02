import { BrowserWindow, app, dialog, shell } from 'electron'
import { writeFile, unlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { inlineImages } from './attachments'

/*
 * Export a note as a standalone HTML file or a PDF.
 * The window renders the Markdown to HTML (the same way the preview does);
 * here we wrap it in a page with its own styles, embed the images, and
 * either save it or print it to PDF from a hidden window.
 */

export type ExportFormat = 'pdf' | 'html'

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const STYLES = `
  :root { color-scheme: light dark; --fg: #1f2328; --muted: #59636e; --line: #d1d9e0; --code: #f6f8fa; --accent: #0969da; }
  @media (prefers-color-scheme: dark) {
    :root { --fg: #e6edf3; --muted: #9198a1; --line: #3d444d; --code: #151b23; --accent: #4493f8; }
    body { background: #0d1117; }
  }
  @media print { :root { --fg: #1f2328; --muted: #59636e; --line: #d1d9e0; --code: #f6f8fa; --accent: #0969da; } body { background: #fff; } }
  * { box-sizing: border-box; }
  body { margin: 0; color: var(--fg); font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
  main { max-width: 760px; margin: 0 auto; padding: 48px 24px 64px; overflow-wrap: anywhere; }
  @media print { main { max-width: none; padding: 0; } }
  h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 1.6em 0 0.6em; font-weight: 600; }
  h1 { font-size: 2em; padding-bottom: .3em; border-bottom: 1px solid var(--line); }
  h2 { font-size: 1.5em; padding-bottom: .3em; border-bottom: 1px solid var(--line); }
  h3 { font-size: 1.25em; }
  main > :first-child { margin-top: 0; }
  p, ul, ol, blockquote, pre, table { margin: 0 0 1em; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  img { max-width: 100%; height: auto; border-radius: 6px; }
  blockquote { margin-left: 0; padding: 0 1em; color: var(--muted); border-left: .25em solid var(--line); }
  code { font: .875em/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: var(--code); padding: .2em .4em; border-radius: 6px; }
  pre { background: var(--code); padding: 16px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; }
  pre code { background: none; padding: 0; font-size: .85em; }
  hr { border: 0; border-top: 1px solid var(--line); margin: 2em 0; }
  table { border-collapse: collapse; width: max-content; max-width: 100%; }
  th, td { border: 1px solid var(--line); padding: 6px 13px; }
  th { font-weight: 600; background: var(--code); }
  .overflow-x-auto { overflow-x: auto; }
  .contains-task-list { list-style: none; padding-left: 1.2em; }
  .task-list-item input { margin: 0 .5em 0 -1.2em; }
  pre, blockquote, table, img { break-inside: avoid; }
  h1, h2, h3 { break-after: avoid; }
`

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Luna MD">
<title>${escapeHtml(title)}</title>
<style>${STYLES}</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>
`
}

async function printToPdf(html: string): Promise<Buffer> {
  const tmp = path.join(os.tmpdir(), `luna-export-${process.pid}-${Date.now()}.html`)
  await writeFile(tmp, html, 'utf8')
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, javascript: false } // just render the page, run nothing
  })
  try {
    await win.loadFile(tmp)
    return await win.webContents.printToPDF({
      printBackground: true,
      margins: { top: 0.7, bottom: 0.7, left: 0.7, right: 0.7 } // inches
    })
  } finally {
    win.destroy()
    await unlink(tmp).catch(() => {})
  }
}

/** Ask where to save, then write the file. Returns the saved path, or null if cancelled. */
export async function exportNote(
  parent: BrowserWindow | null,
  title: string,
  bodyHtml: string,
  format: ExportFormat
): Promise<string | null> {
  const ext = format === 'pdf' ? 'pdf' : 'html'
  const options: Electron.SaveDialogOptions = {
    title: format === 'pdf' ? 'Export as PDF' : 'Export as HTML',
    defaultPath: path.join(app.getPath('documents'), `${title}.${ext}`),
    filters: [format === 'pdf' ? { name: 'PDF', extensions: ['pdf'] } : { name: 'Web page', extensions: ['html'] }]
  }
  const result = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return null

  // Images are embedded, and must all load before printing: no lazy loading
  const html = page(title, (await inlineImages(bodyHtml)).replace(/ loading="lazy"/g, ''))
  if (format === 'pdf') await writeFile(result.filePath, await printToPdf(html))
  else await writeFile(result.filePath, html, 'utf8')

  shell.showItemInFolder(result.filePath)
  return result.filePath
}
