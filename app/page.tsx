'use client';

import { useMemo, useState, type CSSProperties } from 'react';

type OutcomeKind = 'success' | 'jump' | 'stay' | 'down' | 'fail' | 'draw';
type Mode = 'upgrade' | 'check' | 'draw' | 'adaptive';
type Category = '宝石与圣器' | '特殊强化' | '装备升阶' | '星级系统' | '概率重绘';

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
};

const categories: Array<'全部' | Category> = ['全部', '宝石与圣器', '特殊强化', '装备升阶', '星级系统', '概率重绘'];

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
    id: 'annihilation-crown', name: '灭世之冠', category: '宝石与圣器', mode: 'upgrade', symbol: '♛', accent: '#ff8661', accentSoft: '#3b1c24',
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
    id: 'refining-stone', name: '洗练石', category: '宝石与圣器', mode: 'upgrade', symbol: '⬡', accent: '#58d9d1', accentSoft: '#133c40',
    description: '从 1 级一路强化至 20 级。', sourceNote: '失败后果未在公示表中说明；Mock 失败时不改等级。', minLevel: 1, maxLevel: 20,
    rows: successOnlyRows(1, [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10]),
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
    id: 'moon-cloud', name: '星月彩云', category: '概率重绘', mode: 'draw', symbol: '☁', accent: '#b492ff', accentSoft: '#2a2148',
    description: '触发后随机点亮 1、3 或 5 个星位。', sourceNote: '官方公布触发星位数量分布。',
    drawOptions: [{ label: '1 个星位', probability: 85 }, { label: '3 个星位', probability: 12 }, { label: '5 个星位', probability: 3 }],
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
    id: 'weapon-magic-stone', name: '武器魔石', category: '概率重绘', mode: 'draw', symbol: '⬢', accent: '#ef6e9a', accentSoft: '#421d31',
    description: '随机出现 1、2 或 3 个魔石孔。', sourceNote: '官方公布魔石孔数的出现概率。',
    drawOptions: [{ label: '1 个魔石孔', probability: 80 }, { label: '2 个魔石孔', probability: 15 }, { label: '3 个魔石孔', probability: 5 }],
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
  {
    id: 'cloak-rebirth', name: '披风重生', category: '星级系统', mode: 'check', symbol: '⌁', accent: '#80d77f', accentSoft: '#1d3a28',
    description: '按选定星数读取对应几率。', sourceNote: '公示只给出星数与几率，未列成功或失败后的等级。', minLevel: 1, maxLevel: 15,
    rows: checkRows(1, [100, 80, 70, 50, 40, 30, 20, 10, 5, 5, 60, 50, 30, 20, 10]),
  },
  {
    id: 'cloak-redraw', name: '披风重绘', category: '概率重绘', mode: 'draw', symbol: '▧', accent: '#69dbb2', accentSoft: '#173c34',
    description: '按公示概率随机获得一种图腾名称。', sourceNote: '十三种图腾概率合计 100%。',
    drawOptions: [
      { label: '鲲图腾', probability: 12 }, { label: '鹏图腾', probability: 12 }, { label: '天狼图腾', probability: 10 }, { label: '青犀图腾', probability: 10 }, { label: '雪狐图腾', probability: 10 }, { label: '金蟾图腾', probability: 10 },
      { label: '灵蛇图腾', probability: 8 }, { label: '鬼车图腾', probability: 8 }, { label: '金狮图腾', probability: 8 }, { label: '青龙图腾', probability: 3 }, { label: '白虎图腾', probability: 3 }, { label: '朱雀图腾', probability: 3 }, { label: '玄武图腾', probability: 3 },
    ],
  },
  {
    id: 'soulforging', name: '魂化', category: '装备升阶', mode: 'upgrade', symbol: '◈', accent: '#7e96ff', accentSoft: '#20284a',
    description: '覆盖 0–15 级的魂化成功率。', sourceNote: '失败后果未在公示表中说明；Mock 失败时不改等级。', minLevel: 0, maxLevel: 15,
    rows: successOnlyRows(0, [100,100,100,40,30,20,10,5,5,3,10,5,4,3,1]),
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
  }

  function selectLevel(next: number) {
    setLevels((current) => ({ ...current, [item.id]: next }));
    setLastAttempt(null);
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
    setIsRolling(true);
    window.setTimeout(() => {
      if (item.mode === 'upgrade' || item.mode === 'adaptive') setLevels((current) => ({ ...current, [item.id]: currentLevel }));
      if (item.mode === 'adaptive') setAttemptCount(currentCount);
      setAttempts((current) => [...generated.reverse(), ...current].slice(0, 120));
      setLastAttempt(generated[0]);
      setIsRolling(false);
    }, times === 1 ? 460 : 720);
  }

  function resetSession() {
    setLevels(initialLevels);
    setAttemptCount(1);
    setAttempts([]);
    setLastAttempt(null);
  }

  const theme = { '--accent': item.accent, '--accent-soft': item.accentSoft } as CSSProperties;
  const maxSelectable = item.maxLevel ?? item.minLevel ?? 0;
  const canForge = item.mode === 'draw' || outcomes.length > 0;
  const actionLabel = item.mode === 'draw' ? '唤醒图腾' : item.mode === 'check' ? '进行祈愿' : item.mode === 'adaptive' ? '点亮星辰' : '开始强化';
  const levelName = item.mode === 'adaptive' ? `${level} 星` : item.mode === 'check' ? `${level} 档` : `+${level}`;

  function shiftLevel(delta: number) {
    selectLevel(Math.min(maxSelectable, Math.max(item.minLevel ?? 0, level + delta)));
  }

  return (
    <main className={`game-forge ${isRolling ? 'is-forging' : ''}`} style={theme}>
      <header className="game-hud">
        <div className="player-block">
          <div className="player-avatar"><span>喵</span><i>67</i></div>
          <div><p>星月旅团</p><h1>猫游记 · 天穹工坊</h1></div>
        </div>
        <nav className="world-tabs" aria-label="工坊导航"><button className="active">强化祭坛</button><button>冒险图鉴</button><button>旅团仓库</button></nav>
        <div className="wallet"><span><i>◈</i><b>8,888</b></span><span><i>●</i><b>238,400</b></span><a href="http://www.pet.imop.com/html/6/13/54102.htm" target="_blank" rel="noreferrer">规则公示</a></div>
      </header>

      <section className="forge-layout">
        <aside className="catalog-panel">
          <div className="catalog-heading"><div><span>旅团背包</span><b>{items.length}/24</b></div><small>选择要锻造的道具</small></div>
          <label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索道具或别名" /></label>
          <div className="category-list" aria-label="道具分类">
            {categories.map((entry) => <button key={entry} type="button" className={category === entry ? 'active' : ''} onClick={() => setCategory(entry)}>{entry}</button>)}
          </div>
          <div className="item-list">
            {visibleItems.map((entry) => (
              <button key={entry.id} type="button" className={`item-card ${entry.id === item.id ? 'active' : ''}`} onClick={() => chooseItem(entry)}>
                <span className="item-symbol" style={{ '--card-accent': entry.accent, '--card-soft': entry.accentSoft } as CSSProperties}>{entry.symbol}</span>
                <span><b>{entry.name}</b><small>{entry.aliases?.length ? entry.aliases.join(' / ') : entry.category}</small></span>
                <em>{entry.mode === 'draw' ? '秘宝' : entry.mode === 'adaptive' ? `${levels[entry.id] ?? 0}★` : entry.mode === 'check' ? `${levels[entry.id] ?? entry.minLevel}档` : `+${levels[entry.id] ?? entry.minLevel ?? 0}`}</em>
              </button>
            ))}
            {!visibleItems.length && <p className="no-results">背包里没有这个道具</p>}
          </div>
        </aside>

        <section className="forge-stage">
          <header className="item-hero">
            <div><div className="eyebrow"><span>{item.category}</span><i>{item.mode === 'draw' ? '远古秘宝' : item.mode === 'adaptive' ? '星辰遗物' : item.mode === 'check' ? '祝福仪式' : '可成长装备'}</i></div><h2>{item.name}</h2><p>{item.aliases?.length ? `古称：${item.aliases.join('、')} · ` : ''}{item.description}</p></div>
            <div className="independent-badge"><b>命运独立</b><span>每次锻造重新判定</span></div>
          </header>

          <div className="forge-chamber">
            <div className="floating-rune rune-one">✦</div><div className="floating-rune rune-two">⌁</div><div className="floating-rune rune-three">◇</div>
            <div className="altar-glow" />
            <div className="artifact-wrap">
              <div className="orbit orbit-one" /><div className="orbit orbit-two" />
              <div className="artifact"><span>{item.symbol}</span></div>
              {item.mode !== 'draw' && <b className="artifact-level">{levelName}</b>}
            </div>
            <div className="artifact-name"><span>{item.mode === 'draw' ? '等待唤醒' : canForge ? '等待强化' : '已臻至最高境界'}</span><h3>{item.name}</h3></div>
            {item.mode !== 'draw' && (
              <div className="rank-switcher" aria-label="试炼档位">
                <button type="button" onClick={() => shiftLevel(-1)} disabled={level <= (item.minLevel ?? 0)}>−</button>
                <div><small>试炼档位</small><b>{levelName}</b></div>
                <button type="button" onClick={() => shiftLevel(1)} disabled={level >= maxSelectable}>＋</button>
              </div>
            )}
            {item.mode === 'adaptive' && <label className="star-memory"><span>星辰共鸣次数</span><input type="number" min="1" max="9999" value={attemptCount} onChange={(event) => setAttemptCount(Math.max(1, Number(event.target.value) || 1))} /><small>第 {bandIndex(attemptCount) + 1} 阶共鸣</small></label>}
          </div>

          <div className="ritual-dock">
            <section className="offering-panel">
              <div className="section-title"><div><span>✧</span><h3>锻造祭品</h3></div><small>试炼场无限供应</small></div>
              <div className="offering-slots">
                <div><i>{item.symbol}</i><span>主道具</span><b>{item.name}</b></div>
                <div><i>✦</i><span>{item.mode === 'draw' ? '唤灵媒介' : item.mode === 'check' ? '祈愿媒介' : '强化媒介'}</span><b>星辉结晶</b></div>
                <div><i>●</i><span>锻造费用</span><b>{item.mode === 'draw' ? '1,200' : `${600 + level * 240}`} 金</b></div>
              </div>
            </section>
            <section className="omen-panel">
              <div className="section-title"><div><span>☾</span><h3>命运预兆</h3></div><small>{item.sourceNote}</small></div>
              {!outcomes.length ? <div className="maxed-message"><b>MAX</b><span>这件道具已经完成最终成长</span></div> : <div className="omen-list">{outcomes.map((outcome) => <div className={outcomeStyle(outcome.kind)} key={outcome.key}><span>{outcome.label}</span><b>{outcome.probability}%</b></div>)}</div>}
            </section>
          </div>

          <div className="forge-actions">
            <button type="button" className="secondary-action" onClick={() => simulate(10)} disabled={isRolling || !canForge}>十连锻造</button>
            <button type="button" className="primary-action" onClick={() => simulate(1)} disabled={isRolling || !canForge}><i>✦</i><span>{isRolling ? '命运交汇中…' : canForge ? actionLabel : '已经满级'}</span><i>✦</i></button>
            <p>试炼场不会消耗真实游戏道具</p>
          </div>

            {lastAttempt && (
              <div className={`result-banner ${outcomeStyle(lastAttempt.kind)}`} role="status">
                <div className="result-sigil">{lastAttempt.kind === 'success' || lastAttempt.kind === 'jump' ? '✦' : lastAttempt.kind === 'draw' ? '◇' : '⌁'}</div>
                <div><span>锻造回响</span><b>{lastAttempt.resultLabel}</b><p>{lastAttempt.itemName} · {lastAttempt.fromLabel} → {lastAttempt.toLabel}</p></div><strong>{lastAttempt.toLabel}</strong><button type="button" aria-label="关闭结果" onClick={() => setLastAttempt(null)}>×</button>
              </div>
            )}

            <details className="rule-scroll">
              <summary><span>冒险者公会 · 锻造规则卷轴</span><small>展开查看官方公示概率</small></summary>
              <section className="table-card">
              {item.mode === 'draw' ? (
                <div className="rules-table draw-table"><div className="rules-head"><span>结果</span><span>概率</span></div>{item.drawOptions?.map((option) => <div className="rules-line" key={option.label}><b>{option.label}</b><span>{option.probability}%</span></div>)}</div>
              ) : item.mode === 'adaptive' ? (
                <div className="rules-table adaptive-table"><div className="rules-head"><span>目标</span><span>≤40</span><span>41–80</span><span>81–150</span><span>&gt;150</span><span>失败后</span></div>{item.adaptiveRows?.map((row) => <div className={`rules-line ${row.target === level + 1 ? 'current' : ''}`} key={row.target}><b>{row.target}★</b>{row.rates.map((rate, index) => <span key={index}>{rate}%</span>)}<span>{row.failureTo}★{row.failureNote ? ` · ${row.failureNote}` : ''}</span></div>)}</div>
              ) : (
                <div className="rules-table level-table"><div className="rules-head"><span>当前</span><span>目标</span><span>结果分布</span></div>{item.rows?.map((row) => <div className={`rules-line ${row.current === level ? 'current' : ''}`} key={row.current}><b>+{row.current}</b><span>{row.target === null ? '—' : `+${row.target}`}</span><span>{row.outcomes.map((outcome) => `${outcome.label} ${outcome.probability}%`).join(' · ')}</span></div>)}</div>
              )}
              </section>
            </details>
        </section>

        <aside className="session-panel">
          <div className="session-heading"><div><span>冒险战报</span><b>FORGE CHRONICLE</b></div><button type="button" onClick={resetSession}>重置旅程</button></div>
          <div className="stat-grid"><div><span>锻造</span><b>{totals.total}</b></div><div><span>祝福</span><b>{totals.success}</b></div><div><span>厄运</span><b>{totals.risk}</b></div></div>
          <div className="log-heading"><span>工坊回响</span><i>{attempts.length}/120</i></div>
          <div className="history-list">
            {!attempts.length ? <div className="empty-history"><span>✦</span><b>祭坛仍在沉睡</b><p>第一次锻造会唤醒这里的记录</p></div> : attempts.map((attempt, index) => (
              <article key={attempt.id} className={outcomeStyle(attempt.kind)}><header><span>第 {attempts.length - index} 次</span><time>命运值 {attempt.roll.toFixed(2)}</time></header><b>{attempt.itemName}</b><p>{attempt.fromLabel} → {attempt.toLabel}</p><footer><span>{attempt.resultLabel}</span><i>{attempt.probability}% 命运档</i></footer></article>
            ))}
          </div>
          <footer className="session-footer"><span><i /> 公会规则已校准</span><p>所有判定依据官方《概率公示Ⅱ》</p></footer>
        </aside>
      </section>
    </main>
  );
}
