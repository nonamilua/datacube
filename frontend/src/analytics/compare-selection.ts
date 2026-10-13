// null tracks all options, including future ones; [] explicitly selects none.
export type CompareSelection = string[] | null;

export function reconcileSelection(selected:CompareSelection, available:string[]):CompareSelection {
  if (selected === null) return null;
  const retained = selected.filter(value => available.includes(value));
  return available.length && available.every(value => retained.includes(value)) ? null : retained;
}
