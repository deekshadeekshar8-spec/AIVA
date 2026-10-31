import React, { useEffect, useRef } from 'react';
import { cn } from '../../utils/cn';

interface ChromaKeyVideoProps {
  src: string;
  /** Fires once if this exact src 404s / fails to decode, so callers can fall back. */
  onError?: () => void;
  /** Fires the first time a frame has actually been keyed and drawn. */
  onReady?: () => void;
  className?: string;
}

/**
 * Plays a green-screen video and composites it onto a canvas with the green
 * keyed out in real time, so it can sit inside the dashboard as a genuinely
 * transparent character layer. Browsers do not support decoding alpha from
 * WebM in a plain <video> element, so this canvas keying step is the actual
 * mechanism that makes "transparent video" work in a browser.
 */
export function ChromaKeyVideo({ src, onError, onReady, className }: ChromaKeyVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const readyFiredRef = useRef(false);

  useEffect(() => {
    readyFiredRef.current = false;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let cancelled = false;

    const draw = () => {
      if (cancelled) return;
      if (video.readyState >= 2 && video.videoWidth) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = frame.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const excessGreen = g - Math.max(r, b);
          if (excessGreen > 40) {
            data[i + 3] = 0;
          } else if (excessGreen > 8) {
            data[i + 3] = Math.round(255 * (1 - (excessGreen - 8) / 32));
            data[i + 1] = Math.min(g, Math.max(r, b) + 12);
          }
        }
        ctx.putImageData(frame, 0, 0);
        if (!readyFiredRef.current) {
          readyFiredRef.current = true;
          onReady?.();
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };

    const handleError = () => onError?.();
    video.addEventListener('error', handleError);
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelled = true;
      video.removeEventListener('error', handleError);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <div className={cn('relative', className)}>
      <video
        ref={videoRef}
        src={src}
        muted
        loop
        autoPlay
        playsInline
        className="hidden" />

      <canvas ref={canvasRef} className="h-full w-full object-contain" />
    </div>);

}
