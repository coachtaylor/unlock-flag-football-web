// Standalone "U" brand icon (white U + lime slash on transparent).
// Single source for the compact mark used in sidebars, avatars, etc.
// The wordmark lives in BrandLockup; the favicon/app icons are rasterized
// from the same /brand/unlock-u-icon.svg.

export default function BrandMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/unlock-u-icon.svg"
      alt="Unlock Flag Football"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, display: "block" }}
    />
  );
}
