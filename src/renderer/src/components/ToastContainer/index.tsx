import { useToastStore } from "../../stores/toastStore";

type ToastType = "success" | "error" | "info" | "warning";

const typeStyles: Record<ToastType, string> = {
    success: "border-green-500/40 text-green-700 dark:text-green-400",
    error: "border-red-500/40 text-red-700 dark:text-red-400",
    warning: "border-yellow-500/50 text-yellow-700 dark:text-yellow-400",
    info: "border-line text-fg",
};

export function ToastContainer() {
    const toasts = useToastStore((state) => state.toasts);
    const dismissToast = useToastStore((state) => state.dismissToast);

    return (
        <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`flex items-center gap-3 rounded border bg-bg px-4 py-2 text-sm shadow-lg animate-in slide-in-from-bottom-2 fade-in ${typeStyles[toast.type]}`}
                >
                    <span>{toast.message}</span>
                    <button
                        onClick={() => dismissToast(toast.id)}
                        title="Dismiss"
                        className="text-muted hover:text-fg cursor-pointer text-xs"
                    >
                        ✕
                    </button>
                </div>
            ))}
        </div>
    );
}