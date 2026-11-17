import assert from "node:assert/strict";
import { countChanges, wordDiff } from "./wordDiff";

const render = (before: string, after: string) =>
  wordDiff(before, after)
    .map((p) =>
      p.type === "same"
        ? p.text
        : p.type === "del"
          ? `[-${p.text}]`
          : `[+${p.text}]`,
    )
    .join("");

// Removed and added words.
assert.equal(
  render("ok so the overlay breaks", "The overlay breaks."),
  "[-ok so the][+The] overlay breaks[+.]",
);

// Identical text has no changes.
const same = wordDiff("Same text.", "Same text.");
assert.deepEqual(same, [{ type: "same", text: "Same text." }]);
assert.equal(countChanges(same), 0);

// Each separate edit counts once.
assert.equal(
  countChanges(
    wordDiff(
      "yeah it works anywhere u can select text",
      "Yes, it works anywhere you can select text.",
    ),
  ),
  3,
);

console.log("wordDiff: ok");
