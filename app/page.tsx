'use client';

import { useMemo, useState } from 'react';

type ItemId = 'burning' | 'myth';
type OutcomeMode = 'random' | 'success' | 'fail';

type ItemState = {
  id: ItemId;
  name: string;
  kind: string;
  grade: string;
  tone: 'fire' | 'moon';
  level: number;
  material: string;
  materialShort: string;
  owned: number;
  luck: number;
  description: string;
};

type UpgradeLog = {
  id: number;
  item: string;
  from: number;
  success: boolean;
  chance: number;
};

const initialItems: ItemState[] = [
  {
    id: 'burning', name: '燃烧宝石', kind: '火焰系 · 攻击型', grade: '稀有', tone: 'fire', level: 5,
    material: '炽焰碎片', materialShort: '炽焰', owned: 12, luck: 0,
    description: '凝固了火焰精魄的宝石，强化后提升攻击与持续燃烧伤害。',
  },
  {
    id: 'myth', name: '星月神话', kind: '星辉系 · 加护型', grade: '史诗', tone: 'moon', level: 2,
    material: '星辉精华', materialShort: '星辉', owned: 8, luck: 0,
    description: '记录星轨与月相的古老信物，强化后提升生存与全系抵抗。',
  },
];

function getStats(item: ItemState) {
  if (item.id === 'burning') {
    return {
      power: 760 + item.level * 420,
      powerGain: 420,
      mainLabel: '燃烧伤害',
      mainCurrent: `+${item.level * 3 - 3}%`,
      mainNext: `+${item.level * 3}%`,
      secondLabel: '攻击',
      secondCurrent: `+${130 + item.level * 30}`,
      secondNext: `+${160 + item.level * 30}`,
      baseChance: Math.max(28, 103 - item.level * 5),
      need: Math.ceil(item.level / 2),
      coinCost: 1400 + item.level * 360,
    };
  }

  return {
    power: 720 + item.level * 610,
    powerGain: 610,
    mainLabel: '全系抵抗',
    mainCurrent: `+${10 + item.level * 3}`,
    mainNext: `+${13 + item.level * 3}`,
    secondLabel: '生命上限',
    secondCurrent: `+${180 + item.level * 120}`,
    secondNext: `+${300 + item.level * 120}`,
    baseChance: Math.max(25, 77 - item.level * 6),
    need: Math.max(2, item.level),
    coinCost: 3200 + item.level * 800,
  };
}

export default function Home() {
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState<ItemId>('burning');
  const [coins, setCoins] = useState(28600);
  const [crystals, setCrystals] = useState(320);
  const [protect, setProtect] = useState(false);
  const [mode, setMode] = useState<OutcomeMode>('random');
  const [logs, setLogs] = useState<UpgradeLog[]>([]);
  const [result, setResult] = useState<'success' | 'fail' | 'short' | null>(null);
  const [animating, setAnimating] = useState(false);
  const itemIndex = items.findIndex((entry) => entry.id === selectedId);
  const item = items[itemIndex];
  const stats = getStats(item);
  const chance = Math.min(100, stats.baseChance + item.luck + (protect ? 12 : 0));
  const canAfford = item.owned >= stats.need && coins >= stats.coinCost && (!protect || crystals >= 12) && item.level < 10;

  const progressTicks = useMemo(() => Array.from({ length: 10 }, (_, index) => index + 1), []);

  function changeItem(id: ItemId) {
    setSelectedId(id);
    setResult(null);
    setAnimating(false);
  }

  function runUpgrade() {
    if (animating) return;
    if (!canAfford) {
      setResult('short');
      return;
    }

    setResult(null);
    const success = mode === 'success' || (mode === 'random' && Math.random() * 100 < chance);
    const from = item.level;
    setAnimating(true);
    setCoins((value) => value - stats.coinCost);
    if (protect) setCrystals((value) => value - 12);
    setItems((current) => current.map((entry) => entry.id === item.id ? {
      ...entry,
      level: success ? entry.level + 1 : entry.level,
      owned: entry.owned - stats.need,
      luck: success ? 0 : Math.min(30, entry.luck + 8),
    } : entry));
    setLogs((current) => [{ id: Date.now(), item: item.name, from, success, chance }, ...current].slice(0, 4));

    window.setTimeout(() => {
      setAnimating(false);
      setResult(success ? 'success' : 'fail');
    }, 620);
  }

  function replenish() {
    setCoins((value) => value + 20000);
    setCrystals((value) => value + 100);
    setItems((current) => current.map((entry) => ({ ...entry, owned: entry.owned + 10 })));
    setResult(null);
  }

  function resetMock() {
    setItems(initialItems);
    setCoins(28600);
    setCrystals(320);
    setProtect(false);
    setMode('random');
    setLogs([]);
    setResult(null);
  }

  return (
    <main className={`game-shell ${item.tone}`}>
      <header className="topbar">
        <div className="brand">
          <span className="paw-mark">✶</span>
          <div><p className="eyebrow">MAO YOU JI · MOCK LAB</p><h1>道具工坊</h1></div>
        </div>
        <div className="wallet" aria-label="测试账户资源">
          <span><i className="coin" /> {coins.toLocaleString()}</span><span><i className="crystal" /> {crystals}</span>
          <button type="button" className="profile" aria-label="玩家信息">喵</button>
        </div>
      </header>

      <div className="workbench">
        <aside className="inventory-panel">
          <div className="panel-heading"><div><p className="eyebrow">当前背包</p><h2>可升级道具</h2></div><span className="counter">2 / 24</span></div>
          <div className="item-list">
            {items.map((entry) => (
              <button type="button" key={entry.id} className={`item-row ${selectedId === entry.id ? 'active' : ''}`} onClick={() => changeItem(entry.id)}>
                <span className={`mini-icon ${entry.tone}`} aria-hidden="true">{entry.tone === 'moon' && <span>☾</span>}</span>
                <span className="item-copy"><b>{entry.name}</b><small>Lv.{entry.level} · {entry.grade}</small></span>
                {entry.luck > 0 ? <span className="luck-dot">+{entry.luck}%</span> : <span className="chevron">›</span>}
              </button>
            ))}
          </div>

          <div className="test-settings">
            <div className="settings-title"><div><p className="eyebrow">QA CONTROLS</p><h3>测试设置</h3></div><button type="button" onClick={resetMock}>重置</button></div>
            <div className="mode-switch" aria-label="升级结果模式">
              {([['random', '概率'], ['success', '必成'], ['fail', '必败']] as const).map(([value, label]) => (
                <button type="button" key={value} className={mode === value ? 'active' : ''} onClick={() => setMode(value)}>{label}</button>
              ))}
            </div>
            <button type="button" className="replenish" onClick={replenish}><span>＋</span> 补充测试资源</button>
          </div>

          <div className="mock-note"><span>MOCK DATA</span><p>道具出处参考了玩家资料；数值、成功率与消耗为交互测试假设，不代表正式游戏设定。</p></div>
        </aside>

        <section className={`forge-stage ${animating ? 'is-forging' : ''} ${result === 'success' ? 'just-succeeded' : ''}`}>
          <div className="stage-grid" aria-hidden="true" /><div className="stage-orbit orbit-one" aria-hidden="true" /><div className="stage-orbit orbit-two" aria-hidden="true" />
          <div className="item-hero">
            <span className="rarity">{item.grade}</span>
            <div className={`artifact artifact-${item.tone}`} aria-label={item.name}>
              <span className="artifact-core">{item.tone === 'moon' ? '☾' : ''}</span><i className="spark spark-a" /><i className="spark spark-b" /><i className="spark spark-c" />
            </div>
            <p>{item.kind}</p><h2>{item.name}</h2><div className="level-chip">Lv. {item.level}</div>
            <p className="item-description">{item.description}</p>
          </div>
          <div className="level-path" aria-label={`当前等级 ${item.level}`}>
            {progressTicks.map((tick) => <span key={tick} className={tick <= item.level ? 'filled' : ''}>{tick}</span>)}
          </div>
          {animating && <div className="forge-flash" aria-live="polite"><span>强化中</span></div>}
        </section>

        <aside className="upgrade-panel">
          <div className="upgrade-title"><div><p className="eyebrow">属性预览</p><h2>{item.level >= 10 ? '已达当前满级' : `升级至 Lv.${item.level + 1}`}</h2></div><span className="mock-badge">TEST</span></div>
          <div className="power-card"><p>战力</p><strong>{stats.power.toLocaleString()}</strong><span>↑ +{stats.powerGain}</span></div>
          <div className="stat-compare">
            <div><small>{stats.mainLabel}</small><b>{stats.mainCurrent}</b></div><span className="arrow">→</span><div className="next-stat"><small>升级后</small><b>{stats.mainNext}</b></div>
          </div>
          <div className="secondary-stat"><span>{stats.secondLabel}</span><b>{stats.secondCurrent}</b><i>→</i><b>{stats.secondNext}</b></div>

          <div className="success-row"><span>本次成功率</span><b>{chance}%</b></div>
          <div className="chance-track"><span style={{ width: `${chance}%` }} /></div>
          <div className="chance-details"><span>基础 {stats.baseChance}%</span><span className={item.luck ? 'active' : ''}>祝福 +{item.luck}%</span><span className={protect ? 'active' : ''}>护符 +{protect ? 12 : 0}%</span></div>

          <label className="protect-row">
            <input type="checkbox" checked={protect} onChange={(event) => setProtect(event.target.checked)} />
            <span className="toggle" aria-hidden="true"><i /></span>
            <span><b>启用幸运护符</b><small>成功率 +12%</small></span>
            <em><i className="crystal" /> 12</em>
          </label>

          <div className="cost-card"><div className={`material-icon ${item.tone}`}>{item.tone === 'moon' ? '✦' : '◆'}</div><div><p>{item.material}</p><small>拥有 {item.owned}</small></div><b className={item.owned < stats.need ? 'insufficient' : ''}>{stats.need} / {item.owned}</b></div>
          <button type="button" className="upgrade-button" onClick={runUpgrade} disabled={animating || item.level >= 10}>
            <span>{item.level >= 10 ? '当前已满级' : animating ? '强化中…' : '升级一次'}</span><small><i className="coin" /> {stats.coinCost.toLocaleString()}</small>
          </button>
          <p className="failure-note">失败不掉级，获得 8% 祝福加成；成功后清空</p>

          <div className={`result-banner ${result ?? ''}`} role="status" aria-live="polite">
            {result === 'success' && <><span>✓</span><div><b>升级成功</b><small>{item.name} 已提升至 Lv.{item.level}</small></div></>}
            {result === 'fail' && <><span>×</span><div><b>升级失败</b><small>获得祝福 +8%，下次概率提升</small></div></>}
            {result === 'short' && <><span>!</span><div><b>资源不足</b><small>可在左侧补充测试资源</small></div></>}
          </div>
        </aside>
      </div>

      {logs.length > 0 && (
        <div className="history-popover">
          <div><p className="eyebrow">RECENT RUNS</p><b>最近模拟</b></div>
          {logs.map((log) => <span key={log.id} className={log.success ? 'success' : 'fail'}>{log.success ? '✓' : '×'} {log.item} +{log.from + 1} <small>{log.chance}%</small></span>)}
        </div>
      )}
    </main>
  );
}
