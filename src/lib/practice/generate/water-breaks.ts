export type WaterBreak = { afterBlockKey: string; minutes: number };

/** PURE: a break after whichever block crosses each everyMin cumulative mark.
 *  Never emits a break after the final block (no trailing break). */
export function computeWaterBreaks(
  blocks: { key: string; targetMinutes: number }[],
  opts: { everyMin: number; durationMin: number; enabled: boolean },
): WaterBreak[] {
  if (!opts.enabled || blocks.length === 0) return [];
  const out: WaterBreak[] = [];
  let cum = 0;
  let nextMark = opts.everyMin;
  for (let i = 0; i < blocks.length; i++) {
    cum += blocks[i].targetMinutes;
    if (i === blocks.length - 1) break; // no trailing break
    while (cum >= nextMark) {
      if (!out.some((b) => b.afterBlockKey === blocks[i].key)) {
        out.push({ afterBlockKey: blocks[i].key, minutes: opts.durationMin });
      }
      nextMark += opts.everyMin;
    }
  }
  return out;
}
