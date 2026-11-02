export interface Aegis {
  name: string
  path: string
  /** Notes directly inside this notebook (not counting nested notebooks) */
  noteCount: number
  /** Notebooks inside this one */
  children: Aegis[]
  /** 0 for top-level notebooks, 1 for one level down, ... */
  depth: number
  /** Where it lives, for display: "Work / Projects / Q3" */
  trail: string
}
