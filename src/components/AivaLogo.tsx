import React from 'react';

interface AivaLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  showTagline?: boolean;
  animated?: boolean;
  layout?: 'horizontal' | 'vertical' | 'icon-only';
  variant?: 'full' | 'minimal';
}

export const AivaLogo: React.FC<AivaLogoProps> = ({
  className = '',
  size = 48,
  showText = false,
  showTagline = false,
  animated = true,
  layout = 'icon-only',
  variant = 'full'
}) => {
  // SVG styling and animations
  const strokeColor = "url(#aiva-gradient)";
  const bubbleStroke = "url(#bubble-gradient)";

  return (
    <div className={`inline-flex items-center ${layout === 'vertical' ? 'flex-col text-center' : 'flex-row'} gap-3 ${className}`}>
      {/* Icon portion */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 150 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`flex-shrink-0 ${animated ? 'animate-logo-float' : ''}`}
      >
        <defs>
          {/* Main Soundwave Gradient.
              NOTE: gradientUnits="userSpaceOnUse" is REQUIRED here. The bars are
              vertical <line> elements whose bounding box has zero width, so the
              default objectBoundingBox units collapse the gradient and the bars
              render invisibly. userSpaceOnUse maps the gradient to the viewBox
              (y=100 bottom -> cyan, y=15 top -> purple) so every bar paints. */}
          <linearGradient id="aiva-gradient" gradientUnits="userSpaceOnUse" x1="75" y1="100" x2="75" y2="15">
            <stop offset="0%" stopColor="#06b6d4" /> {/* Cyan */}
            <stop offset="60%" stopColor="#3b82f6" /> {/* Blue */}
            <stop offset="100%" stopColor="#8b5cf6" /> {/* Purple */}
          </linearGradient>

          {/* Chat Bubble Gradient */}
          <linearGradient id="bubble-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>

          {/* Glow filter for the topmost dot */}
          <filter id="cyan-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Embed core animations inside the SVG */}
          {animated && (
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes aivaWave1 {
                0%, 100% { transform: scaleY(1); }
                50% { transform: scaleY(1.4); }
              }
              @keyframes aivaWave2 {
                0%, 100% { transform: scaleY(1); }
                50% { transform: scaleY(1.25); }
              }
              @keyframes aivaWave3 {
                0%, 100% { transform: scaleY(1); }
                50% { transform: scaleY(1.15); }
              }
              @keyframes aivaWaveCenter {
                0%, 100% { transform: scaleY(1); }
                50% { transform: scaleY(1.35); }
              }
              @keyframes aivaDotGlow {
                0%, 100% { opacity: 0.8; filter: drop-shadow(0 0 2px #06b6d4); }
                50% { opacity: 1; filter: drop-shadow(0 0 8px #22d3ee); }
              }
              .wave-bar-1 { animation: aivaWave1 2.2s ease-in-out infinite; transform-origin: 36px 90px; }
              .wave-bar-2 { animation: aivaWave2 1.8s ease-in-out infinite; transform-origin: 49px 90px; }
              .wave-bar-3 { animation: aivaWave3 2.0s ease-in-out infinite; transform-origin: 62px 90px; }
              .wave-bar-4 { animation: aivaWaveCenter 1.5s ease-in-out infinite; transform-origin: 75px 92px; }
              .wave-bar-5 { animation: aivaWave3 2.1s ease-in-out infinite; transform-origin: 88px 90px; }
              .wave-bar-6 { animation: aivaWave2 1.7s ease-in-out infinite; transform-origin: 101px 90px; }
              .wave-bar-7 { animation: aivaWave1 2.3s ease-in-out infinite; transform-origin: 114px 90px; }
              .wave-dot { animation: aivaDotGlow 1.8s ease-in-out infinite; }
            `}} />
          )}
        </defs>

        {/* 1. Open-Top Chat Speech Bubble Outline (cups the soundwave, tail bottom-left) */}
        <path
          d="M 47,74 C 39,86 38,98 46,105 L 39,118 C 49,113 53,109 60,107 C 67,109 71,109 75,109 C 99,109 111,96 111,74"
          stroke={bubbleStroke}
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.95"
        />

        {/* 2. Seven Glowing Soundwave Bars - Only in 'full' variant */}
        {variant === 'full' && (
          <>
            {/* Bar 1 (shortest, left) */}
            <line
              x1="36" y1="66" x2="36" y2="90"
              stroke={strokeColor}
              strokeWidth="7"
              strokeLinecap="round"
              className="wave-bar-1"
            />
            {/* Bar 2 */}
            <line
              x1="49" y1="54" x2="49" y2="90"
              stroke={strokeColor}
              strokeWidth="7"
              strokeLinecap="round"
              className="wave-bar-2"
            />
            {/* Bar 3 */}
            <line
              x1="62" y1="42" x2="62" y2="90"
              stroke={strokeColor}
              strokeWidth="7"
              strokeLinecap="round"
              className="wave-bar-3"
            />
            {/* Bar 4 (Center Tall Bar, carries the glowing dot) */}
            <line
              x1="75" y1="30" x2="75" y2="92"
              stroke={strokeColor}
              strokeWidth="7"
              strokeLinecap="round"
              className="wave-bar-4"
            />
            {/* Bar 5 */}
            <line
              x1="88" y1="42" x2="88" y2="90"
              stroke={strokeColor}
              strokeWidth="7"
              strokeLinecap="round"
              className="wave-bar-5"
            />
            {/* Bar 6 */}
            <line
              x1="101" y1="54" x2="101" y2="90"
              stroke={strokeColor}
              strokeWidth="7"
              strokeLinecap="round"
              className="wave-bar-6"
            />
            {/* Bar 7 (shortest, right) */}
            <line
              x1="114" y1="66" x2="114" y2="90"
              stroke={strokeColor}
              strokeWidth="7"
              strokeLinecap="round"
              className="wave-bar-7"
            />
          </>
        )}

        {/* 3. Central Glowing Cyan Dot above Center Bar */}
        <circle
          cx="75"
          cy="21"
          r="6"
          fill="#22d3ee"
          className="wave-dot"
          filter="url(#cyan-glow)"
        />
      </svg>

      {/* Horizontal Text and Tagline layout (used in Headers) */}
      {layout === 'horizontal' && (showText || showTagline) && (
        <div className="flex flex-col">
          {showText && (
            <div className="flex items-baseline gap-1">
              {/* Custom Lambda-Style "AiVA" Typography */}
              <svg width="76" height="24" viewBox="0 0 135 45" className="text-slate-100">
                {/* A (Lambda / Angle style) */}
                <path
                  d="M 12,42 L 27,8 L 42,42"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                {/* i */}
                <line
                  x1="52" y1="20" x2="52" y2="42"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <circle cx="52" cy="10" r="3.5" fill="#22d3ee" />
                {/* V */}
                <path
                  d="M 64,8 L 79,42 L 94,8"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                {/* A (Lambda / Angle style) */}
                <path
                  d="M 102,42 L 117,8 L 132,42"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </div>
          )}
          {showTagline && (
            <span className="text-[9px] text-slate-400 font-mono tracking-widest uppercase mt-1">
              YOUR AI VOICE, ALWAYS LISTENING
            </span>
          )}
        </div>
      )}

      {/* Vertical Text and Tagline layout (used in Landing/Dashboard Cards) */}
      {layout === 'vertical' && (showText || showTagline) && (
        <div className="flex flex-col items-center mt-2">
          {showText && (
            <div className="flex justify-center mb-1">
              {/* Custom Lambda-Style "AiVA" Typography */}
              <svg width="100" height="32" viewBox="0 0 135 45" className="text-slate-100">
                {/* A */}
                <path
                  d="M 12,42 L 27,8 L 42,42"
                  stroke="currentColor"
                  strokeWidth="5.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                {/* i */}
                <line
                  x1="52" y1="20" x2="52" y2="42"
                  stroke="currentColor"
                  strokeWidth="5.5"
                  strokeLinecap="round"
                />
                <circle cx="52" cy="10" r="4" fill="#22d3ee" />
                {/* V */}
                <path
                  d="M 64,8 L 79,42 L 94,8"
                  stroke="currentColor"
                  strokeWidth="5.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                {/* A */}
                <path
                  d="M 102,42 L 117,8 L 132,42"
                  stroke="currentColor"
                  strokeWidth="5.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </div>
          )}
          {showTagline && (
            <span className="text-[9px] text-slate-400 font-mono tracking-widest uppercase mt-1.5 leading-none">
              YOUR AI VOICE, ALWAYS LISTENING
            </span>
          )}
        </div>
      )}
    </div>
  );
};
