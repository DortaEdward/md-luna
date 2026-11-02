const FRONT_MATTER = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/

/** Remove the front matter block from the top of a note */
export function stripFrontMatter(text: string) {
  return text.replace(FRONT_MATTER, '')
}

/** How many characters the front matter block takes up (0 if there isn't one) */
export function frontMatterLength(text: string) {
  return text.match(FRONT_MATTER)?.[0].length ?? 0
}