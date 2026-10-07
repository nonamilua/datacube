// Keep about five solve-count labels using steps of 1, 2 or 5 times a power of ten.
export function solveCountTicks(count: number): number[] {
  if (count <= 0) return [];
  const target = Math.max(5, count / 5);
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const step = count <= 5 ? 1 : [1, 2, 5, 10].map(value => value * magnitude).find(value => value >= target)!;
  return Array.from({length: Math.floor(count / step)}, (_, index) => (index + 1) * step);
}
