import React from 'react';
import './driftKit.css';

/** 全片共享语义色（来自 contract §5），牧羊主题专用。 */
export const PAL = {
  bg: '#f5f8f0',
  env: '#b8c9a7',
  envDark: '#76906a',
  wood: '#92400e',
  blue: '#27446e',
  green: '#228d5c',
  red: '#c43f52',
  orange: '#f07e47',
  purple: '#7c3aed',
  ink: '#21324a',
  muted: '#68778f',
  line: '#d7deea',
  cream: '#f6ecdb',
};

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const fmt = (v: number, d = 2) => v.toFixed(d);
export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export type Pt = { x: number; y: number };

/** 可复现随机数。 */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function gaussOf(rng: () => number) {
  return Math.sqrt(-2 * Math.log(rng() + 1e-9)) * Math.cos(2 * Math.PI * rng());
}

export function svgPoint(
  e: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>,
  vbW: number,
  vbH: number,
): Pt {
  const r = e.currentTarget.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * vbW, y: ((e.clientY - r.top) / r.height) * vbH };
}

export function Hills({ w = 1472, h = 622 }: { w?: number; h?: number }) {
  return (
    <g aria-hidden="true">
      <rect width={w} height={h} fill={PAL.bg} />
      <path d={`M0 ${h * 0.52} Q ${w * 0.18} ${h * 0.4} ${w * 0.4} ${h * 0.52} T ${w * 0.78} ${h * 0.47} T ${w} ${h * 0.52} V${h} H0 Z`} fill={PAL.env} opacity="0.45" />
      <path d={`M0 ${h * 0.68} Q ${w * 0.26} ${h * 0.57} ${w * 0.55} ${h * 0.7} T ${w} ${h * 0.64} V${h} H0 Z`} fill={PAL.envDark} opacity="0.28" />
      <path d={`M0 ${h * 0.86} Q ${w * 0.3} ${h * 0.78} ${w * 0.62} ${h * 0.88} T ${w} ${h * 0.83} V${h} H0 Z`} fill="#a7bb98" opacity="0.35" />
    </g>
  );
}

export function Sheep({
  x, y, s = 1, color = PAL.orange, dim = false, flip = false, outline,
}: { x: number; y: number; s?: number; color?: string; dim?: boolean; flip?: boolean; outline?: string }) {
  const stroke = outline || (color === PAL.blue ? '#1c3355' : '#b9562c');
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} opacity={dim ? 0.5 : 1}>
      <ellipse cx="0" cy="6" rx="21" ry="5" fill={PAL.ink} opacity="0.1" />
      <path d="M-13 -12 l-2 12 M-5 -11 l-1 11 M6 -11 l1 11 M13 -12 l2 12" stroke="#7a6448" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="-8" cy="-19" r="9" fill={color} stroke={stroke} strokeWidth="1.4" />
      <circle cx="0" cy="-22" r="10" fill={color} stroke={stroke} strokeWidth="1.4" />
      <circle cx="8" cy="-18" r="8.5" fill={color} stroke={stroke} strokeWidth="1.4" />
      <circle cx="-2" cy="-13" r="8" fill={color} stroke={stroke} strokeWidth="1.4" />
      <ellipse cx="15" cy="-24" rx="7" ry="6" fill={PAL.cream} stroke={stroke} strokeWidth="1.4" />
      <circle cx="17.5" cy="-25.5" r="1.3" fill={PAL.ink} />
      <path d="M11 -29 q-4 -4 -8 -1" stroke={PAL.ink} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </g>
  );
}

export function Grass({ x, y, s = 1, color = PAL.blue }: { x: number; y: number; s?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} stroke={color} strokeWidth="2.4" fill="none" strokeLinecap="round" aria-hidden="true">
      <path d="M0 0 C-2 -8 -7 -12 -12 -14" />
      <path d="M0 0 C-1 -10 0 -15 1 -19" />
      <path d="M0 0 C3 -8 8 -11 12 -13" />
    </g>
  );
}

export function Arrow({
  x1, y1, x2, y2, color, width = 3.5, dash,
}: { x1: number; y1: number; x2: number; y2: number; color: string; width?: number; dash?: string }) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 2) return <circle cx={x1} cy={y1} r={4.5} fill={color} />;
  const a = Math.atan2(y2 - y1, x2 - x1);
  const hl = Math.min(16, len * 0.5);
  return (
    <g aria-hidden="true">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" />
      <path
        d={`M${x2} ${y2} L${x2 - hl * Math.cos(a - 0.42)} ${y2 - hl * Math.sin(a - 0.42)} L${x2 - hl * Math.cos(a + 0.42)} ${y2 - hl * Math.sin(a + 0.42)} Z`}
        fill={color}
      />
    </g>
  );
}

export function Chip({
  active, onClick, children, disabled, title,
}: { active?: boolean; onClick?: () => void; children: React.ReactNode; disabled?: boolean; title?: string }) {
  return (
    <button type="button" className="dk-chip" aria-pressed={Boolean(active)} disabled={disabled} title={title} onClick={onClick}>
      {children}
    </button>
  );
}

export function Feedback({ tone = 'info', children }: { tone?: 'info' | 'ok' | 'warn'; children: React.ReactNode }) {
  return <div className={`dk-fb ${tone}`} role="status">{children}</div>;
}

export function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="dk-card">
      {title && <div className="dk-card-title">{title}</div>}
      {children}
    </div>
  );
}

export function LegendDots({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="dk-legend">
      {items.map((it) => (
        <span key={it.label}><i style={{ background: it.color }} />{it.label}</span>
      ))}
    </div>
  );
}

/** 静态或论文原生页上的小型主题场景：固定 260×64，不占额外版式高度。 */
export function Pasture({ label, tone = 'calm' }: { label: string; tone?: 'calm' | 'busy' | 'wide' }) {
  const sheep = tone === 'wide' ? [70, 130, 196] : tone === 'busy' ? [80, 116, 152, 190] : [96, 168];
  return (
    <div className="dk-row" style={{ gap: 14 }}>
      <svg width={260} height={64} viewBox="0 0 260 64" role="img" aria-label={label}>
        <g transform="scale(.289 .114)"><Hills w={900} h={560} /></g>
        {sheep.map((x, i) => <Sheep key={i} x={x} y={52 - (i % 2) * 6} s={0.46} color={PAL.orange} />)}
        {[40, 118, 186, 228].map(x => <Grass key={x} x={x} y={58} s={0.7} color={PAL.envDark} />)}
      </svg>
      <span className="dk-note" style={{ flex: 1 }}>{label}</span>
    </div>
  );
}
