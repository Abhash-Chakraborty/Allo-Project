"use client";

import { useEffect, useRef, useState } from "react";

interface VideoAsciiProps {
  src: string;
  resolution?: number;
  backgroundColor?: string;
  charset?: string;
  saturation?: number;
  className?: string;
}

const DEFAULT_CHARSET =
  ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$';

const CHAR_ASPECT = 0.55;

export function VideoAscii({
  src,
  resolution = 130,
  backgroundColor = "#000000",
  charset = DEFAULT_CHARSET,
  saturation = 0.3,
  className,
}: VideoAsciiProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sampleRef = useRef<HTMLCanvasElement>(null);
  const displayRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const dimsRef = useRef({ cols: 0, rows: 0, cellW: 0, cellH: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const video = videoRef.current;
    const sample = sampleRef.current;
    const display = displayRef.current;
    if (!wrap || !video || !sample || !display) return;

    const sCtx = sample.getContext("2d", { willReadFrequently: true });
    const dCtx = display.getContext("2d");
    if (!sCtx || !dCtx) return;

    function layout() {
      const rect = wrap!.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (!w || !h) return false; // not yet visible

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cols = resolution;
      const rows = Math.max(8, Math.round(cols * CHAR_ASPECT));

      sample!.width = cols;
      sample!.height = rows;

      display!.width = Math.round(w * dpr);
      display!.height = Math.round(h * dpr);
      display!.style.width = w + "px";
      display!.style.height = h + "px";

      const cellW = display!.width / cols;
      const cellH = display!.height / rows;
      dimsRef.current = { cols, rows, cellW, cellH };

      const fontPx = Math.max(4, Math.round(cellH));
      dCtx!.font = `${fontPx}px ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace`;
      dCtx!.textBaseline = "top";
      return true;
    }

    // Start video as soon as possible — don't wait for metadata.
    // autoPlay + muted + playsInline is enough for browsers to start.
    void video.play().catch(() => {});

    const onMeta = () => {
      layout();
      setReady(true);
      void video.play().catch(() => {});
    };
    video.addEventListener("loadedmetadata", onMeta);
    // If metadata already loaded before we attached the listener:
    if (video.readyState >= 1) onMeta();

    const ro = new ResizeObserver(() => { layout(); });
    ro.observe(wrap);

    const charsetLen = charset.length - 1;

    const tick = () => {
      const { cols, rows, cellW, cellH } = dimsRef.current;

      // If layout hasn't run yet (wrapper was 0×0 at mount), retry now.
      if (cols === 0) {
        if (layout()) setReady(true);
      }

      if (
        video.readyState >= 2 &&
        cols > 0 &&
        display.width > 0 &&
        video.videoWidth > 0
      ) {
        try {
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          const side = Math.min(vw, vh);
          const sx = (vw - side) / 2;
          const sy = (vh - side) / 2;
          sCtx.drawImage(video, sx, sy, side, side, 0, 0, cols, rows);
          const { data } = sCtx.getImageData(0, 0, cols, rows);

          dCtx.fillStyle = backgroundColor;
          dCtx.fillRect(0, 0, display.width, display.height);

          for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
              const i = (y * cols + x) * 4;
              let r = data[i], g = data[i + 1], b = data[i + 2];
              const lum = 0.299 * r + 0.587 * g + 0.114 * b;
              const ch = charset[((lum / 255) * charsetLen + 0.5) | 0];
              if (!ch || ch === " ") continue;
              if (saturation !== 1) {
                r = clamp(lum + (r - lum) * saturation);
                g = clamp(lum + (g - lum) * saturation);
                b = clamp(lum + (b - lum) * saturation);
              }
              dCtx.fillStyle = `rgb(${r},${g},${b})`;
              dCtx.fillText(ch, x * cellW, y * cellH);
            }
          }
        } catch { /* skip frame */ }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      video.removeEventListener("loadedmetadata", onMeta);
      ro.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [resolution, charset, backgroundColor, saturation]);

  return (
    <div ref={wrapRef} className={className} style={{ background: backgroundColor }}>
      {/* No crossOrigin — same-origin asset, crossOrigin causes unnecessary
          CORS preflight and can block autoplay in some browsers. */}
      <video
        ref={videoRef}
        src={src}
        autoPlay loop muted playsInline
        className="sr-only absolute" aria-hidden="true"
      />
      <canvas ref={sampleRef} className="hidden" aria-hidden="true" />
      <canvas
        ref={displayRef}
        style={{ display: "block", opacity: ready ? 1 : 0, transition: "opacity 400ms ease" }}
        aria-hidden="true"
      />
    </div>
  );
}

function clamp(n: number) { return n < 0 ? 0 : n > 255 ? 255 : n | 0; }
