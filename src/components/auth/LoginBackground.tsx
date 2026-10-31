import React from 'react';

/**
 * Hand-drawn approximation of the reference art's flowing blue/gold satin
 * ribbons — each ribbon is a soft wide blurred base + a bright thin core
 * stroke on top, which is what actually reads as a lit ribbon instead of a
 * flat line. Pure SVG, scales to any viewport, no raster asset needed.
 */
export function LoginBackground() {
  const ribbons = [
  { d: 'M -150 60 C 200 -120, 380 260, 700 40 S 1150 -140, 1550 140', grad: 'g1', width: 26 },
  { d: 'M -150 180 C 250 20, 500 380, 820 160 S 1250 -20, 1650 260', grad: 'g2', width: 16 },
  { d: 'M -150 850 C 250 1050, 620 640, 950 880 S 1400 1120, 1750 860', grad: 'g3', width: 24 },
  { d: 'M -150 950 C 300 1120, 700 820, 1050 980 S 1450 1180, 1800 950', grad: 'g2', width: 14 },
  { d: 'M 1300 -80 C 1420 220, 1560 380, 1460 680 S 1600 980, 1700 1100', grad: 'g1', width: 18 }];


  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMid slice">

      <defs>
        <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
          <stop offset="40%" stopColor="#93c5fd" stopOpacity="0.95" />
          <stop offset="70%" stopColor="#c4b5fd" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="g2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0" />
          <stop offset="45%" stopColor="#fde68a" stopOpacity="0.95" />
          <stop offset="75%" stopColor="#60a5fa" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="g3" x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0" />
          <stop offset="50%" stopColor="#bfdbfe" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </linearGradient>
        <filter id="wideBlur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <filter id="coreBlur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>

      {ribbons.map((r, i) =>
      <g key={i}>
          {/* soft wide body of the ribbon */}
          <path d={r.d} fill="none" stroke={`url(#${r.grad})`} strokeWidth={r.width} filter="url(#wideBlur)" opacity="0.55" />
          {/* mid body */}
          <path d={r.d} fill="none" stroke={`url(#${r.grad})`} strokeWidth={r.width * 0.45} filter="url(#coreBlur)" opacity="0.8" />
          {/* bright satin highlight core */}
          <path d={r.d} fill="none" stroke={`url(#${r.grad})`} strokeWidth={Math.max(1.5, r.width * 0.12)} opacity="0.95" />
        </g>
      )}
    </svg>);

}
