export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={`osun-life-logo ${small ? "osun-life-logo-small" : ""}`}>
      <img
        src={small ? "/brand/osun-life-icon.svg" : "/brand/osun-life-logo-horizontal.svg"}
        alt="OSUN LIFE"
        className="osun-life-logo-image"
        decoding="async"
      />
    </span>
  );
}
