import type { Organization, StoredSolve } from '../api/api';
import { filterSolves, type Filters } from './filters.ts';
import { effectiveTime } from './statistics.ts';
import { reconcileSelection, type CompareSelection } from './compare-selection.ts';

export interface BoxSummary {
  count: number; q1: number; median: number; q3: number;
  low: number; high: number; outliers: number[];
}
export interface ComparisonGroup { value: string; name: string; box: BoxSummary | null }

export function comparisonPercentage(count: number, total: number): string {
  return `${total ? Number((count / total * 100).toFixed(1)) : 0}%`;
}

// Linear interpolation at (n - 1) p, also known as Hyndman-Fan type 7.
// Times remain milliseconds here; only the renderer converts to seconds.
export function boxSummary(values: number[]): BoxSummary | null {
  const sorted = values.filter(Number.isFinite).sort((a,b) => a-b);
  if (!sorted.length) return null;
  const quantile = (p: number) => {
    const position = (sorted.length - 1) * p;
    const index = Math.floor(position);
    return sorted[index] + (sorted[Math.ceil(position)] - sorted[index]) * (position - index);
  };
  const q1 = quantile(.25), median = quantile(.5), q3 = quantile(.75);
  const spread = (q3 - q1) * 1.5;
  const inside = sorted.filter(value => value >= q1 - spread && value <= q3 + spread);
  return {count:sorted.length,q1,median,q3,low:inside[0],high:inside.at(-1)!,
    outliers:sorted.filter(value => value < q1 - spread || value > q3 + spread)};
}

export function comparisonData(solves: StoredSolve[], organization: Organization, filters: Filters,
  selectedCubes: CompareSelection, selectedCustom: CompareSelection, now = new Date()) {
  const scoped = filters.event ? filterSolves(solves,{...filters,cube:'',custom:''},now) : [];
  const cubes = organization.cubes.filter(cube => cube.name.trim() && scoped.some(solve => solve.cube_id === cube.id))
    .map(cube => ({value:String(cube.id),name:cube.name}));
  const custom = [...new Set(scoped.flatMap(solve => solve.custom?.trim() ? [solve.custom] : []))]
    .map(name => ({value:name,name}));
  const alphabetical = (a: {name:string;value:string}, b: {name:string;value:string}) => a.name.localeCompare(b.name) || a.value.localeCompare(b.value);
  cubes.sort(alphabetical); custom.sort(alphabetical);
  // Denominators use the full account/event/date scope, independent of checkbox selections.
  const labeledCubes = new Set(cubes.map(cube => Number(cube.value)));
  const valid = scoped.filter(solve => Number.isFinite(effectiveTime(solve)));
  const cubeTotal = valid.filter(solve => solve.cube_id != null && labeledCubes.has(solve.cube_id)).length;
  const customTotal = valid.filter(solve => solve.custom?.trim()).length;
  const cubeSelection = reconcileSelection(selectedCubes,cubes.map(cube => cube.value));
  const customSelection = reconcileSelection(selectedCustom,custom.map(tag => tag.value));
  const cubeGroups: ComparisonGroup[] = cubes.filter(cube => cubeSelection === null || cubeSelection.includes(cube.value))
    .map(cube => ({...cube,box:boxSummary(scoped.filter(solve => String(solve.cube_id) === cube.value).map(effectiveTime))}));
  const customGroups: ComparisonGroup[] = custom.filter(tag => customSelection === null || customSelection.includes(tag.value))
    .map(tag => ({...tag,box:boxSummary(scoped.filter(solve => solve.custom === tag.value).map(effectiveTime))}));
  const byMedian = (a:ComparisonGroup,b:ComparisonGroup) =>
    (a.box?.median ?? Infinity) - (b.box?.median ?? Infinity) || alphabetical(a,b);
  cubeGroups.sort(byMedian); customGroups.sort(byMedian);
  return {cubes,custom,cubeSelection,customSelection,cubeGroups,customGroups,cubeTotal,customTotal};
}
