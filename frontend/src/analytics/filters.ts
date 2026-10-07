import type { StoredSolve } from '../api/api';

export interface Filters { start: string; end: string; event: string; cube: string; custom: string }

export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function presetDates(days: number | null, now = new Date()): { start: string; end: string } {
  if (days === null) return { start: '', end: '' };
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - days + 1);
  return { start: localDate(start), end: localDate(now) };
}

export function filterSolves(solves: StoredSolve[], filters: Filters): StoredSolve[] {
  const start = filters.start ? new Date(`${filters.start}T00:00:00`).getTime() : -Infinity;
  const endDate = filters.end ? new Date(`${filters.end}T00:00:00`) : null;
  if (endDate) endDate.setDate(endDate.getDate() + 1);
  const end = endDate?.getTime() ?? Infinity;
  return solves.filter(solve => {
    const timestamp = new Date(solve.started_at).getTime();
    return timestamp >= start && timestamp < end
      && (!filters.event || String(solve.category_id) === filters.event)
      && (!filters.cube || String(solve.cube_id) === filters.cube)
      && (!filters.custom || solve.custom === filters.custom);
  }).sort((a, b) => a.started_at.localeCompare(b.started_at) || a.id.localeCompare(b.id));
}
