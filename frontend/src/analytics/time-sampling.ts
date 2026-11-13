export function evenlySpacedIndexes(count: number, target: number): number[] {
  const size = Math.min(count, target);
  if (size <= 1) return size === 1 ? [0] : [];
  return Array.from({length: size}, (_, index) => Math.round(index * (count - 1) / (size - 1)));
}
