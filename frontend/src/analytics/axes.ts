// Keep about five solve-count labels using steps of 1, 2 or 5 times a power of ten.
export function solveCountTicks(count: number): number[] {
  if (count <= 0) return [];
  const target = Math.max(5, count / 5);
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const step = count <= 5 ? 1 : [1, 2, 5, 10].map(value => value * magnitude).find(value => value >= target)!;
  return Array.from({length: Math.floor(count / step)}, (_, index) => (index + 1) * step);
}

// Compare regular and half-step grids, preferring tight, balanced bounds.
export function timeAxis(values: (number | null)[]): { min: number; max: number; ticks: number[] } {
  let lowest = Infinity;
  let highest = -Infinity;
  for (const value of values) {
    if (value !== null && Number.isFinite(value)) {
      lowest = Math.min(lowest, value);
      highest = Math.max(highest, value);
    }
  }
  if (lowest === Infinity) return { min: 0, max: 5, ticks: [0, 5] };
  if (lowest === highest) {
    lowest = Math.max(0, lowest - 0.5);
    highest += 0.5;
  }
  const magnitude = 10 ** Math.floor(Math.log10((highest - lowest) / 4));
  let best: { min: number; max: number; ticks: number[]; span: number; gap: number } | null = null;
  for (const factor of [1, 2, 5, 10, 20, 50]) {
    const step = factor * magnitude;
    // Whole/five-second origins for typical solves; finer grids for short times.
    const offsets = step < 5 || (step / 2) % 5 === 0 ? [0, step / 2] : [0];
    for (const offset of offsets) {
      const min = Math.max(0, Number((Math.floor((lowest - offset) / step) * step + offset).toFixed(6)));
      const intervals = Math.max(1, Math.ceil((highest - min) / step - 1e-9));
      if (intervals > 4) continue;
      const max = Number((min + intervals * step).toFixed(6));
      const span = max - min;
      const gap = Math.max(lowest - min, max - highest);
      if (!best || span < best.span - 1e-6 || Math.abs(span - best.span) < 1e-6 && gap < best.gap) {
        best = { min, max, span, gap, ticks: Array.from({length: intervals + 1}, (_, index) => Number((min + index * step).toFixed(6))) };
      }
    }
  }
  return { min: best!.min, max: best!.max, ticks: best!.ticks };
}

export function distributionAxis(counts: number[]): { max: number; ticks: number[] } {
  const peak = counts.reduce((highest, count) => Math.max(highest, count), 0);
  if (peak === 0) return { max: 1, ticks: [0, 1] };
  // Prefer round ceilings, but never add more than ten percent empty space.
  const ten = Math.ceil(peak / 10) * 10;
  const five = Math.ceil(peak / 5) * 5;
  const max = ten <= peak * 1.1 ? ten : five <= peak * 1.1 ? five : peak;
  const target = max / 4;
  const step = target >= 10 ? Math.max(10, Math.round(target / 10) * 10) : Math.max(1, Math.round(target));
  const ticks = Array.from({length: Math.floor(max / step) + 1}, (_, index) => index * step);
  return { max, ticks };
}
