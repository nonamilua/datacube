export interface BoxBounds { left:number; right:number; top:number; bottom:number }

// Only very narrow boxes receive tolerance; whiskers and the rest of a row do not.
export function hitsBox(bounds:BoxBounds, x:number, y:number):boolean {
  const center = (bounds.left + bounds.right) / 2;
  const halfWidth = Math.max(4,(bounds.right - bounds.left) / 2);
  return x >= center - halfWidth && x <= center + halfWidth && y >= bounds.top && y <= bounds.bottom;
}
