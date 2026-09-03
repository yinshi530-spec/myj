'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

type OutcomeKind = 'success' | 'jump' | 'stay' | 'down' | 'fail' | 'protected' | 'draw';
type Mode = 'upgrade' | 'check' | 'draw' | 'adaptive';
type Category = '宝石与圣器' | '特殊强化' | '装备升阶' | '星级系统';

type Outcome = {
  key: string;
  label: string;
  probability: number;
  target: number | null;
  kind: OutcomeKind;
  note?: string;
};

type UpgradeRow = {
  current: number;
  target: number | null;
  outcomes: Outcome[];
};

type AdaptiveRow = {
  target: number;
  rates: [number, number, number, number];
  failureTo: number;
  failureNote?: string;
};

type DrawOption = { label: string; probability: number; note?: string };

type ProbabilityItem = {
  id: string;
  name: string;
  aliases?: string[];
  category: Category;
  mode: Mode;
  symbol: string;
  accent: string;
  accentSoft: string;
  description: string;
  sourceNote: string;
  minLevel?: number;
  maxLevel?: number;
  rows?: UpgradeRow[];
  adaptiveRows?: AdaptiveRow[];
  drawOptions?: DrawOption[];
};

type Attempt = {
  id: number;
  itemId: string;
  itemName: string;
  fromLabel: string;
  resultLabel: string;
  toLabel: string;
  probability: number;
  roll: number;
  kind: OutcomeKind;
  cost: number | null;
};

type ResultFeedback = {
  id: number;
  attempt: Attempt;
};

type StoredSession = {
  version: 1;
  costModel?: 'quantity-adjusted-v1' | 'quantity-adjusted-v2' | 'individual-items-v3';
  selectedId: string;
  levels: Record<string, number>;
  targetLevels: Record<string, number>;
  attemptCount: number;
  attempts: Attempt[];
  guardianProtection: boolean;
  costLedger: { knownSpend: number; pricedAttempts: number; itemSpend: Record<string, number> };
};

type GraduationItemSpend = {
  id: string;
  name: string;
  level: string;
  spend: number;
};

type GraduationSnapshot = {
  spend: number;
  itemSpends: GraduationItemSpend[];
  pricedAttempts: number;
  completedAt: string;
};

type AutoTargetRun = {
  itemId: string;
  target: number;
};

type ItemInstance = {
  id: string;
  item: ProbabilityItem;
  index: number;
  quantity: number;
  nickname: string;
};

const sessionStorageKey = 'myj-forge-session-v1';
const individualItemsCostModel = 'individual-items-v3' as const;
const autoTargetLimits: Record<string, number> = { 'burning-gem': 8, 'moon-myth': 9 };
const itemQuantities: Record<string, number> = {
  'crystal-ball': 5,
  'moon-myth': 5,
  'holy-gift': 5,
  'goddess-fate': 3,
  earring: 2,
};

const itemInstanceNames: Record<string, string[]> = {
  'crystal-ball': ['天青珠', '绯霞珠', '碧海珠', '紫宸珠', '曦金珠'],
  'moon-myth': ['金', '木', '水', '火', '土'],
  'holy-gift': ['青龙赐', '白虎赐', '朱雀赐', '玄武赐', '麒麟赐'],
  'goddess-fate': ['往昔', '今朝', '未来'],
  earring: ['玉凤环', '金凰环'],
};

function itemInstanceId(itemId: string, index = 0) {
  return (itemQuantities[itemId] ?? 1) > 1 ? `${itemId}:${index + 1}` : itemId;
}
const outcomeKinds: OutcomeKind[] = ['success', 'jump', 'stay', 'down', 'fail', 'protected', 'draw'];

function isStoredAttempt(value: unknown): value is Attempt {
  if (!value || typeof value !== 'object') return false;
  const attempt = value as Partial<Attempt>;
  return typeof attempt.id === 'number'
    && typeof attempt.itemId === 'string'
    && typeof attempt.itemName === 'string'
    && typeof attempt.fromLabel === 'string'
    && typeof attempt.resultLabel === 'string'
    && typeof attempt.toLabel === 'string'
    && typeof attempt.probability === 'number'
    && typeof attempt.roll === 'number'
    && typeof attempt.kind === 'string'
    && outcomeKinds.includes(attempt.kind as OutcomeKind)
    && (attempt.cost === null || typeof attempt.cost === 'number');
}

function roundedRectPath(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const corner = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + corner, y);
  context.lineTo(x + width - corner, y);
  context.quadraticCurveTo(x + width, y, x + width, y + corner);
  context.lineTo(x + width, y + height - corner);
  context.quadraticCurveTo(x + width, y + height, x + width - corner, y + height);
  context.lineTo(x + corner, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - corner);
  context.lineTo(x, y + corner);
  context.quadraticCurveTo(x, y, x + corner, y);
  context.closePath();
}

async function createGraduationPosterFile(snapshot: GraduationSnapshot) {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1440;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const background = context.createLinearGradient(0, 0, 1080, 1440);
  background.addColorStop(0, '#090d16');
  background.addColorStop(.5, '#11101e');
  background.addColorStop(1, '#080a10');
  context.fillStyle = background;
  context.fillRect(0, 0, 1080, 1440);

  const halo = context.createRadialGradient(540, 470, 20, 540, 470, 510);
  halo.addColorStop(0, 'rgba(180,124,255,.24)');
  halo.addColorStop(.45, 'rgba(255,108,53,.09)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = halo;
  context.fillRect(0, 0, 1080, 1020);

  for (let index = 0; index < 58; index += 1) {
    const x = 54 + ((index * 173) % 972);
    const y = 70 + ((index * 257) % 1210);
    const size = index % 7 === 0 ? 3 : index % 3 === 0 ? 2 : 1;
    context.globalAlpha = .18 + ((index * 13) % 48) / 100;
    context.fillStyle = index % 4 === 0 ? '#ffd699' : '#d8c7ff';
    context.fillRect(x, y, size, size);
  }
  context.globalAlpha = 1;

  roundedRectPath(context, 48, 48, 984, 1344, 28);
  context.strokeStyle = 'rgba(221,183,103,.56)';
  context.lineWidth = 2;
  context.stroke();
  roundedRectPath(context, 67, 67, 946, 1306, 22);
  context.strokeStyle = 'rgba(196,157,85,.18)';
  context.lineWidth = 1;
  context.stroke();

  context.textAlign = 'center';
  context.fillStyle = '#a98d5e';
  context.font = '600 24px ui-monospace, monospace';
  context.fillText('MYJ · BUILD GRADUATION', 540, 132);
  context.fillStyle = '#f0dfbc';
  context.font = '700 64px "Noto Serif SC", serif';
  context.fillText('极品号毕业照', 540, 222);
  context.fillStyle = '#746b80';
  context.font = '400 22px "Noto Serif SC", serif';
  context.fillText('燃烧宝石 +8 · 星月神话 +9 · 其余项目全 10', 540, 268);

  const drawStandard = (x: number, label: string, color: string) => {
    roundedRectPath(context, x, 294, 220, 48, 24);
    context.fillStyle = 'rgba(13,17,25,.82)';
    context.fill();
    context.strokeStyle = color;
    context.globalAlpha = .55;
    context.stroke();
    context.globalAlpha = 1;
    context.fillStyle = color;
    context.font = '600 19px "Noto Serif SC", serif';
    context.fillText(label, x + 110, 326);
  };
  drawStandard(180, '燃烧 +8  达成', '#ff7a32');
  drawStandard(430, '星月 +9  达成', '#b67cff');
  drawStandard(680, '其余全 10  达成', '#4ed08b');

  context.textAlign = 'left';
  context.fillStyle = '#a5906c';
  context.font = '600 25px "Noto Serif SC", serif';
  context.fillText('全部养成花费', 120, 392);
  context.textAlign = 'right';
  context.fillStyle = '#665d68';
  context.font = '500 19px ui-monospace, monospace';
  context.fillText(`${snapshot.itemSpends.length} ITEMS`, 960, 392);

  const spendColors = ['#4ed08b', '#55a8ff', '#b67cff', '#ff7a32'];
  const gridLeft = 120;
  const gridTop = 420;
  const cardWidth = 270;
  const cardHeight = 106;
  const columnGap = 15;
  const rowGap = 12;
  snapshot.itemSpends.forEach((entry, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = gridLeft + column * (cardWidth + columnGap);
    const y = gridTop + row * (cardHeight + rowGap);
    const color = entry.id === 'burning-gem' ? '#ff7a32' : entry.id === 'moon-myth' ? '#b67cff' : spendColors[index % spendColors.length];
    roundedRectPath(context, x, y, cardWidth, cardHeight, 14);
    context.fillStyle = 'rgba(10,14,21,.72)';
    context.fill();
    context.strokeStyle = color;
    context.globalAlpha = .25;
    context.stroke();
    context.globalAlpha = 1;
    context.textAlign = 'left';
    context.fillStyle = '#827887';
    context.font = '500 19px "Noto Serif SC", serif';
    context.fillText(entry.name, x + 17, y + 31, 155);
    context.fillStyle = color;
    context.font = '700 20px ui-monospace, monospace';
    context.fillText(entry.level, x + 215, y + 31, 42);
    context.fillStyle = '#e7d8bb';
    context.font = '700 27px ui-monospace, monospace';
    context.fillText(`¥${entry.spend.toFixed(2)}`, x + 17, y + 76, cardWidth - 34);
    context.fillStyle = '#514b55';
    context.font = '500 15px ui-monospace, monospace';
    context.fillText(String(index + 1).padStart(2, '0'), x + 226, y + 77);
  });

  context.textAlign = 'center';
  roundedRectPath(context, 120, 1138, 840, 157, 24);
  const costPanel = context.createLinearGradient(120, 1138, 960, 1295);
  costPanel.addColorStop(0, 'rgba(80,54,26,.52)');
  costPanel.addColorStop(.5, 'rgba(41,31,38,.92)');
  costPanel.addColorStop(1, 'rgba(50,34,72,.55)');
  context.fillStyle = costPanel;
  context.fill();
  context.strokeStyle = 'rgba(229,190,104,.5)';
  context.stroke();
  context.fillStyle = '#95846a';
  context.font = '500 21px "Noto Serif SC", serif';
  context.fillText('毕业总花费', 540, 1177);
  context.fillStyle = '#f4dfae';
  context.font = '700 47px "Noto Serif SC", serif';
  context.fillText(`花费 ¥${snapshot.spend.toFixed(2)} 毕业了`, 540, 1236);
  context.fillStyle = '#776d79';
  context.font = '400 18px "Noto Serif SC", serif';
  context.fillText(`累计计价 ${snapshot.pricedAttempts} 次 · 所有进度来自本地养成记录`, 540, 1273);

  context.fillStyle = '#82735e';
  context.font = '500 22px ui-monospace, monospace';
  context.fillText(snapshot.completedAt, 540, 1340);
  context.fillStyle = '#554e58';
  context.font = '500 18px ui-monospace, monospace';
  context.fillText('KEEP THE FIRE · FOLLOW THE MOON', 540, 1372);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  return blob ? new File([blob], `毕业照-${Date.now()}.png`, { type: 'image/png' }) : null;
}

function standardRows(rates: Array<[number, number, number]>): UpgradeRow[] {
  return rates.map(([success, stay, down], current) => ({
    current,
    target: current + 1,
    outcomes: [
      { key: 'success', label: '升级成功', probability: success, target: current + 1, kind: 'success' },
      { key: 'stay', label: '保持不变', probability: stay, target: current, kind: 'stay' },
      { key: 'down', label: '强化降级', probability: down, target: Math.max(0, current - 1), kind: 'down' },
    ].filter((entry) => entry.probability > 0),
  }));
}

function stayRows(start: number, rates: number[]): UpgradeRow[] {
  return rates.map((success, index) => {
    const current = start + index;
    return {
      current,
      target: current + 1,
      outcomes: [
        { key: 'success', label: '升级成功', probability: success, target: current + 1, kind: 'success' as const },
        { key: 'stay', label: '保持不变', probability: 100 - success, target: current, kind: 'stay' as const },
      ].filter((entry) => entry.probability > 0),
    };
  });
}

function checkpointRows(start: number, rates: number[], checkpoints: number[]): UpgradeRow[] {
  return rates.map((success, index) => {
    const current = start + index;
    const failureTo = checkpoints.reduce((floor, checkpoint) => checkpoint <= current ? checkpoint : floor, start);
    return {
      current,
      target: current + 1,
      outcomes: [
        { key: 'success', label: '升级成功', probability: success, target: current + 1, kind: 'success' as const },
        { key: 'fail', label: `强化失败 · 回到保级 +${failureTo}`, probability: 100 - success, target: failureTo, kind: 'fail' as const },
      ].filter((entry) => entry.probability > 0),
    };
  });
}

function isCheckpointLevel(itemId: string, level: number) {
  if (itemId === 'holy-gift') return [2, 4, 6, 8].includes(level);
  if (itemId === 'earring') return [4, 6, 8, 10, 13].includes(level);
  if (itemId === 'goddess-fate' || itemId === 'mophone' || itemId === 'wanxiang') return [4, 6, 8].includes(level);
  if (itemId === 'catalyst-stone' || itemId === 'mystic-talisman' || itemId === 'primordial-spirit') return [3, 6, 9].includes(level);
  return false;
}

function resetRows(start: number, rates: number[]): UpgradeRow[] {
  return rates.map((success, index) => {
    const current = start + index;
    return {
      current,
      target: current + 1,
      outcomes: [
        { key: 'success', label: '升级成功', probability: success, target: current + 1, kind: 'success' as const },
        { key: 'down', label: '升级失败 · 归 0', probability: 100 - success, target: 0, kind: 'down' as const },
      ].filter((entry) => entry.probability > 0),
    };
  });
}

function explicitRows(specs: Array<[number, number, number, number | null]>): UpgradeRow[] {
  return specs.map(([current, success, successTo, failureTo]) => ({
    current,
    target: successTo,
    outcomes: [
      { key: 'success', label: '升级成功', probability: success, target: successTo, kind: 'success' as const },
      { key: 'fail', label: '升级失败', probability: 100 - success, target: failureTo ?? current, kind: 'fail' as const },
    ].filter((entry) => entry.probability > 0),
  }));
}

function compassRows(): UpgradeRow[] {
  const rates: Array<[number, number, number, number]> = [
    [50, 50, 0, 0], [40, 20, 40, 0], [30, 10, 60, 0], [45, 10, 30, 15], [30, 1, 54, 15],
    [10, 5, 60, 25], [10, 1, 64, 25], [10, 1, 64, 25], [20, 0, 55, 25], [10, 0, 75, 15],
  ];
  return rates.map(([up, jump, stay, down], current) => ({
    current,
    target: current + 1,
    outcomes: [
      { key: 'success', label: '升级 +1', probability: up, target: current + 1, kind: 'success' as const },
      { key: 'jump', label: '跳级 +2', probability: jump, target: Math.min(10, current + 2), kind: 'jump' as const },
      { key: 'stay', label: '保持不变', probability: stay, target: current, kind: 'stay' as const },
      { key: 'down', label: '降级 -1', probability: down, target: Math.max(0, current - 1), kind: 'down' as const },
    ].filter((entry) => entry.probability > 0),
  }));
}

const items: ProbabilityItem[] = [
  {
    id: 'burning-gem', name: '燃烧宝石', category: '宝石与圣器', mode: 'upgrade', symbol: '◇', accent: '#ff6b35', accentSoft: '#401d1a',
    description: '经典的成功、不变、降级三结果强化。', sourceNote: '官方完整公布成功、不变与降级概率。', minLevel: 0, maxLevel: 10,
    rows: standardRows([[100, 0, 0], [80, 10, 10], [60, 20, 20], [40, 30, 30], [30, 35, 35], [15, 40, 45], [10, 40, 50], [5, 40, 55], [2, 40, 58], [1, 40, 59]]),
  },
  {
    id: 'annihilation-crown', name: '灭世之冠', category: '宝石与圣器', mode: 'upgrade', symbol: '♛', accent: '#b892ff', accentSoft: '#28172f',
    description: '失败时保持当前等级的十级强化。', sourceNote: '官方公布成功率与保持不变概率。', minLevel: 0, maxLevel: 10,
    rows: stayRows(0, [100, 80, 60, 40, 30, 20, 10, 5, 2, 1]),
  },
  {
    id: 'catalyst-stone', name: '催化神石', category: '宝石与圣器', mode: 'upgrade', symbol: '◆', accent: '#63e6c2', accentSoft: '#123c38',
    description: '每次升级 ¥3，+3、+6、+9 为保级点。', sourceNote: '逐级成功率沿用元神与神秘护符；失败时回到最近的 +3、+6、+9 保级等级。', minLevel: 0, maxLevel: 10,
    rows: checkpointRows(0, [100, 100, 90, 80, 50, 50, 30, 15, 10, 2], [0, 3, 6, 9]),
  },
  {
    id: 'crystal-ball', name: '水晶球', category: '宝石与圣器', mode: 'upgrade', symbol: '●', accent: '#65c7ff', accentSoft: '#153249',
    description: '共 5 个，每个独立强化，每次升级当前水晶球花费 ¥3。', sourceNote: '公示等级范围为 1→2 至 9→10，失败时保持当前等级。', minLevel: 1, maxLevel: 10,
    rows: stayRows(1, [100, 70, 50, 30, 20, 15, 10, 5, 1]),
  },
  {
    id: 'harmony-cup', name: '和谐圣杯', aliases: ['圣杯之环'], category: '宝石与圣器', mode: 'upgrade', symbol: '♜', accent: '#f3bd63', accentSoft: '#3b2b17',
    description: '强化失败时保持当前等级，不会掉级。', sourceNote: '成功率沿用公示；失败结果统一为保持当前等级。', minLevel: 1, maxLevel: 10,
    rows: stayRows(1, [100, 85, 70, 55, 40, 25, 15, 5, 1]),
  },
  {
    id: 'mystic-talisman', name: '神秘护符', category: '宝石与圣器', mode: 'upgrade', symbol: '✦', accent: '#5ddbb0', accentSoft: '#163c35',
    description: '+3、+6、+9 为保级点，失败回到最近保级等级。', sourceNote: '成功率沿用公示；失败回退规则按当前 Mock 设定。', minLevel: 0, maxLevel: 10,
    rows: checkpointRows(0, [100, 100, 90, 80, 50, 50, 30, 15, 10, 2], [0, 3, 6, 9]),
  },
  {
    id: 'guardian-star', name: '守护之星', category: '宝石与圣器', mode: 'upgrade', symbol: '✧', accent: '#73b7ff', accentSoft: '#19314c',
    description: '每次消耗 ¥2 升级道具，可追加 ¥8 保护避免失败归零。', sourceNote: '未保护时失败直接归 0；启用保护后，本次失败保持当前等级。', minLevel: 0, maxLevel: 10,
    rows: resetRows(0, [100, 90, 80, 60, 40, 20, 5, 3, 2, 1]),
  },
  {
    id: 'element-compass', name: '元素罗盘', category: '特殊强化', mode: 'upgrade', symbol: '✣', accent: '#47d7ac', accentSoft: '#123d38',
    description: '唯一包含 +2 跳级结果的四分支强化。', sourceNote: '升级 +1、跳级 +2、保持不变与降级 -1。', minLevel: 0, maxLevel: 10, rows: compassRows(),
  },
  {
    id: 'moon-myth', name: '星月神话', aliases: ['星云沙'], category: '宝石与圣器', mode: 'upgrade', symbol: '☾', accent: '#a78bfa', accentSoft: '#2a2148',
    description: '共 5 份，每份独立强化，每次升级当前星月神话花费 ¥5。', sourceNote: '与星云沙共用成功、不变、降级概率。', minLevel: 0, maxLevel: 10,
    rows: standardRows([[100, 0, 0], [90, 10, 0], [80, 10, 10], [60, 30, 10], [40, 40, 20], [30, 40, 30], [20, 45, 35], [15, 45, 40], [5, 50, 45], [2, 50, 48]]),
  },
  {
    id: 'holy-gift', name: '圣之赐', aliases: ['神圣之力'], category: '装备升阶', mode: 'upgrade', symbol: '✚', accent: '#f4d66f', accentSoft: '#40361b',
    description: '共 5 份，每份独立强化，¥5 / 次，+2、+4、+6、+8 为保级点。', sourceNote: '失败时回落到当前圣之赐最近的保级点。', minLevel: 0, maxLevel: 10,
    rows: explicitRows([[0,100,1,null],[1,100,2,null],[2,90,3,2],[3,80,4,2],[4,50,5,4],[5,50,6,4],[6,30,7,6],[7,15,8,6],[8,10,9,8],[9,2,10,8]]),
  },
  {
    id: 'primordial-spirit', name: '元神', category: '装备升阶', mode: 'upgrade', symbol: '◉', accent: '#79d9ff', accentSoft: '#173748',
    description: '+3、+6、+9 为保级点，失败回到最近保级等级。', sourceNote: '成功率沿用公示；失败回退规则按当前 Mock 设定。', minLevel: 0, maxLevel: 10,
    rows: checkpointRows(0, [100, 100, 90, 80, 50, 50, 30, 15, 10, 2], [0, 3, 6, 9]),
  },
  {
    id: 'mophone', name: 'Mophone', aliases: ['手机升级配件'], category: '装备升阶', mode: 'upgrade', symbol: '▣', accent: '#62d6ff', accentSoft: '#15364a',
    description: '+4、+6、+8 为保级点，失败回到最近保级等级。', sourceNote: '成功率沿用公示；失败回退规则按当前 Mock 设定。', minLevel: 0, maxLevel: 10,
    rows: checkpointRows(0, [100, 100, 90, 80, 25, 25, 50, 20, 15, 2], [0, 4, 6, 8]),
  },
  {
    id: 'goddess-fate', name: '命运女神', aliases: ['女神的祝福'], category: '装备升阶', mode: 'upgrade', symbol: '♢', accent: '#ff8fc5', accentSoft: '#421f36',
    description: '共 3 个，每个独立强化，¥8 / 次，+4、+6、+8 为保级点。', sourceNote: '失败时回落到当前命运女神最近的保级点。', minLevel: 0, maxLevel: 10,
    rows: checkpointRows(0, [100, 100, 100, 100, 25, 25, 70, 50, 20, 5], [0, 4, 6, 8]),
  },
  {
    id: 'earring', name: '耳环', category: '装备升阶', mode: 'upgrade', symbol: '◌', accent: '#cb9bff', accentSoft: '#312047',
    description: '共 2 个，每个独立强化，¥8 / 次，+4、+6、+8、+10、+13 为保级点。', sourceNote: '失败时回落到当前耳环最近的保级点。', minLevel: 0, maxLevel: 15,
    rows: checkpointRows(0, [100, 100, 100, 100, 25, 25, 70, 50, 20, 5, 100, 50, 30, 20, 5], [0, 4, 6, 8, 10, 13]),
  },
  {
    id: 'wanxiang', name: '万象图', category: '星级系统', mode: 'adaptive', symbol: '◎', accent: '#f8c55c', accentSoft: '#453417',
    description: '成功率随累计次数变化，4、6、8 星为保级点。', sourceNote: '次数区间沿用公示；失败回退到最近的 4、6、8 星保级点。', minLevel: 0, maxLevel: 10,
    adaptiveRows: [
      { target: 1, rates: [100, 100, 100, 100], failureTo: 1, failureNote: '不降级' }, { target: 2, rates: [100, 100, 100, 100], failureTo: 2, failureNote: '不降级' },
      { target: 3, rates: [70, 100, 100, 100], failureTo: 0 }, { target: 4, rates: [50, 100, 100, 100], failureTo: 0 },
      { target: 5, rates: [25, 50, 100, 100], failureTo: 4 }, { target: 6, rates: [25, 50, 70, 100], failureTo: 4 },
      { target: 7, rates: [1, 50, 70, 100], failureTo: 6 }, { target: 8, rates: [1, 15, 40, 60], failureTo: 6 },
      { target: 9, rates: [1, 3, 15, 40], failureTo: 8 }, { target: 10, rates: [1, 1, 5, 15], failureTo: 8 },
    ],
  },
];

const itemInstances: ItemInstance[] = items.flatMap((item) => {
  const quantity = itemQuantities[item.id] ?? 1;
  return Array.from({ length: quantity }, (_, index) => ({
    id: itemInstanceId(item.id, index),
    item,
    index,
    quantity,
    nickname: itemInstanceNames[item.id]?.[index] ?? `${index + 1}号`,
  }));
});

function itemInstanceName(instance: ItemInstance) {
  return instance.quantity > 1 ? `${instance.item.name} · ${instance.nickname}` : instance.item.name;
}

const autoTargetInstanceLimits: Record<string, number> = Object.fromEntries(
  itemInstances
    .filter((instance) => autoTargetLimits[instance.item.id] !== undefined)
    .map((instance) => [instance.id, autoTargetLimits[instance.item.id]]),
);

function bandIndex(count: number) {
  if (count <= 40) return 0;
  if (count <= 80) return 1;
  if (count <= 150) return 2;
  return 3;
}

function outcomeStyle(kind: OutcomeKind) {
  if (kind === 'success' || kind === 'jump') return 'positive';
  if (kind === 'down' || kind === 'fail') return 'negative';
  if (kind === 'draw') return 'drawn';
  return 'neutral';
}

function visualTier(entry: ProbabilityItem, current: number) {
  if (entry.mode === 'draw') return 0;
  const min = entry.minLevel ?? 0;
  const span = Math.max(1, (entry.maxLevel ?? min + 1) - min);
  return Math.min(5, Math.floor(((current - min) / span) * 5));
}

const tierNames = ['原初', '微光', '精炼', '星辉', '神话', '天穹'];

const effectProfiles: Record<string, { effect: string; rite: string; catalyst: string }> = {
  'burning-gem': { effect: 'flame', rite: '烈焰淬晶', catalyst: '炽炎之心' },
  'annihilation-crown': { effect: 'crown', rite: '灭世加冕', catalyst: '暗雷王印' },
  'catalyst-stone': { effect: 'catalyst', rite: '神石催化', catalyst: '源质反应核' },
  'crystal-ball': { effect: 'crystal', rite: '水晶共鸣', catalyst: '澄澈灵液' },
  'harmony-cup': { effect: 'chalice', rite: '圣杯灌注', catalyst: '和谐圣泉' },
  'mystic-talisman': { effect: 'talisman', rite: '敕令封印', catalyst: '灵符朱砂' },
  'guardian-star': { effect: 'guardian', rite: '星盾守护', catalyst: '守望星屑' },
  'element-compass': { effect: 'compass', rite: '元素跃迁', catalyst: '四象磁针' },
  'moon-myth': { effect: 'moon', rite: '星月蚀刻', catalyst: '星云砂砾' },
  'holy-gift': { effect: 'blessing', rite: '圣赐降临', catalyst: '神圣辉光' },
  'primordial-spirit': { effect: 'spirit', rite: '元神归一', catalyst: '太初魂息' },
  mophone: { effect: 'cyber', rite: '机芯超频', catalyst: '量子芯片' },
  'goddess-fate': { effect: 'fate', rite: '命运编织', catalyst: '女神丝线' },
  earring: { effect: 'earring', rite: '双环鸣奏', catalyst: '月银铃音' },
  wanxiang: { effect: 'constellation', rite: '万象演星', catalyst: '天机星轨' },
};

const costRules: Record<string, number> = {
  'burning-gem': 3,
  'annihilation-crown': 5,
  'catalyst-stone': 3,
  'crystal-ball': 3,
  'harmony-cup': 2,
  'mystic-talisman': 2,
  'element-compass': 5,
  'moon-myth': 5,
  'holy-gift': 5,
  'primordial-spirit': 5,
  mophone: 8,
  'guardian-star': 2,
  'goddess-fate': 8,
  earring: 8,
  wanxiang: 8,
};

const instantUpgradeItems = new Set(['burning-gem', 'annihilation-crown', 'catalyst-stone', 'crystal-ball', 'harmony-cup', 'mystic-talisman', 'element-compass', 'moon-myth', 'holy-gift', 'primordial-spirit', 'mophone', 'guardian-star', 'goddess-fate', 'earring', 'wanxiang']);
const guardianProtectionCost = 8;

const levelPalettes = {
  neutral: { accent: '#9b9386', soft: '#292622' },
  green: { accent: '#4ed08b', soft: '#143a2a' },
  blue: { accent: '#55a8ff', soft: '#152f4d' },
  purple: { accent: '#b67cff', soft: '#321d4c' },
  ultimate: { accent: '#ff7a32', soft: '#4a2415' },
};

function levelPalette(item: ProbabilityItem, level: number) {
  if (item.mode === 'draw') return { accent: item.accent, soft: item.accentSoft };
  if (level >= 10) return levelPalettes.ultimate;
  if (level >= 7) return levelPalettes.purple;
  if (level >= 4) return levelPalettes.blue;
  if (level >= 1) return levelPalettes.green;
  return levelPalettes.neutral;
}

export default function Home() {
  const initialLevels = useMemo(() => Object.fromEntries(itemInstances.filter((instance) => instance.item.mode !== 'draw').map((instance) => [instance.id, instance.item.minLevel ?? 0])), []);
  const [selectedId, setSelectedId] = useState(itemInstances[0].id);
  const [levels, setLevels] = useState<Record<string, number>>(initialLevels);
  const [targetLevels, setTargetLevels] = useState<Record<string, number>>({ ...autoTargetInstanceLimits });
  const [autoTargetRun, setAutoTargetRun] = useState<AutoTargetRun | null>(null);
  const [attemptCount, setAttemptCount] = useState(1);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [isRolling, setIsRolling] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<Attempt | null>(null);
  const [resultFeedbacks, setResultFeedbacks] = useState<ResultFeedback[]>([]);
  const feedbackSequence = useRef(0);
  const pendingForgeTimer = useRef<number | null>(null);
  const autoTargetTimer = useRef<number | null>(null);
  const autoTargetTick = useRef<() => void>(() => undefined);
  const [guardianProtection, setGuardianProtection] = useState(false);
  const [costLedger, setCostLedger] = useState({ knownSpend: 0, pricedAttempts: 0, itemSpend: {} as Record<string, number> });
  const [hasHydrated, setHasHydrated] = useState(false);
  const [costDetailsOpen, setCostDetailsOpen] = useState(false);
  const [graduationPosterOpen, setGraduationPosterOpen] = useState(false);
  const [graduationSnapshot, setGraduationSnapshot] = useState<GraduationSnapshot | null>(null);
  const [posterStatus, setPosterStatus] = useState<'rendering' | 'ready' | 'shared' | 'saved' | 'error'>('rendering');
  const graduationPosterFile = useRef<File | null>(null);
  const posterBuildSequence = useRef(0);

  useEffect(() => {
    try {
      const rawSession = window.localStorage.getItem(sessionStorageKey);
      if (!rawSession) return;
      const stored = JSON.parse(rawSession) as Partial<StoredSession>;
      if (stored.version !== 1) return;
      const quantityMigrationMultiplier = (itemId: string) => {
        if (stored.costModel === individualItemsCostModel || stored.costModel === 'quantity-adjusted-v2') return 1;
        if (stored.costModel === 'quantity-adjusted-v1') return itemId === 'holy-gift' ? 5 : 1;
        return itemQuantities[itemId] ?? 1;
      };
      const restoredAttempts = Array.isArray(stored.attempts)
        ? stored.attempts.filter(isStoredAttempt).slice(0, 120).map((attempt) => {
          const multiplier = quantityMigrationMultiplier(attempt.itemId);
          if (multiplier === 1 || attempt.cost === null) return attempt;
          return { ...attempt, cost: attempt.cost * multiplier };
        })
        : [];

      if (typeof stored.selectedId === 'string') {
        if (itemInstances.some((instance) => instance.id === stored.selectedId)) {
          setSelectedId(stored.selectedId);
        } else if (items.some((entry) => entry.id === stored.selectedId)) {
          setSelectedId(itemInstanceId(stored.selectedId));
        }
      }
      if (stored.levels && typeof stored.levels === 'object') {
        const restoredLevels = { ...initialLevels };
        itemInstances.filter((instance) => instance.item.mode !== 'draw').forEach((instance) => {
          const entry = instance.item;
          const storedLevel = stored.levels?.[instance.id] ?? stored.levels?.[entry.id];
          if (typeof storedLevel !== 'number' || !Number.isFinite(storedLevel)) return;
          restoredLevels[instance.id] = Math.min(entry.maxLevel ?? storedLevel, Math.max(entry.minLevel ?? 0, Math.floor(storedLevel)));
        });
        setLevels(restoredLevels);
      }
      if (stored.targetLevels && typeof stored.targetLevels === 'object') {
        const restoredTargets = { ...autoTargetInstanceLimits };
        Object.entries(autoTargetInstanceLimits).forEach(([instanceId, limit]) => {
          const baseItemId = itemInstances.find((instance) => instance.id === instanceId)?.item.id ?? instanceId;
          const storedTarget = stored.targetLevels?.[instanceId] ?? stored.targetLevels?.[baseItemId];
          if (typeof storedTarget !== 'number' || !Number.isFinite(storedTarget)) return;
          restoredTargets[instanceId] = Math.min(limit, Math.max(1, Math.floor(storedTarget)));
        });
        setTargetLevels(restoredTargets);
      }
      if (typeof stored.attemptCount === 'number' && Number.isFinite(stored.attemptCount)) {
        setAttemptCount(Math.min(9999, Math.max(1, Math.floor(stored.attemptCount))));
      }
      if (Array.isArray(stored.attempts)) {
        setAttempts(restoredAttempts);
      }
      if (typeof stored.guardianProtection === 'boolean') {
        setGuardianProtection(stored.guardianProtection);
      }
      if (stored.costLedger
        && typeof stored.costLedger.knownSpend === 'number'
        && Number.isFinite(stored.costLedger.knownSpend)
        && typeof stored.costLedger.pricedAttempts === 'number'
        && Number.isFinite(stored.costLedger.pricedAttempts)) {
        const itemSpend: Record<string, number> = {};
        if (stored.costLedger.itemSpend && typeof stored.costLedger.itemSpend === 'object') {
          Object.entries(stored.costLedger.itemSpend).forEach(([itemId, spend]) => {
            if (typeof spend === 'number' && Number.isFinite(spend) && spend >= 0) itemSpend[itemId] = spend;
          });
        } else if (Array.isArray(stored.attempts)) {
          stored.attempts.filter(isStoredAttempt).forEach((attempt) => {
            itemSpend[attempt.itemId] = (itemSpend[attempt.itemId] ?? 0) + (attempt.cost ?? 0);
          });
        }
        let knownSpend = Math.max(0, stored.costLedger.knownSpend);
        Object.entries(itemSpend).forEach(([itemId, spend]) => {
          const multiplier = quantityMigrationMultiplier(itemId);
          if (multiplier === 1) return;
          itemSpend[itemId] = spend * multiplier;
          knownSpend += spend * (multiplier - 1);
        });
        const separatedItemSpend: Record<string, number> = {};
        Object.entries(itemSpend).forEach(([itemId, spend]) => {
          const quantity = itemQuantities[itemId] ?? 1;
          if (quantity > 1 && !itemId.includes(':')) {
            for (let index = 0; index < quantity; index += 1) {
              const instanceId = itemInstanceId(itemId, index);
              separatedItemSpend[instanceId] = (separatedItemSpend[instanceId] ?? 0) + (spend / quantity);
            }
            return;
          }
          separatedItemSpend[itemId] = (separatedItemSpend[itemId] ?? 0) + spend;
        });
        setCostLedger({
          knownSpend,
          pricedAttempts: Math.max(0, Math.floor(stored.costLedger.pricedAttempts)),
          itemSpend: separatedItemSpend,
        });
      }
    } catch (error) {
      console.warn('本地养成进度恢复失败:', error);
    } finally {
      setHasHydrated(true);
    }
  }, [initialLevels]);

  useEffect(() => {
    if (!hasHydrated) return;
    const stored: StoredSession = {
      version: 1,
      costModel: individualItemsCostModel,
      selectedId,
      levels,
      targetLevels,
      attemptCount,
      attempts,
      guardianProtection,
      costLedger,
    };
    try {
      window.localStorage.setItem(sessionStorageKey, JSON.stringify(stored));
    } catch (error) {
      console.warn('本地养成进度保存失败:', error);
    }
  }, [attemptCount, attempts, costLedger, guardianProtection, hasHydrated, levels, selectedId, targetLevels]);

  useEffect(() => () => {
    if (pendingForgeTimer.current !== null) window.clearTimeout(pendingForgeTimer.current);
    if (autoTargetTimer.current !== null) window.clearTimeout(autoTargetTimer.current);
  }, []);

  useEffect(() => {
    if (!graduationPosterOpen && !costDetailsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setGraduationPosterOpen(false);
      setCostDetailsOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [costDetailsOpen, graduationPosterOpen]);

  const selectedInstance = itemInstances.find((instance) => instance.id === selectedId) ?? itemInstances[0];
  const item = selectedInstance.item;
  const itemKey = selectedInstance.id;
  const itemInstanceNumber = selectedInstance.index + 1;
  const level = levels[itemKey] ?? item.minLevel ?? 0;
  const currentRow = item.rows?.find((row) => row.current === level);
  const adaptiveRow = level >= (item.maxLevel ?? 10)
    ? undefined
    : item.adaptiveRows?.find((row) => row.target === level + 1);

  const totals = useMemo(() => attempts.reduce((acc, attempt) => {
    acc.total += 1;
    if (attempt.kind === 'success' || attempt.kind === 'jump') acc.success += 1;
    if (attempt.kind === 'down' || attempt.kind === 'fail' || attempt.kind === 'protected') acc.risk += 1;
    return acc;
  }, { total: 0, success: 0, risk: 0 }), [attempts]);

  const accountProgress = useMemo(() => {
    const progress = itemInstances.map((instance) => {
      const entry = instance.item;
      const min = entry.minLevel ?? 0;
      const max = entry.maxLevel ?? min + 1;
      return ((levels[instance.id] ?? min) - min) / Math.max(1, max - min);
    });
    return Math.round((progress.reduce((sum, value) => sum + value, 0) / progress.length) * 100);
  }, [levels]);

  const completedItems = useMemo(() => itemInstances.filter((instance) => (levels[instance.id] ?? instance.item.minLevel ?? 0) >= (instance.item.maxLevel ?? 1)).length, [levels]);
  const burningGraduated = itemInstances
    .filter((instance) => instance.item.id === 'burning-gem')
    .every((instance) => (levels[instance.id] ?? 0) >= 8);
  const moonGraduated = itemInstances
    .filter((instance) => instance.item.id === 'moon-myth')
    .every((instance) => (levels[instance.id] ?? 0) >= 9);
  const otherItemsGraduated = itemInstances
    .filter((instance) => instance.item.id !== 'burning-gem' && instance.item.id !== 'moon-myth')
    .every((instance) => (levels[instance.id] ?? instance.item.minLevel ?? 0) >= Math.min(10, instance.item.maxLevel ?? 10));
  const graduationReady = burningGraduated && moonGraduated && otherItemsGraduated;
  const costDetailItems = itemInstances.map((instance) => {
    const entry = instance.item;
    const currentLevel = levels[instance.id] ?? entry.minLevel ?? 0;
    const unitCost = costRules[entry.id] ?? null;
    return {
      id: instance.id,
      baseItemId: entry.id,
      name: itemInstanceName(instance),
      level: entry.mode === 'adaptive' ? `${currentLevel}★` : `+${currentLevel}`,
      unitCost,
      attemptCost: unitCost,
      spend: costLedger.itemSpend[instance.id] ?? 0,
    };
  });
  const categorizedCost = costDetailItems.reduce((sum, entry) => sum + entry.spend, 0);
  const uncategorizedCost = Math.max(0, costLedger.knownSpend - categorizedCost);
  const autoTargetLimit = autoTargetInstanceLimits[itemKey] ?? null;
  const targetLevel = autoTargetLimit === null ? null : Math.min(autoTargetLimit, Math.max(1, targetLevels[itemKey] ?? autoTargetLimit));
  const isAutoTargetRunning = autoTargetRun?.itemId === itemKey;

  const outcomes = useMemo(() => {
    if (item.mode === 'draw') return (item.drawOptions ?? []).map((option) => ({ key: option.label, label: option.label, probability: option.probability, target: null, kind: 'draw' as const }));
    if (item.mode === 'adaptive' && adaptiveRow) {
      const success = adaptiveRow.rates[bandIndex(attemptCount)];
      return [
        { key: 'success', label: `升至 ${adaptiveRow.target} 星`, probability: success, target: adaptiveRow.target, kind: 'success' as const },
        { key: 'fail', label: `失败后 ${adaptiveRow.failureTo} 星`, probability: 100 - success, target: adaptiveRow.failureTo, kind: 'fail' as const },
      ].filter((entry) => entry.probability > 0);
    }
    return currentRow?.outcomes ?? [];
  }, [adaptiveRow, attemptCount, currentRow, item]);

  function chooseItem(next: ItemInstance) {
    stopAutoTargetRun();
    setSelectedId(next.id);
    setLastAttempt(null);
    setResultFeedbacks([]);
  }

  function createAttempt(activeItem: ProbabilityItem, activeItemKey: string, activeInstanceName: string, currentLevel: number, count: number, sequence: number) {
    let available: Outcome[] = [];
    let fromLabel = activeItem.mode === 'draw' ? '触发' : `+${currentLevel}`;

    if (activeItem.mode === 'draw') {
      available = (activeItem.drawOptions ?? []).map((option) => ({ key: option.label, label: option.label, probability: option.probability, target: null, kind: 'draw' }));
    } else if (activeItem.mode === 'adaptive') {
      if (currentLevel >= (activeItem.maxLevel ?? 10)) return null;
      const rule = activeItem.adaptiveRows?.find((entry) => entry.target === currentLevel + 1);
      if (!rule) return null;
      const success = rule.rates[bandIndex(count)];
      available = [
        { key: 'success', label: '升级成功', probability: success, target: rule.target, kind: 'success' },
        { key: 'fail', label: '升级失败', probability: 100 - success, target: rule.failureTo, kind: 'fail', note: rule.failureNote },
      ].filter((entry) => entry.probability > 0);
      fromLabel = `${currentLevel} 星 · 第 ${count} 次`;
    } else {
      const rule = activeItem.rows?.find((entry) => entry.current === currentLevel);
      if (!rule) return null;
      available = rule.outcomes;
    }

    const roll = Math.random() * 100;
    let threshold = 0;
    const picked = available.find((entry) => {
      threshold += entry.probability;
      return roll < threshold;
    }) ?? available[available.length - 1];
    if (!picked) return null;

    const protectionEnabled = activeItem.id === 'guardian-star' && guardianProtection;
    const protectionTriggered = protectionEnabled && (picked.kind === 'down' || picked.kind === 'fail');
    const nextLevel = protectionTriggered ? currentLevel : picked.target ?? currentLevel;
    const baseCost = costRules[activeItem.id];
    const attempt: Attempt = {
      id: Date.now() + sequence,
      itemId: activeItemKey,
      itemName: activeInstanceName,
      fromLabel,
      resultLabel: protectionTriggered ? '保护生效 · 保持等级' : picked.label,
      toLabel: activeItem.mode === 'draw' ? picked.label : activeItem.mode === 'adaptive' ? `${nextLevel} 星` : `+${nextLevel}`,
      probability: picked.probability,
      roll: Number(roll.toFixed(2)),
      kind: protectionTriggered ? 'protected' : picked.kind,
      cost: baseCost === undefined ? null : baseCost + (protectionEnabled ? guardianProtectionCost : 0),
    };
    return { attempt, nextLevel };
  }

  function simulate(times: number, forceInstant = false) {
    if (isRolling) return;
    let currentLevel = level;
    let currentCount = attemptCount;
    const generated: Attempt[] = [];
    for (let index = 0; index < times; index += 1) {
      const result = createAttempt(item, itemKey, itemInstanceName(selectedInstance), currentLevel, currentCount, index);
      if (!result) break;
      generated.push(result.attempt);
      if (item.mode === 'upgrade' || item.mode === 'adaptive') currentLevel = result.nextLevel;
      if (item.mode === 'adaptive') currentCount += 1;
    }
    if (!generated.length) return;
    const applyResults = () => {
      pendingForgeTimer.current = null;
      const latestAttempts = [...generated].reverse();
      if (item.mode === 'upgrade' || item.mode === 'adaptive') setLevels((current) => ({ ...current, [itemKey]: currentLevel }));
      if (item.mode === 'adaptive') setAttemptCount(currentCount);
      const generatedSpend = generated.reduce((sum, attempt) => sum + (attempt.cost ?? 0), 0);
      setCostLedger((current) => ({
        knownSpend: current.knownSpend + generatedSpend,
        pricedAttempts: current.pricedAttempts + generated.filter((attempt) => attempt.cost !== null).length,
        itemSpend: { ...current.itemSpend, [itemKey]: (current.itemSpend[itemKey] ?? 0) + generatedSpend },
      }));
      setAttempts((current) => [...latestAttempts, ...current].slice(0, 120));
      const latestAttempt = latestAttempts[0];
      const feedback = { id: feedbackSequence.current += 1, attempt: latestAttempt };
      setLastAttempt(latestAttempt);
      setResultFeedbacks((current) => [...current, feedback].slice(-4));
      window.setTimeout(() => {
        setResultFeedbacks((current) => current.filter((entry) => entry.id !== feedback.id));
      }, 1600);
      setIsRolling(false);
    };

    if (forceInstant || instantUpgradeItems.has(item.id)) {
      applyResults();
      return;
    }

    setIsRolling(true);
    const feedbackDelay = times === 1 ? 920 : 1280;
    pendingForgeTimer.current = window.setTimeout(applyResults, feedbackDelay);
  }

  function stopAutoTargetRun() {
    if (autoTargetTimer.current !== null) {
      window.clearTimeout(autoTargetTimer.current);
      autoTargetTimer.current = null;
    }
    setAutoTargetRun(null);
  }

  function toggleAutoTargetRun() {
    if (isAutoTargetRunning) {
      stopAutoTargetRun();
      return;
    }
    if (targetLevel === null || level >= targetLevel || isRolling) return;
    setAutoTargetRun({ itemId: itemKey, target: targetLevel });
    simulate(1, true);
  }

  autoTargetTick.current = () => simulate(1, true);

  useEffect(() => {
    if (!autoTargetRun) return;
    const limit = autoTargetInstanceLimits[autoTargetRun.itemId];
    const currentLevel = levels[autoTargetRun.itemId] ?? 0;
    const safeTarget = Math.min(limit ?? autoTargetRun.target, autoTargetRun.target);
    if (selectedId !== autoTargetRun.itemId || limit === undefined || currentLevel >= safeTarget) {
      setAutoTargetRun(null);
      return;
    }
    autoTargetTimer.current = window.setTimeout(() => {
      autoTargetTimer.current = null;
      autoTargetTick.current();
    }, 200);
    return () => {
      if (autoTargetTimer.current !== null) {
        window.clearTimeout(autoTargetTimer.current);
        autoTargetTimer.current = null;
      }
    };
  }, [autoTargetRun, levels, selectedId]);

  function saveGraduationPosterFile(file: File) {
    const objectUrl = window.URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = file.name;
    link.click();
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
    setPosterStatus('saved');
  }

  function openGraduationPoster() {
    if (!graduationReady) return;
    const itemSpends: GraduationItemSpend[] = items.map((entry) => {
      const instances = itemInstances.filter((instance) => instance.item.id === entry.id);
      const currentLevels = instances.map((instance) => levels[instance.id] ?? entry.minLevel ?? 0);
      const lowestLevel = Math.min(...currentLevels);
      const highestLevel = Math.max(...currentLevels);
      const levelPrefix = entry.mode === 'adaptive' ? '' : '+';
      const levelSuffix = entry.mode === 'adaptive' ? '★' : '';
      const level = lowestLevel === highestLevel
        ? `${levelPrefix}${lowestLevel}${levelSuffix}${instances.length > 1 ? ` ×${instances.length}` : ''}`
        : `${levelPrefix}${lowestLevel}–${levelPrefix}${highestLevel}${levelSuffix}`;
      return {
        id: entry.id,
        name: instances.length > 1 ? `${entry.name} ×${instances.length}` : entry.name,
        level,
        spend: instances.reduce((sum, instance) => sum + (costLedger.itemSpend[instance.id] ?? 0), 0),
      };
    });
    const recordedItemSpend = itemInstances.reduce((sum, instance) => sum + (costLedger.itemSpend[instance.id] ?? 0), 0);
    const historicalSpend = Math.max(0, costLedger.knownSpend - recordedItemSpend);
    if (historicalSpend >= .01) {
      itemSpends.push({ id: 'legacy-history', name: '历史记录', level: '—', spend: historicalSpend });
    }
    const snapshot: GraduationSnapshot = {
      spend: itemSpends.reduce((sum, entry) => sum + entry.spend, 0),
      itemSpends,
      pricedAttempts: costLedger.pricedAttempts,
      completedAt: new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(new Date()),
    };
    const buildId = posterBuildSequence.current += 1;
    graduationPosterFile.current = null;
    setGraduationSnapshot(snapshot);
    setPosterStatus('rendering');
    setGraduationPosterOpen(true);
    void createGraduationPosterFile(snapshot).then((file) => {
      if (posterBuildSequence.current !== buildId) return;
      graduationPosterFile.current = file;
      setPosterStatus(file ? 'ready' : 'error');
    }).catch(() => {
      if (posterBuildSequence.current === buildId) setPosterStatus('error');
    });
  }

  function shareGraduationPoster() {
    if (!graduationSnapshot) return;
    const file = graduationPosterFile.current;
    const shareText = `花费 ¥${graduationSnapshot.spend.toFixed(2)} 毕业了！燃烧宝石 +8，星月神话 +9，其余项目全 10。`;
    if (navigator.share) {
      const canShareFile = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
      const shareData: ShareData = canShareFile
        ? { title: '我的毕业照', text: shareText, files: [file] }
        : { title: '我的毕业照', text: shareText };
      void navigator.share(shareData).then(() => setPosterStatus('shared')).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (file) saveGraduationPosterFile(file);
        else setPosterStatus('error');
      });
      return;
    }
    if (file) {
      saveGraduationPosterFile(file);
      return;
    }
    void navigator.clipboard?.writeText(shareText).then(() => setPosterStatus('shared')).catch(() => setPosterStatus('error'));
  }

  function restartSession() {
    stopAutoTargetRun();
    if (pendingForgeTimer.current !== null) {
      window.clearTimeout(pendingForgeTimer.current);
      pendingForgeTimer.current = null;
    }
    window.localStorage.removeItem(sessionStorageKey);
    feedbackSequence.current = 0;
    posterBuildSequence.current += 1;
    graduationPosterFile.current = null;
    setGraduationPosterOpen(false);
    setCostDetailsOpen(false);
    setGraduationSnapshot(null);
    setSelectedId(itemInstances[0].id);
    setLevels(initialLevels);
    setTargetLevels({ ...autoTargetInstanceLimits });
    setAttemptCount(1);
    setAttempts([]);
    setIsRolling(false);
    setLastAttempt(null);
    setResultFeedbacks([]);
    setGuardianProtection(false);
    setCostLedger({ knownSpend: 0, pricedAttempts: 0, itemSpend: {} });
  }

  const currentLevelPalette = levelPalette(item, level);
  const theme = { '--accent': currentLevelPalette.accent, '--accent-soft': currentLevelPalette.soft } as CSSProperties;
  const maxSelectable = item.maxLevel ?? item.minLevel ?? 0;
  const canForge = item.mode === 'draw' || outcomes.length > 0;
  const actionLabel = item.mode === 'draw' ? '唤醒图腾' : item.mode === 'check' ? '进行祈愿' : item.mode === 'adaptive' ? '点亮星辰' : '开始强化';
  const levelName = item.mode === 'adaptive' ? `${level} 星` : item.mode === 'check' ? `${level} 档` : `+${level}`;
  const tier = visualTier(item, level);
  const tierProgress = item.mode === 'draw' ? 0 : Math.round(((level - (item.minLevel ?? 0)) / Math.max(1, (item.maxLevel ?? 1) - (item.minLevel ?? 0))) * 100);
  const effectProfile = effectProfiles[item.id];
  const unitCost = costRules[item.id] ?? null;
  const itemQuantity = selectedInstance.quantity;
  const guardianProtectionEnabled = item.id === 'guardian-star' && guardianProtection;
  const attemptUnitCost = unitCost === null ? null : unitCost + (guardianProtectionEnabled ? guardianProtectionCost : 0);
  const flameScale = 0.62 + (tierProgress / 100) * 0.83;
  const crownScale = 0.78 + (tierProgress / 100) * 0.38;
  const catalystScale = 0.76 + (tierProgress / 100) * 0.44;
  const crystalScale = 0.76 + (tierProgress / 100) * 0.44;
  const harmonyScale = 0.78 + (tierProgress / 100) * 0.42;
  const talismanScale = 0.76 + (tierProgress / 100) * 0.43;
  const compassScale = 0.76 + (tierProgress / 100) * 0.44;
  const moonScale = 0.76 + (tierProgress / 100) * 0.46;
  const ascensionScale = 0.76 + (tierProgress / 100) * 0.44;
  const spiritScale = 0.76 + (tierProgress / 100) * 0.46;
  const mophoneScale = 0.76 + (tierProgress / 100) * 0.44;
  const levelLabel = (value: number) => item.mode === 'adaptive' ? `${value}★` : item.mode === 'check' ? `${value}档` : `+${value}`;
  const usesLevelOnlyFeedback = instantUpgradeItems.has(item.id);
  const feedbackClass = !usesLevelOnlyFeedback && lastAttempt ? `echo-${outcomeStyle(lastAttempt.kind)}` : '';
  const feedbackKey = usesLevelOnlyFeedback ? itemKey : `${itemKey}-${lastAttempt?.id ?? 'idle'}`;

  return (
    <main className={`game-forge ${isRolling ? 'is-forging' : ''}`} style={theme}>
      <header className="game-hud compact-hud cost-hud">
        <div className="hud-cost-only">
          <span>已知累计花费</span>
          <button type="button" className="hud-cost-detail-trigger" onClick={() => setCostDetailsOpen(true)} disabled={!hasHydrated} title="查看每个强化物品的花费明细"><b>¥{costLedger.knownSpend.toFixed(2)}</b><small>查看明细</small></button>
          <em>{hasHydrated ? '本地已保存' : '正在恢复进度'}</em>
          <button type="button" className={`graduation-trigger ${graduationReady ? 'ready' : ''}`} onClick={openGraduationPoster} disabled={!hasHydrated || !graduationReady} title={graduationReady ? '生成并分享毕业海报' : '毕业条件：燃烧宝石 +8、星月神话 +9、其余项目全 10'}>毕业照</button>
          <button type="button" onClick={restartSession} disabled={!hasHydrated}>重新计算</button>
        </div>
      </header>

      <section className="forge-layout">
        <aside className="catalog-panel">
          <div className="catalog-heading"><div><span>培养清单</span><b>{items.length} 类 · {itemInstances.length} 件</b></div><small>同名装备独立培养，点击编号切换本体</small></div>
          <div className="item-list">
            {items.map((entry) => {
              const instances = itemInstances.filter((instance) => instance.item.id === entry.id);
              const instanceLevels = instances.map((instance) => levels[instance.id] ?? entry.minLevel ?? 0);
              const strongestLevel = Math.max(...instanceLevels);
              const strongestPalette = levelPalette(entry, strongestLevel);
              const completedCopies = instances.filter((instance) => (levels[instance.id] ?? entry.minLevel ?? 0) >= (entry.maxLevel ?? 1)).length;
              if (instances.length === 1) {
                const instance = instances[0];
                const instanceLevel = instanceLevels[0];
                const progress = Math.round(((instanceLevel - (entry.minLevel ?? 0)) / Math.max(1, (entry.maxLevel ?? 1) - (entry.minLevel ?? 0))) * 100);
                return (
                  <button key={entry.id} type="button" className={`item-card single-item-card tier-${visualTier(entry, instanceLevel)} ${instance.id === itemKey ? 'active' : ''}`} onClick={() => chooseItem(instance)} aria-pressed={instance.id === itemKey}>
                    <span className="item-symbol" style={{ '--card-accent': strongestPalette.accent, '--card-soft': strongestPalette.soft } as CSSProperties}>{entry.symbol}</span>
                    <span><b>{entry.name}</b><small>{entry.aliases?.length ? entry.aliases.join(' / ') : entry.category}</small><i className="item-meter"><i style={{ width: `${progress}%` }} /></i></span>
                    <em>{entry.mode === 'draw' ? '秘宝' : entry.mode === 'adaptive' ? `${instanceLevel}★` : entry.mode === 'check' ? `${instanceLevel}档` : `+${instanceLevel}`}</em>
                  </button>
                );
              }
              return (
                <section key={entry.id} className={`item-stack copies-${instances.length} tier-${visualTier(entry, strongestLevel)} ${entry.id === item.id ? 'active' : ''}`} style={{ '--group-accent': strongestPalette.accent, '--group-soft': strongestPalette.soft } as CSSProperties} aria-label={`${entry.name}，共 ${instances.length} 件独立装备`}>
                  <header className="item-stack-heading">
                    <span className="item-symbol" style={{ '--card-accent': strongestPalette.accent, '--card-soft': strongestPalette.soft } as CSSProperties}>{entry.symbol}</span>
                    <span><b>{entry.name}</b><small>{instances.length} 件独立培养 · ¥{costRules[entry.id] ?? '—'} / 件次</small></span>
                    <em>{completedCopies}/{instances.length}</em>
                  </header>
                  <div className="item-copy-grid" role="group" aria-label={`选择${entry.name}`}>
                    {instances.map((instance) => {
                      const instanceLevel = levels[instance.id] ?? entry.minLevel ?? 0;
                      const progress = Math.round(((instanceLevel - (entry.minLevel ?? 0)) / Math.max(1, (entry.maxLevel ?? 1) - (entry.minLevel ?? 0))) * 100);
                      const instanceTier = visualTier(entry, instanceLevel);
                      const instancePalette = levelPalette(entry, instanceLevel);
                      const isComplete = instanceLevel >= (entry.maxLevel ?? 1);
                      const isActive = instance.id === itemKey;
                      return (
                        <button key={instance.id} type="button" className={`tier-${instanceTier} ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}`} style={{ '--copy-accent': instancePalette.accent, '--copy-soft': instancePalette.soft } as CSSProperties} onClick={() => chooseItem(instance)} aria-pressed={isActive} aria-label={`${itemInstanceName(instance)}，当前 ${entry.mode === 'adaptive' ? `${instanceLevel}星` : `加${instanceLevel}`}`} title={`${itemInstanceName(instance)}，当前 +${instanceLevel}`}>
                          <span className="copy-index"><b>{instance.nickname}</b><i>{String(instance.index + 1).padStart(2, '0')}</i></span>
                          <span className="copy-relic" aria-hidden="true"><i /><b>{entry.symbol}</b></span>
                          <span className="copy-meta"><strong>{entry.mode === 'adaptive' ? `${instanceLevel}★` : `+${instanceLevel}`}</strong><small>{isActive ? '当前强化' : isComplete ? '已经毕业' : tierNames[instanceTier]}</small></span>
                          <em className="copy-meter"><i style={{ width: `${progress}%` }} /></em>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </aside>

        <section className="forge-stage">
          <div className={`forge-chamber fx-${effectProfile.effect} tier-${tier} ${feedbackClass} ${guardianProtectionEnabled ? 'protection-active' : ''}`} key={feedbackKey} style={{ '--tier-progress': `${tierProgress}%`, '--flame-scale': flameScale, '--flame-burst-scale': flameScale * 1.28, '--flame-dip-scale': flameScale * 0.9, '--crown-scale': crownScale, '--crown-entry-scale': crownScale * 0.82, '--crown-burst-scale': crownScale * 1.2, '--catalyst-scale': catalystScale, '--crystal-scale': crystalScale, '--harmony-scale': harmonyScale, '--talisman-scale': talismanScale, '--compass-scale': compassScale, '--moon-scale': moonScale, '--ascension-scale': ascensionScale, '--spirit-scale': spiritScale, '--mophone-scale': mophoneScale } as CSSProperties}>
            <div className="altar-glow" />
            {item.mode !== 'draw' && <div className="level-route"><div className="level-focus"><span>当前等级</span><b>{levelLabel(level)}</b>{itemQuantity > 1 && <em className="current-instance">{selectedInstance.nickname} · {String(itemInstanceNumber).padStart(2, '0')} / {String(itemQuantity).padStart(2, '0')}</em>}</div><div className="level-steps" aria-label={`${itemInstanceName(selectedInstance)}强化等级进度`}>{Array.from({ length: maxSelectable - (item.minLevel ?? 0) + 1 }, (_, index) => (item.minLevel ?? 0) + index).map((step) => <span key={step} className={`${step === level ? 'current' : step < level ? 'done' : ''} ${isCheckpointLevel(item.id, step) ? 'checkpoint' : ''}`} aria-current={step === level ? 'step' : undefined} title={isCheckpointLevel(item.id, step) ? item.mode === 'adaptive' ? `${step} 星保级点` : `+${step} 保级点` : undefined} style={{ '--step-color': levelPalette(item, step).accent } as CSSProperties}><i /><b>{step}</b></span>)}</div></div>}
            <div className={`effect-stage tier-${tier}`}>
              <div className="effect-visual">
                {item.id === 'burning-gem' ? (
                  <>
                    <div className="burning-gem-art" role="img" aria-label="被烈焰包裹的燃烧宝石">
                      <div className="gem-fire fire-back">{Array.from({ length: 7 }, (_, index) => <i key={index} />)}</div>
                      <div className="gem-stone">
                        <i className="facet facet-left" />
                        <i className="facet facet-center" />
                        <i className="facet facet-right" />
                        <b className="gem-glint" />
                      </div>
                      <div className="gem-fire fire-front">{Array.from({ length: 4 }, (_, index) => <i key={index} />)}</div>
                    </div>
                    <div className="effect-particles burning-embers">{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</div>
                  </>
                ) : item.id === 'annihilation-crown' ? (
                  <>
                    <div className="annihilation-crown-art" role="img" aria-label="被暗雷环绕的灭世之冠">
                      <div className="crown-eclipse"><i /><i /></div>
                      <div className="crown-lightning"><i /><i /><i /><i /></div>
                      <div className="crown-body">
                        <div className="crown-peaks"><i /><i /><i /><i /><i /></div>
                        <span className="crown-band" />
                        <b className="crown-core" />
                      </div>
                      <div className="crown-shockwave" />
                    </div>
                    <div className="effect-particles crown-ash">{Array.from({ length: 14 }, (_, index) => <i key={index} />)}</div>
                  </>
                ) : item.id === 'catalyst-stone' ? (
                  <>
                    <div className="catalyst-stone-art" role="img" aria-label="三重反应环中持续催化的神石">
                      <div className="catalyst-orbits"><i /><i /><i /></div>
                      <div className="catalyst-checkpoints">
                        {[3, 6, 9].map((checkpoint) => <i key={checkpoint} className={level >= checkpoint ? 'unlocked' : ''}>{checkpoint}</i>)}
                      </div>
                      <div className="catalyst-crystal"><i /><i /><i /><b /></div>
                      <span className="catalyst-vessel" />
                    </div>
                    <div className="effect-particles catalyst-sparks">{Array.from({ length: 16 }, (_, index) => <i key={index} />)}</div>
                  </>
                ) : item.id === 'crystal-ball' ? (
                  <>
                    <div className="crystal-ball-art" role="img" aria-label="盛放星雾能量的水晶球">
                      <div className="orb-rings"><i /><i /><i /></div>
                      <div className="crystal-sphere">
                        <span className="crystal-mist" />
                        <div className="orb-stars">{Array.from({ length: 7 }, (_, index) => <i key={index} />)}</div>
                        <b className="orb-core" />
                      </div>
                      <div className="crystal-pedestal"><i /></div>
                    </div>
                    <div className="effect-particles crystal-motes">{Array.from({ length: 14 }, (_, index) => <i key={index} />)}</div>
                  </>
                ) : item.id === 'harmony-cup' ? (
                  <>
                    <div className="harmony-chalice-art" role="img" aria-label="汇聚双流圣泉的和谐圣杯">
                      <div className="harmony-halo"><i /><i /><i /></div>
                      <div className="harmony-streams"><i /><i /></div>
                      <div className="chalice-cup">
                        <span className="chalice-rim" />
                        <span className="harmony-water" />
                        <i className="chalice-handle left" /><i className="chalice-handle right" />
                        <b className="chalice-heart" />
                        <span className="chalice-stem" />
                      </div>
                    </div>
                    <div className="effect-particles harmony-drops">{Array.from({ length: 14 }, (_, index) => <i key={index} />)}</div>
                  </>
                ) : item.id === 'mystic-talisman' ? (
                  <>
                    <div className="mystic-talisman-art" role="img" aria-label="朱砂符纹环绕的神秘护符">
                      <div className="talisman-aura"><i /><i /><i /></div>
                      <div className="spirit-ribbons"><i /><i /></div>
                      <div className="talisman-scroll">
                        <span className="scroll-cap top" /><span className="scroll-cap bottom" />
                        <div className="talisman-runes"><i /><i /><i /><i /><i /><i /></div>
                        <b className="talisman-seal" />
                        <span className="jade-knot" />
                      </div>
                    </div>
                    <div className="effect-particles talisman-sparks">{Array.from({ length: 14 }, (_, index) => <i key={index} />)}</div>
                  </>
                ) : item.id === 'element-compass' ? (
                  <>
                    <div className="element-compass-art" role="img" aria-label="汇聚火水风土的元素罗盘">
                      <div className="compass-aura"><i /><i /></div>
                      <div className="compass-wheel">
                        <span className="compass-ticks" />
                        <div className="element-orbs"><i /><i /><i /><i /></div>
                        <div className="compass-needle"><i /><b /></div>
                        <strong className="compass-core" />
                      </div>
                      <div className="compass-base" />
                    </div>
                    <div className="effect-particles element-motes">{Array.from({ length: 16 }, (_, index) => <i key={index} />)}</div>
                  </>
                ) : item.id === 'moon-myth' ? (
                  <>
                    <div className="star-moon-art" role="img" aria-label="星轨环绕新月的星月神话">
                      <div className="lunar-orbits"><i /><i /><i /></div>
                      <div className="moon-clouds"><i /><i /></div>
                      <div className="myth-moon">
                        <span className="moon-crater one" /><span className="moon-crater two" /><span className="moon-crater three" />
                        <b className="moon-star-core">✦</b>
                      </div>
                      <div className="moon-constellation"><i /><i /><i /><i /><i /><i /><i /></div>
                    </div>
                    <div className="effect-particles starlight-motes">{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</div>
                  </>
                ) : item.id === 'holy-gift' ? (
                  <>
                    <div className="holy-gift-art" role="img" aria-label="圣光与羽翼环绕的圣之赐">
                      <div className="gift-halo"><i /><i /><i /></div>
                      <div className="gift-wings"><i /><i /><i /><i /></div>
                      <div className="gift-reliquary">
                        <span className="gift-cross"><i /><i /></span>
                        <b className="gift-core">✦</b>
                      </div>
                      <div className="gift-seals"><i>2</i><i>4</i><i>6</i><i>8</i></div>
                    </div>
                    <div className="effect-particles gift-sparks">{Array.from({ length: 16 }, (_, index) => <i key={index} />)}</div>
                  </>
                ) : item.id === 'primordial-spirit' ? (
                  <>
                    <div className="primordial-spirit-art" role="img" aria-label="魂焰灵轮中凝聚成形的元神">
                      <div className="spirit-halo"><i /><i /><i /></div>
                      <div className="spirit-flames">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div>
                      <div className="spirit-form">
                        <span className="spirit-head" />
                        <span className="spirit-body" />
                        <div className="spirit-arms"><i /><i /></div>
                        <b className="spirit-soul-core"><i /><i /></b>
                      </div>
                      <div className="spirit-seals"><i>3</i><i>6</i><i>9</i></div>
                      <div className="spirit-lotus" />
                    </div>
                    <div className="effect-particles soul-motes">{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</div>
                  </>
                ) : item.id === 'mophone' ? (
                  <>
                    <div className="mophone-art" role="img" aria-label="环形电路中持续超频的未来 Mophone">
                      <div className="mophone-orbits"><i /><i /><i /></div>
                      <div className="circuit-arcs"><i /><i /><i /><i /><i /><i /></div>
                      <div className="mophone-device">
                        <span className="phone-speaker" />
                        <span className="camera-array"><i /><i /><i /></span>
                        <div className="phone-screen">
                          <span className="screen-scan" />
                          <div className="chip-grid">{Array.from({ length: 9 }, (_, index) => <i key={index} />)}</div>
                          <b className="phone-core">M</b>
                          <div className="power-bars"><i /><i /><i /><i /></div>
                        </div>
                      </div>
                      <div className="mophone-seals"><i>4</i><i>6</i><i>8</i></div>
                      <div className="charging-dock" />
                    </div>
                    <div className="effect-particles data-motes">{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</div>
                  </>
                ) : item.id === 'goddess-fate' ? (
                  <>
                    <div className="fate-goddess-art" role="img" aria-label="在命运轮与丝线中央显现的命运女神">
                      <div className="fate-wheel"><i /><i /><i /></div>
                      <div className="fate-threads"><i /><i /><i /><i /><i /><i /></div>
                      <div className="goddess-figure">
                        <span className="goddess-crown"><i /><i /><i /></span>
                        <span className="goddess-head" />
                        <span className="goddess-hair"><i /><i /></span>
                        <span className="goddess-robe" />
                        <b className="fate-heart">◆</b>
                      </div>
                      <div className="fate-seals">
                        <i className={level >= 4 ? 'unlocked' : ''}>4</i>
                        <i className={level >= 6 ? 'unlocked' : ''}>6</i>
                        <i className={level >= 8 ? 'unlocked' : ''}>8</i>
                      </div>
                    </div>
                    <div className="effect-particles fate-motes">{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</div>
                  </>
                ) : item.id === 'earring' ? (
                  <>
                    <div className="earring-relic-art" role="img" aria-label="五枚保级宝石环绕的月银双耳环">
                      <div className="earring-aura"><i /><i /><i /></div>
                      <div className="relic-earring left">
                        <span className="earring-hook" />
                        <span className="earring-cap" />
                        <span className="earring-chain"><i /><i /><i /></span>
                        <span className="earring-drop"><i /><i /></span>
                      </div>
                      <div className="relic-earring right">
                        <span className="earring-hook" />
                        <span className="earring-cap" />
                        <span className="earring-chain"><i /><i /><i /></span>
                        <span className="earring-drop"><i /><i /></span>
                      </div>
                      <b className="earring-resonance">✦</b>
                      <div className="earring-seals">
                        {[4, 6, 8, 10, 13].map((checkpoint) => <i key={checkpoint} className={level >= checkpoint ? 'unlocked' : ''}>{checkpoint}</i>)}
                      </div>
                    </div>
                    <div className="effect-particles earring-motes">{Array.from({ length: 16 }, (_, index) => <i key={index} />)}</div>
                  </>
                ) : (
                  <>
                    <div className="effect-field" />
                    <div className="effect-particles">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div>
                    <span className="effect-glyph">{item.symbol}</span>
                    <div className="effect-detail"><i /><i /><i /><i /></div>
                  </>
                )}
              </div>
              {item.mode !== 'draw' && <b className="artifact-level">{levelName}</b>}
              <small className="rite-name">{effectProfile.rite}</small>
            </div>
            <div className="artifact-name"><span>{item.mode === 'draw' ? '等待唤醒' : canForge ? `${tierNames[tier]}境 · 等待强化` : '已臻至最高境界'}</span><h3>{item.name}{itemQuantity > 1 && <i className="active-instance-mark">{selectedInstance.nickname}</i>}</h3><div className="evolution-track" aria-label={`成长进度 ${tierProgress}%`}>{Array.from({ length: 6 }, (_, index) => <i key={index} className={index <= tier ? 'lit' : ''} />)}</div></div>
            {item.mode === 'adaptive' && <label className="star-memory"><span>星辰共鸣次数</span><input type="number" min="1" max="9999" value={attemptCount} onChange={(event) => setAttemptCount(Math.max(1, Number(event.target.value) || 1))} /><small>第 {bandIndex(attemptCount) + 1} 阶共鸣</small></label>}
            {item.id === 'guardian-star' && <button type="button" className={`guardian-protection ${guardianProtection ? 'active' : ''}`} aria-pressed={guardianProtection} onClick={() => setGuardianProtection((enabled) => !enabled)} disabled={!canForge}><i>✧</i><span><b>失败保护</b><small>{guardianProtection ? '已开启 · +¥8 / 次' : '¥8 / 次 · 点击开启'}</small></span></button>}
            <div className={`altar-actions ${autoTargetLimit !== null ? 'has-target-runner' : 'single-only'}`}>
              {autoTargetLimit !== null && targetLevel !== null && (
                <div className={`target-runner ${isAutoTargetRunning ? 'running' : ''}`}>
                  <label>
                    <span>到</span>
                    <input
                      type="number"
                      min="1"
                      max={autoTargetLimit}
                      value={targetLevel}
                      disabled={isAutoTargetRunning}
                      aria-label={`${item.name}自动强化目标等级`}
                      onChange={(event) => {
                        const nextTarget = Math.min(autoTargetLimit, Math.max(1, Math.floor(Number(event.target.value) || 1)));
                        setTargetLevels((current) => ({ ...current, [itemKey]: nextTarget }));
                      }}
                    />
                    <span>停止</span>
                  </label>
                  <button type="button" onClick={toggleAutoTargetRun} disabled={!canForge || (!isAutoTargetRunning && level >= targetLevel)} title="每 0.2 秒结算一次单次强化">
                    {isAutoTargetRunning ? '停止' : level >= targetLevel ? '已到达' : '执行'}
                  </button>
                </div>
              )}
              <button type="button" className="primary-action" onClick={() => simulate(1)} disabled={isRolling || !canForge || isAutoTargetRunning}>
                <span>{isAutoTargetRunning ? `自动强化中 · ¥${attemptUnitCost?.toFixed(0) ?? '—'} / 0.2 秒` : isRolling ? '强化中…' : canForge ? attemptUnitCost !== null ? `${actionLabel} · ¥${attemptUnitCost.toFixed(0)}` : actionLabel : '已经毕业'}</span>
              </button>
            </div>
          </div>

            {!!resultFeedbacks.length && (
              <div className="result-tooltip-stack" role="status" aria-live="polite">
                {resultFeedbacks.map(({ id, attempt }) => (
                  <div className={`result-popover ${outcomeStyle(attempt.kind)}`} key={id}>
                    <span>{attempt.kind === 'success' || attempt.kind === 'jump' ? '✦' : attempt.kind === 'protected' ? '✧' : attempt.kind === 'draw' ? '◇' : '⌁'}</span>
                    <div><b>{attempt.resultLabel}</b><small>{attempt.fromLabel} → {attempt.toLabel}</small></div>
                    <strong>{attempt.toLabel}</strong>
                  </div>
                ))}
              </div>
            )}

        </section>

        <aside className="session-panel">
          <div className="session-heading"><div><span>极品号账本</span><b>BUILD COST LEDGER</b></div><button type="button" onClick={restartSession} disabled={!hasHydrated}>重新计算</button></div>
          <div className="budget-total"><button type="button" className="budget-detail-trigger" onClick={() => setCostDetailsOpen(true)} disabled={!hasHydrated}><span>已录入规则累计花费 <i>查看逐件明细</i></span><strong>¥{costLedger.knownSpend.toFixed(2)}</strong></button><p>多件装备已拆分单独强化：水晶球 5 件 · 星月神话 5 件 · 圣之赐 5 件 · 命运女神 3 件 · 耳环 2 件；每次只为当前选中的一件计费。</p></div>
          <div className="account-progress"><div><span>账号完成度</span><b>{accountProgress}%</b></div><i><i style={{ width: `${accountProgress}%` }} /></i><small>{completedItems} / {itemInstances.length} 件达到目标</small></div>
          <div className="stat-grid"><div><span>强化次数</span><b>{totals.total}</b></div><div><span>成功</span><b>{totals.success}</b></div><div><span>失败</span><b>{totals.risk}</b></div></div>
          <div className="rule-roadmap"><h3>成本规则进度</h3><div className="done"><i>✓</i><span><b>升级概率</b><small>已录入官方公示</small></span></div><div className="done"><i>✓</i><span><b>{Object.keys(costRules).length} 项核心道具已计价</b><small>守护星 ¥2 / 次 · 可选保护 +¥8</small></span></div><div><i>3</i><span><b>其余 {items.length - Object.keys(costRules).length} 项成本</b><small>已计价 {costLedger.pricedAttempts} 次 · 等待共同完善</small></span></div></div>
          <div className="log-heading"><span>最近强化</span><i>{attempts.length} 次</i></div>
          <div className="history-list">
            {!attempts.length ? <div className="empty-history"><span>✦</span><b>尚未开始打造</b><p>选择左侧项目并进行第一次强化</p></div> : attempts.slice(0, 5).map((attempt, index) => (
              <article key={attempt.id} className={outcomeStyle(attempt.kind)}><header><span>第 {attempts.length - index} 次</span><time>{attempt.cost !== null ? `¥${attempt.cost.toFixed(2)}` : '未计价'}</time></header><b>{attempt.itemName}</b><p>{attempt.fromLabel} → {attempt.toLabel}</p><footer><span>{attempt.resultLabel}</span><i>{attempt.probability}% 命运档</i></footer></article>
            ))}
          </div>
          <footer className="session-footer"><span><i /> 当前仅计算养成过程</span><p>未录入的花费不会被估算或虚构</p></footer>
        </aside>
      </section>

      {costDetailsOpen && (
        <div className="cost-detail-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setCostDetailsOpen(false);
        }}>
          <section className="cost-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="cost-detail-title">
            <header>
              <div><small>BUILD COST LEDGER</small><h2 id="cost-detail-title">强化花费明细</h2></div>
              <button type="button" onClick={() => setCostDetailsOpen(false)} aria-label="关闭花费明细">×</button>
            </header>
            <div className="cost-detail-summary"><span>全部累计花费</span><strong>¥{costLedger.knownSpend.toFixed(2)}</strong><small>{costDetailItems.length} 件装备 · 每件独立记录</small></div>
            <div className="cost-detail-list">
              {costDetailItems.map((entry) => (
                <article key={entry.id}>
                  <div>
                    <b>{entry.name}</b>
                    <small>
                      {entry.level} · {entry.attemptCost === null
                        ? '未计价'
                        : entry.baseItemId === 'guardian-star'
                          ? '¥2 / 次 · 保护时 ¥10 / 次'
                          : `¥${entry.attemptCost.toFixed(0)} / 次`}
                    </small>
                  </div>
                  <strong>¥{entry.spend.toFixed(2)}</strong>
                </article>
              ))}
              {uncategorizedCost >= .01 && <article className="legacy"><div><b>历史未分类</b><small>旧版本中未归入具体项目的花费</small></div><strong>¥{uncategorizedCost.toFixed(2)}</strong></article>}
            </div>
            <footer><span>分项合计</span><strong>¥{(categorizedCost + uncategorizedCost).toFixed(2)}</strong></footer>
          </section>
        </div>
      )}

      {graduationPosterOpen && graduationSnapshot && (
        <div className="graduation-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setGraduationPosterOpen(false);
        }}>
          <section className="graduation-dialog" role="dialog" aria-modal="true" aria-labelledby="graduation-poster-title">
            <button type="button" className="graduation-close" onClick={() => setGraduationPosterOpen(false)} aria-label="关闭毕业照">×</button>
            <article className="graduation-poster graduation-ledger-poster">
              <div className="poster-stars">{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</div>
              <header className="poster-header"><span>MYJ · BUILD GRADUATION</span><b>GRADUATED</b></header>
              <div className="poster-heading"><small>全项目养成结算</small><h2 id="graduation-poster-title">极品号毕业照</h2></div>
              <div className="poster-standards">
                <span><i />燃烧宝石 +8</span>
                <span><i />星月神话 +9</span>
                <span><i />其余项目全 10</span>
              </div>
              <section className="poster-ledger">
                <header><span>全部养成花费</span><b>{graduationSnapshot.itemSpends.length} 项</b></header>
                <div className="poster-item-spends">
                  {graduationSnapshot.itemSpends.map((entry) => (
                    <div key={entry.id} className={`${entry.id === 'burning-gem' ? 'burning' : entry.id === 'moon-myth' ? 'moon' : entry.id === 'legacy-history' ? 'legacy' : ''}`}>
                      <span><b>{entry.name}</b><i>{entry.level}</i></span>
                      <strong>¥{entry.spend.toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
              </section>
              <div className="poster-total">
                <span>毕业总花费</span>
                <strong>花费 ¥{graduationSnapshot.spend.toFixed(2)} 毕业了</strong>
                <small>累计计价 {graduationSnapshot.pricedAttempts} 次 · 所有进度来自本地养成记录</small>
              </div>
              <footer className="poster-footer"><time>{graduationSnapshot.completedAt}</time><span>KEEP THE FIRE · FOLLOW THE MOON</span></footer>
            </article>
            <div className="graduation-actions">
              <span className={`poster-status ${posterStatus}`}>
                {posterStatus === 'rendering' ? '正在生成高清海报…' : posterStatus === 'ready' ? '高清海报已生成' : posterStatus === 'shared' ? '毕业照已分享' : posterStatus === 'saved' ? '毕业照已保存' : '图片生成失败，可继续分享文字'}
              </span>
              <div>
                <button type="button" onClick={() => setGraduationPosterOpen(false)}>返回</button>
                <button type="button" onClick={() => graduationPosterFile.current && saveGraduationPosterFile(graduationPosterFile.current)} disabled={!graduationPosterFile.current}>保存图片</button>
                <button type="button" className="share-poster" onClick={shareGraduationPoster} disabled={posterStatus === 'rendering'}>分享毕业照</button>
              </div>
            </div>
          </section>
        </div>
      )}

    </main>
  );
}
