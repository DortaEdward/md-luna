import { ReactNode } from "react";

export function Toolbar({ children, className = "" }: { children?: ReactNode; className?: string }) {
    return (
        <div className={`h-10 shrink-0 flex items-center gap-2 px-3 select-none drag ${className}`}>
            {children}
        </div>
    );
}
export function NoDrag({ children }: { children: ReactNode }) {
    return <div className="no-drag flex items-center gap-2">{children}</div>;
}