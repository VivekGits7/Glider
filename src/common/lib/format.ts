/** Bytes in a megabyte (MiB), as model sizes and download speeds count them. */
export const BYTES_PER_MB = 1024 * 1024;

export const formatModelSize = (sizeMb: number | null | undefined): string => {
  if (!sizeMb || !Number.isFinite(sizeMb) || sizeMb <= 0) {
    return "Unknown size";
  }

  if (sizeMb >= 1024) {
    const sizeGb = sizeMb / 1024;
    const formatter = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: sizeGb >= 10 ? 0 : 1,
      maximumFractionDigits: sizeGb >= 10 ? 0 : 1,
    });
    return `${formatter.format(sizeGb)} GB`;
  }

  const formatter = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: sizeMb >= 100 ? 0 : 1,
    maximumFractionDigits: sizeMb >= 100 ? 0 : 1,
  });

  return `${formatter.format(sizeMb)} MB`;
};

// shortcut: estimated from the download size (weights load whole, plus ~25%
// runtime), not measured; add a catalog field if real numbers are needed.
export const estimateMemory = (sizeMb: number): string =>
  `~${formatModelSize(sizeMb * 1.25)}`;
