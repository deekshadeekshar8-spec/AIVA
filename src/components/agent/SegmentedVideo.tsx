import React, { useEffect, useRef } from 'react';
import { cn } from '../../utils/cn';

interface SegmentedVideoProps {
  videoEl: HTMLVideoElement | null;
  className?: string;
}

/**
 * Draws a <video> to a canvas with its background removed live, using
 * MediaPipe's selfie/person segmentation model — for clips that were NOT
 * shot on green screen (no color to key out), this is what makes the
 * character appear to stand directly in the AIVA UI instead of in a boxed
 * "video call" panel with its own baked-in office behind it.
 *
 * Two things matter for this to look good, not just "technically working":
 *  - Crop tight on the person (source clips are wide 16:9 with the subject
 *    centered in a narrow vertical band) so they render at a usable size
 *    instead of tiny in the middle of a mostly-empty frame.
 *  - Bilinear-sample the mask and use a wider soft-edge band so silhouette
 *    edges don't look jagged/blocky and stray low-confidence background
 *    pixels (chairs, furniture) don't ghost through.
 *
 * The model + WASM runtime load once (module-level singleton) and are
 * shared across every agent's SegmentedVideo instance.
 */
let segmenterPromise: Promise<import('@mediapipe/tasks-vision').ImageSegmenter> | null = null;

async function getSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );
      return ImageSegmenter.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        outputCategoryMask: false,
        outputConfidenceMasks: true
      });
    })();
  }
  return segmenterPromise;
}

/** Fraction of the source frame's width to keep, centered on the subject. */
const CROP_WIDTH_FRACTION = 0.34;
const STRONG = 0.72;
const FADE_START = 0.42;

function sampleMask(mask: Float32Array, mw: number, mh: number, fx: number, fy: number) {
  const x = fx * mw - 0.5;
  const y = fy * mh - 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, mw - 1);
  const y1 = Math.min(y0 + 1, mh - 1);
  const cx0 = Math.max(x0, 0);
  const cy0 = Math.max(y0, 0);
  const tx = x - x0;
  const ty = y - y0;
  const v00 = mask[cy0 * mw + cx0];
  const v10 = mask[cy0 * mw + x1];
  const v01 = mask[y1 * mw + cx0];
  const v11 = mask[y1 * mw + x1];
  const top = v00 * (1 - tx) + v10 * tx;
  const bottom = v01 * (1 - tx) + v11 * tx;
  return top * (1 - ty) + bottom * ty;
}

export function SegmentedVideo({ videoEl, className }: SegmentedVideoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!videoEl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let cancelled = false;
    let lastTimestamp = -1;

    getSegmenter().then((segmenter) => {
      const draw = () => {
        if (cancelled) return;
        if (videoEl.readyState >= 2 && videoEl.videoWidth && videoEl.currentTime !== lastTimestamp) {
          lastTimestamp = videoEl.currentTime;

          const vw = videoEl.videoWidth;
          const vh = videoEl.videoHeight;
          const sw = vw * CROP_WIDTH_FRACTION;
          const sx = (vw - sw) / 2;

          if (canvas.width !== Math.round(sw) || canvas.height !== vh) {
            canvas.width = Math.round(sw);
            canvas.height = vh;
          }

          segmenter.segmentForVideo(videoEl, performance.now(), (result) => {
            const mask = result.confidenceMasks?.[0];
            if (!mask) return;
            ctx.drawImage(videoEl, sx, 0, sw, vh, 0, 0, canvas.width, canvas.height);
            const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = frame.data;
            const maskData = mask.getAsFloat32Array();
            const mw = mask.width;
            const mh = mask.height;

            for (let y = 0; y < canvas.height; y++) {
              const fy = y / canvas.height;
              for (let x = 0; x < canvas.width; x++) {
                const fx = (sx + (x / canvas.width) * sw) / vw;
                const confidence = sampleMask(maskData, mw, mh, fx, fy);
                const keep =
                confidence > STRONG ?
                1 :
                confidence > FADE_START ?
                (confidence - FADE_START) / (STRONG - FADE_START) :
                0;
                if (keep < 1) {
                  const i = (y * canvas.width + x) * 4;
                  data[i] = data[i] * keep;
                  data[i + 1] = data[i + 1] * keep;
                  data[i + 2] = data[i + 2] * keep;
                }
                // alpha stays 255 — solid black fill, not transparency, so it blends with the dark UI without matte edge artifacts
              }
            }
            ctx.putImageData(frame, 0, 0);
            mask.close();
          });
        }
        rafRef.current = requestAnimationFrame(draw);
      };
      rafRef.current = requestAnimationFrame(draw);
    });

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [videoEl]);

  return <canvas ref={canvasRef} className={cn('h-full w-full object-contain', className)} />;
}
