// Maps a generated plan into the practice editor's "block spec" shape so the
// editor's existing addBlocksWithDrills() path can inject it. Pure and generic
// over the drill-entry type (keyed by id) so this lib file never imports a UI
// component type — the editor passes its own DrillCatalogEntry map in.
//
// One spec per skeleton block, in skeleton order, so the coach gets the full
// session shape (warm-up → skill blocks → team → cool-down). Generated drills
// are resolved against the catalog; any that don't resolve (e.g. a gap drill
// adopted in the full preview flow but not present in the editor's page-load
// catalog) are dropped — AI fill only injects drills the editor already knows.

import type { Skeleton, GeneratedPlan } from "./types";

export type EditorBlockSpec<T> = { name: string; drills: T[] };

export function toEditorBlocks<T extends { id: string }>(
  skeleton: Skeleton,
  generated: GeneratedPlan,
  catalogById: Map<string, T>,
): EditorBlockSpec<T>[] {
  const genByKey = new Map(generated.blocks.map((b) => [b.blockKey, b]));
  return skeleton.blocks.map((sb) => {
    const gen = genByKey.get(sb.key);
    const drills = (gen?.drills ?? [])
      .map((d) => catalogById.get(d.drillId))
      .filter((d): d is T => Boolean(d));
    return { name: sb.name, drills };
  });
}
