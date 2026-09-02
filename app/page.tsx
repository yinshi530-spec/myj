'use client';

import { useMemo, useState } from 'react';

type ItemId = 'burning' | 'myth';
type Rule = { success: number; stay: number; down: number };
type Attempt = {
  id: number;
  itemId: ItemId;
  itemName: string;
  from: number;
  to: number;
  roll: number;
  result: 'success' | 'stay' | 'down';
};

const itemData: Record<ItemId, {
  name: string;
  alias?: string;
  tone: 'fire' | 'moon';
  rules: Rule[];
}> = {
  burning: {
    name: '燃烧宝石',
    tone: 'fire',
    rules: [
      { success: 100, stay: 0, down: 0 },
      { success: 80, stay: 10, down: 10 },
      { success: 60, stay: 20, down: 20 },
      { success: 40, stay: 30, down: 30 },
      { success: 30, stay: 35, down: 35 },
      { success: 15, stay: 40, down: 45 },
      { success: 10, stay: 40, down: 50 },
      { success: 5, stay: 40, down: 55 },
      { success: 2, stay: 40, down: 58 },
      { success: 1, stay: 40, down: 59 },
    ],
  },
  myth: {
    name: '星月神话',
    alias: '星云沙',
    tone: 'moon',
    rules: [
      { success: 100, stay: 0, down: 0 },
      { success: 90, stay: 10, down: 0 },
      { success: 80, stay: 10, down: 10 },
      { success: 60, stay: 30, down: 10 },
      { success: 40, stay: 40, down: 20 },
      { success: 30, stay: 40, down: 30 },
      { success: 20, stay: 45, down: 35 },
      { success: 15, stay: 45, down: 40 },
      { success: 5, stay: 50, down: 45 },
      { success: 2, stay: 50, down: 48 },
    ],
  },
};

const initialLevels: Record<ItemId, number> = { burning: 0, myth: 0 };

function makeAttempt(itemId: ItemId, from: number, sequence: number): Attempt | null {
  if (from >= 10) return null;
  const item = itemData[itemId];
  const rule = item.rules[from];
  const roll = Math.random() * 100;
  let result: Attempt['result'];
  let to: number;

  if (roll < rule.success) {
    result = 'success';
    to = from + 1;
  } else if (roll < rule.success + rule.stay) {
    result = 'stay';
    to = from;
  } else {
    result = 'down';
    to = Math.max(0, from - 1);
  }

  return {
    id: Date.now() + sequence,
    itemId,
    itemName: item.name,
    from,
    to,
    roll: Number(roll.toFixed(2)),
    result,
  };
}

export default function Home() {
  const [selectedId, setSelectedId] = useState<ItemId>('burning');
  const [levels, setLevels] = useState(initialLevels);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [lastResult, setLastResult] = useState<Attempt | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const item = itemData[selectedId];
  const level = levels[selectedId];
  const rule = level < 10 ? item.rules[level] : null;

  const totals = useMemo(() => attempts.reduce((acc, attempt) => {
    acc[attempt.result] += 1;
    return acc;
  }, { success: 0, stay: 0, down: 0 }), [attempts]);

  function chooseItem(id: ItemId) {
    setSelectedId(id);
    setLastResult(null);
  }

  function setTestLevel(value: number) {
    setLevels((current) => ({ ...current, [selectedId]: value }));
    setLastResult(null);
  }

  function reinforce(times = 1) {
    if (isRolling || level >= 10) return;
    let currentLevel = level;
    const nextAttempts: Attempt[] = [];

    for (let index = 0; index < times; index += 1) {
      const attempt = makeAttempt(selectedId, currentLevel, index);
      if (!attempt) break;
      nextAttempts.push(attempt);
      currentLevel = attempt.to;
    }

    if (!nextAttempts.length) return;
    setIsRolling(true);
    window.setTimeout(() => {
      const latest = nextAttempts[nextAttempts.length - 1];
      setLevels((current) => ({ ...current, [selectedId]: currentLevel }));
      setAttempts((current) => [...nextAttempts.reverse(), ...current].slice(0, 50));
      setLastResult(latest);
      setIsRolling(false);
    }, times === 1 ? 520 : 760);
  }

  function resetAll() {
    setLevels(initialLevels);
    setAttempts([]);
    setLastResult(null);
    setIsRolling(false);
  }

  return (
    <main className="page-shell">
      <div className="official-backdrop" aria-hidden="true" />
      <section className="game-client" aria-label="猫游记道具强化测试窗口">
        <div className="client-topbar">
          <span className="top-plus">＋</span>
          <nav aria-label="游戏功能">
            <button type="button">[功能]</button><button type="button">[帮助]</button><button type="button">[音乐]</button><button type="button">[跳市]</button><button type="button">[道具]</button>
          </nav>
          <p>《猫游记》强化概率测试版</p>
          <span className="client-clock">MOCK 1.0</span>
        </div>

        <div className="world-header">
          <strong>拖把城·道具工坊</strong>
          <div className="world-tabs"><span>任务</span><span className="active">道具</span><span>宠物</span><span>公会</span></div>
          <div className="test-avatar"><span>喵</span><div><b>强化测试员</b><i>Lv 80</i></div></div>
          <div className="status-bars"><i><span style={{ width: '100%' }} /></i><i><span style={{ width: '76%' }} /></i></div>
        </div>

        <div className="client-body">
          <section className="upgrade-window">
            <header className="window-titlebar">
              <b>道具强化</b>
              <span>概率公示Ⅱ规则</span>
              <button type="button" aria-label="关闭窗口">×</button>
            </header>

            <div className="window-tabs"><button className="active" type="button">强化</button><button type="button" onClick={() => setShowRules((value) => !value)}>{showRules ? '返回' : '概率表'}</button></div>

            {showRules ? (
              <div className="rules-view">
                <div className="rules-caption"><b>{item.name}</b>{item.alias && <span>公示别名：{item.alias}</span>}</div>
                <div className="rule-table" role="table" aria-label={`${item.name}强化概率表`}>
                  <div className="table-row table-head" role="row"><span>当前</span><span>目标</span><span>成功</span><span>不变</span><span>降级</span></div>
                  {item.rules.map((entry, index) => (
                    <div key={index} className={`table-row ${index === level ? 'current' : ''}`} role="row">
                      <span>{index} 级</span><span>{index + 1} 级</span><span>{entry.success}%</span><span>{entry.stay}%</span><span>{entry.down}%</span>
                    </div>
                  ))}
                </div>
                <p className="official-note">※ 官方说明：强化概率每次均独立计算。</p>
              </div>
            ) : (
              <div className="upgrade-content">
                <aside className="item-chooser">
                  <p className="section-label">选择道具</p>
                  {(Object.keys(itemData) as ItemId[]).map((id) => {
                    const entry = itemData[id];
                    return (
                      <button key={id} type="button" className={`inventory-slot ${selectedId === id ? 'selected' : ''}`} onClick={() => chooseItem(id)}>
                        <span className={`pixel-item ${entry.tone}`} aria-hidden="true">{entry.tone === 'moon' ? '☾' : ''}</span>
                        <span><b>{entry.name}</b><small>强化 +{levels[id]}</small></span>
                      </button>
                    );
                  })}
                  <div className="empty-slots" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</div>
                </aside>

                <div className="forge-area">
                  <div className={`large-item ${item.tone} ${isRolling ? 'rolling' : ''}`} aria-label={item.name}><span>{item.tone === 'moon' ? '☾' : ''}</span></div>
                  <h1>{item.name}</h1>
                  {item.alias && <p className="item-alias">概率公示中与“{item.alias}”同组</p>}
                  <div className="level-display"><b>+{level}</b><span>→</span><b>+{Math.min(10, level + 1)}</b></div>

                  {rule ? (
                    <div className="outcome-preview">
                      <div className="success"><b>{rule.success}%</b><span>升级成功</span><small>+{level + 1}</small></div>
                      <div className="stay"><b>{rule.stay}%</b><span>保持不变</span><small>+{level}</small></div>
                      <div className="down"><b>{rule.down}%</b><span>强化降级</span><small>+{Math.max(0, level - 1)}</small></div>
                    </div>
                  ) : <div className="max-level">当前已达最高强化等级</div>}

                  <div className="forge-actions">
                    <button type="button" className="batch-button" onClick={() => reinforce(10)} disabled={isRolling || level >= 10}>10 次模拟</button>
                    <button type="button" className="forge-button" onClick={() => reinforce(1)} disabled={isRolling || level >= 10}>{isRolling ? '强化中…' : '开始强化'}</button>
                  </div>
                  <p className="calculation-note">每次使用当前等级对应的公示概率，独立随机计算。</p>
                </div>
              </div>
            )}

            {lastResult && !showRules && (
              <div className={`result-dialog ${lastResult.result}`} role="status" aria-live="polite">
                <b>{lastResult.result === 'success' ? '强化成功！' : lastResult.result === 'stay' ? '强化失败，等级保持不变' : '强化失败，等级下降'}</b>
                <span>+{lastResult.from} → +{lastResult.to}</span>
                <button type="button" onClick={() => setLastResult(null)}>确定</button>
              </div>
            )}
          </section>

          <aside className="message-panel">
            <div className="message-tabs"><span>队伍</span><span>好友</span><span>事件</span><span className="active">信息</span></div>
            <div className="system-copy">
              <p className="notice">《猫游记》强化概率测试</p>
              <p>已接入官方“概率公示Ⅱ”数据。</p>
              <p>本版仅复现等级变化，未加入官方页面没有说明的属性、材料或保底。</p>
            </div>
            <div className="log-list" aria-label="强化记录">
              {attempts.length === 0 ? <p className="empty-log">暂无强化记录</p> : attempts.slice(0, 12).map((attempt) => (
                <p key={attempt.id} className={attempt.result}>
                  <b>[系统]</b> {attempt.itemName} +{attempt.from} {attempt.result === 'success' ? '强化成功' : attempt.result === 'stay' ? '等级不变' : '强化降级'}
                  <small>R {attempt.roll.toFixed(2)}</small>
                </p>
              ))}
            </div>
          </aside>
        </div>

        <div className="client-bottom">
          <div className="hotbar" aria-hidden="true"><i className="hot health">＋</i><i className="hot fire">◆</i><i className="hot moon">☾</i>{Array.from({ length: 7 }, (_, index) => <i key={index} className="hot empty">{index + 4}</i>)}</div>
          <div className="qa-controls">
            <label>测试起始等级
              <select value={level} onChange={(event) => setTestLevel(Number(event.target.value))}>
                {Array.from({ length: 11 }, (_, index) => <option key={index} value={index}>+{index}</option>)}
              </select>
            </label>
            <button type="button" onClick={resetAll}>重置全部</button>
            <span>成功 {totals.success}</span><span>不变 {totals.stay}</span><span>降级 {totals.down}</span>
          </div>
        </div>

        <footer className="client-status">
          <span>MaoYouJi Upgrade Mock v1.0</span>
          <span>数据源：猫游记官方网站《概率公示Ⅱ》</span>
        </footer>
      </section>
    </main>
  );
}
