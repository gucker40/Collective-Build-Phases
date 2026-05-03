import React from "react";

/**
 * LogosSigil  Animated sacred geometry sigil for Logos.
 * Renders a layered geometric mark: outer ring, inner triangle, center point.
 * State: idle (white/dim), thinking (gold pulse), speaking (purple glow)
 */
export default function LogosSigil({ size = 48, state = "idle", animated = true }) {
  const stateColors = {
    idle:     { outer: "rgba(160,154,184,0.4)", inner: "rgba(124,58,237,0.5)", center: "rgba(212,175,55,0.6)" },
    thinking: { outer: "rgba(212,175,55,0.7)",  inner: "rgba(212,175,55,0.5)", center: "rgba(212,175,55,1)"   },
    speaking: { outer: "rgba(124,58,237,0.9)",  inner: "rgba(139,92,246,0.7)", center: "rgba(196,181,253,1)"  },
  };
  const colors = stateColors[state] || stateColors.idle;

  const animStyle = animated
    ? { animation: "breathe 3s ease-in-out infinite" }
    : {};

  const cx = size / 2;
  const cy = size / 2;
  const r  = size / 2 - 2;

  // Triangle points inscribed in circle
  const tri = [0, 120, 240].map(deg => {
    const rad = (deg - 90) * (Math.PI / 180);
    return [cx + (r * 0.62) * Math.cos(rad), cy + (r * 0.62) * Math.sin(rad)];
  });
  const triPoints = tri.map(p => p.join(",")).join(" ");

  // Inner triangle (inverted)
  const triInner = [180, 300, 60].map(deg => {
    const rad = (deg - 90) * (Math.PI / 180);
    return [cx + (r * 0.38) * Math.cos(rad), cy + (r * 0.38) * Math.sin(rad)];
  });
  const triInnerPoints = triInner.map(p => p.join(",")).join(" ");

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={animStyle}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer ring */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={colors.outer}
        strokeWidth="0.8"
        opacity="0.8"
      />

      {/* Secondary ring */}
      <circle
        cx={cx} cy={cy} r={r * 0.75}
        fill="none"
        stroke={colors.outer}
        strokeWidth="0.4"
        opacity="0.4"
        strokeDasharray="2 4"
      />

      {/* Outer triangle */}
      <polygon
        points={triPoints}
        fill="none"
        stroke={colors.inner}
        strokeWidth="0.8"
        opacity="0.9"
      />

      {/* Inner inverted triangle */}
      <polygon
        points={triInnerPoints}
        fill="none"
        stroke={colors.inner}
        strokeWidth="0.6"
        opacity="0.6"
      />

      {/* Center dot */}
      <circle
        cx={cx} cy={cy} r={size * 0.06}
        fill={colors.center}
        opacity="1"
      />

      {/* Radial lines from center to triangle vertices */}
      {tri.map(([x, y], i) => (
        <line
          key={i}
          x1={cx} y1={cy} x2={x} y2={y}
          stroke={colors.inner}
          strokeWidth="0.4"
          opacity="0.25"
        />
      ))}

      {/* Slow-rotating outer dash ring (speaking state only) */}
      {state === "speaking" && (
        <circle
          cx={cx} cy={cy} r={r * 0.9}
          fill="none"
          stroke="rgba(139,92,246,0.5)"
          strokeWidth="0.6"
          strokeDasharray="3 6"
          style={{ animation: "sigilSpin 8s linear infinite", transformOrigin: `${cx}px ${cy}px` }}
        />
      )}
    </svg>
  );
}
