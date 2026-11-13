export function timeSampleTarget(width: number): number {
  // Use the canvas width in CSS pixels so high-density screens don't oversample.
  return Math.min(1200, Math.max(600, Math.round(width * 1.2)));
}

export function sampleAverageIndexes(count: number, target: number): number[] {
  const size = Math.min(count, target);
  if (size <= 1) return size === 1 ? [0] : [];
  return Array.from({length: size}, (_, index) => Math.round(index * (count - 1) / (size - 1)));
}

export function sampleTimeIndexes(times: readonly (number | null)[], best: readonly (number | null)[], target: number): number[] {
  if (times.length <= target) return times.map((_, index) => index);

  const last = times.length - 1;
  const selected = new Set([0, last]);
  const groups = Math.floor((target - 2) / 2);
  for (let group = 0; group < groups; group++) {
    const start = 1 + Math.floor(group * (last - 1) / groups);
    const end = 1 + Math.floor((group + 1) * (last - 1) / groups);
    let low = Infinity, high = -Infinity;
    let lowIndex = start, highIndex = end - 1;
    for (let index = start; index < end; index++) {
      const time = times[index];
      if (time === null || !Number.isFinite(time)) continue;
      if (time < low) { low = time; lowIndex = index; }
      if (time >= high) { high = time; highIndex = index; }
    }
    selected.add(lowIndex);
    selected.add(highIndex);
  }
  // Retain every best solve even when it falls between sampled positions.
  best.forEach((time, index) => { if (time !== null) selected.add(index); });
  return [...selected].sort((a, b) => a - b);
}
