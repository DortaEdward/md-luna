import { useApp } from "@renderer/stores/globalStore";
import { NOTE_DRAG_TYPE } from "@renderer/components/AegisViewer";
import { applyPathMove } from "@renderer/lib/pathMoves";
import { isInside } from "@renderer/lib/paths";

/** Drag type for moving a notebook into another notebook */
export const AEGIS_DRAG_TYPE = "application/x-luna-aegis";


/** Move a dragged note or notebook into `destPath` (a notebook, or the notes root for top level) */
export async function dropInto(e: React.DragEvent, destPath: string): Promise<void> {
    const { activeNote, setActiveNote, bumpNotes, loadTree } = useApp.getState();
    const notePath = e.dataTransfer.getData(NOTE_DRAG_TYPE);
    const aegisPath = e.dataTransfer.getData(AEGIS_DRAG_TYPE);

    try {
        if (notePath) {
            const newPath = await window.api.aegis.moveNote(notePath, destPath);
            if (newPath === notePath) return; // dropped on its own notebook
            applyPathMove(notePath, newPath);
            if (activeNote === notePath) setActiveNote(newPath);
            bumpNotes();
        } else if (aegisPath) {
            if (isInside(destPath, aegisPath)) return; // can't go inside itself
            window.dispatchEvent(new Event("note:flush")); // save edits before files move
            const newPath = await window.api.aegis.moveAegis(aegisPath, destPath);
            if (newPath === aegisPath) return;
            applyPathMove(aegisPath, newPath);
            useApp.getState().revealAegis(newPath);
            bumpNotes();
        }
        loadTree(); // refresh note counts and the tree
    } catch (err) {
        console.error("Failed to move:", err);
    }
}

export function isMoveDrag(e: React.DragEvent): boolean {
    const types = Array.from(e.dataTransfer.types);
    return types.includes(NOTE_DRAG_TYPE) || types.includes(AEGIS_DRAG_TYPE);
}

