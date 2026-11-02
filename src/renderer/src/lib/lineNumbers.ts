import { gutter, GutterMarker, highlightActiveLineGutter, lineNumbers } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

/* Line number gutter for the editor, following Vim's two options:
 *   number only        → 1 2 3 4 ...
 *   relativenumber     → distance from the cursor line; that line shows 0
 *   number + relative  → distance, but the cursor line shows its real number
 */

class NumberMarker extends GutterMarker {
  constructor(
    readonly text: string,
    current: boolean
  ) {
    super();
    this.elementClass = current ? "cm-activeLineGutter" : "";
  }
  eq(other: NumberMarker): boolean {
    return other.text === this.text && other.elementClass === this.elementClass;
  }
  toDOM(): Node {
    return document.createTextNode(this.text);
  }
}

function relativeNumbers(showCurrentNumber: boolean): Extension {
  return gutter({
    class: "cm-lineNumbers cm-relativeLineNumbers",
    lineMarker(view, block) {
      const doc = view.state.doc;
      const n = doc.lineAt(block.from).number;
      const cursor = doc.lineAt(view.state.selection.main.head).number;
      const d = Math.abs(n - cursor);
      return new NumberMarker(d === 0 && showCurrentNumber ? String(n) : String(d), d === 0);
    },
    // Re-number whenever the cursor moves or lines change
    lineMarkerChange: (update) => update.selectionSet || update.docChanged,
    // Reserve room for the widest number so the text doesn't shift
    initialSpacer: (view) => new NumberMarker(String(view.state.doc.lines), false),
    updateSpacer: (_spacer, update) => new NumberMarker(String(update.state.doc.lines), false),
  });
}

export function lineNumberGutter(number: boolean, relative: boolean): Extension {
  if (relative) return relativeNumbers(number);
  if (number) return [lineNumbers(), highlightActiveLineGutter()];
  return [];
}
