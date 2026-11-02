import { PanelLeft } from "lucide-react";

export default function Menubar() {
  return (
    <div className="h-10 shrink-0 flex items-center px-4 bg-side border-b border-line titlebar justify-between gap-4">
      <div className="flex gap-2">
        <button
          title="Close"
          onClick={() => window.api.window.close()}
          className="bg-red-400 rounded-full h-3 w-3 traffic cursor-pointer"
        />
        <button
          title="Minimize"
          onClick={() => window.api.window.minimize()}
          className="bg-yellow-400 rounded-full h-3 w-3 traffic cursor-pointer"
        />
        <button
          title="Maximize"
          onClick={() => window.api.window.maximize()}
          className="bg-green-400 rounded-full h-3 w-3 traffic cursor-pointer"
        />
      </div>
      <PanelLeft size={18} className="text-muted hover:text-fg cursor-pointer" />
    </div>
  );
}
