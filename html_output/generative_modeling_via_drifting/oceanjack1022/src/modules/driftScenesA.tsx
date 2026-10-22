import React, { useMemo, useRef, useState } from 'react';
import { useCoverPlayback } from '../components/CoverPlayback';
import { SymbolHint } from '../components/SymbolHint';
import {
  PAL, Sheep, Grass, Hills, Arrow, Chip, Feedback, Section, LegendDots,
  clamp, lerp, seeded, gaussOf, svgPoint,
} from './driftKit';
import type { WidgetProps } from './registry';

type P = { x: number; y: number };

const N = 30;
const SHEEP_S = 0.62;

function flock(seed: number, cx: number, cy: number, rx: number, ry: number): P[] {
  const rng = seeded(seed);
  return Array.from({ length: N }, () => ({
    x: cx + (rng() - 0.5) * 2 * rx,
    y: cy + (rng() - 0.5) * 2 * ry,
  }));
}

/** Cover, old method: inference-time iteration — every step nudges the flock a little. */
export function DriftCoverOld({ moduleId }: WidgetProps) {
  const { progress } = useCoverPlayback();
  const start = useMemo(() => flock(11, 130, 300, 58, 34), []);
  const target = useMemo(() => flock(23, 505, 150, 55, 30), []);
  const steps = Math.min(250, Math.floor(progress * 250));
  const t = steps / 250;
  return (
    <div className="dk-cover-panel">
      <div className="dk-cover-title">推理时迭代：走 250 步</div>
      <svg viewBox="0 0 640 360" role="img" aria-label={`推理时迭代，第 ${steps} 步，羊群渐进移动`}>
        <g transform="scale(.711 1)"><Hills w={900} h={360} /></g>
        <path d="M150 320 Q 320 300 520 190" fill="none" stroke={PAL.wood} strokeWidth="3" strokeDasharray="10 8" opacity=".55" />
        {target.map((p, i) => <Grass key={i} x={p.x} y={p.y + 6} s={0.9} color={PAL.blue} />)}
        {start.map((p, i) => {
          const q = target[i];
          const x = lerp(p.x, q.x, t);
          const y = lerp(p.y, q.y, t);
          return <Sheep key={i} x={x} y={y} s={SHEEP_S} color={PAL.orange} dim={t < 1} />;
        })}
        <text x="24" y="34" className="dk-svg-strong">{steps} / 250 步</text>
        <text x="24" y="64" className="dk-svg-label">每步只挪一点点</text>
      </svg>
      <div className="dk-cover-note">{t < 1 ? `已评估 ${steps * 2} 次网络，羊群还没到位` : '到位了，但总共评估 500 次'}</div>
    </div>
  );
}

/** Cover, new method: the distribution evolves during training; one forward pass at inference. */
export function DriftCoverNew({ moduleId }: WidgetProps) {
  const { progress } = useCoverPlayback();
  const noise = useMemo(() => flock(41, 150, 250, 88, 60), []);
  const mid = useMemo(() => flock(47, 320, 235, 60, 42), []);
  const target = useMemo(() => flock(23, 505, 150, 55, 30), []);
  const train = clamp(progress / 0.55, 0, 1);
  const done = progress >= 0.55;
  const pos = noise.map((p, i) => {
    if (train < 0.5) {
      const k = train / 0.5;
      return { x: lerp(p.x, mid[i].x, k), y: lerp(p.y, mid[i].y, k) };
    }
    const k = (train - 0.5) / 0.5;
    return { x: lerp(mid[i].x, target[i].x, k), y: lerp(mid[i].y, target[i].y, k) };
  });
  return (
    <div className="dk-cover-panel">
      <div className="dk-cover-title">训练时演化：推理 1 步</div>
      <svg viewBox="0 0 640 360" role="img" aria-label={done ? '训练已完成，羊群经一次前向落到草场' : '训练过程中羊群分布逐步靠近草场'}>
        <g transform="scale(.711 1)"><Hills w={900} h={360} /></g>
        {target.map((p, i) => <Grass key={i} x={p.x} y={p.y + 6} s={0.9} color={PAL.blue} />)}
        {target.map((p, i) => (
          <circle key={`g${i}`} cx={p.x} cy={p.y - 14} r={13} fill="none" stroke={PAL.green} strokeWidth="1.5" strokeDasharray="4 4" opacity={done ? 0.9 : 0.25} />
        ))}
        {pos.map((p, i) => <Sheep key={i} x={p.x} y={p.y} s={SHEEP_S} color={PAL.orange} />)}
        {done && <Arrow x1={300} y1={330} x2={480} y2={330} color={PAL.green} width={4} />}
        <text x="24" y="34" className="dk-svg-strong">{done ? '1 次前向' : '训练中：q 向 p 演化'}</text>
        <text x="24" y="64" className="dk-svg-label">{done ? '不再迭代采样' : `第 ${Math.round(train * 1280)} / 1280 轮`}</text>
      </svg>
      <div className="dk-cover-note">{done ? '推理只需一次网络评估' : '迭代发生在训练里，不在推理里'}</div>
    </div>
  );
}

/** Scene: what iterative inference costs. Learner scrubs the inference step budget. */
export function DriftSteps({ moduleId }: WidgetProps) {
  const [steps, setSteps] = useState(250);
  const start = useMemo(() => flock(7, 180, 400, 95, 62), []);
  const target = useMemo(() => flock(19, 730, 210, 105, 60), []);
  const t = clamp(steps / 250, 0, 1);
  const arrived = steps >= 250;
  return (
    <div className="dk-page two">
      <div className="dk-scene">
        <svg viewBox="0 0 900 560" role="img" aria-label={`推理步数 ${steps}，羊群走了约 ${Math.round(t * 100)}% 的路程`}>
          <Hills w={900} h={560} />
          <path d="M150 470 Q 400 430 760 250" fill="none" stroke={PAL.wood} strokeWidth="3" strokeDasharray="12 9" opacity=".55" />
          {target.map((p, i) => <Grass key={i} x={p.x} y={p.y + 8} s={1.1} color={PAL.blue} />)}
          {start.map((p, i) => {
            const q = target[i];
            const x = lerp(p.x, q.x, t);
            const y = lerp(p.y, q.y, t);
            return <Sheep key={i} x={x} y={y} s={0.9} color={PAL.orange} dim={!arrived} />;
          })}
          {!arrived && <text x="170" y="230" className="dk-svg-strong" fill={PAL.red}>还差 {Math.round((1 - t) * 100)}% 路程</text>}
          {arrived && <text x="620" y="120" className="dk-svg-strong" fill={PAL.green}>到达草场</text>}
          <text x="40" y="46" className="dk-svg-label">起点：噪声 ε</text>
          <text x="700" y="46" className="dk-svg-label">目标：数据分布 p</text>
        </svg>
      </div>
      <div className="dk-stack">
        <Section title="推理要评估几次网络？">
          <div className="dk-big" style={{ color: steps === 1 ? PAL.green : PAL.blue }}>{steps === 250 ? '500' : steps}</div>
          <div className="dk-note">{steps === 250 ? '250 步 × 2（CFG 需要条件与非条件各一次）' : '网络评估次数（含 CFG 时还要翻倍）'}</div>
          <input className="dk-slider" type="range" min={1} max={250} step={1} value={steps} aria-label="推理步数"
            onChange={e => setSteps(Number(e.target.value))} />
          <div className="dk-row" style={{ marginTop: 6 }}>
            <Chip active={steps === 1} onClick={() => setSteps(1)}>1 步</Chip>
            <Chip active={steps === 50} onClick={() => setSteps(50)}>50 步</Chip>
            <Chip active={steps === 250} onClick={() => setSteps(250)}>250 步</Chip>
          </div>
        </Section>
        <Feedback tone={arrived ? 'ok' : 'warn'}>
          {arrived ? '走 250 步才恰好到位：时间花在推理，每个样本都要重来一遍。' : `第 ${steps} 步时羊群还在半路——步数不够，分布就没被推到数据上。`}
        </Feedback>
        <div className="dk-note">扩散 / 流模型把「推前」拆成 250 个小步，在推理时反复调用网络；这是本文要绕开的成本。</div>
      </div>
    </div>
  );
}

/** Scene: pushforward q = f#p; learner hand-tunes a tiny f to match the data. */
export function DriftPushforward({ moduleId }: WidgetProps) {
  const [scale, setScale] = useState(0.8);
  const [dx, setDx] = useState(-0.5);
  const [dy, setDy] = useState(0.5);
  const [rot, setRot] = useState(0.6);
  const prior = useMemo(() => {
    const rng = seeded(31);
    return Array.from({ length: 44 }, () => ({ x: gaussOf(rng), y: gaussOf(rng) }));
  }, []);
  const data = useMemo(() => {
    const rng = seeded(53);
    const blobs = [{ cx: -1.1, cy: 0.35 }, { cx: 1.0, cy: -0.4 }];
    return blobs.flatMap(b => Array.from({ length: 24 }, () => ({
      x: b.cx + gaussOf(rng) * 0.28, y: b.cy + gaussOf(rng) * 0.28,
    })));
  }, []);
  const q = prior.map(p => {
    const s = scale;
    const x = p.x * s, y = p.y * s;
    return {
      x: x * Math.cos(rot) - y * Math.sin(rot) + dx,
      y: x * Math.sin(rot) + y * Math.cos(rot) + dy,
    };
  });
  const err = q.reduce((sum, p) => {
    const d = Math.min(...data.map(d => Math.hypot(d.x - p.x, d.y - p.y)));
    return sum + d;
  }, 0) / q.length;
  const good = err < 0.33;
  const map = (p: P): P => ({ x: 450 + p.x * 120, y: 280 - p.y * 120 });
  return (
    <div className="dk-page two">
      <div className="dk-scene">
        <svg viewBox="0 0 900 560" role="img" aria-label={`推前分布 q 与数据分布 p 的平均最近距离 ${err.toFixed(2)}`}>
          <rect width="900" height="560" fill={PAL.bg} />
          <line x1="90" y1="280" x2="840" y2="280" stroke={PAL.line} strokeWidth="1.5" />
          <line x1="450" y1="40" x2="450" y2="520" stroke={PAL.line} strokeWidth="1.5" />
          {data.map((p, i) => <Grass key={i} x={map(p).x} y={map(p).y} s={0.85} color={PAL.blue} />)}
          {q.map((p, i) => <circle key={i} cx={map(p).x} cy={map(p).y} r={7} fill={PAL.orange} opacity=".9" />)}
          <text x="96" y="66" className="dk-svg-label">蓝 = 数据 p（草地）</text>
          <text x="96" y="102" className="dk-svg-label">橙 = 推前分布 q（羊群）</text>
          <text x="600" y="524" className="dk-svg-label">f 把 ε 变成 q</text>
        </svg>
      </div>
      <div className="dk-stack">
        <Section title="手工调 f：让 q 盖住 p">
          <label className="dk-note">缩放 {scale.toFixed(2)}
            <input className="dk-slider" type="range" min={0.3} max={2} step={0.01} value={scale}
              aria-label="缩放" onChange={e => setScale(Number(e.target.value))} /></label>
          <label className="dk-note">横向平移 {dx.toFixed(2)}
            <input className="dk-slider" type="range" min={-1.6} max={1.6} step={0.01} value={dx}
              aria-label="横向平移" onChange={e => setDx(Number(e.target.value))} /></label>
          <label className="dk-note">纵向平移 {dy.toFixed(2)}
            <input className="dk-slider" type="range" min={-1.6} max={1.6} step={0.01} value={dy}
              aria-label="纵向平移" onChange={e => setDy(Number(e.target.value))} /></label>
          <label className="dk-note">旋转 {rot.toFixed(2)} 弧度
            <input className="dk-slider" type="range" min={0} max={3.14} step={0.01} value={rot}
              aria-label="旋转" onChange={e => setRot(Number(e.target.value))} /></label>
        </Section>
        <Feedback tone={good ? 'ok' : 'warn'}>
          {good ? '形状对上了——但双峰分布靠一个简单仿射映射永远盖不满；这正是需要训练去演化的原因。' :
            `平均最近距离 ${err.toFixed(2)}：q 没有贴住 p。人工调参已经很费劲，真实图像维度要高得多。`}
        </Feedback>
        <div className="dk-note"><SymbolHint meaning="推前分布 q：先验噪声 ε 经过网络 f 之后得到的分布。">q</SymbolHint> 由 <SymbolHint meaning="先验分布 p_ε：输入网络的标准正态噪声分布。">p_ε</SymbolHint> 经 <SymbolHint meaning="网络 f：把噪声映射成样本的映射函数。">f</SymbolHint> 推前得到；训练就是让 q ≈ p。</div>
      </div>
    </div>
  );
}

/** Scene: the drifting field V = V+ - V-, drag one generated sample. */
export function DriftField({ moduleId }: WidgetProps) {
  const data = useMemo(() => {
    const rng = seeded(61);
    return Array.from({ length: 14 }, () => ({ x: 0.56 + gaussOf(rng) * 0.11, y: 0.42 + gaussOf(rng) * 0.13 }));
  }, []);
  const neg = useMemo(() => {
    const rng = seeded(67);
    return Array.from({ length: 10 }, () => ({ x: 0.3 + gaussOf(rng) * 0.09, y: 0.65 + gaussOf(rng) * 0.1 }));
  }, []);
  const [focus, setFocus] = useState<P>({ x: 0.34, y: 0.6 });
  const [tau, setTau] = useState(0.35);
  const dragging = useRef(false);
  const toPx = (p: P) => ({ x: 90 + p.x * 700, y: 520 - p.y * 460 });
  const weights = (pool: P[], skip = -1) => {
    const ws = pool.map((p, i) => (i === skip ? 0 : Math.exp(-Math.hypot(p.x - focus.x, p.y - focus.y) / tau)));
    const z = ws.reduce((a, b) => a + b, 0) || 1;
    return ws.map(w => w / z);
  };
  const wp = weights(data);
  const negPool = neg.map((p, i) => (i === 0 ? focus : p));
  const wn = weights(negPool, 0);
  const mean = (pool: P[], ws: number[]) => pool.reduce((a, p, i) => ({ x: a.x + p.x * ws[i], y: a.y + p.y * ws[i] }), { x: 0, y: 0 });
  const mp = mean(data, wp);
  const mn = mean(negPool, wn);
  const vPlus = { x: mp.x - focus.x, y: mp.y - focus.y };
  const vMinus = { x: mn.x - focus.x, y: mn.y - focus.y };
  const v = { x: vPlus.x - vMinus.x, y: vPlus.y - vMinus.y };
  const k = 760;
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    const p = svgPoint(e, 900, 560);
    setFocus({
      x: clamp((p.x - 90) / 700, 0.04, 0.96),
      y: clamp((520 - p.y) / 460, 0.06, 0.95),
    });
  };
  const fp = toPx(focus);
  return (
    <div className="dk-page two">
      <div className="dk-scene">
        <svg viewBox="0 0 900 560" role="img" aria-label="拖动橙色羊，观察来自草地的吸引与来自同伴的排斥如何合成漂移向量"
          onPointerDown={e => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); onMove(e); }}
          onPointerMove={onMove} onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }}>
          <Hills w={900} h={560} />
          {data.map((p, i) => (
            <g key={`p${i}`}>
              <line x1={fp.x} y1={fp.y} x2={toPx(p).x} y2={toPx(p).y} stroke={PAL.blue} strokeWidth={1 + wp[i] * 8} opacity={0.08 + wp[i] * 0.5} />
              <Grass x={toPx(p).x} y={toPx(p).y} s={0.95} color={PAL.blue} />
            </g>
          ))}
          {negPool.map((p, i) => (
            <g key={`n${i}`}>
              <line x1={fp.x} y1={fp.y} x2={toPx(p).x} y2={toPx(p).y} stroke={PAL.orange} strokeWidth={1 + wn[i] * 8} opacity={0.08 + wn[i] * 0.45} />
              {i !== 0 && <Sheep x={toPx(p).x} y={toPx(p).y} s={0.62} color={PAL.orange} />}
            </g>
          ))}
          <Arrow x1={fp.x} y1={fp.y} x2={fp.x + vPlus.x * k} y2={fp.y - vPlus.y * k} color={PAL.blue} width={5} />
          <Arrow x1={fp.x} y1={fp.y} x2={fp.x - vMinus.x * k} y2={fp.y + vMinus.y * k} color={PAL.orange} width={5} dash="9 7" />
          <Arrow x1={fp.x} y1={fp.y} x2={fp.x + v.x * k} y2={fp.y - v.y * k} color={PAL.green} width={7} />
          <circle cx={fp.x} cy={fp.y} r={26} fill={PAL.green} opacity=".16" />
          <g style={{ cursor: 'grab' }} transform={`translate(${fp.x} ${fp.y})`}>
            <Sheep x={0} y={0} s={0.85} color={PAL.orange} outline={PAL.green} />
          </g>
          <text x="90" y="36" className="dk-svg-label">拖动这只羊（生成样本 x）</text>
          <text x="560" y="36" className="dk-svg-strong" fill={PAL.green}>‖V‖ = {Math.hypot(v.x, v.y).toFixed(3)}</text>
        </svg>
      </div>
      <div className="dk-stack">
        <Section title="吸引减排斥">
          <div className="dk-text" style={{ fontFamily: 'inherit' }}>
            <SymbolHint meaning="漂移向量 V：生成样本下一步的位移，由来自数据的吸引减去来自生成分布的排斥得到。">V</SymbolHint>(x) ={' '}
            <span style={{ color: PAL.blue, fontWeight: 700 }}><SymbolHint meaning="吸引项 V⁺：以核权重为平均，指向附近数据样本 y⁺ 的方向。">V⁺<sub>p</sub></SymbolHint>(x)</span> −{' '}
            <span style={{ color: PAL.orange, fontWeight: 700 }}><SymbolHint meaning="排斥项 V⁻：以核权重为平均，指向附近生成样本 y⁻ 的方向；减号让它变成推离。">V⁻<sub>q</sub></SymbolHint>(x)</span>
          </div>
          <div className="dk-note">V⁺ 指向草地加权中心，V⁻ 指向同伴加权中心。</div>
          <LegendDots items={[{ color: PAL.blue, label: '数据 y⁺' }, { color: PAL.orange, label: '生成 y⁻' }, { color: PAL.green, label: '漂移 V' }]} />
        </Section>
        <div>
          <input className="dk-slider" type="range" min={0.08} max={1.2} step={0.01} value={tau}
            aria-label="核函数温度" onChange={e => setTau(Number(e.target.value))} />
          <div className="dk-kv"><span><SymbolHint meaning="核温度 τ：控制「附近」有多远。τ 小则只被最近的一小撮样本影响。">τ</SymbolHint>（决定看多近）</span><b>{tau.toFixed(2)}</b></div>
          <div className="dk-kv"><span>吸引与排斥夹角</span><b>{Math.round(Math.acos(clamp((vPlus.x * vMinus.x + vPlus.y * vMinus.y) /
            ((Math.hypot(vPlus.x, vPlus.y) || 1) * (Math.hypot(vMinus.x, vMinus.y) || 1)), -1, 1)) * 180 / Math.PI)}°</b></div>
        </div>
        <Feedback tone={Math.hypot(v.x, v.y) < 0.04 ? 'ok' : 'info'}>
          {Math.hypot(v.x, v.y) < 0.04 ? '两股力量抵消：这只羊停在原地，说明 p 与 q 在它附近已经平衡。' :
            '← 羊同时被草地吸、被同伴推；两者相减就是它下一步要走的位移。'}
        </Feedback>
      </div>
    </div>
  );
}
