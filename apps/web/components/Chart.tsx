"use client";

import { useEffect, useRef, useState } from "react";
import type { OddsPoint } from "@/lib/data";
import { EN_DASH, utcShortDate, utcStamp } from "@/lib/format";

interface ChartProps {
  points: OddsPoint[];
  aLabel: string;
  bLabel: string;
  height?: number;
}

/**
 * Hand-rolled SVG: odds over time. 1.5px ink line for the left side, vermilion for the
 * right, one 50% hairline, axis labels in --t-xs. No area fill, no library. The y-domain
 * hugs the data (always including 50) so a 54-46 market is not a flat line in the middle.
 */
export function Chart({ points, aLabel, bLabel, height = 220 }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 640;
      setW(Math.max(240, Math.floor(width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (points.length < 4) {
    return (
      <p className="text-sm text-ink-2 max-w-[40ch]">
        Not enough history to draw yet. The line starts once the board moves.
      </p>
    );
  }

  const padR = 40;
  const padT = 14;
  const padB = 24;
  const innerW = w - padR;
  const innerH = height - padT - padB;

  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  let minV = 0.5;
  let maxV = 0.5;
  for (const p of points) {
    minV = Math.min(minV, p.a, 1 - p.a);
    maxV = Math.max(maxV, p.a, 1 - p.a);
  }
  const pad = 0.06;
  const lo = Math.max(0, minV - pad);
  const hi = Math.min(1, maxV + pad);

  const x = (t: number) => ((t - t0) / (t1 - t0 || 1)) * innerW;
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo || 1)) * innerH;

  const dA = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.a).toFixed(1)}`).join(" ");
  const dB = points
    .map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(1 - p.a).toFixed(1)}`)
    .join(" ");

  const last = points[points.length - 1];
  const pa = Math.round(last.a * 100);
  const hp = hover !== null ? points[hover] : null;

  // Keep the two end labels legible when the lines sit close to each other.
  let ya = y(last.a);
  let yb = y(1 - last.a);
  if (Math.abs(ya - yb) < 14) {
    const mid = (ya + yb) / 2;
    const s = ya <= yb ? -1 : 1;
    ya = mid + 7 * s;
    yb = mid - 7 * s;
  }

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const t = t0 + (px / innerW) * (t1 - t0);
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i].t - t);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHover(best);
  };

  const labelStyle = { fontSize: "var(--t-xs)" } as const;

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={w}
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        role="img"
        aria-label={`Odds over the last 30 days. ${aLabel} ${pa} percent now, ${bLabel} ${100 - pa} percent.`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        className="max-w-full"
      >
        <line x1={0} x2={innerW} y1={y(0.5)} y2={y(0.5)} stroke="var(--rule)" strokeWidth={1} />
        <text x={0} y={y(0.5) - 5} fill="var(--ink-2)" style={labelStyle}>
          50
        </text>

        <path d={dB} fill="none" stroke="var(--side-b)" strokeWidth={1.5} strokeLinejoin="round" />
        <path d={dA} fill="none" stroke="var(--side-a)" strokeWidth={1.5} strokeLinejoin="round" />

        <text x={innerW + 8} y={ya + 4} fill="var(--side-a)" fontWeight={700} style={labelStyle} className="tnum">
          {pa}
        </text>
        <text x={innerW + 8} y={yb + 4} fill="var(--side-b)" fontWeight={700} style={labelStyle} className="tnum">
          {100 - pa}
        </text>

        <text x={0} y={height - 6} fill="var(--ink-2)" style={labelStyle}>
          {utcShortDate(t0)}
        </text>
        <text x={innerW} y={height - 6} fill="var(--ink-2)" textAnchor="end" style={labelStyle}>
          {utcShortDate(t1)}
        </text>

        {hp ? (
          <g>
            <line x1={x(hp.t)} x2={x(hp.t)} y1={padT} y2={padT + innerH} stroke="var(--ink-3)" strokeWidth={1} />
            <circle cx={x(hp.t)} cy={y(hp.a)} r={3} fill="var(--side-a)" />
            <circle cx={x(hp.t)} cy={y(1 - hp.a)} r={3} fill="var(--side-b)" />
          </g>
        ) : null}
      </svg>
      <div className="flex items-baseline justify-between gap-4 mt-2 text-xs text-ink-2 min-h-[1.4em]">
        <span>
          <span className="text-side-a font-semibold">{aLabel}</span> in green,{" "}
          <span className="text-side-b font-semibold">{bLabel}</span> in red.
        </span>
        <span className="tnum text-right" aria-live="polite">
          {hp
            ? `${utcStamp(hp.t)} ${EN_DASH} ${aLabel} ${Math.round(hp.a * 100)}`
            : `${points.length} marks`}
        </span>
      </div>
    </div>
  );
}
