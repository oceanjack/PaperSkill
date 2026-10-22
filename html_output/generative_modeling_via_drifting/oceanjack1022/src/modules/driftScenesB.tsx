import React, { useEffect, useMemo, useState } from 'react';
import { SymbolHint } from '../components/SymbolHint';
import {
  PAL, Sheep, Grass, Hills, Arrow, Chip, Feedback, Section, LegendDots, Pasture,
  clamp, lerp, seeded, gaussOf,
} from './driftKit';
import type { WidgetProps } from './registry';

type P = { x: number; y: number };

const TAU = 0.34;
const LR = 0.5;

function bimodal(seed: number, n = 16, spread = 0.09): P[] {
  const rng = seeded(seed);
  const c = [{ x: 0.64, y: 0.36 }, { x: 0.78, y: 0.68 }];
  return c.flatMap(center => Array.from({ length: n }, () => ({
    x: center.x + gaussOf(rng) * spread, y: center.y + gaussOf(rng) * spread,
  })));
}

function field(x: P, pos: P[], neg: P[], a: number, b: number, tau = TAU) {
  const wk = (pool: P[], skip: P | null) => {
    const ws = pool.map(p => (p === skip ? 0 : Math.exp(-Math.hypot(p.x - x.x, p.y - x.y) / tau)));
    const z = ws.reduce((s, w) => s + w, 0) || 1;
    return { ws: ws.map(w => w / z), z };
  };
  const wp = wk(pos, null);
  const wn = wk(neg, x);
  let px = 0, py = 0, nx = 0, ny = 0;
  pos.forEach((p, i) => { px += p.x * wp.ws[i]; py += p.y * wp.ws[i]; });
  neg.forEach((p, i) => { nx += p.x * wn.ws[i]; ny += p.y * wn.ws[i]; });
  return { x: a * (px - x.x) - b * (nx - x.x), y: a * (py - x.y) - b * (ny - x.y) };
}

const VARIANTS = [
  { id: 'anti', label: '反对称（默认）', a: 1, b: 1, fid: '8.46', ok: true, note: 'V = V⁺ − V⁻：平衡时两股力正好抵消。' },
  { id: 'a15', label: '1.5× 吸引', a: 1.5, b: 1, fid: '41.05', ok: false, note: '吸引压过排斥，样本被拽成一团。' },
  { id: 'r15', label: '1.5× 排斥', a: 1, b: 1.5, fid: '46.28', ok: false, note: '排斥压过吸引，样本被推散到边界。' },
  { id: 'a20', label: '2.0× 吸引', a: 2, b: 1, fid: '86.16', ok: false, note: '反对称被进一步打破，分布塌缩得更严重。' },
  { id: 'r20', label: '2.0× 排斥', a: 1, b: 2, fid: '112.84', ok: false, note: '样本逃离数据区，几乎没有可用的覆盖。' },
  { id: 'only', label: '只有吸引', a: 1, b: 0, fid: '177.14', ok: false, note: '没有排斥制衡，所有样本收敛到同一个重心。' },
] as const;

/** Scene: anti-symmetry and the destructive table. */
export function DriftAntiSymmetry({ moduleId }: WidgetProps) {
  const data = useMemo(() => bimodal(71), []);
  const [variant, setVariant] = useState<typeof VARIANTS[number]>(VARIANTS[0]);
  const [tick, setTick] = useState(70);
  const rng = useMemo(() => seeded(83), []);
  const init = useMemo(() => Array.from({ length: 30 }, () => ({
    x: 0.22 + gaussOf(rng) * 0.06, y: 0.5 + gaussOf(rng) * 0.12,
  })), [rng]);
  const traj = useMemo(() => {
    const frames: P[][] = [];
    let cur = init.map(p => ({ ...p }));
    for (let i = 0; i <= 70; i++) {
      frames.push(cur.map(p => ({ ...p })));
      cur = cur.map(p => {
        const v = field(p, data, cur, variant.a, variant.b);
        return { x: clamp(p.x + v.x * LR, 0.03, 0.97), y: clamp(p.y + v.y * LR, 0.04, 0.96) };
      });
    }
    return frames;
  }, [data, init, variant]);
  useEffect(() => {
    setTick(0);
    const id = setInterval(() => setTick(t => Math.min(70, t + 1)), 36);
    const stop = setTimeout(() => clearInterval(id), 70 * 36 + 200);
    return () => { clearInterval(id); clearTimeout(stop); };
  }, [variant]);
  const pts = traj[Math.min(tick, traj.length - 1)];
  const map = (p: P) => ({ x: 90 + p.x * 720, y: 530 - p.y * 460 });
  return (
    <div className="dk-page two">
      <div className="dk-scene">
        <svg viewBox="0 0 900 560" role="img" aria-label={`破坏反对称的后果：${variant.label}，示意训练后的羊群分布`}>
          <Hills w={900} h={560} />
          {data.map((p, i) => <Grass key={i} x={map(p).x} y={map(p).y} s={0.95} color={PAL.blue} />)}
          {pts.map((p, i) => <Sheep key={i} x={map(p).x} y={map(p).y} s={0.55} color={PAL.orange} dim={!variant.ok} />)}
          <text x="40" y="36" className="dk-svg-label">蓝 = 数据 p · 橙 = 样本 q</text>
          <text x="40" y="540" className="dk-svg-strong" fill={variant.ok ? PAL.green : PAL.red}>{variant.label}</text>
        </svg>
      </div>
      <div className="dk-stack">
        <Section title="打破 V 的反对称会怎样">
          <div className="dk-row">
            {VARIANTS.map(v => <Chip key={v.id} active={variant.id === v.id} onClick={() => setVariant(v)}>{v.label}</Chip>)}
          </div>
          <div className="dk-note" style={{ marginTop: 8 }}>
            <SymbolHint meaning="漂移场 V_pq：同时依赖数据分布 p 与当前生成分布 q 的位移场。">V<sub>p,q</sub></SymbolHint> = −
            <SymbolHint meaning="交换 p 与 q 后，漂移场只改变符号——这就是反对称。">V<sub>q,p</sub></SymbolHint>
            {' '}⇒ 当 <SymbolHint meaning="数据分布 p：正样本 y⁺ 的来源。">p</SymbolHint> = <SymbolHint meaning="生成分布 q：当前网络输出的分布。">q</SymbolHint> 时 V = 0。
          </div>
        </Section>
        <div className="dk-row">
          <span className="dk-note">实测 FID（B/2，100 轮）</span>
          <span className="dk-big" style={{ color: variant.ok ? PAL.green : PAL.red }}>{variant.fid}</span>
        </div>
        <Feedback tone={variant.ok ? 'ok' : 'warn'}>{variant.note}</Feedback>
        <div className="dk-note">二维示意；FID 取论文表 1（ImageNet 256×256）。</div>
      </div>
    </div>
  );
}

/** Scene: one training step with a stop-gradient target. */
export function DriftTrainStep({ moduleId }: WidgetProps) {
  const data = useMemo(() => bimodal(97), []);
  const init = useMemo(() => {
    const rng = seeded(103);
    return Array.from({ length: 24 }, () => ({ x: 0.26 + gaussOf(rng) * 0.07, y: 0.5 + gaussOf(rng) * 0.13 }));
  }, []);
  const [pts, setPts] = useState<P[]>(init);
  const [loss, setLoss] = useState<number[]>([]);
  const [steps, setSteps] = useState(0);
  const fieldNow = (pool: P[]) => pool.map(p => ({ v: field(p, data, pool, 1, 1), p }));
  const targets = fieldNow(pts).map(({ v, p }) => ({ x: p.x + v.x * 0.75, y: p.y + v.y * 0.75 }));
  const currentLoss = fieldNow(pts).reduce((s, { v }) => s + v.x * v.x + v.y * v.y, 0) / pts.length;
  const advance = (n: number) => {
    let cur = pts.map(p => ({ ...p }));
    const hist = [...loss];
    for (let k = 0; k < n; k++) {
      let lsum = 0;
      cur = cur.map(p => {
        const v = field(p, data, cur, 1, 1);
        lsum += v.x * v.x + v.y * v.y;
        return { x: clamp(p.x + v.x * 0.75, 0.03, 0.97), y: clamp(p.y + v.y * 0.75, 0.04, 0.96) };
      });
      hist.push(lsum / cur.length);
    }
    setPts(cur);
    setLoss(hist);
    setSteps(s => s + n);
  };
  const reset = () => { setPts(init.map(p => ({ ...p }))); setLoss([]); setSteps(0); };
  const map = (p: P) => ({ x: 90 + p.x * 720, y: 530 - p.y * 460 });
  const spark = useMemo(() => {
    const vals = loss.length ? loss : [currentLoss];
    const max = Math.max(...vals, 0.02);
    const w = 380, h = 90;
    return vals.map((v, i) => `${i ? 'L' : 'M'}${(i / Math.max(1, vals.length - 1)) * w} ${h - (v / max) * h}`).join(' ');
  }, [loss, currentLoss]);
  return (
    <div className="dk-page two">
      <div className="dk-scene">
        <svg viewBox="0 0 900 560" role="img" aria-label="点击训练一步：羊群朝冻结的目标位置移动">
          <Hills w={900} h={560} />
          {data.map((p, i) => <Grass key={i} x={map(p).x} y={map(p).y} s={0.95} color={PAL.blue} />)}
          {pts.map((p, i) => {
            const t = targets[i];
            return <g key={i}>
              <line x1={map(p).x} y1={map(p).y} x2={map(t).x} y2={map(t).y} stroke={PAL.green} strokeWidth="2" opacity=".45" strokeDasharray="5 5" />
              <circle cx={map(t).x} cy={map(t).y} r="8" fill="#fff" stroke={PAL.green} strokeWidth="3" />
              <Sheep x={map(p).x} y={map(p).y} s={0.55} color={PAL.orange} />
            </g>;
          })}
          <text x="40" y="36" className="dk-svg-label">空心圈 = 冻结目标 x + V</text>
          <text x="40" y="70" className="dk-svg-strong">已训练 {steps} 步</text>
        </svg>
      </div>
      <div className="dk-stack">
        <Section title="目标先冻结，再靠近">
          <div className="dk-text">
            <SymbolHint meaning="训练损失 ℒ：网络输出与冻结目标之间的均方误差，数值上等于 ‖V‖² 的期望。">ℒ</SymbolHint> = <SymbolHint meaning="E_ε：对随机噪声 ε 取期望。">E<sub>ε</sub></SymbolHint>{' '}
            ‖ <SymbolHint meaning="生成器 f_θ：参数为 θ 的网络，输入噪声 ε，输出样本。">f<sub>θ</sub>(ε)</SymbolHint> −{' '}
            <SymbolHint meaning="sg = stop-gradient：把 x + V 当作常量目标，不让梯度穿过它。">sg</SymbolHint>(
            f<sub>θ</sub>(ε) + <SymbolHint meaning="漂移 V：当前轮由正负样本算出的位移向量。">V</SymbolHint>(x) ) ‖²
          </div>
          <div className="dk-note">sg：冻结目标，梯度不穿过它。</div>
        </Section>
        <div className="dk-row">
          <button className="dk-btn" type="button" onClick={() => advance(1)}>训练一步</button>
          <button className="dk-btn ghost" type="button" onClick={() => advance(10)}>连续 10 步</button>
          <button className="dk-btn ghost" type="button" onClick={reset}>重置</button>
        </div>
        <Section title={`损失 ‖V‖² = ${currentLoss.toFixed(3)}`}>
          <svg viewBox="0 0 380 90" style={{ width: '100%', height: 76 }} role="img" aria-label="损失随训练步数下降的折线">
            <line x1="0" y1="86" x2="380" y2="86" stroke={PAL.line} strokeWidth="2" />
            <path d={spark} fill="none" stroke={PAL.green} strokeWidth="3.5" strokeLinecap="round" />
          </svg>
        </Section>
        <Feedback tone={currentLoss < 0.02 ? 'ok' : 'info'}>
          {currentLoss < 0.02 ? '漂移接近零：q 已基本盖住 p，训练达到平衡。' :
            '每点一次，羊群就朝当轮冻结的目标走一步；下一轮目标重新计算。'}
        </Feedback>
      </div>
    </div>
  );
}

const ENCODERS = [
  { id: 'none', label: '不用编码器', fid: '—', fail: true, gap: 0.02, spread: 0.24, note: '原始像素里核函数区分不开相似性，论文报告无法在 ImageNet 上跑通。' },
  { id: 'simclr', label: 'SimCLR', fid: '11.05', fail: false, gap: 0.34, spread: 0.19, note: '像素域自监督编码器，需要跑 VAE 解码，已经可用。' },
  { id: 'moco', label: 'MoCo-v2', fid: '8.41', fail: false, gap: 0.4, spread: 0.17, note: '同属像素域预训练，比 SimCLR 略好。' },
  { id: 'mae', label: 'latent-MAE', fid: '8.46', fail: false, gap: 0.44, spread: 0.12, note: '在隐空间预训练的 MAE（默认设置），特征更聚。' },
  { id: 'cls', label: 'latent-MAE + 分类微调', fid: '3.36', fail: false, gap: 0.47, spread: 0.08, note: '再经分类微调，语义相近的样本靠得更近，FID 降到 3.36。' },
] as const;

/** Scene: drifting happens in feature space; encoder quality changes the kernel. */
export function DriftFeature({ moduleId }: WidgetProps) {
  const [enc, setEnc] = useState<typeof ENCODERS[number]>(ENCODERS[3]);
  const pointSets = useMemo(() => {
    const rng = seeded(113);
    const a = Array.from({ length: 22 }, () => ({ x: gaussOf(rng), y: gaussOf(rng) }));
    const b = Array.from({ length: 22 }, () => ({ x: gaussOf(rng), y: gaussOf(rng) }));
    return { a, b };
  }, []);
  const place = (p: P, cls: 0 | 1): P => ({
    x: (cls ? 1 : -1) * enc.gap + p.x * enc.spread,
    y: p.y * enc.spread + (cls ? 0.16 : -0.16),
  });
  const pts = [...pointSets.a.map(p => place(p, 0)), ...pointSets.b.map(p => place(p, 1))];
  const focus = pts[5];
  const dists = pts.map(p => Math.hypot(p.x - focus.x, p.y - focus.y));
  const ws = dists.map(d => Math.exp(-d / 0.16));
  const z = ws.reduce((s, w) => s + w, 0) || 1;
  const top = dists.map((d, i) => ({ d, w: ws[i] / z, cls: i < 22 ? 0 : 1 })).sort((m, n) => m.d - n.d).slice(0, 6);
  const map = (p: P) => ({ x: 520 + p.x * 200, y: 300 - p.y * 200 });
  return (
    <div className="dk-page two">
      <div className="dk-scene">
        <svg viewBox="0 0 900 560" role="img" aria-label={`${enc.label} 特征空间中的样本分布与核权重`}>
          <rect width="900" height="560" fill={PAL.bg} />
          <rect x="30" y="70" width="250" height="250" rx="16" fill="#fff" stroke={PAL.line} />
          <text x="46" y="104" className="dk-svg-strong">像素空间</text>
          {Array.from({ length: 25 }, (_, i) => {
            const r = Math.floor(i / 5), c = i % 5;
            const cls = (r + c) % 2;
            return <rect key={i} x={52 + c * 44} y={126 + r * 34} width="34" height="26" rx="4"
              fill={cls ? PAL.blue : PAL.orange} opacity={enc.fail ? 0.55 : 0.35 + (cls ? 0 : 0.1)} />;
          })}
          <text x="46" y="352" className="dk-svg-label">像元相近 ≠ 语义相近</text>
          <line x1="330" y1="40" x2="330" y2="530" stroke={PAL.line} strokeWidth="2" />
          <text x="520" y="52" className="dk-svg-strong">特征空间 φ</text>
          <line x1="360" y1="300" x2="880" y2="300" stroke={PAL.line} />
          <line x1="520" y1="80" x2="520" y2="520" stroke={PAL.line} />
          {pts.map((p, i) => {
            const q = map(p);
            const isA = i < 22;
            return <g key={i}>
              <line x1={map(focus).x} y1={map(focus).y} x2={q.x} y2={q.y} stroke={isA ? PAL.blue : PAL.orange}
                strokeWidth={1 + ws[i] * 10} opacity={0.05 + ws[i] * 4} />
              <circle cx={q.x} cy={q.y} r={i === 5 ? 11 : 7} fill={isA ? PAL.blue : PAL.orange} opacity=".9" />
            </g>;
          })}
          <text x="360" y="544" className="dk-svg-label">线越粗 = 核权重越大</text>
        </svg>
      </div>
      <div className="dk-stack">
        <Section title="用哪种气味地图找相似样本">
          <div className="dk-row">
            {ENCODERS.map(e => <Chip key={e.id} active={enc.id === e.id} onClick={() => setEnc(e)}>{e.label}</Chip>)}
          </div>
        </Section>
        <div className="dk-row">
          <span className="dk-note">实测 FID（B/2，100 轮）</span>
          <span className="dk-big" style={{ color: enc.fail ? PAL.red : enc.id === 'cls' ? PAL.green : PAL.blue }}>{enc.fid}</span>
        </div>
        <Feedback tone={enc.fail ? 'warn' : enc.id === 'cls' ? 'ok' : 'info'}>{enc.note}</Feedback>
        <Pasture label="同一群羊，换一张气味地图，靠得近不近就变了。" tone={enc.id === 'cls' ? 'wide' : 'calm'} />
        <Section>
          <div className="dk-row" style={{ gap: 18 }}>
            {top.slice(0, 3).map((t, i) => (
              <div key={i} style={{ minWidth: 130 }}>
                <div className="dk-note" style={{ marginBottom: 2 }}>距离 {t.d.toFixed(2)}</div>
                <div className="dk-big" style={{ fontSize: 34, color: t.cls ? PAL.orange : PAL.blue }}>
                  {(t.w * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

/** Scene: classifier-free guidance becomes a training-time negative mixture. */
export function DriftCfg({ moduleId }: WidgetProps) {
  const [alpha, setAlpha] = useState(1);
  const gamma = 1 - 1 / alpha;
  const cond = { x: 0.74, y: 0.34 };
  const unc = { x: 0.3, y: 0.66 };
  const rng = useMemo(() => seeded(127), []);
  const base = useMemo(() => Array.from({ length: 26 }, () => ({ x: gaussOf(rng) * 0.16, y: gaussOf(rng) * 0.16 })), [rng]);
  const shift = clamp((alpha - 1) * 0.28, 0, 0.42);
  const spread = clamp(1.05 / alpha, 0.35, 1.05);
  const pts = base.map(p => ({
    x: cond.x - shift * 0.9 + p.x * spread,
    y: cond.y + p.y * spread,
  }));
  const map = (p: P) => ({ x: 90 + p.x * 720, y: 530 - p.y * 460 });
  return (
    <div className="dk-page two">
      <div className="dk-scene">
        <svg viewBox="0 0 900 560" role="img" aria-label={`CFG 强度 α=${alpha.toFixed(2)}，条件羊群更集中地靠向条件草地`}>
          <Hills w={900} h={560} />
          {Array.from({ length: 12 }, (_, i) => {
            const g = map({ x: cond.x + gaussOf(seeded(130 + i)) * 0.07, y: cond.y + gaussOf(seeded(190 + i)) * 0.07 });
            return <Grass key={`c${i}`} x={g.x} y={g.y} s={0.95} color={PAL.blue} />;
          })}
          {Array.from({ length: 8 }, (_, i) => {
            const g = map({ x: unc.x + gaussOf(seeded(210 + i)) * 0.12, y: unc.y + gaussOf(seeded(260 + i)) * 0.12 });
            return <Grass key={`u${i}`} x={g.x} y={g.y} s={0.95} color={PAL.envDark} />;
          })}
          {pts.map((p, i) => <Sheep key={i} x={map(p).x} y={map(p).y} s={0.58} color={PAL.orange} />)}
          <text x="40" y="36" className="dk-svg-label">蓝 = 条件数据 · 灰绿 = 无条件负样本</text>
          <text x="40" y="540" className="dk-svg-strong">α = {alpha.toFixed(2)}　γ = {gamma.toFixed(2)}</text>
        </svg>
      </div>
      <div className="dk-stack">
        <Section title="负样本池怎么混">
          <input className="dk-slider" type="range" min={1} max={3} step={0.05} value={alpha}
            aria-label="CFG 强度" onChange={e => setAlpha(Number(e.target.value))} />
          <div className="dk-kv"><span>引导强度 <SymbolHint meaning="α = 1/(1−γ)：把条件分布与无条件分布线性外推的强度。">α</SymbolHint> = 1/(1−γ)</span><b>{alpha.toFixed(2)}</b></div>
          <div className="dk-kv"><span>无条件真实样本占比 <SymbolHint meaning="γ：混进负样本池的无条件真实样本比例；γ 越大，α 越大。">γ</SymbolHint></span><b>{gamma.toFixed(2)}</b></div>
          <div style={{ display: 'flex', height: 26, borderRadius: 8, overflow: 'hidden', marginTop: 10 }}>
            <div style={{ width: `${(1 - gamma) * 100}%`, background: PAL.orange }} />
            <div style={{ width: `${gamma * 100}%`, background: PAL.envDark }} />
          </div>
          <div className="dk-note">橙：生成的负样本 q(·|c)　灰绿：无条件数据 p(·|∅)</div>
        </Section>
        <Feedback tone={alpha === 1 ? 'info' : 'ok'}>
          {alpha === 1 ? 'α = 1：没有额外无条件负样本，等价于无引导。' :
            '引导越强，q 越向条件分布外推，样本更集中、覆盖更窄。'}
        </Feedback>
        <div className="dk-note">L/2 最优 α = 1.0，B/2 为 1.1；推理仍是 1 次前向。</div>
      </div>
    </div>
  );
}
