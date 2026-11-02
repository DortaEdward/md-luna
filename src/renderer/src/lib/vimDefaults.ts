/** Starting contents of Settings → Editor → Vim keymaps */
export const DEFAULT_VIM_CONFIG = `-- Vim keymaps. Neovim Lua or Vimscript, one mapping per line.
-- App commands: :w  :q  :wq  :Ex  :Sidebar  :Editor  :Split  :Preview  :Favorite  :Settings  :ExportPdf  :ExportHtml

vim.g.mapleader = " "

vim.keymap.set("n", "<leader>pv", vim.cmd.Ex)
`;
