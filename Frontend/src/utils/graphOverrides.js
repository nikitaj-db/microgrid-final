export const FORCE_ZERO_GRAPHS = false;

function isNumericLike(value) {
  const num = Number(value);
  return Number.isFinite(num);
}

export function zeroSeries(series = []) {
  if (!Array.isArray(series)) return [];
  return series.map((point) => {
    if (!point || typeof point !== "object") return point;
    const out = { ...point };
    for (const key of Object.keys(out)) {
      if (key === "hour" || key === "ts") continue;
      if (isNumericLike(out[key])) out[key] = 0;
    }
    return out;
  });
}

