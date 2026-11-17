import { useEffect, useState } from "react";
import { commands, type ModelMemory } from "@/bindings";

/** Live memory of each model's worker, read every 2 s while the Models page
 * is open. `null` until the first read comes back. */
export const useModelMemory = (): ModelMemory | null => {
  const [memory, setMemory] = useState<ModelMemory | null>(null);
  useEffect(() => {
    let alive = true;
    const read = () =>
      commands
        .getModelMemory()
        .then((next) => alive && setMemory(next))
        .catch(() => {});
    read();
    const id = setInterval(read, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return memory;
};
