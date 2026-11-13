// Plot x coordinates retain the original solve position even when points are sampled.
export function solveDateTitle(position: number | undefined, timestamps: readonly string[]): string {
  if (position === undefined || !Number.isInteger(position)) return '';
  const timestamp = timestamps[position - 1];
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';
  return solveLocalDate(date);
}

export function solveTooltipValues(position: number, series: readonly (readonly (number | null)[])[], isVisible: (index: number) => boolean) {
  return series.flatMap((values, index) => {
    const value = values[position - 1];
    return value != null && Number.isFinite(value) && isVisible(index) ? [{index, value}] : [];
  });
}

export function solveLocalDate(date: Date): string {
  // Local getters preserve the device's calendar day rather than the UTC day.
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
