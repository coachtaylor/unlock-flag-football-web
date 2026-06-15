// Horizontal brand wordmark — "UNLOCK" (Anton) with the lime slash.
// The Anton font is embedded inside the SVG, so the browser renders it
// with no extra @font-face wiring. Single source for the wordmark; the
// compact "U" icon is BrandMark.

type Size = "default" | "large" | "small" | "xl";

// Rendered height of the wordmark in px (width scales with the SVG aspect).
const HEIGHTS: Record<Size, number> = { small: 26, default: 30, large: 40, xl: 52 };

export default function BrandLockup({ size = "default" }: { size?: Size }) {
  const h = HEIGHTS[size];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/unlock-wordmark.svg"
      alt="Unlock Flag Football"
      height={h}
      style={{ height: h, width: "auto", display: "block" }}
    />
  );
}
