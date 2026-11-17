import React from "react";
import { wordDiff } from "@/features/llm/lib/wordDiff";

/** `before` rewritten as `after`, removed words struck through and added
 * ones tinted (the canvas's .del / .add). */
export const DiffText: React.FC<{ before: string; after: string }> = ({
  before,
  after,
}) => (
  <>
    {wordDiff(before, after).map((part, i) =>
      part.type === "same" ? (
        <React.Fragment key={i}>{part.text}</React.Fragment>
      ) : part.type === "del" ? (
        <del key={i} className="g-del">
          {part.text}
        </del>
      ) : (
        <ins key={i} className="g-add no-underline">
          {part.text}
        </ins>
      ),
    )}
  </>
);
