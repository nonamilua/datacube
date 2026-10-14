// Keep chart canvases and legend sources sharp, with a minimum 2x resolution.
export function chartPixelRatio(ratio = window.devicePixelRatio): number {
  return Math.max(ratio, 2);
}

// Match the CSS presentation scale; chart coordinates stay in CSS pixels.
export function presentationScale(value: string): number {
  const scale = Number(value.trim());
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

export function chartScale(): number {
  return presentationScale(getComputedStyle(document.documentElement).getPropertyValue('--presentation-scale'));
}

export function symbolDimensions(size: number, scale: number, pixelRatio: number) {
  const logical = size * scale;
  return { logical, backing: Math.ceil(logical * pixelRatio) };
}
