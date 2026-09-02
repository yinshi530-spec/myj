'use client';

import { useMemo, useState, type CSSProperties } from 'react';

type OutcomeKind = 'success' | 'jump' | 'stay' | 'down' | 'fail' | 'draw';
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

const categories: Array<'全部' | Category> = ['全部', '宝石与圣器', '特殊强化', '装备升阶', '星级系统'];

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

function successOnlyRows(start: number, rates: number[]): UpgradeRow[] {
  return rates.map((success, index) => {
    const current = start + index;
    return {
      current,
      target: current + 1,
      outcomes: [
        { key: 'success', label: '升级成功', probability: success, target: current + 1, kind: 'success' as const },
        { key: 'fail', label: '失败（后果未公示）', probability: 100 - success, target: current, kind: 'fail' as const, note: 'Mock 中不改变等级' },
      ].filter((entry) => entry.probability > 0),
    };
  });
}

function checkRows(start: number, rates: number[]): UpgradeRow[] {
  return rates.map((success, index) => ({
    current: start + index,
    target: null,
    outcomes: [
      { key: 'success', label: '检定成功', probability: success, target: null, kind: 'success' as const },
      { key: 'fail', label: '检定失败', probability: 100 - success, target: null, kind: 'fail' as const },
    ].filter((entry) => entry.probability > 0),
  }));
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
    id: 'crystal-ball', name: '水晶球', category: '宝石与圣器', mode: 'upgrade', symbol: '●', accent: '#65c7ff', accentSoft: '#153249',
    description: '从 1 级开始，失败时保持当前等级。', sourceNote: '公示等级范围为 1→2 至 9→10。', minLevel: 1, maxLevel: 10,
    rows: stayRows(1, [100, 70, 50, 30, 20, 15, 10, 5, 1]),
  },
  {
    id: 'harmony-cup', name: '和谐圣杯', aliases: ['圣杯之环'], category: '宝石与圣器', mode: 'upgrade', symbol: '♜', accent: '#f3bd63', accentSoft: '#3b2b17',
    description: '与圣杯之环共用同一组公示概率。', sourceNote: '两个名称在公示中列为同组。', minLevel: 1, maxLevel: 10,
    rows: stayRows(1, [100, 85, 70, 55, 40, 25, 15, 5, 1]),
  },
  {
    id: 'sacred-chain', name: '圣器之链', category: '宝石与圣器', mode: 'upgrade', symbol: '∞', accent: '#e8c07a', accentSoft: '#372c1e',
    description: '失败时保持当前等级的圣器强化。', sourceNote: '官方公布成功率与保持不变概率。', minLevel: 1, maxLevel: 10,
    rows: stayRows(1, [100, 85, 70, 55, 40, 25, 15, 5, 1]),
  },
  {
    id: 'mystic-talisman', name: '神秘护符', category: '宝石与圣器', mode: 'upgrade', symbol: '✦', accent: '#5ddbb0', accentSoft: '#163c35',
    description: '官方只公布每级升级成功率。', sourceNote: '失败后果未在公示表中说明；Mock 失败时不改等级。', minLevel: 0, maxLevel: 10,
    rows: successOnlyRows(0, [100, 100, 90, 80, 50, 50, 30, 15, 10, 2]),
  },
  {
    id: 'guardian-star', name: '守护之星', category: '宝石与圣器', mode: 'upgrade', symbol: '✧', accent: '#73b7ff', accentSoft: '#19314c',
    description: '官方只公布每级升级成功率。', sourceNote: '失败后果未在公示表中说明；Mock 失败时不改等级。', minLevel: 0, maxLevel: 10,
    rows: successOnlyRows(0, [100, 90, 80, 60, 40, 20, 5, 3, 2, 1]),
  },
  {
    id: 'element-compass', name: '元素罗盘', category: '特殊强化', mode: 'upgrade', symbol: '✣', accent: '#47d7ac', accentSoft: '#123d38',
    description: '唯一包含 +2 跳级结果的四分支强化。', sourceNote: '升级 +1、跳级 +2、保持不变与降级 -1。', minLevel: 0, maxLevel: 10, rows: compassRows(),
  },
  {
    id: 'moon-myth', name: '星月神话', aliases: ['星云沙'], category: '宝石与圣器', mode: 'upgrade', symbol: '☾', accent: '#a78bfa', accentSoft: '#2a2148',
    description: '与星云沙共用成功、不变、降级概率。', sourceNote: '两个名称在公示中列为同组。', minLevel: 0, maxLevel: 10,
    rows: standardRows([[100, 0, 0], [90, 10, 0], [80, 10, 10], [60, 30, 10], [40, 40, 20], [30, 40, 30], [20, 45, 35], [15, 45, 40], [5, 50, 45], [2, 50, 48]]),
  },
  {
    id: 'divine-ascension', name: '神装升阶', category: '装备升阶', mode: 'upgrade', symbol: '⇧', accent: '#ffb657', accentSoft: '#3c2918',
    description: '神装从 0 阶升至 10 阶的成功率。', sourceNote: '失败后果未在公示表中说明；Mock 失败时不改等级。', minLevel: 0, maxLevel: 10,
    rows: successOnlyRows(0, [100, 90, 80, 50, 40, 30, 15, 10, 5, 2]),
  },
  {
    id: 'holy-gift', name: '圣之赐', aliases: ['神圣之力'], category: '装备升阶', mode: 'upgrade', symbol: '✚', accent: '#f4d66f', accentSoft: '#40361b',
    description: '与神圣之力共用指定失败等级规则。', sourceNote: '成功与失败后的等级均按公示直接落位。', minLevel: 0, maxLevel: 10,
    rows: explicitRows([[0,100,1,null],[1,100,2,null],[2,90,3,1],[3,80,4,1],[4,50,5,4],[5,50,6,4],[6,30,7,6],[7,15,8,6],[8,10,9,8],[9,2,10,8]]),
  },
  {
    id: 'holy-devotion', name: '神圣虔诚', category: '特殊强化', mode: 'check', symbol: '✥', accent: '#e8cf8f', accentSoft: '#38311e',
    description: '按当前档位进行成功率检定。', sourceNote: '公示只给出 1–5 档成功率，未列目标或失败等级。', minLevel: 1, maxLevel: 5,
    rows: checkRows(1, [80, 40, 20, 10, 10]),
  },
  {
    id: 'primordial-spirit', name: '元神', category: '装备升阶', mode: 'upgrade', symbol: '◉', accent: '#79d9ff', accentSoft: '#173748',
    description: '成功或失败后落到公示指定等级。', sourceNote: '失败后的等级按官方表直接处理。', minLevel: 0, maxLevel: 10,
    rows: explicitRows([[0,100,1,null],[1,100,2,null],[2,90,3,1],[3,80,4,3],[4,50,5,3],[5,50,6,3],[6,30,7,6],[7,15,8,6],[8,10,9,6],[9,2,10,9]]),
  },
  {
    id: 'mophone', name: 'Mophone', aliases: ['手机升级配件'], category: '装备升阶', mode: 'upgrade', symbol: '▣', accent: '#62d6ff', accentSoft: '#15364a',
    description: '与手机升级配件共用指定失败等级规则。', sourceNote: '两个名称在公示中列为同组。', minLevel: 0, maxLevel: 10,
    rows: explicitRows([[0,100,1,null],[1,100,2,null],[2,90,3,1],[3,80,4,1],[4,25,5,4],[5,25,6,4],[6,50,7,6],[7,20,8,6],[8,15,9,8],[9,2,10,8]]),
  },
  {
    id: 'goddess-fate', name: '命运女神', aliases: ['女神的祝福'], category: '装备升阶', mode: 'upgrade', symbol: '♢', accent: '#ff8fc5', accentSoft: '#421f36',
    description: '与女神的祝福共用升阶规则。', sourceNote: '0–3 级均为 100%，其后按指定失败等级处理。', minLevel: 0, maxLevel: 10,
    rows: explicitRows([[0,100,1,null],[1,100,2,null],[2,100,3,null],[3,100,4,null],[4,25,5,4],[5,25,6,4],[6,70,7,6],[7,50,8,6],[8,20,9,8],[9,5,10,8]]),
  },
  {
    id: 'divine-craft', name: '鬼斧神工', category: '装备升阶', mode: 'upgrade', symbol: '⚒', accent: '#ff8b5f', accentSoft: '#40231b',
    description: '每一级都有独立成功率与失败落点。', sourceNote: '失败后的等级按官方表直接处理。', minLevel: 0, maxLevel: 10,
    rows: explicitRows([[0,100,1,null],[1,80,2,1],[2,60,3,1],[3,60,4,2],[4,50,5,3],[5,80,6,5],[6,60,7,5],[7,40,8,6],[8,20,9,7],[9,10,10,9]]),
  },
  {
    id: 'earring', name: '耳环', category: '装备升阶', mode: 'upgrade', symbol: '◌', accent: '#cb9bff', accentSoft: '#312047',
    description: '覆盖 0–15 级的长线升级规则。', sourceNote: '0–3 级均为 100%，其后按指定失败等级处理。', minLevel: 0, maxLevel: 15,
    rows: explicitRows([[0,100,1,null],[1,100,2,null],[2,100,3,null],[3,100,4,null],[4,25,5,4],[5,25,6,4],[6,70,7,6],[7,50,8,6],[8,20,9,8],[9,5,10,8],[10,100,11,10],[11,50,12,10],[12,30,13,10],[13,20,14,13],[14,5,15,13]]),
  },
  {
    id: 'wanxiang', name: '万象图', category: '星级系统', mode: 'adaptive', symbol: '◎', accent: '#f8c55c', accentSoft: '#453417',
    description: '成功率同时取决于目标星级与累计次数区间。', sourceNote: '次数区间：≤40、41–80、81–150、>150。', minLevel: 0, maxLevel: 10,
    adaptiveRows: [
      { target: 1, rates: [100, 100, 100, 100], failureTo: 1, failureNote: '不降级' }, { target: 2, rates: [100, 100, 100, 100], failureTo: 2, failureNote: '不降级' },
      { target: 3, rates: [70, 100, 100, 100], failureTo: 2 }, { target: 4, rates: [50, 100, 100, 100], failureTo: 2 },
      { target: 5, rates: [25, 50, 100, 100], failureTo: 4 }, { target: 6, rates: [25, 50, 70, 100], failureTo: 4 },
      { target: 7, rates: [1, 50, 70, 100], failureTo: 6 }, { target: 8, rates: [1, 15, 40, 60], failureTo: 6 },
      { target: 9, rates: [1, 3, 15, 40], failureTo: 8 }, { target: 10, rates: [1, 1, 5, 15], failureTo: 8 },
    ],
  },
];

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
  'crystal-ball': { effect: 'crystal', rite: '水晶共鸣', catalyst: '澄澈灵液' },
  'harmony-cup': { effect: 'chalice', rite: '圣杯灌注', catalyst: '和谐圣泉' },
  'sacred-chain': { effect: 'chain', rite: '圣链锻接', catalyst: '秘银链节' },
  'mystic-talisman': { effect: 'talisman', rite: '敕令封印', catalyst: '灵符朱砂' },
  'guardian-star': { effect: 'guardian', rite: '星盾守护', catalyst: '守望星屑' },
  'element-compass': { effect: 'compass', rite: '元素跃迁', catalyst: '四象磁针' },
  'moon-myth': { effect: 'moon', rite: '星月蚀刻', catalyst: '星云砂砾' },
  'divine-ascension': { effect: 'ascension', rite: '神装升阶', catalyst: '登神金羽' },
  'holy-gift': { effect: 'blessing', rite: '圣赐降临', catalyst: '神圣辉光' },
  'holy-devotion': { effect: 'devotion', rite: '虔诚祈愿', catalyst: '祷告白羽' },
  'primordial-spirit': { effect: 'spirit', rite: '元神归一', catalyst: '太初魂息' },
  mophone: { effect: 'cyber', rite: '机芯超频', catalyst: '量子芯片' },
  'goddess-fate': { effect: 'fate', rite: '命运编织', catalyst: '女神丝线' },
  'divine-craft': { effect: 'hammer', rite: '鬼斧锻打', catalyst: '神工火种' },
  earring: { effect: 'earring', rite: '双环鸣奏', catalyst: '月银铃音' },
  wanxiang: { effect: 'constellation', rite: '万象演星', catalyst: '天机星轨' },
};

const costRules: Record<string, number> = {
  'burning-gem': 3,
  'annihilation-crown': 5,
  'crystal-ball': 3,
};

const instantUpgradeItems = new Set(['burning-gem', 'annihilation-crown', 'crystal-ball']);

export default function Home() {
  const initialLevels = useMemo(() => Object.fromEntries(items.filter((item) => item.mode !== 'draw').map((item) => [item.id, item.minLevel ?? 0])), []);
  const [selectedId, setSelectedId] = useState(items[0].id);
  const [levels, setLevels] = useState<Record<string, number>>(initialLevels);
  const [attemptCount, setAttemptCount] = useState(1);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'全部' | Category>('全部');
  const [isRolling, setIsRolling] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<Attempt | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [costLedger, setCostLedger] = useState({ knownSpend: 0, pricedAttempts: 0 });

  const item = items.find((entry) => entry.id === selectedId) ?? items[0];
  const level = levels[item.id] ?? item.minLevel ?? 0;
  const currentRow = item.rows?.find((row) => row.current === level);
  const adaptiveRow = item.adaptiveRows?.find((row) => row.target === Math.min(10, level + 1));

  const visibleItems = useMemo(() => items.filter((entry) => {
    const categoryMatch = category === '全部' || entry.category === category;
    const searchable = [entry.name, ...(entry.aliases ?? [])].join('');
    return categoryMatch && searchable.toLowerCase().includes(query.trim().toLowerCase());
  }), [category, query]);

  const totals = useMemo(() => attempts.reduce((acc, attempt) => {
    acc.total += 1;
    if (attempt.kind === 'success' || attempt.kind === 'jump') acc.success += 1;
    if (attempt.kind === 'down' || attempt.kind === 'fail') acc.risk += 1;
    return acc;
  }, { total: 0, success: 0, risk: 0 }), [attempts]);

  const accountProgress = useMemo(() => {
    const progress = items.map((entry) => {
      const min = entry.minLevel ?? 0;
      const max = entry.maxLevel ?? min + 1;
      return ((levels[entry.id] ?? min) - min) / Math.max(1, max - min);
    });
    return Math.round((progress.reduce((sum, value) => sum + value, 0) / progress.length) * 100);
  }, [levels]);

  const completedItems = useMemo(() => items.filter((entry) => (levels[entry.id] ?? entry.minLevel ?? 0) >= (entry.maxLevel ?? 1)).length, [levels]);

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

  function chooseItem(next: ProbabilityItem) {
    setSelectedId(next.id);
    setLastAttempt(null);
    setRulesOpen(false);
  }

  function createAttempt(activeItem: ProbabilityItem, currentLevel: number, count: number, sequence: number) {
    let available: Outcome[] = [];
    let fromLabel = activeItem.mode === 'draw' ? '触发' : `+${currentLevel}`;

    if (activeItem.mode === 'draw') {
      available = (activeItem.drawOptions ?? []).map((option) => ({ key: option.label, label: option.label, probability: option.probability, target: null, kind: 'draw' }));
    } else if (activeItem.mode === 'adaptive') {
      const rule = activeItem.adaptiveRows?.find((entry) => entry.target === Math.min(10, currentLevel + 1));
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

    const nextLevel = picked.target ?? currentLevel;
    const attempt: Attempt = {
      id: Date.now() + sequence,
      itemId: activeItem.id,
      itemName: activeItem.name,
      fromLabel,
      resultLabel: picked.label,
      toLabel: activeItem.mode === 'draw' ? picked.label : activeItem.mode === 'adaptive' ? `${nextLevel} 星` : `+${nextLevel}`,
      probability: picked.probability,
      roll: Number(roll.toFixed(2)),
      kind: picked.kind,
      cost: costRules[activeItem.id] ?? null,
    };
    return { attempt, nextLevel };
  }

  function simulate(times: number) {
    if (isRolling) return;
    let currentLevel = level;
    let currentCount = attemptCount;
    const generated: Attempt[] = [];
    for (let index = 0; index < times; index += 1) {
      const result = createAttempt(item, currentLevel, currentCount, index);
      if (!result) break;
      generated.push(result.attempt);
      if (item.mode === 'upgrade' || item.mode === 'adaptive') currentLevel = result.nextLevel;
      if (item.mode === 'adaptive') currentCount += 1;
    }
    if (!generated.length) return;
    const applyResults = () => {
      const latestAttempts = [...generated].reverse();
      if (item.mode === 'upgrade' || item.mode === 'adaptive') setLevels((current) => ({ ...current, [item.id]: currentLevel }));
      if (item.mode === 'adaptive') setAttemptCount(currentCount);
      setCostLedger((current) => ({
        knownSpend: current.knownSpend + generated.reduce((sum, attempt) => sum + (attempt.cost ?? 0), 0),
        pricedAttempts: current.pricedAttempts + generated.filter((attempt) => attempt.cost !== null).length,
      }));
      setAttempts((current) => [...latestAttempts, ...current].slice(0, 120));
      setLastAttempt(latestAttempts[0]);
      setIsRolling(false);
    };

    if (instantUpgradeItems.has(item.id)) {
      applyResults();
      return;
    }

    setIsRolling(true);
    const feedbackDelay = times === 1 ? 920 : 1280;
    window.setTimeout(applyResults, feedbackDelay);
  }

  function resetSession() {
    setLevels(initialLevels);
    setAttemptCount(1);
    setAttempts([]);
    setLastAttempt(null);
    setCostLedger({ knownSpend: 0, pricedAttempts: 0 });
  }

  const theme = { '--accent': item.accent, '--accent-soft': item.accentSoft } as CSSProperties;
  const maxSelectable = item.maxLevel ?? item.minLevel ?? 0;
  const canForge = item.mode === 'draw' || outcomes.length > 0;
  const actionLabel = item.mode === 'draw' ? '唤醒图腾' : item.mode === 'check' ? '进行祈愿' : item.mode === 'adaptive' ? '点亮星辰' : '开始强化';
  const levelName = item.mode === 'adaptive' ? `${level} 星` : item.mode === 'check' ? `${level} 档` : `+${level}`;
  const tier = visualTier(item, level);
  const tierProgress = item.mode === 'draw' ? 0 : Math.round(((level - (item.minLevel ?? 0)) / Math.max(1, (item.maxLevel ?? 1) - (item.minLevel ?? 0))) * 100);
  const effectProfile = effectProfiles[item.id];
  const unitCost = costRules[item.id] ?? null;
  const flameScale = 0.62 + (tierProgress / 100) * 0.83;
  const crownScale = 0.78 + (tierProgress / 100) * 0.38;
  const crystalScale = 0.76 + (tierProgress / 100) * 0.44;
  const levelLabel = (value: number) => item.mode === 'adaptive' ? `${value}★` : item.mode === 'check' ? `${value}档` : `+${value}`;
  const nextLevelLabel = levelLabel(Math.min(maxSelectable, level + 1));
  const usesLevelOnlyFeedback = instantUpgradeItems.has(item.id);
  const feedbackClass = !usesLevelOnlyFeedback && lastAttempt ? `echo-${outcomeStyle(lastAttempt.kind)}` : '';
  const feedbackKey = usesLevelOnlyFeedback ? item.id : `${item.id}-${lastAttempt?.id ?? 'idle'}`;

  return (
    <main className={`game-forge ${isRolling ? 'is-forging' : ''}`} style={theme}>
      <header className="game-hud compact-hud">
        <div className="player-block">
          <div className="player-avatar"><span>极</span></div>
          <div><p>猫游记养成规划</p><h1>极品号打造计划</h1></div>
        </div>
        <div className="plan-overview"><span><i /> 规则底稿 V0.2</span><b>{completedItems}/{items.length} 项毕业</b></div>
        <div className="hud-actions"><span>已知累计花费 <b>¥{costLedger.knownSpend.toFixed(2)}</b></span><a href="http://www.pet.imop.com/html/6/13/54102.htm" target="_blank" rel="noreferrer">官方公示 ↗</a></div>
      </header>

      <section className="forge-layout">
        <aside className="catalog-panel">
          <div className="catalog-heading"><div><span>培养清单</span><b>{items.length} 项</b></div><small>逐项打造，最终汇总账号成本</small></div>
          <label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索道具或别名" /></label>
          <div className="category-list" aria-label="道具分类">
            {categories.map((entry) => <button key={entry} type="button" className={category === entry ? 'active' : ''} onClick={() => setCategory(entry)}>{entry}</button>)}
          </div>
          <div className="item-list">
            {visibleItems.map((entry) => (
              <button key={entry.id} type="button" className={`item-card tier-${visualTier(entry, levels[entry.id] ?? entry.minLevel ?? 0)} ${entry.id === item.id ? 'active' : ''}`} onClick={() => chooseItem(entry)}>
                <span className="item-symbol" style={{ '--card-accent': entry.accent, '--card-soft': entry.accentSoft } as CSSProperties}>{entry.symbol}</span>
                <span><b>{entry.name}</b><small>{entry.aliases?.length ? entry.aliases.join(' / ') : entry.category}</small><i className="item-meter"><i style={{ width: `${Math.round((((levels[entry.id] ?? entry.minLevel ?? 0) - (entry.minLevel ?? 0)) / Math.max(1, (entry.maxLevel ?? 1) - (entry.minLevel ?? 0))) * 100)}%` }} /></i></span>
                <em>{entry.mode === 'draw' ? '秘宝' : entry.mode === 'adaptive' ? `${levels[entry.id] ?? 0}★` : entry.mode === 'check' ? `${levels[entry.id] ?? entry.minLevel}档` : `+${levels[entry.id] ?? entry.minLevel ?? 0}`}</em>
              </button>
            ))}
            {!visibleItems.length && <p className="no-results">背包里没有这个道具</p>}
          </div>
        </aside>

        <section className="forge-stage">
          <header className="item-hero compact-hero">
            <div><div className="eyebrow"><span>{item.category}</span><i>{item.mode === 'draw' ? '远古秘宝' : item.mode === 'adaptive' ? '星辰遗物' : item.mode === 'check' ? '祝福仪式' : '可成长装备'}</i></div><h2>{item.name}</h2><p>{item.aliases?.length ? `古称：${item.aliases.join('、')} · ` : ''}{item.description}</p></div>
            <div className="hero-status"><div className={`tier-badge tier-${tier}`}><small>当前境界</small><b>{item.mode === 'draw' ? '秘宝' : tierNames[tier]}</b></div><button type="button" className="rules-button" onClick={() => setRulesOpen(true)}>规则详情</button></div>
          </header>

          <div className={`forge-chamber fx-${effectProfile.effect} tier-${tier} ${feedbackClass}`} key={feedbackKey} style={{ '--tier-progress': `${tierProgress}%`, '--flame-scale': flameScale, '--flame-burst-scale': flameScale * 1.28, '--flame-dip-scale': flameScale * 0.9, '--crown-scale': crownScale, '--crown-entry-scale': crownScale * 0.82, '--crown-burst-scale': crownScale * 1.2, '--crystal-scale': crystalScale } as CSSProperties}>
            <div className="altar-glow" />
            {item.mode !== 'draw' && <div className="level-route"><div className="level-focus"><span>当前等级</span><b>{levelLabel(level)}</b><i>→</i><span>目标等级</span><strong>{canForge ? nextLevelLabel : 'MAX'}</strong></div><div className="level-steps" aria-label="强化等级进度">{Array.from({ length: maxSelectable - (item.minLevel ?? 0) + 1 }, (_, index) => (item.minLevel ?? 0) + index).map((step) => <span key={step} className={step === level ? 'current' : step < level ? 'done' : ''} aria-current={step === level ? 'step' : undefined}><i /><b>{step}</b></span>)}</div></div>}
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
            <div className="artifact-name"><span>{item.mode === 'draw' ? '等待唤醒' : canForge ? `${tierNames[tier]}境 · 等待强化` : '已臻至最高境界'}</span><h3>{item.name}</h3><div className="evolution-track" aria-label={`成长进度 ${tierProgress}%`}>{Array.from({ length: 6 }, (_, index) => <i key={index} className={index <= tier ? 'lit' : ''} />)}</div></div>
            {item.mode === 'adaptive' && <label className="star-memory"><span>星辰共鸣次数</span><input type="number" min="1" max="9999" value={attemptCount} onChange={(event) => setAttemptCount(Math.max(1, Number(event.target.value) || 1))} /><small>第 {bandIndex(attemptCount) + 1} 阶共鸣</small></label>}
            <div className="altar-actions"><button type="button" className="secondary-action" onClick={() => simulate(10)} disabled={isRolling || !canForge}>{unitCost !== null ? `十连 · 最多 ¥${(unitCost * 10).toFixed(0)}` : '十连强化'}</button><button type="button" className="primary-action" onClick={() => simulate(1)} disabled={isRolling || !canForge}><span>{isRolling ? '强化中…' : canForge ? unitCost !== null ? `${actionLabel} · ¥${unitCost.toFixed(0)}` : actionLabel : '已经毕业'}</span></button></div>
          </div>

            {lastAttempt && (
              <div className={`result-banner result-tooltip ${outcomeStyle(lastAttempt.kind)} ${usesLevelOnlyFeedback ? 'instant-feedback' : ''}`} role="status">
                <div className="result-sigil">{lastAttempt.kind === 'success' || lastAttempt.kind === 'jump' ? '✦' : lastAttempt.kind === 'draw' ? '◇' : '⌁'}</div>
                <div><span>锻造回响</span><b>{lastAttempt.resultLabel}</b><p>{lastAttempt.itemName} · {lastAttempt.fromLabel} → {lastAttempt.toLabel}</p></div><strong>{lastAttempt.toLabel}</strong><button type="button" aria-label="关闭结果" onClick={() => setLastAttempt(null)}>×</button>
              </div>
            )}

        </section>

        <aside className="session-panel">
          <div className="session-heading"><div><span>极品号账本</span><b>BUILD COST LEDGER</b></div><button type="button" onClick={resetSession}>重置</button></div>
          <div className="budget-total"><span>已录入规则累计花费</span><strong>¥{costLedger.knownSpend.toFixed(2)}</strong><p>燃烧宝石 ¥3 · 灭世之冠 ¥5 · 水晶球 ¥3 / 次</p></div>
          <div className="account-progress"><div><span>账号完成度</span><b>{accountProgress}%</b></div><i><i style={{ width: `${accountProgress}%` }} /></i><small>{completedItems} / {items.length} 项达到目标</small></div>
          <div className="stat-grid"><div><span>强化次数</span><b>{totals.total}</b></div><div><span>成功</span><b>{totals.success}</b></div><div><span>失败</span><b>{totals.risk}</b></div></div>
          <div className="rule-roadmap"><h3>成本规则进度</h3><div className="done"><i>✓</i><span><b>升级概率</b><small>已录入官方公示</small></span></div><div className="done"><i>✓</i><span><b>三项核心道具已计价</b><small>宝石 ¥3 · 王冠 ¥5 · 水晶球 ¥3 · 共 {costLedger.pricedAttempts} 次</small></span></div><div><i>3</i><span><b>其余 15 项成本</b><small>等待共同完善</small></span></div></div>
          <div className="log-heading"><span>最近强化</span><i>{attempts.length} 次</i></div>
          <div className="history-list">
            {!attempts.length ? <div className="empty-history"><span>✦</span><b>尚未开始打造</b><p>选择左侧项目并进行第一次强化</p></div> : attempts.slice(0, 5).map((attempt, index) => (
              <article key={attempt.id} className={outcomeStyle(attempt.kind)}><header><span>第 {attempts.length - index} 次</span><time>{attempt.cost !== null ? `¥${attempt.cost.toFixed(2)}` : '未计价'}</time></header><b>{attempt.itemName}</b><p>{attempt.fromLabel} → {attempt.toLabel}</p><footer><span>{attempt.resultLabel}</span><i>{attempt.probability}% 命运档</i></footer></article>
            ))}
          </div>
          <footer className="session-footer"><span><i /> 当前仅计算养成过程</span><p>未录入的花费不会被估算或虚构</p></footer>
        </aside>
      </section>

      {rulesOpen && <div className="rules-modal" role="dialog" aria-modal="true" aria-label={`${item.name}规则详情`} onMouseDown={(event) => { if (event.target === event.currentTarget) setRulesOpen(false); }}><section><header><div><small>官方概率底稿</small><h2>{item.name}</h2></div><button type="button" onClick={() => setRulesOpen(false)} aria-label="关闭规则">×</button></header><p>{item.sourceNote}</p><div className="table-card">{item.mode === 'draw' ? <div className="rules-table draw-table"><div className="rules-head"><span>结果</span><span>概率</span></div>{item.drawOptions?.map((option) => <div className="rules-line" key={option.label}><b>{option.label}</b><span>{option.probability}%</span></div>)}</div> : item.mode === 'adaptive' ? <div className="rules-table adaptive-table"><div className="rules-head"><span>目标</span><span>≤40</span><span>41–80</span><span>81–150</span><span>&gt;150</span><span>失败后</span></div>{item.adaptiveRows?.map((row) => <div className={`rules-line ${row.target === level + 1 ? 'current' : ''}`} key={row.target}><b>{row.target}★</b>{row.rates.map((rate, index) => <span key={index}>{rate}%</span>)}<span>{row.failureTo}★{row.failureNote ? ` · ${row.failureNote}` : ''}</span></div>)}</div> : <div className="rules-table level-table"><div className="rules-head"><span>当前</span><span>目标</span><span>结果分布</span></div>{item.rows?.map((row) => <div className={`rules-line ${row.current === level ? 'current' : ''}`} key={row.current}><b>+{row.current}</b><span>{row.target === null ? '—' : `+${row.target}`}</span><span>{row.outcomes.map((outcome) => `${outcome.label} ${outcome.probability}%`).join(' · ')}</span></div>)}</div>}</div></section></div>}
    </main>
  );
}
