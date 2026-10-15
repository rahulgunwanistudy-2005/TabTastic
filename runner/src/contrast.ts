/** sRGB / OKLCH conversions and a minimum-lightness-change contrast fix. */
export type RGB = { r: number; g: number; b: number };
export type OKLCH = { l: number; c: number; h: number };
export type ContrastSolution = {
  color: string;
  ratio: number;
  originalRatio: number;
  oklch: OKLCH;
  lightnessDelta: number;
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const linear = (value: number) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const encoded = (value: number) => value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;

export function rgbToOklch(rgb: RGB): OKLCH {
  const r = linear(rgb.r), g = linear(rgb.g), b = linear(rgb.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(a, bb);
  return { l: lightness, c: c < 1e-7 ? 0 : c, h: c < 1e-7 ? 0 : (Math.atan2(bb, a) * 180 / Math.PI + 360) % 360 };
}

export function oklchToRgb(color: OKLCH, clip = true): RGB {
  const a = color.c * Math.cos(color.h * Math.PI / 180);
  const b = color.c * Math.sin(color.h * Math.PI / 180);
  const l = (color.l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (color.l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (color.l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = {
    r: encoded(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: encoded(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: encoded(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
  return clip ? { r: clamp(rgb.r), g: clamp(rgb.g), b: clamp(rgb.b) } : rgb;
}

export function parseColor(value: string): RGB {
  const hex = value.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].split('').map(digit => digit + digit).join('') : hex[1];
    return { r: parseInt(digits.slice(0, 2), 16) / 255, g: parseInt(digits.slice(2, 4), 16) / 255, b: parseInt(digits.slice(4, 6), 16) / 255 };
  }
  const oklch = value.trim().match(/^oklch\(\s*([\d.]+)(%)?\s+([\d.]+)\s+([\d.-]+)(?:deg)?\s*\)$/i);
  if (oklch) return oklchToRgb({ l: Number(oklch[1]) / (oklch[2] ? 100 : 1), c: Number(oklch[3]), h: Number(oklch[4]) });
  throw new Error(`Unsupported color: ${value}. Use a hex or OKLCH color.`);
}

export function relativeLuminance(color: string | RGB): number {
  const rgb = typeof color === 'string' ? parseColor(color) : color;
  return 0.2126 * linear(rgb.r) + 0.7152 * linear(rgb.g) + 0.0722 * linear(rgb.b);
}

export function contrastRatio(foreground: string | RGB, background: string | RGB): number {
  const a = relativeLuminance(foreground), b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Reduce chroma only when necessary to remain in sRGB; hue never changes. */
function inGamut(color: OKLCH): OKLCH {
  const fits = (c: number) => Object.values(oklchToRgb({ ...color, c }, false)).every(channel => channel >= -1e-7 && channel <= 1.0000001);
  if (fits(color.c)) return color;
  let low = 0, high = color.c;
  for (let i = 0; i < 40; i++) {
    const middle = (low + high) / 2;
    if (fits(middle)) low = middle; else high = middle;
  }
  return { ...color, c: low };
}

function formatOklch(color: OKLCH): string {
  return `oklch(${(color.l * 100).toFixed(6)}% ${color.c.toFixed(8)} ${color.h.toFixed(6)})`;
}

export function solveContrast(foreground: string, background: string, target = 4.5): ContrastSolution {
  if (!Number.isFinite(target) || target < 1 || target > 21) throw new Error('Contrast target must be between 1 and 21.');
  const original = rgbToOklch(parseColor(foreground));
  const originalRatio = contrastRatio(foreground, background);
  if (originalRatio >= target) return { color: foreground, ratio: originalRatio, originalRatio, oklch: original, lightnessDelta: 0 };
  const candidates: OKLCH[] = [];
  for (const endpoint of [0, 1]) {
    const at = (lightness: number) => inGamut({ ...original, l: lightness });
    if (contrastRatio(oklchToRgb(at(endpoint)), background) < target) continue;
    let failing = original.l, passing = endpoint;
    for (let i = 0; i < 60; i++) {
      const middle = (failing + passing) / 2;
      if (contrastRatio(oklchToRgb(at(middle)), background) >= target + 0.000001) passing = middle; else failing = middle;
    }
    candidates.push(at(passing));
  }
  if (!candidates.length) throw new Error(`A ${target}:1 contrast ratio cannot be achieved against ${background}.`);
  candidates.sort((a, b) => Math.abs(a.l - original.l) - Math.abs(b.l - original.l));
  const candidate = candidates[0];
  const color = formatOklch(candidate);
  return { color, ratio: contrastRatio(color, background), originalRatio, oklch: candidate, lightnessDelta: Math.abs(candidate.l - original.l) };
}
