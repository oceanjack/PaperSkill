import React, { useMemo, useState } from 'react';
import { SymbolHint } from '../components/SymbolHint';
import { PAL, Sheep, Grass, Hills, Chip, Feedback, Section, LegendDots, Pasture, clamp, seeded, gaussOf } from './driftKit';
import type { WidgetProps } from './registry';

type P = { x: number; y: number };

/** Scene: the DiT-like generator reads the whole latent grid in one pass. */
export function DriftArchitecture({ moduleId }: WidgetProps) {
  const [style, setStyle] = useState(true);
  const [context, setContext] = useState(true);
  const sheep = useMemo(() => Array.from({ length: 6 }, (_, i) => ({ x: 120 + i * 105, y: 300 + (i % 2) * 42 })), []);
  return (
    <div className="dk-page two">
      <div className="dk-scene">
        <svg viewBox="0 0 900 560" role="img" aria-label="一次前向里，牧羊人把整张草地地图切成 256 个令牌，并带上类别与风格条件">
          <rect width="900" height="560" fill={PAL.bg} />
          <text x="40" y="46" className="dk-svg-strong">牧羊人一次看完整张地图</text>
          <text x="40" y="82" className="dk-svg-label">32×32×4 隐变量 → 256 个令牌</text>
          {Array.from({ length: 256 }, (_, i) => {
            const r = Math.floor(i / 16), c = i % 16;
            const on = (r * 7 + c * 3) % 11 < 4;
            return <rect key={i} x={60 + c * 30} y={100 + r * 22} width="27" height="19" rx="3"
              fill={on ? PAL.env : '#e9efe4'} stroke="#ffffff" strokeWidth="1" />;
          })}
          <text x="560" y="120" className="dk-svg-label">加上条件令牌：</text>
          <g transform="translate(560 140)">
            {context && <g>
              <rect width="300" height="52" rx="12" fill="#fff" stroke={PAL.blue} strokeWidth="2" />
              <text x="14" y="34" className="dk-svg-label" fill={PAL.blue}>16 个上下文令牌</text>
            </g>}
            {style && <g transform="translate(0 64)">
              <rect width="300" height="52" rx="12" fill="#fff" stroke={PAL.orange} strokeWidth="2" />
              <text x="14" y="36" className="dk-svg-label" fill={PAL.orange}>32 个风格令牌</text>
            </g>}
            <g transform="translate(0 140)">
              <rect width="300" height="48" rx="12" fill={PAL.blue} opacity=".9" />
              <text x="14" y="32" className="dk-svg-label" fill="#fff">adaLN：类别 c 与 α</text>
            </g>
          </g>
          <text x="360" y="420" className="dk-svg-label">一次前向输出整张图</text>
          {sheep.map((s, i) => (
            <g key={i}>
              <Sheep x={s.x} y={s.y} s={0.62} color={PAL.orange} />
              {style && <circle cx={s.x + 14} cy={s.y - 26} r={5} fill={[PAL.blue, PAL.green, PAL.purple, PAL.red, PAL.orange, PAL.wood][i]} />}
            </g>
          ))}
          <text x="40" y="470" className="dk-svg-label">{style ? '风格令牌让每只羊的花纹不同' : '没有风格令牌：羊长得一样'}</text>
        </svg>
      </div>
      <div className="dk-stack">
        <Section title="生成器里放了什么">
          <div className="dk-row">
            <Chip active={style} onClick={() => setStyle(!style)}>风格令牌 32</Chip>
            <Chip active={context} onClick={() => setContext(!context)}>上下文令牌 16</Chip>
          </div>
          <div className="dk-kv"><span>序列长度</span><b>256 + {context ? 16 : 0}</b></div>
          <div className="dk-kv"><span>随机变量</span><b>高斯 ε + 风格索引</b></div>
          <div className="dk-kv"><span>条件注入</span><b>adaLN + in-context</b></div>
        </Section>
        <div className="dk-row">
          <span className="dk-note">实测 FID（B/2，100 轮）</span>
          <span className="dk-big" style={{ color: style ? PAL.green : PAL.red }}>{style ? '8.46' : '8.86'}</span>
        </div>
        <Feedback tone={style ? 'ok' : 'warn'}>
          {style ? '风格令牌几乎不增加参数与算力，却让随机输入不只是一种高斯噪声。' :
            '去掉风格令牌，随机性只剩高斯噪声，FID 从 8.46 退到 8.86。'}
        </Feedback>
        <div className="dk-note">DiT 架构：patch 2、SwiGLU、RoPE；隐空间 SD-VAE 32×32×4。</div>
      </div>
    </div>
  );
}

type Method = { name: string; nfe: number; fid: number; family: 'our' | 'one' | 'multi' };

const METHODS: Method[] = [
  { name: '漂移模型 L/2', nfe: 1, fid: 1.54, family: 'our' },
  { name: 'iMeanFlow-XL/2', nfe: 1, fid: 1.72, family: 'one' },
  { name: 'AdvFlow-XL/2', nfe: 1, fid: 2.38, family: 'one' },
  { name: 'MeanFlow-XL/2', nfe: 1, fid: 3.43, family: 'one' },
  { name: 'Shortcut-XL/2', nfe: 1, fid: 10.6, family: 'one' },
  { name: 'RAE+DiT-XL/2', nfe: 100, fid: 1.13, family: 'multi' },
  { name: 'LightningDiT-XL/2', nfe: 500, fid: 1.35, family: 'multi' },
  { name: 'SiT-XL/2+REPA', nfe: 500, fid: 1.42, family: 'multi' },
  { name: 'SiT-XL/2', nfe: 500, fid: 2.06, family: 'multi' },
  { name: 'DiT-XL/2', nfe: 500, fid: 2.27, family: 'multi' },
];

/** Scene: read the system-level comparison through an inference budget. */
export function DriftBudget({ moduleId }: WidgetProps) {
  const [budget, setBudget] = useState(1);
  const shown = METHODS.filter(m => m.nfe <= budget);
  const best = shown.reduce((a, b) => (b.fid < a.fid ? b : a), shown[0]);
  const ours = METHODS[0];
  const x = (nfe: number) => 150 + (Math.log10(nfe) / Math.log10(500)) * 640;
  const y = (fid: number) => 500 - ((fid - 1.0) / 10.2) * 400;
  return (
    <div className="dk-page two">
      <div className="dk-scene">
        <svg viewBox="0 0 900 560" role="img" aria-label={`在 ${budget} 次评估的预算下，可用的最低 FID 是 ${best.fid}`}>
          <rect width="900" height="560" fill={PAL.bg} />
          <line x1="150" y1="100" x2="150" y2="500" stroke={PAL.line} strokeWidth="2" />
          <line x1="150" y1="500" x2="820" y2="500" stroke={PAL.line} strokeWidth="2" />
          <text x="40" y="300" className="dk-svg-label" transform="rotate(-90 40 300)">FID ↓</text>
          <text x="640" y="536" className="dk-svg-label">网络评估次数 →</text>
          {[1.5, 3, 6, 9].map(v => <g key={v}>
            <line x1="150" y1={y(v)} x2="820" y2={y(v)} stroke={PAL.line} strokeDasharray="4 6" opacity=".6" />
            <text x="96" y={y(v) + 7} className="dk-svg-label">{v.toFixed(1)}</text>
          </g>)}
          {[1, 10, 100, 500].map(v => <text key={v} x={x(v) - 16} y="524" className="dk-svg-label">{v}</text>)}
          {budget >= 100 && <line x1={x(100)} y1="90" x2={x(100)} y2="500" stroke={PAL.blue} strokeDasharray="6 6" opacity=".5" />}
          {budget >= 500 && <line x1={x(500)} y1="90" x2={x(500)} y2="500" stroke={PAL.blue} strokeDasharray="6 6" opacity=".5" />}
          {METHODS.map(m => {
            const active = m.nfe <= budget;
            return <g key={m.name} opacity={active ? 1 : 0.28}>
              <circle cx={x(m.nfe)} cy={y(m.fid)} r={m.family === 'our' ? 13 : 8}
                fill={m.family === 'our' ? PAL.green : m.family === 'one' ? PAL.orange : PAL.blue} />
              {m.family === 'our' && <text x={x(m.nfe) + 18} y={y(m.fid) + 8} className="dk-svg-strong" fill={PAL.green}>1.54</text>}
            </g>;
          })}
          <text x="180" y="130" className="dk-svg-label">蓝：多步扩散/流 · 橙：单步 · 绿：本文</text>
          <text x="180" y="470" className="dk-svg-label">1 次评估这一列，橙色最低为 1.72</text>
        </svg>
      </div>
      <div className="dk-stack">
        <Section title="预算内能拿到多低的 FID">
          <div className="dk-row">
            {[1, 100, 500].map(b => <Chip key={b} active={budget === b} onClick={() => setBudget(b)}>{b} 次</Chip>)}
          </div>
          <div className="dk-kv"><span>预算内最低 FID</span><b>{best.fid.toFixed(2)} · {best.name}</b></div>
          <div className="dk-kv"><span>本文 1-NFE</span><b style={{ color: PAL.green }}>{ours.fid.toFixed(2)}</b></div>
          <div className="dk-kv"><span>本文参数量</span><b>463M + 49M 解码器</b></div>
        </Section>
        <Feedback tone={budget === 1 ? 'ok' : 'info'}>
          {budget === 1 ? '同样只评估 1 次，漂移模型 1.54，此前最好的单步方法为 1.72。' :
            budget === 100 ? '预算放宽到 100 次，多步的 RAE+DiT 可到 1.13——它用更多步换更低 FID。' :
              '500 次预算下，多步方法仍占 FID 优势；漂移模型的价值在于把 1 次评估做到这个水平。'}
        </Feedback>
        <Pasture label="同样一群羊，1 次评估的预算下只有本文这一群到位。" tone="wide" />
        <div className="dk-note">FID 在 50K 张生成图上计算；表中 NFE 为论文报告的「步数 × 2」，这里折算为网络评估次数。</div>
      </div>
    </div>
  );
}

const POS = [{ n: 1, fid: 20.43 }, { n: 16, fid: 10.39 }, { n: 32, fid: 8.97 }, { n: 64, fid: 8.46 }];
const NEG = [{ n: 8, fid: 11.82 }, { n: 16, fid: 10.16 }, { n: 32, fid: 9.32 }, { n: 64, fid: 8.46 }];

/** Scene: how many positive and negative samples to use. */
export function DriftSampling({ moduleId }: WidgetProps) {
  const [pos, setPos] = useState(POS[0]);
  const [neg, setNeg] = useState(NEG[0]);
  const x = (n: number) => 150 + (Math.log2(n) / 6) * 620;
  const y = (fid: number) => 500 - ((fid - 7.5) / 14) * 360;
  const line = (rows: typeof POS) => rows.map((r, i) => `${i ? 'L' : 'M'}${x(r.n)} ${y(r.fid)}`).join(' ');
  return (
    <div className="dk-page two">
      <div className="dk-scene">
        <svg viewBox="0 0 900 560" role="img" aria-label={`正样本 ${pos.n} 个时 FID ${pos.fid}，负样本 ${neg.n} 个时 FID ${neg.fid}`}>
          <rect width="900" height="560" fill={PAL.bg} />
          <line x1="150" y1="80" x2="150" y2="500" stroke={PAL.line} strokeWidth="2" />
          <line x1="150" y1="500" x2="830" y2="500" stroke={PAL.line} strokeWidth="2" />
          <text x="44" y="290" className="dk-svg-label" transform="rotate(-90 44 290)">FID ↓</text>
          <text x="620" y="538" className="dk-svg-label">样本数（对数）</text>
          {[8, 16, 32, 64].map(v => <text key={v} x={x(v) - 12} y="524" className="dk-svg-label">{v}</text>)}
          <path d={line(POS)} fill="none" stroke={PAL.blue} strokeWidth="4" />
          <path d={line(NEG)} fill="none" stroke={PAL.orange} strokeWidth="4" strokeDasharray="9 7" />
          {POS.map(r => <circle key={`p${r.n}`} cx={x(r.n)} cy={y(r.fid)} r={r.n === pos.n ? 11 : 6} fill={PAL.blue} />)}
          {NEG.map(r => <circle key={`n${r.n}`} cx={x(r.n)} cy={y(r.fid)} r={r.n === neg.n ? 11 : 6} fill={PAL.orange} />)}
          <text x="150" y="112" className="dk-svg-label" fill={PAL.blue}>实线：正样本 y⁺（负=64）</text>
          <text x="150" y="150" className="dk-svg-label" fill={PAL.orange}>虚线：负样本 y⁻</text>
        </svg>
      </div>
      <div className="dk-stack">
        <Section title="多看草、多看同伴">
          <label className="dk-note">正样本数（负样本固定 64）：{pos.n}
            <input className="dk-slider" type="range" min={0} max={3} step={1} value={POS.indexOf(pos)}
              aria-label="正样本数" onChange={e => setPos(POS[Number(e.target.value)])} /></label>
          <label className="dk-note" style={{ display: 'block', marginTop: 4 }}>负样本数（与正样本相同）：{neg.n}
            <input className="dk-slider" type="range" min={0} max={3} step={1} value={NEG.indexOf(neg)}
              aria-label="负样本数" onChange={e => setNeg(NEG[Number(e.target.value)])} /></label>
          <div className="dk-kv" style={{ marginTop: 8 }}><span>正样本消融 FID（B/2，100 轮）</span><b style={{ color: PAL.blue }}>{pos.fid.toFixed(2)}</b></div>
          <div className="dk-kv"><span>负样本消融 FID（同一预算）</span><b style={{ color: PAL.orange }}>{neg.fid.toFixed(2)}</b></div>
        </Section>
        <Feedback tone={pos.n === 64 && neg.n === 64 ? 'ok' : 'info'}>
          {pos.n === 64 && neg.n === 64 ? '两头都取 64，估计最稳，FID 都落到 8.46。' :
            '样本越少，V 的经验估计越抖；两组实验各自固定总预算。'}
        </Feedback>
        <Pasture label="看清的同伴越多，V 的方向越稳。" tone={pos.n === 64 ? 'busy' : 'calm'} />
        <div className="dk-note">表 2 实测值，两组为独立实验。</div>
      </div>
    </div>
  );
}

/** Scene: pixel space and robotic control — same method, two domains. */
export function DriftDomains({ moduleId }: WidgetProps) {
  const tasks = [
    { name: 'Lift', diff: 0.98, drift: 1.0 },
    { name: 'Can', diff: 0.96, drift: 0.98 },
    { name: 'ToolHang', diff: 0.3, drift: 0.38 },
    { name: 'PushT', diff: 0.91, drift: 0.86 },
  ];
  return (
    <div className="dk-page even">
      <Section title="像素空间：不带 VAE 也能生成">
        <svg viewBox="0 0 700 300" style={{ width: '100%', height: 300 }} role="img" aria-label="像素空间 FID 对比：漂移模型 1.61，StyleGAN-XL 2.30，PixelDiT 1.61">
          <g transform="translate(90 40)">
            {[{ n: '漂移模型 L/16 · 1 次', v: 1.61, c: PAL.green }, { n: 'PixelDiT · 200 步', v: 1.61, c: PAL.blue }, { n: 'StyleGAN-XL', v: 2.3, c: PAL.orange }].map((r, i) => (
              <g key={r.n} transform={`translate(0 ${i * 82})`}>
                <text x="0" y="0" className="dk-svg-label">{r.n}</text>
                <rect x="0" y="14" width={r.v * 190} height={26} rx="6" fill={r.c} opacity=".85" />
                <text x={r.v * 190 + 12} y="34" className="dk-svg-strong" fill={r.c}>{r.v.toFixed(2)}</text>
              </g>
            ))}
            <text x="0" y="270" className="dk-svg-label">FID ↓ · 87G vs 1574G FLOPs</text>
          </g>
        </svg>
        <div className="dk-note">1.61 是本次的主结果之一：无需隐变量，一次前向直接出 256×256×3。</div>
      </Section>
      <Section title="机器人控制：把多步策略换成 1 步">
        <table className="dk-table">
          <thead><tr><th>任务（状态观测）</th><th>Diffusion Policy · 100 次</th><th>漂移策略 · 1 次</th></tr></thead>
          <tbody>
            {tasks.map(t => (
              <tr key={t.name} className={t.drift >= t.diff ? 'on' : ''}>
                <td>{t.name}</td><td>{t.diff.toFixed(2)}</td><td><b style={{ color: t.drift >= t.diff ? PAL.green : PAL.ink }}>{t.drift.toFixed(2)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="dk-note" style={{ marginTop: 14 }}>成功率取最后 10 个检查点的平均；同协议直接对比。</div>
        <div style={{ marginTop: 14 }}>
          <LegendDots items={[{ color: PAL.blue, label: '多步基线' }, { color: PAL.green, label: '1 步不劣于基线' }]} />
        </div>
        <div style={{ marginTop: 14 }}>
          <Pasture label="赶羊的动作不变，场地从图像换成了机械臂。" tone="calm" />
        </div>
      </Section>
    </div>
  );
}

function limitField(x: P, pos: P[], neg: P[], tau: number) {
  const wk = (pool: P[]) => {
    const ws = pool.map(p => (p === x ? 0 : Math.exp(-Math.hypot(p.x - x.x, p.y - x.y) / tau)));
    const z = ws.reduce((s, w) => s + w, 0) || 1;
    return ws.map(w => w / z);
  };
  const wp = wk(pos), wn = wk(neg);
  let px = 0, py = 0, nx = 0, ny = 0;
  pos.forEach((p, i) => { px += p.x * wp[i]; py += p.y * wp[i]; });
  neg.forEach((p, i) => { nx += p.x * wn[i]; ny += p.y * wn[i]; });
  return { x: px - nx, y: py - ny };
}

/** Scene: zero drift does not automatically mean matched distributions. */
export function DriftLimits({ moduleId }: WidgetProps) {
  const [t, setT] = useState(0.5);
  const tau = Math.pow(10, -1.5 + t * 2.3);
  const data = useMemo(() => {
    const rng = seeded(151);
    return [
      ...Array.from({ length: 14 }, () => ({ x: 0.6 + gaussOf(rng) * 0.11, y: 0.35 + gaussOf(rng) * 0.11 })),
      ...Array.from({ length: 14 }, () => ({ x: 0.74 + gaussOf(rng) * 0.11, y: 0.68 + gaussOf(rng) * 0.11 })),
    ];
  }, []);
  const neg = useMemo(() => {
    const rng = seeded(157);
    return [
      ...Array.from({ length: 12 }, () => ({ x: 0.26 + gaussOf(rng) * 0.05, y: 0.36 + gaussOf(rng) * 0.05 })),
      ...Array.from({ length: 12 }, () => ({ x: 0.42 + gaussOf(rng) * 0.05, y: 0.64 + gaussOf(rng) * 0.05 })),
    ];
  }, []);
  const fields = neg.map(p => limitField(p, data, neg, tau));
  const meanV = fields.reduce((s, v) => s + Math.hypot(v.x, v.y), 0) / fields.length;
  const mismatch = neg.reduce((s, p) => s + Math.min(...data.map(d => Math.hypot(d.x - p.x, d.y - p.y))), 0) / neg.length;
  const map = (p: P) => ({ x: 90 + p.x * 720, y: 530 - p.y * 460 });
  const tooSmall = tau < 0.06, tooBig = tau > 0.8;
  return (
    <div className="dk-page two">
      <div className="dk-scene">
        <svg viewBox="0 0 900 560" role="img" aria-label={`温度 ${tau.toFixed(2)} 时的漂移场示意，平均漂移 ${meanV.toFixed(3)}`}>
          <Hills w={900} h={560} />
          {data.map((p, i) => <Grass key={i} x={map(p).x} y={map(p).y} s={0.95} color={PAL.blue} />)}
          {neg.map((p, i) => {
            const q = map(p);
            const v = fields[i];
            return <g key={i}>
              <Sheep x={q.x} y={q.y} s={0.55} color={PAL.orange} />
              <line x1={q.x} y1={q.y} x2={q.x + v.x * 300} y2={q.y - v.y * 300} stroke={PAL.green} strokeWidth="4" strokeLinecap="round" />
            </g>;
          })}
          <text x="40" y="36" className="dk-svg-label">绿箭头 = 当前温度下每个样本的漂移 V</text>
          <text x="40" y="540" className="dk-svg-strong">τ = {tau.toFixed(3)}　平均‖V‖ = {meanV.toFixed(3)}</text>
        </svg>
      </div>
      <div className="dk-stack">
        <Section title="温度把漂移「调没」了">
          <input className="dk-slider" type="range" min={0} max={1} step={0.01} value={t}
            aria-label="核函数温度（对数）" onChange={e => setT(Number(e.target.value))} />
          <div className="dk-kv"><span>核温度 <SymbolHint meaning="核温度 τ：控制每个样本「看得多远」；τ 过小或过大都会让漂移假性归零。">τ</SymbolHint>（对数滑动）</span><b>{tau.toFixed(3)}</b></div>
          <div className="dk-kv"><span>平均漂移 <SymbolHint meaning="‖V‖：漂移向量的长度，训练损失要把它压到零。">‖V‖</SymbolHint></span><b>{meanV.toFixed(3)}</b></div>
          <div className="dk-kv"><span><SymbolHint meaning="q 到 p 的平均最近距离：衡量生成分布与数据分布还差多远，越小越接近。">q 到 p 的平均最近距离</SymbolHint></span><b style={{ color: PAL.red }}>{mismatch.toFixed(3)}</b></div>
        </Section>
        <Feedback tone={tooSmall || tooBig ? 'warn' : 'info'}>
          {tooSmall ? 'τ 太小：每只羊只看见最近的一撮草，漂移几乎为零，可分布仍没对齐。' :
            tooBig ? 'τ 太大：核几乎变平，吸引与排斥一起被平均掉，V 也接近零。' :
              '合适的 τ 让邻域既不太窄也不太宽；但漂移小本身不能证明分布已经匹配。'}
        </Feedback>
        <div className="dk-note">只证明了 p = q ⇒ V = 0，反向不保证（第 6 节、附录 C.1）。τ 消融 FID：10.62 / 8.67 / 8.96 / 8.46。</div>
      </div>
    </div>
  );
}

/** Scene: recap with one forward pass, drawn as a fresh flock. */
export function DriftRecap({ moduleId }: WidgetProps) {
  const [batch, setBatch] = useState(0);
  const target = useMemo(() => {
    const rng = seeded(167);
    return Array.from({ length: 20 }, () => ({ x: 620 + gaussOf(rng) * 90, y: 330 + gaussOf(rng) * 70 }));
  }, []);
  const sampled = useMemo(() => {
    const rng = seeded(170 + batch);
    return Array.from({ length: 20 }, () => ({ x: 620 + gaussOf(rng) * 90, y: 330 + gaussOf(rng) * 70 }));
  }, [batch]);
  return (
    <div className="dk-page even">
      <div className="dk-scene">
        <svg viewBox="0 0 720 560" role="img" aria-label="一次前向，新的噪声直接生成一批羊">
          <Hills w={720} h={560} />
          {target.map((p, i) => <g key={i} opacity={0.5}><Grass x={p.x} y={p.y} s={0.85} color={PAL.blue} /></g>)}
          {sampled.map((p, i) => <Sheep key={`${batch}-${i}`} x={p.x} y={p.y} s={0.6} color={PAL.orange} />)}
          <text x="30" y="42" className="dk-svg-strong">第 {batch + 1} 批：一次前向</text>
          <text x="30" y="74" className="dk-svg-label">不同的 ε，各自直接落到草场</text>
          <text x="30" y="530" className="dk-svg-label">虚线 = 目标分布 p；羊 = q 的样本</text>
        </svg>
      </div>
      <div className="dk-stack">
        <Section title="把整条链条压缩成一句话">
          <div className="dk-text" style={{ lineHeight: 1.5 }}>
            训练时：q 由 V 推动，V 在 p = q 时归零。<br />
            推理时：只做一次 f(ε)。<br />
            关键条件：V 必须反对称；漂移要发生在有意义的特征空间。
          </div>
        </Section>
        <div className="dk-row">
          <button className="dk-btn" type="button" onClick={() => setBatch(b => b + 1)}>再生成一批</button>
          <span className="dk-badge">1-NFE</span>
        </div>
        <Feedback tone="ok">
          1.54（隐空间）/ 1.61（像素空间）的 FID，来自同一个「训练时演化」的思路。
        </Feedback>
        <div className="dk-note">仍待回答：V → 0 何时能推出 q → p、漂移场与核的设计、特征编码器的选择，论文都列为开放问题。</div>
      </div>
    </div>
  );
}
