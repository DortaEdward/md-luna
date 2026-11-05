import { useState } from "react";
import { Aegis } from "../../../../shared/types/aegis.types";
import { Book, ChevronRight } from "lucide-react";
import { useApp } from "@renderer/stores/globalStore";
import { useInlineRename } from "@renderer/hook/useInlineRename";
import { applyPathMove } from "@renderer/lib/pathMoves";
import { AEGIS_DRAG_TYPE, dropInto, isMoveDrag } from "./drag";

const INDENT = 14; // px per nesting level

export function SidebarItem({ aegis }: { aegis: Aegis }): React.JSX.Element {
    const isActive = useApp((s) => s.view === "aegis" && s.activeAegis === aegis.path);
    const isExpanded = useApp((s) => s.expandedAegis.includes(aegis.path));
    const setActiveAegis = useApp((s) => s.setActiveAegis);
    const toggleExpanded = useApp((s) => s.toggleExpanded);
    const loadTree = useApp((s) => s.loadTree);
    const [isDropTarget, setIsDropTarget] = useState(false);
    const hasChildren = aegis.children.length > 0;

    const { isRenaming, inputProps } = useInlineRename(aegis.path, aegis.name, (newPath) => {
        applyPathMove(aegis.path, newPath);
        loadTree();
    });

    /* ----- drop a note or notebook here to move it inside ----- */

    function onDragOver(e: React.DragEvent): void {
        if (!isMoveDrag(e)) return;
        e.preventDefault();
        e.stopPropagation(); // don't also highlight the parent
        e.dataTransfer.dropEffect = "move";
        if (!isDropTarget) setIsDropTarget(true);
    }

    function onDragLeave(e: React.DragEvent): void {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDropTarget(false);
    }

    async function onDrop(e: React.DragEvent): Promise<void> {
        if (!isMoveDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDropTarget(false);
        await dropInto(e, aegis.path);
        if (!isExpanded && e.dataTransfer.types.includes(AEGIS_DRAG_TYPE)) toggleExpanded(aegis.path);
    }

    const dropHandlers = { onDragOver, onDragEnter: onDragOver, onDragLeave, onDrop };

    const dragHandlers = {
        draggable: !isRenaming,
        onDragStart: (e: React.DragEvent): void => {
            e.stopPropagation();
            e.dataTransfer.setData(AEGIS_DRAG_TYPE, aegis.path);
            e.dataTransfer.effectAllowed = "move";
        },
    };

    const stateClass = isDropTarget
        ? "bg-accent/15 text-accent-fg ring-2 ring-accent"
        : isActive
            ? "bg-selected text-selected-fg"
            : "hover:bg-hover";

    function onContextMenu(e: React.MouseEvent): void {
        e.preventDefault();
        window.api.aegis.showSidebarItemMenu(aegis.path);
    }

    return (
        <div>
            <div
                {...dropHandlers}
                {...dragHandlers}
                style={{ paddingLeft: 4 + aegis.depth * INDENT }}
                className={`flex items-center gap-1 cursor-pointer rounded-md py-1 pr-1 ${stateClass} ${
                    isRenaming ? "border border-faint" : ""
                }`}
                onClick={() => setActiveAegis(aegis.path)}
                onContextMenu={onContextMenu}
            >
                {hasChildren ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(aegis.path);
                        }}
                        title={isExpanded ? "Hide notebooks inside" : "Show notebooks inside"}
                        className="shrink-0 rounded text-muted hover:text-fg"
                    >
                        <ChevronRight
                            size={14}
                            className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        />
                    </button>
                ) : (
                    <span className="w-[14px] shrink-0" />
                )}
                <Book size={16} className="shrink-0" />
                <div className="flex-1 min-w-0 ml-1">
                    {isRenaming
                        ? <input {...inputProps} className="w-full bg-transparent outline-none" />
                        : <span className="block truncate">{aegis.name}</span>}
                </div>
                <span className="text-xs text-muted">{aegis.noteCount}</span>
            </div>

            {hasChildren && isExpanded && (
                <div className="flex flex-col gap-1 mt-1">
                    {aegis.children.map((child) => (
                        <SidebarItem key={child.path} aegis={child} />
                    ))}
                </div>
            )}
        </div>
    );
}
