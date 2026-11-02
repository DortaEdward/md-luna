import { create } from 'zustand'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
    id: number
    message: string
    type: ToastType
}

interface ToastState {
    toasts: Toast[]
    showToast: (message: string, type?: ToastType, duration?: number) => void
    dismissToast: (id: number) => void
}

let idCounter = 0

export const useToastStore = create<ToastState>((set) => ({
    toasts: [],

    showToast: (message, type = 'info', duration = 3000) => {
        const id = idCounter++

        set((state) => ({ toasts: [...state.toasts, { id, message, type }] }))

        setTimeout(() => {
            set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
        }, duration)
    },

    dismissToast: (id) => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    },
}))