export interface Result { duration_ms: number; penalty?: 'OK' | '+2' | 'DNF' }

export function effectiveTime(solve: Result): number {
  return solve.penalty === 'DNF' ? Infinity : solve.duration_ms + (solve.penalty === '+2' ? 2000 : 0);
}

// Trim five percent from each end, rounded up. DNF sorts as the worst result.
export function average(times: number[]): number | null {
  if (times.length < 3) return null;
  const trim = Math.ceil(times.length * 0.05);
  const sorted = [...times].sort((a, b) => a - b).slice(trim, -trim);
  return sorted.reduce((sum, time) => sum + time, 0) / sorted.length;
}

export function rollingAverage(times: number[], size: number): (number | null)[] {
  return times.map((_, index) => index + 1 < size ? null : average(times.slice(index + 1 - size, index + 1)));
}

export function bestProgression(times: number[]): (number | null)[] {
  let best = Infinity;
  return times.map(time => {
    if (!Number.isFinite(time) || time >= best) return null;
    best = time;
    return time;
  });
}

// Input is chronological. DNF counts as a solve but is excluded from basic statistics.
export function statistics(solves: Result[]) {
  const times = solves.map(effectiveTime);
  const finite = times.filter(Number.isFinite).sort((a, b) => a - b);
  const mean = finite.length ? finite.reduce((sum, time) => sum + time, 0) / finite.length : null;
  const middle = Math.floor(finite.length / 2);
  const median = finite.length ? finite.length % 2 ? finite[middle] : (finite[middle - 1] + finite[middle]) / 2 : null;
  const deviation = mean === null ? null : Math.sqrt(finite.reduce((sum, time) => sum + (time - mean) ** 2, 0) / finite.length);
  const ao5 = rollingAverage(times, 5);
  const ao12 = rollingAverage(times, 12);
  const ao50 = rollingAverage(times, 50);
  const ao100 = rollingAverage(times, 100);
  const bestAverage = (values: (number | null)[]) => {
    const available = values.filter((value): value is number => value !== null);
    return available.length ? available.reduce((best, value) => Math.min(best, value), Infinity) : null;
  };
  return { count: solves.length, plusTwoCount: solves.filter(solve => solve.penalty === '+2').length,
    dnfCount: solves.filter(solve => solve.penalty === 'DNF').length,
    mean, median, best: finite[0] ?? null, worst: finite.at(-1) ?? null, deviation,
    ao5: ao5.at(-1) ?? null, ao12: ao12.at(-1) ?? null,
    ao50: ao50.at(-1) ?? null, ao100: ao100.at(-1) ?? null,
    bestAo5: bestAverage(ao5), bestAo12: bestAverage(ao12), bestAo50: bestAverage(ao50), bestAo100: bestAverage(ao100),
    times, rolling5: ao5, rolling12: ao12, bestProgression: bestProgression(times) };
}

export function histogram(times: number[]) {
  let finite = times.filter(Number.isFinite);
  if (!finite.length) return { labels: [] as string[], boundaries: [] as number[], counts: [] as number[], omitted: 0 };
  const fullMean = finite.reduce((sum, time) => sum + time, 0) / finite.length;
  const fullDeviation = Math.sqrt(finite.reduce((sum, time) => sum + (time - fullMean) ** 2, 0) / finite.length);
  const visible = finite.filter(time => fullDeviation === 0 || Math.abs(time - fullMean) <= 3 * fullDeviation);
  const omitted = finite.length - visible.length;
  finite = visible;
  const min = finite.reduce((best, value) => Math.min(best, value), Infinity);
  const max = finite.reduce((worst, value) => Math.max(worst, value), 0);
  const mean = finite.reduce((sum, time) => sum + time, 0) / finite.length;
  const deviation = Math.sqrt(finite.reduce((sum, time) => sum + (time - mean) ** 2, 0) / finite.length);
  // Sparse samples use fewer intervals. Seven bins are available only with
  // at least 50 plotted times; variation determines the interval width.
  const maximumBins = finite.length >= 50 ? 7 : Math.min(6, Math.ceil(Math.sqrt(finite.length)));
  // Use tenths of a second for both boundaries and widths so rounded labels
  // stay distinct, including for very short solves.
  const requestedWidth = Math.max(100, 2 * deviation / Math.cbrt(finite.length), (max - min) / Math.max(1, maximumBins - 1));
  const rounding = 100;
  let width = Math.ceil(requestedWidth / rounding) * rounding;
  const center = Math.round(mean / rounding) * rounding;
  let lower = Math.max(0, center + Math.floor((min - center) / width) * width);
  let bins = Math.floor((max - lower) / width) + 1;
  while (bins > maximumBins) {
    width = Math.ceil(width * 1.1 / rounding) * rounding;
    lower = Math.max(0, center + Math.floor((min - center) / width) * width);
    bins = Math.floor((max - lower) / width) + 1;
  }
  const counts = Array<number>(bins).fill(0);
  for (const time of finite) counts[Math.min(bins - 1, Math.floor((time - lower) / width))] += 1;
  const boundaries = Array.from({length: bins + 1}, (_, index) => (lower + width * index) / 1000);
  return { labels: counts.map((_, index) => `${boundaries[index].toFixed(1)}–${boundaries[index + 1].toFixed(1)}`), boundaries, counts, omitted };
}
