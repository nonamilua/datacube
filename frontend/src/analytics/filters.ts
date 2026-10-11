import type { StoredSolve } from '../api/api';

export interface Filters { start: string; end: string; event: string; cube: string; custom: string; hours?: number }
// Longer than the maximum stored tag, so it cannot collide with a user value.
export const EMPTY_CUSTOM = '__no_custom_value__';

function customMatches(solve: StoredSolve, value: string): boolean {
  return !value || (value === EMPTY_CUSTOM ? !solve.custom?.trim() : solve.custom === value);
}

export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function presetDates(days: number | null, now = new Date()): { start: string; end: string } {
  if (days === null) return { start: '', end: '' };
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - days + 1);
  return { start: localDate(start), end: localDate(now) };
}

export function filterSolves(solves: StoredSolve[], filters: Filters, now = new Date()): StoredSolve[] {
  const start = filters.start ? new Date(`${filters.start}T00:00:00`).getTime() : -Infinity;
  const endDate = filters.end ? new Date(`${filters.end}T00:00:00`) : null;
  if (endDate) endDate.setDate(endDate.getDate() + 1);
  const end = endDate?.getTime() ?? Infinity;
  return solves.filter(solve => {
    const timestamp = new Date(solve.started_at).getTime();
    return timestamp >= start && timestamp < end
      && (filters.hours === undefined || timestamp >= now.getTime() - filters.hours * 3600000 && timestamp <= now.getTime())
      && (!filters.event || String(solve.category_id) === filters.event)
      && (!filters.cube || String(solve.cube_id) === filters.cube)
      && customMatches(solve, filters.custom);
  }).sort((a, b) => a.started_at.localeCompare(b.started_at) || a.id.localeCompare(b.id));
}

// Start with event/date scope, validate selections independently, then cross-filter options.
export function availableFilters(solves: StoredSolve[], filters: Filters, now = new Date()) {
  const scoped = filters.event ? filterSolves(solves, {...filters, cube: '', custom: ''}, now) : [];
  let cube = filters.cube && scoped.some(solve => String(solve.cube_id) === filters.cube) ? filters.cube : '';
  let custom = filters.custom && scoped.some(solve => customMatches(solve, filters.custom)) ? filters.custom : '';
  if (cube && custom && !scoped.some(solve => String(solve.cube_id) === cube && customMatches(solve, custom))) {
    cube = custom = '';
  }
  const cubeIds = [...new Set(scoped.filter(solve => customMatches(solve, custom))
    .flatMap(solve => solve.cube_id == null ? [] : [String(solve.cube_id)]))];
  const customRows = scoped.filter(solve => !cube || String(solve.cube_id) === cube);
  const names = [...new Set(customRows.map(solve => solve.custom).filter((value): value is string => Boolean(value?.trim())))].sort();
  const customValues = customRows.some(solve => !solve.custom?.trim()) ? [EMPTY_CUSTOM, ...names] : names;
  return {cube, custom, cubeIds, customValues};
}
