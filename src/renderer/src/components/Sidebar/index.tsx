import { File, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings2, Star, Hash } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NoDrag, Toolbar } from "../Toolbar";
import { useApp } from "@renderer/stores/globalStore";
import { SidebarItem } from "./SidebarItem";
import { dropInto, isMoveDrag } from "./drag";
import { flattenAegis } from "../../../../shared/tree";
import { applyPathMove, requestRename } from "@renderer/lib/pathMoves";
import CommandPalette, { openCommandPalette } from "@renderer/components/CommandPalette";
import { initials, useDisplayName } from "@renderer/hook/useUser";
import ResizeHandle from "@renderer/components/ResizeHandle";
import { useResizableWidth } from "@renderer/hook/useResizableWidth";

const iconBtn = "p-1.5 rounded-md text-muted hover:bg-hover hover:text-fg";
const activeClass = "bg-selected text-selected-fg";

export default function Sidebar() {
    const tree = useApp((s) => s.tree);
    const loadTree = useApp((s) => s.loadTree);
    const view = useApp((s) => s.view);
    const setView = useApp((s) => s.setView);
    const favorites = useApp((s) => s.favorites);
    const loadFavorites = useApp((s) => s.loadFavorites);
    const setSettingsOpen = useApp((s) => s.setSettingsOpen);
    const [collapsed, setCollapsed] = useState(false);
    const displayName = useDisplayName();
    const tags = useApp((s) => s.tags);
    const activeTag = useApp((s) => s.activeTag);
    const setActiveTag = useApp((s) => s.setActiveTag);
    const loadTags = useApp((s) => s.loadTags);
    const notesVersion = useApp((s) => s.notesVersion);


    const totalNotes = flattenAegis(tree).reduce((sum, a) => sum + a.noteCount, 0);
    const [topDrop, setTopDrop] = useState(false);

    const sidebarWidth = useApp((s) => s.sidebarWidth);
    const setSidebarWidth = useApp((s) => s.setSidebarWidth);
    const resize = useResizableWidth({
        width: sidebarWidth,
        onSave: setSidebarWidth,
        min: 180,
        max: 400,
        defaultWidth: 256,
    });

    // Load favorites on start and whenever the main process says they changed
    useEffect(() => {
        loadFavorites();
        return window.api.aegis.onFavoritesChanged(loadFavorites);
    }, []);

    useEffect(() => {
        loadTags();
    }, [notesVersion]);

    // A new notebook (from + or "New Notebook Inside"): show it, select it, and ask for a name
    async function revealNew(path: string) {
        await loadTree();
        const { revealAegis, setActiveAegis } = useApp.getState();
        revealAegis(path);
        setActiveAegis(path);
        setTimeout(() => requestRename(path), 50); // once it has rendered
    }

    async function newAegis() {
        const path = await window.api.aegis.createAegis();
        if (!collapsed) revealNew(path);
        else loadTree();
    }

    useEffect(() => {
        const offCreated = window.api.aegis.onAegisCreated((path) => revealNew(path));
        const offMoved = window.api.aegis.onAegisMoved((oldPath, newPath) => applyPathMove(oldPath, newPath));
        return () => {
            offCreated();
            offMoved();
        };
    }, []);

    const toggle = () => setCollapsed((c) => !c);

    // Collapsed width: just enough for the macOS window buttons
    // (they sit at x=16 and are ~52px wide), plus room to breathe on the right
    const COLLAPSED_WIDTH = 96;

    const navClass = (active: boolean) =>
        `flex items-center gap-1 cursor-pointer rounded-md p-1 ${active ? activeClass : "hover:bg-hover"}`;

    return (
        <div
            style={{ width: collapsed ? COLLAPSED_WIDTH : resize.width }}
            className={`relative h-full shrink-0 border-r border-line min-h-0 bg-side flex flex-col overflow-hidden ${resize.dragging ? "" : "transition-[width] duration-200 ease-out"
                }`}
        >
            {/* Top bar: traffic lights on the left. Expanded, the toggle sits to their right;
                collapsed, the bar only holds the lights and the toggle moves into the icon strip. */}
            <Toolbar className="shrink-0 pl-10 justify-end">
                {!collapsed && (
                    <NoDrag>
                        <button onClick={toggle} title="Collapse sidebar" className={iconBtn}>
                            <PanelLeftClose size={18} />
                        </button>
                    </NoDrag>
                )}
            </Toolbar>

            {collapsed ? (
                /* ---------- Collapsed: icon strip ---------- */
                <div className="flex flex-col items-center flex-1 min-h-0 gap-1 py-2 no-drag overflow-y-auto">
                    <button onClick={toggle} title="Expand sidebar" className={iconBtn}>
                        <PanelLeftOpen size={18} />
                    </button>
                    <button onClick={openCommandPalette} title="Search (⌘K)" className={iconBtn}>
                        <Search size={18} />
                    </button>
                    <Link
                        to="/"
                        onClick={() => setView("all")}
                        title={`All Notes (${totalNotes})`}
                        className={`${iconBtn} ${view === "all" ? activeClass : ""}`}
                    >
                        <File size={18} />
                    </Link>
                    <Link
                        to="/"
                        onClick={() => setView("favorites")}
                        title={`Favorites (${favorites.length})`}
                        className={`${iconBtn} ${view === "favorites" ? activeClass : ""}`}
                    >
                        <Star size={18} />
                    </Link>

                    <div className="w-8 border-t border-line my-1" />

                    {tree.map((aegis) => (
                        <SidebarItem key={aegis.path} aegis={aegis} collapsed />
                    ))}

                    <button onClick={newAegis} title="New notebook" className={iconBtn}>
                        <Plus size={18} />
                    </button>
                </div>
            ) : (
                /* ---------- Expanded ---------- */
                <div className="flex flex-col flex-1 min-h-0 py-2 z-50 no-drag gap-2 px-2 overflow-y-auto">
                    <section>
                        <button
                            onClick={openCommandPalette}
                            className="w-full flex items-center px-2 text-muted bg-hover hover:bg-hover-strong rounded-md py-1"
                        >
                            <div className="flex items-center flex-1 gap-2">
                                <Search size={16} />
                                <span className="text-sm">Search</span>
                            </div>
                            <span className="text-sm">⌘ k</span>
                        </button>
                    </section>

                    <section>
                        <Link to="/" onClick={() => setView("all")} className={navClass(view === "all")}>
                            <File size={16} />
                            <span className="flex-1">All Notes</span>
                            <span className="text-muted">{totalNotes}</span>
                        </Link>
                        <Link to="/" onClick={() => setView("favorites")} className={navClass(view === "favorites")}>
                            <Star size={16} />
                            <span className="flex-1">Favorites</span>
                            <span className="text-muted">{favorites.length}</span>
                        </Link>
                    </section>

                    <section>
                        {/* Drop a notebook on this header to move it back to the top level */}
                        <div
                            onDragOver={(e) => {
                                if (!isMoveDrag(e)) return;
                                e.preventDefault();
                                setTopDrop(true);
                            }}
                            onDragLeave={() => setTopDrop(false)}
                            onDrop={async (e) => {
                                if (!isMoveDrag(e)) return;
                                e.preventDefault();
                                setTopDrop(false);
                                const root = await window.api.settings.getNotesRoot();
                                await dropInto(e, root);
                            }}
                            className={`flex items-center justify-between mb-2 rounded px-1 -mx-1 ${topDrop ? "ring-2 ring-accent bg-accent/15" : ""}`}
                            title="Drop a notebook here to move it to the top level"
                        >
                            <span className="text-muted text-xs font-medium">NOTEBOOKS</span>
                            <button onClick={newAegis} title="New notebook" className="text-muted hover:text-fg">
                                <Plus size={16} />
                            </button>
                        </div>
                        <div className="flex flex-col gap-1">
                            {tree.map((aegis) => (
                                <SidebarItem key={aegis.path} aegis={aegis} />
                            ))}
                        </div>
                    </section>

                    {tags.length > 0 && (
                        <section>
                            <div className="mb-2">
                                <span className="text-muted text-xs font-medium">TAGS</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                {tags.map((tag) => (
                                    <Link
                                        key={tag.name}
                                        to="/"
                                        onClick={() => setActiveTag(tag.name)}
                                        className={navClass(view === "tag" && activeTag === tag.name)}
                                    >
                                        <Hash size={16} className="shrink-0" />
                                        <span className="flex-1 truncate">{tag.name}</span>
                                        <span className="text-xs text-muted">{tag.count}</span>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}

            {/* Footer */}
            <section
                className={`shrink-0 border-t border-line w-full flex items-center no-drag ${collapsed ? "flex-col-reverse gap-2 pt-2 pb-4" : "h-12 px-4 justify-between"
                    }`}
            >
                <div className="flex items-center gap-2 min-w-0" title={displayName}>
                    <div className="flex items-center justify-center shrink-0 text-xs font-medium rounded-full bg-accent h-7 w-7 text-white">
                        {initials(displayName)}
                    </div>
                    {!collapsed && <span className="text-sm lg:text-base truncate">{displayName}</span>}
                </div>
                <div className="flex items-center">
                    <button onClick={() => setSettingsOpen(true)} title="Settings (⌘,)" className={iconBtn}>
                        <Settings2 size={18} />
                    </button>
                </div>
            </section>

            {/* Cmd+K search palette (fixed overlay, covers the whole window) */}
            {!collapsed && <ResizeHandle dragging={resize.dragging} {...resize.handleProps} />}
            <CommandPalette />
        </div>
    );
}