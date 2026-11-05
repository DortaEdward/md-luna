import AegisViewer from "@renderer/components/AegisViewer";
import Sidebar from "@renderer/components/Sidebar";
import SettingsModal from "@renderer/components/SettingsModal";
import TitleBar from "@renderer/components/TitleBar";
import CommandPalette from "@renderer/components/CommandPalette";
import { ToastContainer } from "@renderer/components/ToastContainer";
import { useApplyPrefs } from "@renderer/hook/usePrefs";
import { useTheme } from "@renderer/hook/useTheme";
import { useApp } from "@renderer/stores/globalStore";
import { useEffect } from "react";
import { Outlet } from "react-router";
import { isInside } from "@renderer/lib/paths";
import { exportNote } from "@renderer/lib/exportNote";
import { goBack, goForward, historyPathRemoved, startHistory } from "@renderer/stores/historyStore";

export default function DefaultLayout() {
    useTheme();
    useApplyPrefs();

    useEffect(() => {
        const { loadTree, bumpNotes, loadSystemName } = useApp.getState();
        loadTree();
        loadSystemName();

        const offFs = window.api.aegis.onFsChanged(() => {
            loadTree();
            bumpNotes();
        });

        // A note or notebook is about to be trashed
        const offTrash = window.api.aegis.onTrashing((trashed) => {
            // 1. Tell the editor to drop unsaved edits, so the note isn't written back
            window.dispatchEvent(new CustomEvent("note:discard", { detail: trashed }));

            // 2. Forget history steps that point into it
            historyPathRemoved(trashed);

            // 3. Close the note/notebook if it's the one being trashed
            const { activeNote, activeAegis, setActiveNote, setActiveAegis } = useApp.getState();
            if (isInside(activeNote, trashed)) setActiveNote(null);
            if (isInside(activeAegis, trashed)) setActiveAegis(null);
        });

        // "Export as PDF/HTML…" from a menu
        const offExport = window.api.aegis.onExportRequest((notePath, format) => exportNote(notePath, format));

        return () => {
            offFs();
            offTrash();
            offExport();
        };
    }, []);

    // Back / forward: ⌘[ and ⌘], or the mouse's side buttons
    useEffect(() => {
        const stop = startHistory();

        function onKey(e: KeyboardEvent) {
            if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
            if (e.key !== "[" && e.key !== "]") return;
            e.preventDefault();
            e.stopPropagation(); // capture phase: beats the editor's own ⌘[ / ⌘] (Tab handles indenting)
            if (e.key === "[") goBack();
            else goForward();
        }
        function onMouse(e: MouseEvent) {
            if (e.button === 3) {
                e.preventDefault();
                goBack();
            } else if (e.button === 4) {
                e.preventDefault();
                goForward();
            }
        }

        window.addEventListener("keydown", onKey, true);
        window.addEventListener("mouseup", onMouse);
        return () => {
            stop();
            window.removeEventListener("keydown", onKey, true);
            window.removeEventListener("mouseup", onMouse);
        };
    }, []);

    return (
        <div className="w-screen h-screen flex flex-col overflow-hidden bg-bg text-fg relative">
            {/* One title bar across the window; the panels start below it */}
            <TitleBar />
            <div className="flex-1 min-h-0 flex">
                <Sidebar />
                <AegisViewer />
                <main className="flex-1 min-w-0 overflow-y-auto relative bg-list">
                    <Outlet />
                </main>
            </div>
            <CommandPalette />
            <ToastContainer />
            <SettingsModal />
        </div>
    );
}