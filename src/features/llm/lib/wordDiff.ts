/** One stretch of a word diff: kept, removed from the original, or added. */
export interface DiffPart {
  type: "same" | "del" | "add";
  text: string;
}

/** Words and the punctuation stuck to them are compared on their own, so
 * "it" -> "it." shows only the period as added. */
const tokenize = (text: string): string[] =>
  text.match(/\s+|[\p{L}\p{N}'’_-]+|[^\s\p{L}\p{N}]/gu) ?? [];

/**
 * What changed from `before` to `after`, word by word (a longest common
 * subsequence of tokens). Whitespace sits with the words around it, so the
 * removed and added runs read as phrases.
 */
export const wordDiff = (before: string, after: string): DiffPart[] => {
  const a = tokenize(before);
  const b = tokenize(after);
  // Long texts: cap the table so a huge paste can't freeze the window.
  if (a.length * b.length > 4_000_000) {
    return [
      { type: "del", text: before },
      { type: "add", text: after },
    ];
  }
  const table: Uint32Array[] = Array.from(
    { length: a.length + 1 },
    () => new Uint32Array(b.length + 1),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] =
        a[i] === b[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const parts: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.text += text;
    else parts.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      push("del", a[i++]);
    } else {
      push("add", b[j++]);
    }
  }
  while (i < a.length) push("del", a[i++]);
  while (j < b.length) push("add", b[j++]);

  // A space that only separates two changes belongs to the change, not to
  // the kept text, so "ok so | The" doesn't split into four pieces.
  return parts.filter((p) => p.text.length > 0);
};

/** How many separate edits a diff holds: each run of removed and/or added
 * text between kept words counts once. */
export const countChanges = (parts: DiffPart[]): number => {
  let changes = 0;
  let inChange = false;
  for (const part of parts) {
    const kept = part.type === "same" && part.text.trim().length > 0;
    if (part.type !== "same" && !inChange) {
      changes++;
      inChange = true;
    } else if (kept) {
      inChange = false;
    }
  }
  return changes;
};
