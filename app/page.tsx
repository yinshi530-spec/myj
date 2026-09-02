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
    <main className="server-page">
      <div className="server-shell">
        <section className="game-client" aria-label="猫游记碧空倾城游戏内强化测试">
          <header className="client-topbar">
            <span className="mop-mark">◆</span>
            <nav aria-label="猫游记功能栏">
              <button type="button">[功能]</button><button type="button">[帮助]</button><button type="button">[音乐]</button><button type="button">[跳市]</button><button type="button">[卡片]</button><button type="button">[邀请]</button><button type="button">[小游戏]</button><button type="button">[商店]</button>
            </nav>
            <p>强化测试 · 每次概率独立计算</p>
            <span>碧空倾城（双线）</span>
          </header>

          <div className="client-workspace">
            <section className="world-column" aria-label="游戏主场景">
              <div className="world-toolbar">
                <strong>碧空倾城</strong>
                <button type="button">地图</button><button type="button">移动</button><button type="button">刷新</button>
                <span className="mock-tag">MOCK 测试场景</span>
              </div>
              <div className="map-scene" aria-hidden="true">
                <div className="map-path path-a" /><div className="map-path path-b" />
                <div className="map-house house-a"><i /><b>道具店</b></div>
                <div className="map-house house-b"><i /><b>仓库</b></div>
                <div className="map-tree tree-a" /><div className="map-tree tree-b" /><div className="map-tree tree-c" />
                <span className="map-label label-a">强化测试入口</span><span className="map-label label-b">返回广场</span>
              </div>
              <div className="public-chat">
                <div><button type="button">世界</button><button type="button">区域</button></div>
                <p><b>[系统]</b> 当前为强化 Mock，不连接正式游戏账号与道具。</p>
              </div>
            </section>

            <aside className="info-column">
              <section className="pet-summary">
                <div className="pet-avatar" aria-hidden="true">猫</div>
                <div><b>强化测试</b><span>状态：在线</span><i><em /></i><i className="blue"><em /></i></div>
              </section>
              <div className="info-tabs"><button type="button">任务</button><button type="button">道具</button><button type="button">宠物</button><button type="button">工会</button></div>
              <section className="game-notice">
                <h2>游戏信息</h2>
                <p className="blue-text">猫游记强化概率测试版</p>
                <p>只模拟燃烧宝石与星月神话的等级变化。</p>
                <p className="red-text">未添加材料、金币、保底或属性数值。</p>
              </section>
              <section className="message-panel">
                <div className="message-tabs"><span>队伍</span><span>好友</span><span>事件</span><span className="active">信息</span></div>
                <div className="log-list" aria-label="强化记录">
                  {attempts.length === 0 ? <p className="empty-log">[系统] 暂无强化记录</p> : attempts.slice(0, 14).map((attempt) => (
                    <p key={attempt.id} className={attempt.result}>
                      <b>[系统]</b> {attempt.itemName} +{attempt.from} {attempt.result === 'success' ? '强化成功' : attempt.result === 'stay' ? '等级不变' : '强化降级'}
                      <small>随机值 {attempt.roll.toFixed(2)}</small>
                    </p>
                  ))}
                </div>
              </section>
            </aside>
          </div>

          <section className="upgrade-window" aria-label="道具强化窗口">
            <header className="window-titlebar">
              <b>道具</b><span>— 强化测试</span><button type="button" aria-label="关闭窗口">×</button>
            </header>
            <div className="window-tabs"><button className={!showRules ? 'active' : ''} type="button" onClick={() => setShowRules(false)}>强化</button><button className={showRules ? 'active' : ''} type="button" onClick={() => setShowRules(true)}>概率表</button></div>

            {showRules ? (
              <div className="rules-view">
                <div className="rules-caption"><b>{item.name}</b>{item.alias && <span>官方公示同组名称：{item.alias}</span>}</div>
                <div className="rule-table" role="table" aria-label={`${item.name}强化概率表`}>
                  <div className="table-row table-head" role="row"><span>当前</span><span>目标</span><span>成功</span><span>不变</span><span>降级</span></div>
                  {item.rules.map((entry, index) => (
                    <div key={index} className={`table-row ${index === level ? 'current' : ''}`} role="row">
                      <span>+{index}</span><span>+{index + 1}</span><span>{entry.success}%</span><span>{entry.stay}%</span><span>{entry.down}%</span>
                    </div>
                  ))}
                </div>
                <p className="official-note">※ 官方说明：强化概率每次均独立计算。</p>
              </div>
            ) : (
              <div className="upgrade-content">
                <aside className="item-chooser">
                  <p className="section-label">道具栏</p>
                  <div className="bag-grid">
                    {(Object.keys(itemData) as ItemId[]).map((id) => {
                      const entry = itemData[id];
                      return (
                        <button key={id} type="button" title={`${entry.name} +${levels[id]}`} className={`inventory-slot ${selectedId === id ? 'selected' : ''}`} onClick={() => chooseItem(id)}>
                          <span className={`pixel-item ${entry.tone}`} aria-hidden="true">{entry.tone === 'moon' ? '☾' : ''}</span>
                          <small>+{levels[id]}</small>
                        </button>
                      );
                    })}
                    {Array.from({ length: 10 }, (_, index) => <i key={index} className="empty-slot" />)}
                  </div>
                  <div className="selected-copy"><b>{item.name}</b><span>当前等级：+{level}</span>{item.alias && <small>公示同组：{item.alias}</small>}</div>
                </aside>

                <div className="forge-area">
                  <p className="forge-prompt">请选择要强化的道具</p>
                  <div className="forge-item-line">
                    <div className={`large-item ${item.tone} ${isRolling ? 'rolling' : ''}`} aria-label={item.name}><span>{item.tone === 'moon' ? '☾' : ''}</span></div>
                    <div><h1>{item.name}</h1><p>强化等级</p><div className="level-display"><b>+{level}</b><span>→</span><b>+{Math.min(10, level + 1)}</b></div></div>
                  </div>

                  {rule ? (
                    <div className="outcome-preview">
                      <p><span>强化成功</span><b className="success">{rule.success}%</b><small>等级变为 +{level + 1}</small></p>
                      <p><span>等级不变</span><b className="stay">{rule.stay}%</b><small>等级保持 +{level}</small></p>
                      <p><span>强化降级</span><b className="down">{rule.down}%</b><small>等级变为 +{Math.max(0, level - 1)}</small></p>
                    </div>
                  ) : <div className="max-level">当前已达最高强化等级 +10</div>}

                  <p className="calculation-note">本次使用 +{level} 对应公示概率，独立随机计算。</p>
                  <div className="forge-actions">
                    <button type="button" className="plain-button" onClick={() => reinforce(10)} disabled={isRolling || level >= 10}>连续测试10次</button>
                    <button type="button" className="forge-button" onClick={() => reinforce(1)} disabled={isRolling || level >= 10}>{isRolling ? '强化中…' : '开始强化'}</button>
                  </div>
                </div>
              </div>
            )}

            {lastResult && !showRules && (
              <div className={`result-dialog ${lastResult.result}`} role="status" aria-live="polite">
                <header>系统提示</header>
                <b>{lastResult.result === 'success' ? '强化成功！' : lastResult.result === 'stay' ? '强化失败，等级保持不变' : '强化失败，等级下降'}</b>
                <span>{lastResult.itemName} +{lastResult.from} → +{lastResult.to}</span>
                <button type="button" onClick={() => setLastResult(null)}>确定</button>
              </div>
            )}
          </section>

          <div className="client-bottom">
            <div className="chat-entry"><select aria-label="聊天频道"><option>区域</option></select><input aria-label="聊天输入框" /></div>
            <div className="hotbar" aria-hidden="true"><i className="hot health">＋</i><i className="hot fire">◆</i><i className="hot moon">☾</i>{Array.from({ length: 7 }, (_, index) => <i key={index} className="hot empty">{index + 4}</i>)}</div>
            <div className="function-buttons"><button type="button">任务</button><button type="button">道具</button><button type="button">宠物</button><button type="button">好友</button></div>
          </div>

          <footer className="test-console">
            <label>测试起始等级 <select value={level} onChange={(event) => setTestLevel(Number(event.target.value))}>{Array.from({ length: 11 }, (_, index) => <option key={index} value={index}>+{index}</option>)}</select></label>
            <button type="button" onClick={resetAll}>重置测试</button>
            <span>成功 {totals.success}</span><span>不变 {totals.stay}</span><span>降级 {totals.down}</span>
            <em>官方概率公示Ⅱ</em>
          </footer>
        </section>

        <div className="frame-gutter" aria-hidden="true" />
        <aside className="help-rail" aria-label="S93 页面帮助栏">
          <h2>在线帮助</h2>
          <button type="button">在线求助?</button><button type="button">用户反馈</button><button type="button">专区论坛</button><button type="button">官方网站</button>
          <b>防沉迷公告</b>
          <p>抵制不良游戏</p><p>拒绝盗版游戏</p><p>注意自我保护</p><p>谨防受骗上当</p><p>适度游戏益脑</p><p>沉迷游戏伤身</p><p>合理安排时间</p><p>享受健康生活</p>
        </aside>
      </div>
    </main>
  );
}
