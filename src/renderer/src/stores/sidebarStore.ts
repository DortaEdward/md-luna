

import { create } from 'zustand'

interface SidebarState {
    isOpen: boolean
}

export const useSidebarStore = create<SidebarState>(() => ({
    isOpen: true,
}))