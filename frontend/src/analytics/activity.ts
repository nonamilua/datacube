import type { StoredSolve } from '../api/api';
import { solveLocalDate } from './solve-tooltip.ts';

export function countActivity(solves: readonly StoredSolve[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const solve of solves) {
    const day = new Date(solve.started_at);
    if (!Number.isFinite(day.getTime())) continue;
    const date = solveLocalDate(day);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  return counts;
}

export function activityBand(count: number): number {
  if (count >= 50) return 4;
  if (count >= 20) return 3;
  if (count >= 5) return 2;
  return count > 0 ? 1 : 0;
}

export function activityLayout(width: number, height: number, gap: number) {
  const cell = Math.max(0, Math.floor(Math.min(width, (height - 6 * gap) / 7)));
  return {cell, weeks: cell > 0 ? Math.floor((width + gap) / (cell + gap)) : 0};
}

export function activityDays(counts: ReadonlyMap<string, number>, weeks: number, now: Date) {
  const today = solveLocalDate(now);
  const monday = new Date(now);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7 - 7 * (weeks - 1));
  return Array.from({length:7}, (_, weekday) => Array.from({length:weeks}, (_, week) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + 7 * week + weekday);
    const date = solveLocalDate(day);
    return date > today ? null : {date, count:counts.get(date) ?? 0};
  }));
}
