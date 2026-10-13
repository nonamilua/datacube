// Interpolate cyan to violet to pink across rows, never within a box.
export function comparisonColors(count:number, cyan:string, violet:string, pink:string):string[] {
  const channels = (hex:string) => [1,3,5].map(index => parseInt(hex.slice(index,index+2),16));
  const stops = [cyan,violet,pink].map(channels);
  return Array.from({length:count},(_,index) => {
    const position = count < 2 ? 0 : index / (count - 1) * 2;
    const segment = Math.min(1,Math.floor(position));
    const first = stops[segment], last = stops[segment+1];
    const fraction = position - segment;
    const rgb = first.map((value,channel) => Math.round(value + (last[channel] - value) * fraction));
    return `rgb(${rgb.join(', ')})`;
  });
}
