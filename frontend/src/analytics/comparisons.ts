import type { Organization, StoredSolve } from '../api/api';
import { effectiveTime } from './statistics.ts';
import { filterSolves, type Filters } from './filters.ts';

// Compare named groups only; unlabeled solves still contribute to the main statistics.
export function comparisonLabels(solves: StoredSolve[], organization: Organization, filters: Filters) {
  function favoriteEvent(rows: StoredSolve[]): number | null {
    const counts = new Map<number, number>();
    for (const solve of rows) {
      if (solve.category_id != null) counts.set(solve.category_id, (counts.get(solve.category_id) ?? 0) + 1);
    }
    // Event list order makes ties deterministic.
    return organization.categories.reduce<number | null>((best, event) =>
      (counts.get(event.id) ?? 0) > (best === null ? 0 : counts.get(best) ?? 0) ? event.id : best, null);
  }
  const favorite = favoriteEvent(filterSolves(solves, {...filters, event: ''}));
  // Ignore cube selection even when deriving the fallback event for best cube.
  const cubeCandidates = filterSolves(solves, {...filters, event: '', cube: ''});
  const cubeEvent = filters.event ? Number(filters.event) : favoriteEvent(cubeCandidates);
  const customEvent = filters.event ? Number(filters.event) : favorite;
  const cubeSolves = cubeEvent === null ? [] : cubeCandidates.filter(solve => solve.category_id === cubeEvent);
  const customSolves = customEvent === null ? [] : filterSolves(solves, {...filters, event: String(customEvent)});
  function bestMedian(rows: StoredSolve[], label: (solve: StoredSolve) => string | undefined): string | null {
    const groups = new Map<string, number[]>();
    for (const solve of rows) {
      const name = label(solve);
      const time = effectiveTime(solve);
      if (!name || !Number.isFinite(time)) continue;
      const times = groups.get(name) ?? [];
      times.push(time);
      groups.set(name, times);
    }
    let best: string | null = null;
    let bestTime = Infinity;
    for (const [name, times] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
      times.sort((a, b) => a - b);
      const middle = Math.floor(times.length / 2);
      const median = times.length % 2 ? times[middle] : (times[middle - 1] + times[middle]) / 2;
      if (median < bestTime) { bestTime = median; best = name; }
    }
    return best;
  }
  return {
    favoriteEvent: organization.categories.find(event => event.id === favorite)?.name ?? null,
    bestCube: bestMedian(cubeSolves, solve => organization.cubes.find(cube => cube.id === solve.cube_id)?.name),
    bestCustom: bestMedian(customSolves, solve => solve.custom ?? undefined),
  };
}
