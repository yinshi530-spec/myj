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

type GuardianSkill = {
  id: string;
  groupId: string;
  groupName: string;
  name: string;
  level: number;
  probability: number;
  accent: string;
};

type GuardianSlot = {
  id: number;
  skillId: string | null;
  refreshes: number;
};

type GuardianHistoryEntry = {
  id: number;
  slotId: number;
  skillId: string;
  previousSkillId: string | null;
  mode: 'single' | 'all' | 'until-five';
  batchAttempts?: number;
};

type GachaRarity = 'mythic' | 'legendary' | 'epic' | 'rare' | 'common';

type GachaPrize = {
  id: string;
  name: string;
  icon: string;
  probability: number;
  rarity: GachaRarity;
};

type GachaPull = {
  id: number;
  prizeId: string;
};

type GachaLoot = {
  id: string;
  name: string;
  icon: string;
  probability: number;
  sellPrice: number;
  rarity: GachaRarity;
};

type GachaContainer = {
  prizeId: string;
  label: string;
  items: GachaLoot[];
};

type LuckyItem = {
  id: string;
  name: string;
  icon: string;
  sellPrice: number;
  rarity: GachaRarity;
  container?: 'zodiac';
};

type LuckyReward = {
  itemId: string;
  min: number;
  max: number;
};

type LuckyChanceRow = {
  id: string;
  probability: number;
  rewards: LuckyReward[];
};

type LuckyDrop = {
  id: number;
  itemId: string;
  quantity: number;
};

type RareAnnouncement = {
  id: number;
  icon: string;
  name: string;
  eyebrow: string;
  message: string;
  tone: 'treasure' | 'celestial';
};

type ContainerRevealItem = {
  id: string;
  name: string;
  icon: string;
  rarity: GachaRarity;
  sellPrice: number;
  quantity: number;
};

type ContainerReveal = {
  id: number;
  source: 'gacha' | 'zodiac';
  phase: 'opening' | 'result';
  containerName: string;
  containerIcon: string;
  openCount: number;
  items: ContainerRevealItem[];
};

const sessionStorageKey = 'myj-forge-session-v1';
const guardianStorageKey = 'myj-guardian-skills-v1';
const fundStorageKey = 'myj-hourly-fund-v1';
const gachaStorageKey = 'myj-cat-gacha-v1';
const luckyStorageKey = 'myj-wangwang-pack-v1';
const hourlyFundAmount = 10000;
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

const itemInstancePalettes: Record<string, Array<{ accent: string; soft: string }>> = {
  'crystal-ball': [
    { accent: '#66c9ff', soft: '#15394e' },
    { accent: '#ff789d', soft: '#4a1c2e' },
    { accent: '#4edfc0', soft: '#123b34' },
    { accent: '#b98aff', soft: '#35214f' },
    { accent: '#ffc85c', soft: '#4a3517' },
  ],
  'moon-myth': [
    { accent: '#ffd56a', soft: '#4a3715' },
    { accent: '#62d58a', soft: '#153c29' },
    { accent: '#58bfff', soft: '#16384f' },
    { accent: '#ff6655', soft: '#4b1e19' },
    { accent: '#cf9b58', soft: '#40301e' },
  ],
  'holy-gift': [
    { accent: '#4ed8c0', soft: '#123b36' },
    { accent: '#d8e4f2', soft: '#303944' },
    { accent: '#ff695c', soft: '#4a1d1b' },
    { accent: '#728cff', soft: '#202b52' },
    { accent: '#f4c75d', soft: '#493716' },
  ],
  'goddess-fate': [
    { accent: '#d7a760', soft: '#44301d' },
    { accent: '#ec7fac', soft: '#472139' },
    { accent: '#69d9f1', soft: '#173d4a' },
  ],
  earring: [
    { accent: '#66dbad', soft: '#153c31' },
    { accent: '#ff9a55', soft: '#4a2818' },
  ],
};

const guardianRankProbabilities = [2.5, 1.88, 1.25, 0.56, 0.06] as const;
const guardianRankNames = ['白卡', '绿卡', '蓝卡', '紫卡', '橙卡'] as const;
const guardianRankColors = ['#e2e7ea', '#53d889', '#56aaff', '#b879f2', '#ff8a3d'] as const;
const guardianSkillGroups = [
  { id: 'armor', name: '甲胄', accent: '#e0b85f', skills: ['铜甲', '铁甲', '钢甲', '银甲', '金甲'] },
  { id: 'resolve', name: '意志', accent: '#d28d62', skills: ['坚忍', '坚强', '坚定', '坚韧', '坚毅'] },
  { id: 'agility', name: '身法', accent: '#63d6a2', skills: ['灵活', '敏锐', '机敏', '迅捷', '敏捷'] },
  { id: 'strength', name: '体魄', accent: '#e66e63', skills: ['强壮', '强健', '顽强', '强韧', '刚毅'] },
  { id: 'wisdom', name: '灵识', accent: '#7bbdff', skills: ['聪颖', '慧黠', '颖悟', '聪慧', '灵智'] },
  { id: 'chance', name: '机缘', accent: '#efb85c', skills: ['偶然', '侥幸', '巧合', '意外', '惊喜'] },
  { id: 'blood', name: '血契', accent: '#e95f72', skills: ['抽取', '吸血', '狂热', '嗜血', '血浴'] },
  { id: 'armor-spirit', name: '胄系', accent: '#62c8d9', skills: ['兰胄', '灵胄', '幻胄', '法胄', '魔胄'] },
  { id: 'dispel', name: '驱散', accent: '#8bc79a', skills: ['分散', '耗散', '消散', '弥散', '驱散'] },
  { id: 'barrier', name: '屏障', accent: '#91a8e8', skills: ['抑制', '抵消', '结界', '屏障', '屏蔽'] },
  { id: 'mana', name: '汲魔', accent: '#a889ec', skills: ['汲取', '吸收', '吸取', '摄取', '吸魔'] },
  { id: 'stable', name: '稳固', accent: '#c4b99f', skills: ['稳定', '稳固', '牢固', '坚固', '不灭'] },
  { id: 'flame', name: '炎术', accent: '#ff7b4e', skills: ['蒸发', '点燃', '灼烧', '蓝炎', '烧尽'] },
  { id: 'corrode', name: '腐蚀', accent: '#9bc65b', skills: ['腐化', '腐败', '腐蚀', '侵蚀', '瓦解'] },
  { id: 'pierce', name: '穿甲', accent: '#d99b6c', skills: ['破甲', '穿透', '透甲', '穿刺', '撕裂'] },
  { id: 'fortune', name: '命数', accent: '#f0cd72', skills: ['一般', '正常', '乐观', '运气', '幸运'] },
] as const;

const guardianSkills: GuardianSkill[] = guardianSkillGroups.flatMap((group) => group.skills.map((name, index) => ({
  id: `${group.id}:${index + 1}`,
  groupId: group.id,
  groupName: group.name,
  name,
  level: index + 1,
  probability: guardianRankProbabilities[index],
  accent: group.accent,
})));
const guardianSkillById = new Map(guardianSkills.map((skill) => [skill.id, skill]));
const initialGuardianSlots: GuardianSlot[] = Array.from({ length: 4 }, (_, index) => ({ id: index + 1, skillId: null, refreshes: 0 }));

const gachaRarityMeta: Record<GachaRarity, { name: string; short: string; color: string }> = {
  mythic: { name: '神话', short: 'UR', color: '#ffcf66' },
  legendary: { name: '传说', short: 'SSR', color: '#ff7e68' },
  epic: { name: '珍奇', short: 'SR', color: '#bd82ff' },
  rare: { name: '稀有', short: 'R', color: '#68b8ff' },
  common: { name: '常见', short: 'N', color: '#73d6ad' },
};

function gachaRarity(probability: number): GachaRarity {
  if (probability <= 0.02) return 'mythic';
  if (probability <= 0.11) return 'legendary';
  if (probability <= 0.95) return 'epic';
  if (probability <= 1.68) return 'rare';
  return 'common';
}

const gachaPrizeRows: Array<[string, number]> = [
  ['强能之晶', 0.01], ['装备配饰包lv8', 0.02], ['白色宠物蛋', 0.11], ['圣地灵猿', 0.11], ['天使泡泡', 0.08], ['恶魔泡泡', 0.08],
  ['情比金坚对戒', 0.11], ['高级宝石守护符', 0.11], ['怪爷爷召唤符', 0.42], ['血骑士召唤符', 0.56], ['技能强化剂', 0.42],
  ['高级完璧宝玉', 0.84], ['天火石', 0.84], ['法宝完璧宝玉', 0.84], ['神赐之星', 1.68], ['强化祝福lv3', 1.05], ['叮当宝石袋', 1.05],
  ['坐骑勋章', 1.68], ['神秘水晶', 2.80], ['元素之卵', 0.93], ['元力', 0.93], ['元素之力', 0.95], ['宝珠合成符', 0.95],
  ['历练骰子', 2.05], ['催化之力', 0.95], ['超绝魂魄之精', 1.15], ['神符孔精粹符', 1.15], ['高级法宝完璧宝玉', 1.15],
  ['神秘的画笔', 1.15], ['奇迹画笔', 1.15], ['卡片合成符', 2.80], ['声望放大镜', 2.80], ['翼灵重生石', 2.80],
  ['翼灵灵力宝石', 2.80], ['翼灵技能锦囊', 3.21], ['中级宝石合成符', 2.80], ['低级宝石摘除符', 4.21], ['技能百宝箱', 4.21],
  ['蓝色小药丸', 4.21], ['全技能刷新符', 2.80], ['特有技能刷新符', 3.21], ['坐骑装备合成符', 3.21], ['天机石', 3.21],
  ['源质合金', 3.21], ['守护灵技能锦囊', 3.21], ['奥意魂魄之精', 3.21], ['锦囊', 3.21], ['秘银钥匙', 5.35],
  ['时光药水', 4.21], ['旅馆套房卡', 4.21], ['神龙锦囊', 0.01], ['萌萌', 0.27], ['新召唤神丹', 0.07], ['筋斗云', 0.18],
  ['幻彩宝石包', 1.05], ['宠物转转蛋', 1.05], ['单技能刷新符', 1.05], ['法宝道具包', 1.05], ['金丝银线', 1.05],
];

const gachaPrizeIcons = [
  '💎', '🎁', '🥚', '🐒', '😇', '😈', '💍', '🛡️', '👴', '⚔️', '🧪', '🔮', '🔥', '🧿', '⭐', '🙏', '👝', '🎖️', '🔷', '🌈',
  '🌀', '⚡', '📜', '🎲', '🧬', '👻', '🕳️', '🏵️', '🖌️', '🎨', '🃏', '🔍', '🪽', '🪶', '📖', '🔨', '🧲', '🧰', '💊', '♻️',
  '🎯', '🧩', '🪨', '⚙️', '📚', '👁️', '🧧', '🗝️', '⏳', '🏨', '🐉', '😺', '🍥', '☁️', '🌈', '🎰', '🔄', '📦', '🧵',
] as const;

const gachaPrizes: GachaPrize[] = gachaPrizeRows.map(([name, probability], index) => ({ id: `gacha-${index + 1}`, name, icon: gachaPrizeIcons[index] ?? '◆', probability, rarity: gachaRarity(probability) }));
const gachaPrizeById = new Map(gachaPrizes.map((prize) => [prize.id, prize]));
const gachaTotalWeight = gachaPrizes.reduce((sum, prize) => sum + prize.probability, 0);
const gachaUnitCost = 2;
const gachaSellPrices = Object.fromEntries([
  300, null, 20, 20, 30, 30, 24, 24, null, null, 8, 10, 5, 5, 3, 4, 4, 3, 1, 1, 3, 3, 3, 1, 3, 1, 8, 10, 8, 8,
  2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 200, 10, 50, 10, 4, 4, 5, 10, 7,
].flatMap((price, index) => price === null ? [] : [[`gacha-${index + 1}`, price]])) as Record<string, number>;

const gachaContainers: Record<string, GachaContainer> = {
  'gacha-2': {
    prizeId: 'gacha-2',
    label: '八色冥石匣',
    items: [
      { id: 'loot-blue-ming', name: '蓝冥石', icon: '🔵', probability: 12.5, sellPrice: 800, rarity: 'mythic' },
      { id: 'loot-red-ming', name: '红冥石', icon: '🔴', probability: 12.5, sellPrice: 400, rarity: 'legendary' },
      { id: 'loot-black-tortoise', name: '玄武岩心', icon: '🪨', probability: 12.5, sellPrice: 100, rarity: 'epic' },
      { id: 'loot-jade-shadow', name: '翠影灵石', icon: '🟢', probability: 12.5, sellPrice: 100, rarity: 'epic' },
      { id: 'loot-sun-glow', name: '曜光晶石', icon: '☀️', probability: 12.5, sellPrice: 100, rarity: 'epic' },
      { id: 'loot-purple-lightning', name: '紫电魔石', icon: '⚡', probability: 12.5, sellPrice: 100, rarity: 'epic' },
      { id: 'loot-star-moon', name: '星辉月石', icon: '🌙', probability: 12.5, sellPrice: 100, rarity: 'epic' },
      { id: 'loot-sky-essence', name: '苍穹精石', icon: '💠', probability: 12.5, sellPrice: 100, rarity: 'epic' },
    ],
  },
  'gacha-9': {
    prizeId: 'gacha-9',
    label: '怪爷爷饰品珍藏',
    items: [
      { id: 'loot-duck-bottle', name: '瓶子里的小鸭子', icon: '🐥', probability: 1, sellPrice: 800, rarity: 'mythic' },
      { id: 'loot-dragon-wing', name: '强效龙翼', icon: '🐉', probability: 4, sellPrice: 60, rarity: 'legendary' },
      { id: 'loot-hero-medal', name: '英雄勋章', icon: '🏅', probability: 5, sellPrice: 58, rarity: 'legendary' },
      { id: 'loot-time-rift', name: '时空缝隙', icon: '🌀', probability: 6, sellPrice: 10, rarity: 'epic' },
      { id: 'loot-allround-medal', name: '通吃勋章', icon: '🎖️', probability: 7, sellPrice: 9, rarity: 'epic' },
      { id: 'loot-battle-mark', name: '作战徽记', icon: '⚔️', probability: 8, sellPrice: 8, rarity: 'epic' },
      { id: 'loot-iron-shield', name: '铁盾胸针', icon: '🛡️', probability: 9, sellPrice: 7, rarity: 'rare' },
      { id: 'loot-pocket-cannon', name: '袖珍大炮', icon: '💣', probability: 9, sellPrice: 6, rarity: 'rare' },
      { id: 'loot-little-poker', name: '小扑挂坠', icon: '♠️', probability: 10, sellPrice: 5, rarity: 'rare' },
      { id: 'loot-silver-spoon', name: '银勺护符', icon: '🥄', probability: 10, sellPrice: 4, rarity: 'common' },
      { id: 'loot-power-screw', name: '动力螺丝', icon: '🔩', probability: 10, sellPrice: 3, rarity: 'common' },
      { id: 'loot-alchemy-stone', name: '炼金石', icon: '⚗️', probability: 10, sellPrice: 2, rarity: 'common' },
      { id: 'loot-mana-lens', name: '法力透镜', icon: '🔍', probability: 11, sellPrice: 1, rarity: 'common' },
    ],
  },
  'gacha-10': {
    prizeId: 'gacha-10',
    label: '血骑士战利品',
    items: [
      { id: 'loot-fearless-breastplate', name: '无畏胸甲', icon: '🛡️', probability: 1, sellPrice: 500, rarity: 'mythic' },
      { id: 'loot-fearless-helmet', name: '无畏头盔', icon: '🪖', probability: 4, sellPrice: 60, rarity: 'legendary' },
      { id: 'loot-fearless-shoulders', name: '无畏肩甲', icon: '🦾', probability: 5, sellPrice: 58, rarity: 'legendary' },
      { id: 'loot-fearless-leggings', name: '无畏腿铠', icon: '🦿', probability: 6, sellPrice: 9.8, rarity: 'epic' },
      { id: 'loot-fearless-gauntlets', name: '无畏护手', icon: '🥊', probability: 7, sellPrice: 8.8, rarity: 'epic' },
      { id: 'loot-fearless-boots', name: '无畏战靴', icon: '🥾', probability: 8, sellPrice: 7.8, rarity: 'epic' },
      { id: 'loot-fearless-belt', name: '无畏腰带', icon: '🔗', probability: 9, sellPrice: 6.8, rarity: 'rare' },
      { id: 'loot-fearless-bracers', name: '无畏护腕', icon: '⛓️', probability: 10, sellPrice: 5.8, rarity: 'rare' },
      { id: 'loot-source-ore', name: '源质矿石', icon: '🪨', probability: 10, sellPrice: 4.8, rarity: 'rare' },
      { id: 'loot-frostweave', name: '冰霜暗纹', icon: '❄️', probability: 10, sellPrice: 3.8, rarity: 'rare' },
      { id: 'loot-demon-crystal', name: '魔化晶石', icon: '🔮', probability: 15, sellPrice: 2.8, rarity: 'common' },
      { id: 'loot-mana-crystal', name: '法力结晶', icon: '💠', probability: 15, sellPrice: 1.8, rarity: 'common' },
    ],
  },
};
const gachaLootById = new Map(Object.values(gachaContainers).flatMap((container) => container.items).map((loot) => [loot.id, loot]));

const luckyPackUnitCost = 8;
const luckyPackBatchSize = 10;
const luckyItems: LuckyItem[] = [
  { id: 'lucky-perfect-jade', name: '完璧宝玉', icon: '🔮', sellPrice: 5, rarity: 'rare' },
  { id: 'lucky-upgrade-stone', name: '升级石', icon: '🪨', sellPrice: 0.1, rarity: 'common' },
  { id: 'lucky-vitality-element', name: '体力元素LV3', icon: '❤️', sellPrice: 0.1, rarity: 'common' },
  { id: 'lucky-intelligence-element', name: '智力元素LV3', icon: '💧', sellPrice: 0.1, rarity: 'common' },
  { id: 'lucky-strength-element', name: '力量元素LV3', icon: '🔥', sellPrice: 0.1, rarity: 'common' },
  { id: 'lucky-drill', name: '钻孔器', icon: '🔩', sellPrice: 0.1, rarity: 'common' },
  { id: 'lucky-solvent', name: '元素溶剂', icon: '🧪', sellPrice: 0.1, rarity: 'common' },
  { id: 'lucky-training-card', name: '练功房门卡', icon: '🎫', sellPrice: 1, rarity: 'common' },
  { id: 'lucky-pouch', name: '锦囊', icon: '🧧', sellPrice: 1, rarity: 'common' },
  { id: 'lucky-short-blessing', name: '短效赐福光环', icon: '⭕', sellPrice: 0.1, rarity: 'common' },
  { id: 'lucky-moon-goddess-blessing', name: '月神赐福光环', icon: '🌙', sellPrice: 0.1, rarity: 'common' },
  { id: 'lucky-moonlight-blessing', name: '月光的祝福', icon: '✨', sellPrice: 0.1, rarity: 'common' },
  { id: 'lucky-whetstone', name: '强力磨刀石', icon: '⚔️', sellPrice: 0.1, rarity: 'common' },
  { id: 'lucky-ultra-soul', name: '超绝魂魄之精', icon: '👻', sellPrice: 0.1, rarity: 'common' },
  { id: 'lucky-soul-injection-4', name: '灵魂之注（Lv4）', icon: '🟣', sellPrice: 0.1, rarity: 'common' },
  { id: 'lucky-soul-injection-3', name: '灵魂之注（Lv3）', icon: '🔵', sellPrice: 0.1, rarity: 'common' },
  { id: 'lucky-soul-injection-2', name: '灵魂之注（Lv2）', icon: '🟢', sellPrice: 0.1, rarity: 'common' },
  { id: 'lucky-magic-spring-4', name: '魔法之泉（Lv4）', icon: '💜', sellPrice: 0.1, rarity: 'common' },
  { id: 'lucky-magic-spring-3', name: '魔法之泉（Lv3）', icon: '💙', sellPrice: 0.1, rarity: 'common' },
  { id: 'lucky-magic-spring-2', name: '魔法之泉（Lv2）', icon: '💚', sellPrice: 0.1, rarity: 'common' },
  { id: 'lucky-moonlight-3', name: '月光的祝福Lv3', icon: '🌕', sellPrice: 0.1, rarity: 'common' },
  { id: 'lucky-moonlight-2', name: '月光的祝福Lv2', icon: '🌓', sellPrice: 0.1, rarity: 'common' },
  { id: 'lucky-spirit-potion', name: '极效精神药剂', icon: '🧴', sellPrice: 0.1, rarity: 'common' },
  { id: 'lucky-fearless-power', name: '无畏之力', icon: '🛡️', sellPrice: 1, rarity: 'common' },
  { id: 'lucky-annihilation-power', name: '湮灭之力', icon: '🌑', sellPrice: 1, rarity: 'common' },
  { id: 'lucky-pet-roulette', name: '宠物转转蛋', icon: '🎰', sellPrice: 1, rarity: 'common' },
  { id: 'lucky-monster-summon-3', name: '魔物召唤符（Lv3）', icon: '👹', sellPrice: 10, rarity: 'epic' },
  { id: 'lucky-blood-knight', name: '血骑士召唤符', icon: '⚔️', sellPrice: 10, rarity: 'epic' },
  { id: 'lucky-skill-book-3', name: '技能经验书III', icon: '📕', sellPrice: 1, rarity: 'common' },
  { id: 'lucky-outfit-pack', name: '灵纹换装包', icon: '👘', sellPrice: 5, rarity: 'rare' },
  { id: 'lucky-zodiac-egg', name: '生肖彩蛋', icon: '🥚', sellPrice: 80, rarity: 'legendary', container: 'zodiac' },
  { id: 'lucky-phoenix-baby', name: '凤凰宝宝', icon: '🐣', sellPrice: 300, rarity: 'mythic' },
  { id: 'lucky-gem-accessory-charm', name: '高级宝石配饰符', icon: '💎', sellPrice: 5, rarity: 'rare' },
  { id: 'lucky-new-summon-pill', name: '新召唤神丹', icon: '🔴', sellPrice: 50, rarity: 'legendary' },
];

const luckyChanceRows: LuckyChanceRow[] = [
  { id: 'perfect-jade', probability: 5, rewards: [{ itemId: 'lucky-perfect-jade', min: 1, max: 2 }, { itemId: 'lucky-upgrade-stone', min: 1, max: 5 }] },
  { id: 'vitality-element', probability: 3, rewards: [{ itemId: 'lucky-vitality-element', min: 1, max: 3 }, { itemId: 'lucky-drill', min: 3, max: 4 }] },
  { id: 'intelligence-element', probability: 3, rewards: [{ itemId: 'lucky-intelligence-element', min: 1, max: 3 }, { itemId: 'lucky-drill', min: 3, max: 4 }] },
  { id: 'strength-element', probability: 3, rewards: [{ itemId: 'lucky-strength-element', min: 1, max: 3 }, { itemId: 'lucky-drill', min: 3, max: 4 }] },
  { id: 'drill-solvent', probability: 5, rewards: [{ itemId: 'lucky-drill', min: 1, max: 3 }, { itemId: 'lucky-solvent', min: 3, max: 4 }] },
  { id: 'training-card', probability: 5, rewards: [{ itemId: 'lucky-training-card', min: 10, max: 12 }] },
  { id: 'pouch', probability: 5, rewards: [{ itemId: 'lucky-pouch', min: 10, max: 12 }] },
  { id: 'short-blessing', probability: 5, rewards: [{ itemId: 'lucky-short-blessing', min: 12, max: 20 }] },
  { id: 'moon-goddess-blessing', probability: 5, rewards: [{ itemId: 'lucky-moon-goddess-blessing', min: 3, max: 5 }] },
  { id: 'moonlight-whetstone', probability: 5, rewards: [{ itemId: 'lucky-moonlight-blessing', min: 3, max: 5 }, { itemId: 'lucky-whetstone', min: 3, max: 5 }] },
  { id: 'ultra-soul', probability: 5, rewards: [{ itemId: 'lucky-ultra-soul', min: 2, max: 3 }, { itemId: 'lucky-short-blessing', min: 2, max: 4 }] },
  { id: 'soul-4-spring-2', probability: 5, rewards: [{ itemId: 'lucky-soul-injection-4', min: 1, max: 1 }, { itemId: 'lucky-magic-spring-2', min: 1, max: 1 }] },
  { id: 'spring-4-soul-2', probability: 5, rewards: [{ itemId: 'lucky-magic-spring-4', min: 1, max: 1 }, { itemId: 'lucky-soul-injection-2', min: 1, max: 1 }] },
  { id: 'moonlight-levels', probability: 5, rewards: [{ itemId: 'lucky-moonlight-3', min: 1, max: 1 }, { itemId: 'lucky-moonlight-2', min: 1, max: 1 }, { itemId: 'lucky-moonlight-blessing', min: 1, max: 1 }] },
  { id: 'soul-3-spring-2', probability: 5, rewards: [{ itemId: 'lucky-soul-injection-3', min: 1, max: 1 }, { itemId: 'lucky-magic-spring-2', min: 2, max: 2 }] },
  { id: 'spring-3-soul-2', probability: 5, rewards: [{ itemId: 'lucky-magic-spring-3', min: 1, max: 1 }, { itemId: 'lucky-soul-injection-2', min: 2, max: 2 }] },
  { id: 'spirit-potion', probability: 5, rewards: [{ itemId: 'lucky-spirit-potion', min: 1, max: 1 }] },
  { id: 'fearless-power', probability: 3, rewards: [{ itemId: 'lucky-fearless-power', min: 1, max: 1 }] },
  { id: 'annihilation-power', probability: 3, rewards: [{ itemId: 'lucky-annihilation-power', min: 1, max: 1 }] },
  { id: 'pet-roulette', probability: 2, rewards: [{ itemId: 'lucky-pet-roulette', min: 3, max: 5 }] },
  { id: 'monster-summon', probability: 1, rewards: [{ itemId: 'lucky-monster-summon-3', min: 1, max: 1 }] },
  { id: 'blood-knight', probability: 1, rewards: [{ itemId: 'lucky-blood-knight', min: 1, max: 1 }] },
  { id: 'skill-book', probability: 3, rewards: [{ itemId: 'lucky-skill-book-3', min: 3, max: 5 }] },
  { id: 'outfit-pack', probability: 5, rewards: [{ itemId: 'lucky-outfit-pack', min: 1, max: 1 }] },
  { id: 'zodiac-egg', probability: 3, rewards: [{ itemId: 'lucky-zodiac-egg', min: 1, max: 1 }] },
  { id: 'phoenix-baby', probability: 1, rewards: [{ itemId: 'lucky-phoenix-baby', min: 1, max: 1 }] },
  { id: 'gem-accessory-charm', probability: 15, rewards: [{ itemId: 'lucky-gem-accessory-charm', min: 1, max: 1 }] },
  { id: 'new-summon-pill', probability: 0.3, rewards: [{ itemId: 'lucky-new-summon-pill', min: 1, max: 1 }] },
];

const zodiacItems: Array<LuckyItem & { probability: number; celestial?: boolean }> = [
  { id: 'zodiac-rat', name: '生肖·子鼠', icon: '🐭', sellPrice: 40, rarity: 'rare', probability: 8.25 },
  { id: 'zodiac-ox', name: '生肖·丑牛', icon: '🐮', sellPrice: 45, rarity: 'rare', probability: 8.25 },
  { id: 'zodiac-tiger', name: '生肖·寅虎', icon: '🐯', sellPrice: 60, rarity: 'rare', probability: 8.25 },
  { id: 'zodiac-rabbit', name: '生肖·卯兔', icon: '🐰', sellPrice: 50, rarity: 'rare', probability: 8.25 },
  { id: 'zodiac-dragon', name: '生肖·辰龙', icon: '🐲', sellPrice: 100, rarity: 'legendary', probability: 8.25 },
  { id: 'zodiac-snake', name: '生肖·巳蛇', icon: '🐍', sellPrice: 55, rarity: 'rare', probability: 8.25 },
  { id: 'zodiac-horse', name: '生肖·午马', icon: '🐴', sellPrice: 70, rarity: 'rare', probability: 8.25 },
  { id: 'zodiac-goat', name: '生肖·未羊', icon: '🐏', sellPrice: 50, rarity: 'rare', probability: 8.25 },
  { id: 'zodiac-monkey', name: '生肖·申猴', icon: '🐒', sellPrice: 65, rarity: 'rare', probability: 8.25 },
  { id: 'zodiac-rooster', name: '生肖·酉鸡', icon: '🐓', sellPrice: 45, rarity: 'rare', probability: 8.25 },
  { id: 'zodiac-dog', name: '生肖·戌狗', icon: '🐕', sellPrice: 60, rarity: 'rare', probability: 8.25 },
  { id: 'zodiac-pig', name: '生肖·亥猪', icon: '🐷', sellPrice: 40, rarity: 'rare', probability: 8.25 },
  { id: 'zodiac-golden-dragon', name: '天命·金龙', icon: '🐉', sellPrice: 3000, rarity: 'mythic', probability: 0.5, celestial: true },
  { id: 'zodiac-phoenix', name: '天命·凤凰', icon: '🦅', sellPrice: 3000, rarity: 'mythic', probability: 0.5, celestial: true },
];

const luckyItemById = new Map([...luckyItems, ...zodiacItems].map((item) => [item.id, item]));

function randomQuantity(min: number, max: number) {
  return min + Math.floor(randomUnit() * (max - min + 1));
}

function formatMoney(value: number) {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: Number.isInteger(value) ? 0 : 1, maximumFractionDigits: 1 });
}

function randomUnit() {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const value = new Uint32Array(1);
    globalThis.crypto.getRandomValues(value);
    return value[0] / 4294967296;
  }
  return Math.random();
}

function pickGachaPrize() {
  let weightedRoll = randomUnit() * gachaTotalWeight;
  let pickedPrize = gachaPrizes[gachaPrizes.length - 1];
  for (const prize of gachaPrizes) {
    weightedRoll -= prize.probability;
    if (weightedRoll < 0) {
      pickedPrize = prize;
      break;
    }
  }
  return pickedPrize;
}

function pickGachaLoot(container: GachaContainer) {
  const totalWeight = container.items.reduce((sum, item) => sum + item.probability, 0);
  let weightedRoll = randomUnit() * totalWeight;
  for (const item of container.items) {
    weightedRoll -= item.probability;
    if (weightedRoll < 0) return item;
  }
  return container.items[container.items.length - 1];
}

function pickGuardianSkill(groupCounts: Record<string, number>) {
  const eligibleSkills = guardianSkills.filter((skill) => (groupCounts[skill.groupId] ?? 0) < 2);
  const totalWeight = eligibleSkills.reduce((sum, skill) => sum + skill.probability, 0);
  let weightedRoll = randomUnit() * totalWeight;
  let pickedSkill = eligibleSkills[eligibleSkills.length - 1];
  for (const skill of eligibleSkills) {
    weightedRoll -= skill.probability;
    if (weightedRoll < 0) {
      pickedSkill = skill;
      break;
    }
  }
  return pickedSkill;
}

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
  context.fillText('燃烧 +8 · 星月 +9 · 催化 +10 · 其余全 10 · 守护四席 Lv.5', 540, 268);

  const drawStandard = (x: number, label: string, color: string) => {
    roundedRectPath(context, x, 294, 160, 48, 24);
    context.fillStyle = 'rgba(13,17,25,.82)';
    context.fill();
    context.strokeStyle = color;
    context.globalAlpha = .55;
    context.stroke();
    context.globalAlpha = 1;
    context.fillStyle = color;
    context.font = '600 16px "Noto Serif SC", serif';
    context.fillText(label, x + 80, 326);
  };
  drawStandard(110, '燃烧 +8', '#ff7a32');
  drawStandard(285, '星月 +9', '#b67cff');
  drawStandard(460, '催化 +10', '#5adbb6');
  drawStandard(635, '其余全 10', '#55a8ff');
  drawStandard(810, '守护 4×Lv.5', '#f2c75f');

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

function itemInstancePalette(instance: ItemInstance, level: number) {
  return itemInstancePalettes[instance.item.id]?.[instance.index] ?? levelPalette(instance.item, level);
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

function localHourKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  return `${year}-${month}-${day}-${hour}`;
}

function countdownToNextHour(now: number) {
  const nextHour = new Date(now);
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
  const seconds = Math.max(0, Math.ceil((nextHour.getTime() - now) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

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
  const [activeSystem, setActiveSystem] = useState<'forge' | 'guardian' | 'gacha' | 'lucky'>('forge');
  const [selectedId, setSelectedId] = useState(itemInstances[0].id);
  const [levels, setLevels] = useState<Record<string, number>>(initialLevels);
  const [targetLevels, setTargetLevels] = useState<Record<string, number>>({ ...autoTargetInstanceLimits });
  const [autoTargetRun, setAutoTargetRun] = useState<AutoTargetRun | null>(null);
  const [rapidClickerItemId, setRapidClickerItemId] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(1);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [isRolling, setIsRolling] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<Attempt | null>(null);
  const [resultFeedbacks, setResultFeedbacks] = useState<ResultFeedback[]>([]);
  const feedbackSequence = useRef(0);
  const pendingForgeTimer = useRef<number | null>(null);
  const autoTargetTimer = useRef<number | null>(null);
  const autoTargetTick = useRef<() => void>(() => undefined);
  const rapidClickerTimer = useRef<number | null>(null);
  const rapidClickerTick = useRef<() => void>(() => undefined);
  const rapidClickerHoldTimer = useRef<number | null>(null);
  const rapidClickerHoldTriggered = useRef(false);
  const [guardianProtection, setGuardianProtection] = useState(false);
  const [costLedger, setCostLedger] = useState({ knownSpend: 0, pricedAttempts: 0, itemSpend: {} as Record<string, number> });
  const [hasHydrated, setHasHydrated] = useState(false);
  const [fundBalance, setFundBalance] = useState(hourlyFundAmount);
  const [fundHourKey, setFundHourKey] = useState('');
  const [fundNow, setFundNow] = useState(0);
  const [fundHasHydrated, setFundHasHydrated] = useState(false);
  const [fundNotice, setFundNotice] = useState<string | null>(null);
  const fundBalanceRef = useRef(hourlyFundAmount);
  const fundHourKeyRef = useRef('');
  const fundNoticeTimer = useRef<number | null>(null);
  const fundBackdoorClicks = useRef(0);
  const [costDetailsOpen, setCostDetailsOpen] = useState(false);
  const [graduationPosterOpen, setGraduationPosterOpen] = useState(false);
  const [graduationSnapshot, setGraduationSnapshot] = useState<GraduationSnapshot | null>(null);
  const [posterStatus, setPosterStatus] = useState<'rendering' | 'ready' | 'shared' | 'saved' | 'error'>('rendering');
  const [guardianSlots, setGuardianSlots] = useState<GuardianSlot[]>(initialGuardianSlots);
  const [guardianHistory, setGuardianHistory] = useState<GuardianHistoryEntry[]>([]);
  const [guardianLatestSlot, setGuardianLatestSlot] = useState<number | null>(null);
  const [guardianAutoSlotId, setGuardianAutoSlotId] = useState<number | null>(null);
  const guardianAutoTimer = useRef<number | null>(null);
  const guardianAutoTick = useRef<(slotId: number) => void>(() => undefined);
  const [gachaHistory, setGachaHistory] = useState<GachaPull[]>([]);
  const [gachaInventory, setGachaInventory] = useState<Record<string, number>>({});
  const [gachaLootInventory, setGachaLootInventory] = useState<Record<string, number>>({});
  const [gachaTotalDraws, setGachaTotalDraws] = useState(0);
  const [gachaSaleRevenue, setGachaSaleRevenue] = useState(0);
  const [gachaSoldCount, setGachaSoldCount] = useState(0);
  const [gachaActionNotice, setGachaActionNotice] = useState<string | null>(null);
  const [gachaLatestLootId, setGachaLatestLootId] = useState<string | null>(null);
  const [gachaLatest, setGachaLatest] = useState<GachaPull[]>([]);
  const [gachaRolling, setGachaRolling] = useState(false);
  const [gachaHasHydrated, setGachaHasHydrated] = useState(false);
  const gachaTimer = useRef<number | null>(null);
  const [luckyInventory, setLuckyInventory] = useState<Record<string, number>>({});
  const [luckyTotalOpens, setLuckyTotalOpens] = useState(0);
  const [luckySaleRevenue, setLuckySaleRevenue] = useState(0);
  const [luckySoldCount, setLuckySoldCount] = useState(0);
  const [luckyLatest, setLuckyLatest] = useState<LuckyDrop[]>([]);
  const [luckyRolling, setLuckyRolling] = useState(false);
  const [luckyOpeningStep, setLuckyOpeningStep] = useState(0);
  const [luckyActionNotice, setLuckyActionNotice] = useState<string | null>(null);
  const [luckyHasHydrated, setLuckyHasHydrated] = useState(false);
  const [rareAnnouncement, setRareAnnouncement] = useState<RareAnnouncement | null>(null);
  const [containerReveal, setContainerReveal] = useState<ContainerReveal | null>(null);
  const luckyTimer = useRef<number | null>(null);
  const rareAnnouncementTimer = useRef<number | null>(null);
  const containerRevealTimer = useRef<number | null>(null);
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
    try {
      const rawGuardian = window.localStorage.getItem(guardianStorageKey);
      if (!rawGuardian) return;
      const stored = JSON.parse(rawGuardian) as { slots?: GuardianSlot[]; history?: GuardianHistoryEntry[] };
      if (Array.isArray(stored.slots) && stored.slots.length === 4) {
        const storedIds = stored.slots.map((slot) => slot.id);
        const hasValidSlotIds = storedIds.every((id) => Number.isInteger(id) && id >= 1 && id <= 4) && new Set(storedIds).size === 4;
        const restoredSlots = stored.slots.map((slot, index) => ({
          id: hasValidSlotIds ? slot.id : index + 1,
          skillId: typeof slot.skillId === 'string' && guardianSkillById.has(slot.skillId) ? slot.skillId : null,
          refreshes: typeof slot.refreshes === 'number' && Number.isFinite(slot.refreshes) ? Math.max(0, Math.floor(slot.refreshes)) : 0,
        }));
        setGuardianSlots(restoredSlots);
      }
      if (Array.isArray(stored.history)) {
        setGuardianHistory(stored.history.filter((entry) => entry
          && typeof entry.id === 'number'
          && typeof entry.slotId === 'number'
          && typeof entry.skillId === 'string'
          && guardianSkillById.has(entry.skillId)
          && (entry.previousSkillId === null || (typeof entry.previousSkillId === 'string' && guardianSkillById.has(entry.previousSkillId))))
          .slice(0, 40)
          .map((entry) => ({ ...entry, mode: entry.mode === 'all' || entry.mode === 'until-five' ? entry.mode : 'single' })));
      }
    } catch (error) {
      console.warn('守护技能进度恢复失败:', error);
    }
  }, []);

  useEffect(() => {
    try {
      const rawGacha = window.localStorage.getItem(gachaStorageKey);
      if (!rawGacha) return;
      const stored = JSON.parse(rawGacha) as {
        history?: GachaPull[];
        inventory?: Record<string, number>;
        lootInventory?: Record<string, number>;
        totalDraws?: number;
        saleRevenue?: number;
        soldCount?: number;
      };
      const restoredHistory = Array.isArray(stored.history) ? stored.history.filter((entry) => entry
        && typeof entry.id === 'number'
        && typeof entry.prizeId === 'string'
        && gachaPrizeById.has(entry.prizeId)).slice(0, 100) : [];
      setGachaHistory(restoredHistory);
      const restoredInventory: Record<string, number> = {};
      if (stored.inventory && typeof stored.inventory === 'object') {
        Object.entries(stored.inventory).forEach(([prizeId, count]) => {
          if (gachaPrizeById.has(prizeId) && typeof count === 'number' && Number.isFinite(count) && count > 0) restoredInventory[prizeId] = Math.floor(count);
        });
      } else {
        restoredHistory.forEach((pull) => { restoredInventory[pull.prizeId] = (restoredInventory[pull.prizeId] ?? 0) + 1; });
      }
      setGachaInventory(restoredInventory);
      const restoredLootInventory: Record<string, number> = {};
      if (stored.lootInventory && typeof stored.lootInventory === 'object') {
        Object.entries(stored.lootInventory).forEach(([lootId, count]) => {
          if (gachaLootById.has(lootId) && typeof count === 'number' && Number.isFinite(count) && count > 0) restoredLootInventory[lootId] = Math.floor(count);
        });
      }
      setGachaLootInventory(restoredLootInventory);
      const inventoryCount = Object.values(restoredInventory).reduce((sum, count) => sum + count, 0);
      setGachaTotalDraws(typeof stored.totalDraws === 'number' && Number.isFinite(stored.totalDraws) ? Math.max(inventoryCount, Math.floor(stored.totalDraws)) : inventoryCount);
      setGachaSaleRevenue(typeof stored.saleRevenue === 'number' && Number.isFinite(stored.saleRevenue) ? Math.max(0, stored.saleRevenue) : 0);
      setGachaSoldCount(typeof stored.soldCount === 'number' && Number.isFinite(stored.soldCount) ? Math.max(0, Math.floor(stored.soldCount)) : 0);
    } catch (error) {
      console.warn('猫猫扭蛋记录恢复失败:', error);
    } finally {
      setGachaHasHydrated(true);
    }
  }, []);

  useEffect(() => {
    try {
      const rawLucky = window.localStorage.getItem(luckyStorageKey);
      if (!rawLucky) return;
      const stored = JSON.parse(rawLucky) as {
        inventory?: Record<string, number>;
        totalOpens?: number;
        saleRevenue?: number;
        soldCount?: number;
        latest?: LuckyDrop[];
      };
      const restoredInventory: Record<string, number> = {};
      if (stored.inventory && typeof stored.inventory === 'object') {
        Object.entries(stored.inventory).forEach(([itemId, count]) => {
          if (luckyItemById.has(itemId) && typeof count === 'number' && Number.isFinite(count) && count > 0) restoredInventory[itemId] = Math.floor(count);
        });
      }
      setLuckyInventory(restoredInventory);
      setLuckyTotalOpens(typeof stored.totalOpens === 'number' && Number.isFinite(stored.totalOpens) ? Math.max(0, Math.floor(stored.totalOpens)) : 0);
      setLuckySaleRevenue(typeof stored.saleRevenue === 'number' && Number.isFinite(stored.saleRevenue) ? Math.max(0, stored.saleRevenue) : 0);
      setLuckySoldCount(typeof stored.soldCount === 'number' && Number.isFinite(stored.soldCount) ? Math.max(0, Math.floor(stored.soldCount)) : 0);
      if (Array.isArray(stored.latest)) {
        setLuckyLatest(stored.latest.filter((drop) => drop
          && typeof drop.id === 'number'
          && typeof drop.itemId === 'string'
          && luckyItemById.has(drop.itemId)
          && typeof drop.quantity === 'number'
          && Number.isFinite(drop.quantity)
          && drop.quantity > 0).slice(0, 20));
      }
    } catch (error) {
      console.warn('旺旺幸运包记录恢复失败:', error);
    } finally {
      setLuckyHasHydrated(true);
    }
  }, []);

  useEffect(() => {
    const currentHour = localHourKey();
    let restoredBalance = hourlyFundAmount;
    try {
      const rawFund = window.localStorage.getItem(fundStorageKey);
      if (rawFund) {
        const stored = JSON.parse(rawFund) as { balance?: number; hourKey?: string };
        if (stored.hourKey === currentHour && typeof stored.balance === 'number' && Number.isFinite(stored.balance) && stored.balance >= 0) {
          restoredBalance = stored.balance;
        } else {
          showFundNotice('整点资金已刷新');
        }
      }
    } catch (error) {
      console.warn('资金池进度恢复失败:', error);
    }
    fundBalanceRef.current = restoredBalance;
    fundHourKeyRef.current = currentHour;
    setFundBalance(restoredBalance);
    setFundHourKey(currentHour);
    setFundNow(Date.now());
    setFundHasHydrated(true);
  }, []);

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

  useEffect(() => {
    if (!hasHydrated) return;
    try {
      window.localStorage.setItem(guardianStorageKey, JSON.stringify({ slots: guardianSlots, history: guardianHistory }));
    } catch (error) {
      console.warn('守护技能进度保存失败:', error);
    }
  }, [guardianHistory, guardianSlots, hasHydrated]);

  useEffect(() => {
    if (!gachaHasHydrated) return;
    try {
      window.localStorage.setItem(gachaStorageKey, JSON.stringify({
        history: gachaHistory,
        inventory: gachaInventory,
        lootInventory: gachaLootInventory,
        totalDraws: gachaTotalDraws,
        saleRevenue: gachaSaleRevenue,
        soldCount: gachaSoldCount,
      }));
    } catch (error) {
      console.warn('猫猫扭蛋记录保存失败:', error);
    }
  }, [gachaHasHydrated, gachaHistory, gachaInventory, gachaLootInventory, gachaSaleRevenue, gachaSoldCount, gachaTotalDraws]);

  useEffect(() => {
    if (!luckyHasHydrated) return;
    try {
      window.localStorage.setItem(luckyStorageKey, JSON.stringify({
        inventory: luckyInventory,
        totalOpens: luckyTotalOpens,
        saleRevenue: luckySaleRevenue,
        soldCount: luckySoldCount,
        latest: luckyLatest,
      }));
    } catch (error) {
      console.warn('旺旺幸运包记录保存失败:', error);
    }
  }, [luckyHasHydrated, luckyInventory, luckyLatest, luckySaleRevenue, luckySoldCount, luckyTotalOpens]);

  useEffect(() => {
    if (!fundHasHydrated) return;
    try {
      window.localStorage.setItem(fundStorageKey, JSON.stringify({ balance: fundBalance, hourKey: fundHourKey }));
    } catch (error) {
      console.warn('资金池进度保存失败:', error);
    }
  }, [fundBalance, fundHasHydrated, fundHourKey]);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const currentHour = localHourKey(new Date(now));
      setFundNow(now);
      if (!fundHourKeyRef.current || currentHour === fundHourKeyRef.current) return;
      fundBalanceRef.current = hourlyFundAmount;
      fundHourKeyRef.current = currentHour;
      setFundBalance(hourlyFundAmount);
      setFundHourKey(currentHour);
      showFundNotice('整点到账 ¥10,000');
    };
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => () => {
    if (pendingForgeTimer.current !== null) window.clearTimeout(pendingForgeTimer.current);
    if (autoTargetTimer.current !== null) window.clearTimeout(autoTargetTimer.current);
    if (rapidClickerTimer.current !== null) window.clearInterval(rapidClickerTimer.current);
    if (rapidClickerHoldTimer.current !== null) window.clearTimeout(rapidClickerHoldTimer.current);
    if (guardianAutoTimer.current !== null) window.clearTimeout(guardianAutoTimer.current);
    if (gachaTimer.current !== null) window.clearTimeout(gachaTimer.current);
    if (luckyTimer.current !== null) window.clearTimeout(luckyTimer.current);
    if (rareAnnouncementTimer.current !== null) window.clearTimeout(rareAnnouncementTimer.current);
    if (containerRevealTimer.current !== null) window.clearTimeout(containerRevealTimer.current);
    if (fundNoticeTimer.current !== null) window.clearTimeout(fundNoticeTimer.current);
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
  const catalystGraduated = itemInstances
    .filter((instance) => instance.item.id === 'catalyst-stone')
    .every((instance) => (levels[instance.id] ?? 0) >= 10);
  const otherItemsGraduated = itemInstances
    .filter((instance) => !['burning-gem', 'moon-myth', 'catalyst-stone'].includes(instance.item.id))
    .every((instance) => (levels[instance.id] ?? instance.item.minLevel ?? 0) >= Math.min(10, instance.item.maxLevel ?? 10));
  const guardianSkillsGraduated = guardianSlots.every((slot) => {
    const skill = slot.skillId ? guardianSkillById.get(slot.skillId) : null;
    return skill?.level === 5;
  });
  const graduationReady = burningGraduated && moonGraduated && catalystGraduated && otherItemsGraduated && guardianSkillsGraduated;
  const guardianResolvedSlots = guardianSlots.map((slot) => ({ ...slot, skill: slot.skillId ? guardianSkillById.get(slot.skillId) ?? null : null }));
  const guardianRefreshes = guardianSlots.reduce((sum, slot) => sum + slot.refreshes, 0);
  const guardianSingleSpend = guardianSlots.reduce((sum, slot) => sum + (costLedger.itemSpend[`guardian-skill:${slot.id}`] ?? 0), 0);
  const guardianBulkSpend = costLedger.itemSpend['guardian-skill:all'] ?? 0;
  const guardianSpend = guardianSingleSpend + guardianBulkSpend;
  const guardianSingleRefreshes = Math.round(guardianSingleSpend / 5);
  const guardianBulkRefreshes = Math.round(guardianBulkSpend);
  const gachaCollected = Object.keys(gachaInventory).length;
  const gachaLootCollected = Object.keys(gachaLootInventory).length;
  const gachaBackpackCount = Object.values(gachaInventory).reduce((sum, count) => sum + count, 0)
    + Object.values(gachaLootInventory).reduce((sum, count) => sum + count, 0);
  const gachaHighRarityCount = Object.entries(gachaInventory).reduce((sum, [prizeId, count]) => {
    const rarity = gachaPrizeById.get(prizeId)?.rarity;
    return sum + (rarity === 'mythic' || rarity === 'legendary' ? count : 0);
  }, 0) + Object.entries(gachaLootInventory).reduce((sum, [lootId, count]) => {
    const rarity = gachaLootById.get(lootId)?.rarity;
    return sum + (rarity === 'mythic' || rarity === 'legendary' ? count : 0);
  }, 0);
  const gachaBackpackItems = gachaPrizes.filter((prize) => (gachaInventory[prize.id] ?? 0) > 0).sort((left, right) => {
    const rarityOrder: Record<GachaRarity, number> = { mythic: 0, legendary: 1, epic: 2, rare: 3, common: 4 };
    return rarityOrder[left.rarity] - rarityOrder[right.rarity] || right.probability - left.probability || left.name.localeCompare(right.name, 'zh-CN');
  });
  const gachaFeaturedPrize = gachaLatest.length ? gachaPrizeById.get(gachaLatest[gachaLatest.length - 1].prizeId) ?? null : null;
  const gachaVaultPrizes = [gachaPrizes[0], gachaPrizes[4], gachaPrizes[10], gachaPrizes[18], gachaPrizes[21], gachaPrizes[31], gachaPrizes[38], gachaPrizes[44], gachaPrizes[50]];
  const gachaLootBackpackItems = [...gachaLootById.values()].filter((loot) => (gachaLootInventory[loot.id] ?? 0) > 0).sort((left, right) => {
    if (left.id === gachaLatestLootId) return -1;
    if (right.id === gachaLatestLootId) return 1;
    return right.sellPrice - left.sellPrice || left.name.localeCompare(right.name, 'zh-CN');
  });
  const gachaSpend = costLedger.itemSpend['cat-gacha'] ?? 0;
  const luckyBackpackCount = Object.values(luckyInventory).reduce((sum, count) => sum + count, 0);
  const luckyCollected = Object.keys(luckyInventory).length;
  const luckySpend = costLedger.itemSpend['wangwang-pack'] ?? 0;
  const luckyLatestValue = luckyLatest.reduce((sum, drop) => sum + (luckyItemById.get(drop.itemId)?.sellPrice ?? 0) * drop.quantity, 0);
  const luckyBackpackItems = [...luckyItemById.values()].filter((entry) => (luckyInventory[entry.id] ?? 0) > 0).sort((left, right) => {
    const rarityOrder: Record<GachaRarity, number> = { mythic: 0, legendary: 1, epic: 2, rare: 3, common: 4 };
    return rarityOrder[left.rarity] - rarityOrder[right.rarity] || right.sellPrice - left.sellPrice || left.name.localeCompare(right.name, 'zh-CN');
  });
  const equippedGuardianGroups = guardianResolvedSlots.reduce<Record<string, number>>((counts, slot) => {
    if (slot.skill) counts[slot.skill.groupId] = (counts[slot.skill.groupId] ?? 0) + 1;
    return counts;
  }, {});
  const costDetailItems = [...items.map((entry) => {
    const instances = itemInstances.filter((instance) => instance.item.id === entry.id);
    const currentLevels = instances.map((instance) => levels[instance.id] ?? entry.minLevel ?? 0);
    const lowestLevel = Math.min(...currentLevels);
    const highestLevel = Math.max(...currentLevels);
    const levelSuffix = entry.mode === 'adaptive' ? '★' : entry.mode === 'check' ? '档' : '';
    const levelPrefix = entry.mode === 'upgrade' ? '+' : '';
    const levelSummary = entry.mode === 'draw'
      ? '秘宝唤醒'
      : lowestLevel === highestLevel
        ? `${levelPrefix}${lowestLevel}${levelSuffix}${instances.length > 1 ? ` ×${instances.length}` : ''}`
        : `${levelPrefix}${lowestLevel}${levelSuffix}–${levelPrefix}${highestLevel}${levelSuffix} · ${instances.length} 件`;
    const unitCost = costRules[entry.id] ?? null;
    return {
      id: entry.id,
      baseItemId: entry.id,
      name: instances.length > 1 ? `${entry.name} ×${instances.length}` : entry.name,
      level: levelSummary,
      unitCost,
      attemptCost: unitCost,
      spend: instances.reduce((sum, instance) => sum + (costLedger.itemSpend[instance.id] ?? 0), 0),
    };
  }), {
    id: 'guardian-skills',
    baseItemId: 'guardian-skill',
    name: '守护技能 ×4',
    level: `${guardianResolvedSlots.filter((slot) => slot.skill).length}/4 席 · 单刷 ${guardianSingleRefreshes} / 全刷 ${guardianBulkRefreshes}`,
    unitCost: 5,
    attemptCost: 5,
    spend: guardianSpend,
  }, {
    id: 'cat-gacha',
    baseItemId: 'cat-gacha',
    name: '猫猫秘境寻宝',
    level: `累计探索 ${gachaTotalDraws} 次`,
    unitCost: gachaUnitCost,
    attemptCost: gachaUnitCost,
    spend: gachaSpend,
  }, {
    id: 'wangwang-pack',
    baseItemId: 'wangwang-pack',
    name: '旺旺幸运包',
    level: `累计启封 ${luckyTotalOpens} 次`,
    unitCost: luckyPackUnitCost,
    attemptCost: luckyPackUnitCost,
    spend: luckySpend,
  }];
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
    stopRapidClicker();
    setSelectedId(next.id);
    setLastAttempt(null);
    setResultFeedbacks([]);
  }

  function showFundNotice(message: string) {
    if (fundNoticeTimer.current !== null) window.clearTimeout(fundNoticeTimer.current);
    setFundNotice(message);
    fundNoticeTimer.current = window.setTimeout(() => {
      setFundNotice(null);
      fundNoticeTimer.current = null;
    }, 1800);
  }

  function spendFromFund(amount: number) {
    if (!fundHasHydrated) return false;
    const safeAmount = Math.max(0, amount);
    if (fundBalanceRef.current < safeAmount) {
      showFundNotice(`余额不足，还差 ¥${(safeAmount - fundBalanceRef.current).toFixed(0)}`);
      return false;
    }
    const nextBalance = fundBalanceRef.current - safeAmount;
    fundBalanceRef.current = nextBalance;
    setFundBalance(nextBalance);
    return true;
  }

  function creditFund(amount: number) {
    if (!fundHasHydrated) return false;
    const safeAmount = Math.max(0, amount);
    const nextBalance = fundBalanceRef.current + safeAmount;
    fundBalanceRef.current = nextBalance;
    setFundBalance(nextBalance);
    showFundNotice(`卖出到账 ¥${formatMoney(safeAmount)}`);
    return true;
  }

  function showRareAnnouncement(announcement: Omit<RareAnnouncement, 'id'>) {
    if (rareAnnouncementTimer.current !== null) window.clearTimeout(rareAnnouncementTimer.current);
    setRareAnnouncement({ ...announcement, id: Date.now() });
    rareAnnouncementTimer.current = window.setTimeout(() => {
      setRareAnnouncement(null);
      rareAnnouncementTimer.current = null;
    }, 4600);
  }

  function triggerFundBackdoor() {
    if (!hasHydrated || !fundHasHydrated) return;
    fundBackdoorClicks.current += 1;
    if (fundBackdoorClicks.current < 10) return;
    fundBackdoorClicks.current = 0;
    const nextBalance = fundBalanceRef.current + 100000;
    fundBalanceRef.current = nextBalance;
    setFundBalance(nextBalance);
    showFundNotice('秘库注资 ¥100,000');
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
    const generatedSpend = generated.reduce((sum, attempt) => sum + (attempt.cost ?? 0), 0);
    if (!spendFromFund(generatedSpend)) {
      if (forceInstant) stopAutoTargetRun();
      return;
    }
    const applyResults = () => {
      pendingForgeTimer.current = null;
      const latestAttempts = [...generated].reverse();
      if (item.mode === 'upgrade' || item.mode === 'adaptive') setLevels((current) => ({ ...current, [itemKey]: currentLevel }));
      if (item.mode === 'adaptive') setAttemptCount(currentCount);
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

  function stopRapidClicker() {
    if (rapidClickerTimer.current !== null) {
      window.clearInterval(rapidClickerTimer.current);
      rapidClickerTimer.current = null;
    }
    if (rapidClickerHoldTimer.current !== null) {
      window.clearTimeout(rapidClickerHoldTimer.current);
      rapidClickerHoldTimer.current = null;
    }
    setRapidClickerItemId(null);
  }

  function startRapidClicker() {
    if (!canForge || !canAffordAttempt || isRolling || isAutoTargetRunning || rapidClickerItemId !== null) return;
    stopAutoTargetRun();
    setRapidClickerItemId(itemKey);
    showFundNotice('连点器已启动 · 0.2秒 / 次');
    simulate(1, true);
  }

  function beginRapidClickerHold() {
    rapidClickerHoldTriggered.current = false;
    if (!canForge || !canAffordAttempt || isRolling || isAutoTargetRunning || rapidClickerItemId !== null) return;
    if (rapidClickerHoldTimer.current !== null) window.clearTimeout(rapidClickerHoldTimer.current);
    rapidClickerHoldTimer.current = window.setTimeout(() => {
      rapidClickerHoldTimer.current = null;
      rapidClickerHoldTriggered.current = true;
      startRapidClicker();
    }, 10000);
  }

  function cancelRapidClickerHold() {
    if (rapidClickerHoldTimer.current === null) return;
    window.clearTimeout(rapidClickerHoldTimer.current);
    rapidClickerHoldTimer.current = null;
  }

  function releaseRapidClickerHold() {
    cancelRapidClickerHold();
    window.setTimeout(() => {
      rapidClickerHoldTriggered.current = false;
    }, 0);
  }

  function handlePrimaryActionClick() {
    cancelRapidClickerHold();
    if (rapidClickerHoldTriggered.current) {
      rapidClickerHoldTriggered.current = false;
      return;
    }
    if (rapidClickerItemId === itemKey) {
      stopRapidClicker();
      showFundNotice('连点器已停止');
      return;
    }
    simulate(1);
  }

  function toggleAutoTargetRun() {
    if (isAutoTargetRunning) {
      stopAutoTargetRun();
      return;
    }
    if (targetLevel === null || level >= targetLevel || isRolling || rapidClickerItemId !== null) return;
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

  useEffect(() => {
    if (rapidClickerItemId === null) return;
    rapidClickerTimer.current = window.setInterval(() => rapidClickerTick.current(), 200);
    return () => {
      if (rapidClickerTimer.current !== null) {
        window.clearInterval(rapidClickerTimer.current);
        rapidClickerTimer.current = null;
      }
    };
  }, [rapidClickerItemId]);

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
    itemSpends.push({
      id: 'guardian-skills',
      name: '守护技能 ×4',
      level: guardianSkillsGraduated ? '4×Lv.5' : `${guardianResolvedSlots.filter((slot) => slot.skill).length}/4 席`,
      spend: guardianSpend,
    });
    const recordedItemSpend = itemInstances.reduce((sum, instance) => sum + (costLedger.itemSpend[instance.id] ?? 0), 0) + guardianSpend;
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
    const shareText = `花费 ¥${graduationSnapshot.spend.toFixed(2)} 毕业了！燃烧宝石 +8，星月神话 +9，催化神石 +10，其余项目全 10，守护四席均为 5 级技能。`;
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

  function performGuardianSlotRefresh(slotId: number, mode: 'single' | 'until-five') {
    const otherGroupCounts = guardianResolvedSlots.reduce<Record<string, number>>((counts, slot) => {
      if (slot.id !== slotId && slot.skill) counts[slot.skill.groupId] = (counts[slot.skill.groupId] ?? 0) + 1;
      return counts;
    }, {});
    const nextSkill = pickGuardianSkill(otherGroupCounts);
    if (!nextSkill || !spendFromFund(5)) return null;
    const previousSkillId = guardianSlots.find((slot) => slot.id === slotId)?.skillId ?? null;
    const historyEntry: GuardianHistoryEntry = {
      id: (Date.now() * 10) + slotId,
      slotId,
      skillId: nextSkill.id,
      previousSkillId,
      mode,
      batchAttempts: 1,
    };
    setGuardianSlots((current) => current.map((slot) => slot.id === slotId
      ? { ...slot, skillId: nextSkill.id, refreshes: slot.refreshes + 1 }
      : slot));
    setGuardianHistory((current) => [historyEntry, ...current].slice(0, 40));
    setGuardianLatestSlot(slotId);
    setCostLedger((current) => ({
      knownSpend: current.knownSpend + 5,
      pricedAttempts: current.pricedAttempts + 1,
      itemSpend: {
        ...current.itemSpend,
        [`guardian-skill:${slotId}`]: (current.itemSpend[`guardian-skill:${slotId}`] ?? 0) + 5,
      },
    }));
    return nextSkill;
  }

  function refreshGuardianSlot(slotId: number) {
    if (guardianAutoSlotId !== null) return;
    performGuardianSlotRefresh(slotId, 'single');
  }

  function stopGuardianAutoRefresh() {
    if (guardianAutoTimer.current !== null) {
      window.clearTimeout(guardianAutoTimer.current);
      guardianAutoTimer.current = null;
    }
    setGuardianAutoSlotId(null);
  }

  function toggleGuardianAutoRefresh(slotId: number) {
    if (guardianAutoSlotId === slotId) {
      stopGuardianAutoRefresh();
      showFundNotice('已停止追逐橙卡');
      return;
    }
    if (guardianAutoSlotId !== null) return;
    const currentSlot = guardianResolvedSlots.find((slot) => slot.id === slotId);
    if (currentSlot?.skill?.level === 5) return;
    if (!fundHasHydrated || fundBalanceRef.current < 5) {
      showFundNotice('资金不足，无法追逐橙卡');
      return;
    }
    setGuardianAutoSlotId(slotId);
    const firstSkill = performGuardianSlotRefresh(slotId, 'until-five');
    if (!firstSkill || firstSkill.level === 5) {
      setGuardianAutoSlotId(null);
      if (firstSkill?.level === 5) showFundNotice(`追到橙卡 · ${firstSkill.name}`);
    }
  }

  guardianAutoTick.current = (slotId: number) => {
    const nextSkill = performGuardianSlotRefresh(slotId, 'until-five');
    if (!nextSkill || nextSkill.level === 5) {
      stopGuardianAutoRefresh();
      if (nextSkill?.level === 5) showFundNotice(`追到橙卡 · ${nextSkill.name}`);
    }
  };

  useEffect(() => {
    if (guardianAutoSlotId === null) return;
    const activeSlotId = guardianAutoSlotId;
    const currentSlot = guardianSlots.find((slot) => slot.id === activeSlotId);
    const currentSkill = currentSlot?.skillId ? guardianSkillById.get(currentSlot.skillId) : null;
    if (currentSkill?.level === 5 || fundBalance < 5) {
      setGuardianAutoSlotId(null);
      if (fundBalance < 5) showFundNotice('资金不足，追橙已停止');
      return;
    }
    guardianAutoTimer.current = window.setTimeout(() => {
      guardianAutoTimer.current = null;
      guardianAutoTick.current(activeSlotId);
    }, 300);
    return () => {
      if (guardianAutoTimer.current !== null) {
        window.clearTimeout(guardianAutoTimer.current);
        guardianAutoTimer.current = null;
      }
    };
  }, [fundBalance, guardianAutoSlotId, guardianSlots]);

  function refreshAllGuardianSlots() {
    if (guardianAutoSlotId !== null) return;
    const nextGroupCounts: Record<string, number> = {};
    const timestamp = Date.now() * 10;
    const nextHistory: GuardianHistoryEntry[] = [];
    const nextSlots = guardianSlots.map((slot) => {
      const nextSkill = pickGuardianSkill(nextGroupCounts);
      if (!nextSkill) return slot;
      nextGroupCounts[nextSkill.groupId] = (nextGroupCounts[nextSkill.groupId] ?? 0) + 1;
      nextHistory.push({
        id: timestamp + slot.id,
        slotId: slot.id,
        skillId: nextSkill.id,
        previousSkillId: slot.skillId,
        mode: 'all',
      });
      return { ...slot, skillId: nextSkill.id, refreshes: slot.refreshes + 1 };
    });
    if (!nextHistory.length || !spendFromFund(1)) return;
    const sortedNextSlots = [...nextSlots].sort((left, right) => {
      const leftLevel = left.skillId ? guardianSkillById.get(left.skillId)?.level ?? 0 : 0;
      const rightLevel = right.skillId ? guardianSkillById.get(right.skillId)?.level ?? 0 : 0;
      return rightLevel - leftLevel || left.id - right.id;
    });
    setGuardianSlots(sortedNextSlots);
    setGuardianHistory((current) => [...nextHistory.reverse(), ...current].slice(0, 40));
    setGuardianLatestSlot(0);
    setCostLedger((current) => ({
      knownSpend: current.knownSpend + 1,
      pricedAttempts: current.pricedAttempts + 1,
      itemSpend: {
        ...current.itemSpend,
        'guardian-skill:all': (current.itemSpend['guardian-skill:all'] ?? 0) + 1,
      },
    }));
  }

  function drawGacha(count: 1 | 10) {
    const drawCost = count * gachaUnitCost;
    if (gachaRolling || containerReveal?.phase === 'opening' || !gachaHasHydrated || !fundHasHydrated || !spendFromFund(drawCost)) return;
    setContainerReveal(null);
    const drawId = Date.now() * 100;
    const nextPulls = Array.from({ length: count }, (_, index) => ({ id: drawId + index, prizeId: pickGachaPrize().id }));
    setGachaLatest([]);
    setGachaActionNotice(null);
    setGachaRolling(true);
    setGachaTotalDraws((current) => current + count);
    setCostLedger((current) => ({
      knownSpend: current.knownSpend + drawCost,
      pricedAttempts: current.pricedAttempts + count,
      itemSpend: { ...current.itemSpend, 'cat-gacha': (current.itemSpend['cat-gacha'] ?? 0) + drawCost },
    }));
    if (gachaTimer.current !== null) window.clearTimeout(gachaTimer.current);
    gachaTimer.current = window.setTimeout(() => {
      setGachaLatest(nextPulls);
      setGachaHistory((current) => [...nextPulls.slice().reverse(), ...current].slice(0, 100));
      setGachaInventory((current) => {
        const next = { ...current };
        nextPulls.forEach((pull) => { next[pull.prizeId] = (next[pull.prizeId] ?? 0) + 1; });
        return next;
      });
      const announcedPrizeId = ['gacha-1', 'gacha-51', 'gacha-2']
        .find((prizeId) => nextPulls.some((pull) => pull.prizeId === prizeId));
      if (announcedPrizeId) {
        const prize = gachaPrizeById.get(announcedPrizeId)!;
        showRareAnnouncement({
          icon: prize.icon,
          name: prize.name,
          eyebrow: '禁域秘宝 · 全服瞩目',
          message: '猫猫探险队带回了足以改写旅程的至珍宝物',
          tone: 'treasure',
        });
      }
      setGachaRolling(false);
      gachaTimer.current = null;
    }, count === 1 ? 520 : 760);
  }

  function openGachaContainer(prizeId: string, openAll = false) {
    const container = gachaContainers[prizeId];
    const owned = gachaInventory[prizeId] ?? 0;
    if (!container || owned < 1 || containerReveal?.phase === 'opening') return;
    setContainerReveal(null);
    const openCount = openAll ? owned : 1;
    const openedLoot = Array.from({ length: openCount }, () => pickGachaLoot(container));
    const revealItems = [...openedLoot.reduce((grouped, loot) => {
      const current = grouped.get(loot.id);
      if (current) current.quantity += 1;
      else grouped.set(loot.id, { id: loot.id, name: loot.name, icon: loot.icon, rarity: loot.rarity, sellPrice: loot.sellPrice, quantity: 1 });
      return grouped;
    }, new Map<string, ContainerRevealItem>()).values()].sort((left, right) => {
      const rarityOrder: Record<GachaRarity, number> = { mythic: 0, legendary: 1, epic: 2, rare: 3, common: 4 };
      return rarityOrder[left.rarity] - rarityOrder[right.rarity] || right.sellPrice - left.sellPrice;
    });
    const lootKinds = new Set(openedLoot.map((loot) => loot.id)).size;
    const featuredLoot = openedLoot.find((loot) => loot.id === 'loot-duck-bottle' || loot.id === 'loot-fearless-breastplate') ?? openedLoot[openedLoot.length - 1];
    const duckCount = openedLoot.filter((loot) => loot.id === 'loot-duck-bottle').length;
    const breastplateCount = openedLoot.filter((loot) => loot.id === 'loot-fearless-breastplate').length;
    const sourcePrize = gachaPrizeById.get(prizeId)!;
    if (containerRevealTimer.current !== null) window.clearTimeout(containerRevealTimer.current);
    setContainerReveal({ id: Date.now(), source: 'gacha', phase: 'result', containerName: sourcePrize.name, containerIcon: sourcePrize.icon, openCount, items: revealItems });
    setGachaInventory((current) => {
      const next = { ...current };
      const remaining = (next[prizeId] ?? 0) - openCount;
      if (remaining > 0) next[prizeId] = remaining;
      else delete next[prizeId];
      return next;
    });
    setGachaLootInventory((current) => {
      const next = { ...current };
      openedLoot.forEach((loot) => { next[loot.id] = (next[loot.id] ?? 0) + 1; });
      return next;
    });
    setGachaLatestLootId(featuredLoot.id);
    setGachaActionNotice(openCount === 1
      ? `已放入背包：${featuredLoot.name} ×1 · 可售 ¥${featuredLoot.sellPrice}`
      : `连续开启 ${openCount} 个容器 · 获得 ${lootKinds} 种战利品，已全部入包`);
    if (duckCount > 0 || breastplateCount > 0) {
      containerRevealTimer.current = window.setTimeout(() => {
        setContainerReveal(null);
        if (duckCount > 0) {
          showRareAnnouncement({ icon: '🐥', name: '瓶子里的小鸭子', eyebrow: '怪爷爷秘藏 · 奇珍现世', message: duckCount > 1 ? `封存于瓶中的传奇小鸭子，本次一共游来 ${duckCount} 只` : '封存于瓶中的传奇小鸭子，已经游进你的宝物背包', tone: 'treasure' });
        } else {
          showRareAnnouncement({ icon: '🛡️', name: '无畏胸甲', eyebrow: '血骑士遗珍 · 无畏降临', message: breastplateCount > 1 ? `猩红战意席卷秘境，本次共获得 ${breastplateCount} 件无畏胸甲` : '猩红战意扑面而来，无畏胸甲已归入你的战利品', tone: 'treasure' });
        }
        containerRevealTimer.current = null;
      }, 320);
    } else {
      containerRevealTimer.current = null;
    }
  }

  function sellGachaItem(source: 'prize' | 'loot', itemId: string, sellAll: boolean) {
    const inventory = source === 'prize' ? gachaInventory : gachaLootInventory;
    const owned = inventory[itemId] ?? 0;
    const unitPrice = source === 'prize' ? gachaSellPrices[itemId] : gachaLootById.get(itemId)?.sellPrice;
    if (!owned || !unitPrice) return;
    const quantity = sellAll ? owned : 1;
    if (!creditFund(unitPrice * quantity)) return;
    const updateInventory = (current: Record<string, number>) => {
      const next = { ...current };
      const remaining = (next[itemId] ?? 0) - quantity;
      if (remaining > 0) next[itemId] = remaining;
      else delete next[itemId];
      return next;
    };
    if (source === 'prize') setGachaInventory(updateInventory);
    else setGachaLootInventory(updateInventory);
    const itemName = source === 'prize' ? gachaPrizeById.get(itemId)?.name : gachaLootById.get(itemId)?.name;
    setGachaSaleRevenue((current) => current + unitPrice * quantity);
    setGachaSoldCount((current) => current + quantity);
    setGachaActionNotice(`卖出 ${itemName ?? '物品'} ×${quantity} · 到账 ¥${formatMoney(unitPrice * quantity)}`);
  }

  function openLuckyPack() {
    const batchCost = luckyPackUnitCost * luckyPackBatchSize;
    if (luckyRolling || containerReveal?.phase === 'opening' || !luckyHasHydrated || !fundHasHydrated || !spendFromFund(batchCost)) return;
    setContainerReveal(null);
    const openedAt = Date.now() * 100;
    const drops: LuckyDrop[] = [];
    Array.from({ length: luckyPackBatchSize }, (_, packIndex) => {
      luckyChanceRows.forEach((row, rowIndex) => {
        if (randomUnit() * 100 >= row.probability) return;
        row.rewards.forEach((reward, rewardIndex) => {
          drops.push({
            id: openedAt + packIndex * 1000 + rowIndex * 10 + rewardIndex,
            itemId: reward.itemId,
            quantity: randomQuantity(reward.min, reward.max),
          });
        });
      });
    });
    const mergedDrops = [...drops.reduce((merged, drop) => {
      const existing = merged.get(drop.itemId);
      if (existing) existing.quantity += drop.quantity;
      else merged.set(drop.itemId, { ...drop });
      return merged;
    }, new Map<string, LuckyDrop>()).values()].sort((left, right) => {
      const rarityOrder: Record<GachaRarity, number> = { mythic: 0, legendary: 1, epic: 2, rare: 3, common: 4 };
      const leftItem = luckyItemById.get(left.itemId)!;
      const rightItem = luckyItemById.get(right.itemId)!;
      return rarityOrder[leftItem.rarity] - rarityOrder[rightItem.rarity] || rightItem.sellPrice - leftItem.sellPrice || leftItem.name.localeCompare(rightItem.name, 'zh-CN');
    });
    setLuckyLatest([]);
    setLuckyActionNotice(null);
    setLuckyRolling(true);
    setLuckyOpeningStep(0);
    setLuckyTotalOpens((current) => current + luckyPackBatchSize);
    setCostLedger((current) => ({
      knownSpend: current.knownSpend + batchCost,
      pricedAttempts: current.pricedAttempts + luckyPackBatchSize,
      itemSpend: { ...current.itemSpend, 'wangwang-pack': (current.itemSpend['wangwang-pack'] ?? 0) + batchCost },
    }));
    const finishOpening = () => {
      setLuckyLatest(mergedDrops);
      if (mergedDrops.length) {
        setLuckyInventory((current) => {
          const next = { ...current };
          mergedDrops.forEach((drop) => { next[drop.itemId] = (next[drop.itemId] ?? 0) + drop.quantity; });
          return next;
        });
        const totalQuantity = mergedDrops.reduce((sum, drop) => sum + drop.quantity, 0);
        setLuckyActionNotice(`10 包开启完成 · 命中 ${mergedDrops.length} 种 · 共 ${totalQuantity} 件物品`);
        const phoenixDrop = mergedDrops.find((drop) => drop.itemId === 'lucky-phoenix-baby');
        if (phoenixDrop) {
          const phoenix = luckyItemById.get(phoenixDrop.itemId)!;
          showRareAnnouncement({
            icon: phoenix.icon,
            name: phoenix.name,
            eyebrow: '赤羽临世 · 福运沸腾',
            message: `旺旺十连迎来凤凰祥瑞，${phoenixDrop.quantity > 1 ? `本次共降临 ${phoenixDrop.quantity} 只` : '珍稀灵宠已进入你的背包'}`,
            tone: 'treasure',
          });
        }
      } else {
        setLuckyActionNotice('10 包均未命中任何奖项，幸运值正在积蓄');
      }
      setLuckyRolling(false);
      setLuckyOpeningStep(0);
      luckyTimer.current = null;
    };
    let nextPack = 0;
    const revealNextPack = () => {
      nextPack += 1;
      setLuckyOpeningStep(nextPack);
      luckyTimer.current = window.setTimeout(nextPack < luckyPackBatchSize ? revealNextPack : finishOpening, nextPack < luckyPackBatchSize ? 90 : 210);
    };
    if (luckyTimer.current !== null) window.clearTimeout(luckyTimer.current);
    luckyTimer.current = window.setTimeout(revealNextPack, 80);
  }

  function openZodiacEgg() {
    if (luckyRolling || containerReveal?.phase === 'opening' || (luckyInventory['lucky-zodiac-egg'] ?? 0) < 1) return;
    setContainerReveal(null);
    let roll = randomUnit() * 100;
    let result = zodiacItems[zodiacItems.length - 1];
    for (const item of zodiacItems) {
      roll -= item.probability;
      if (roll < 0) {
        result = item;
        break;
      }
    }
    if (containerRevealTimer.current !== null) window.clearTimeout(containerRevealTimer.current);
    setContainerReveal({ id: Date.now(), source: 'zodiac', phase: 'result', containerName: '生肖彩蛋', containerIcon: '🥚', openCount: 1, items: [{ id: result.id, name: result.name, icon: result.icon, rarity: result.rarity, sellPrice: result.sellPrice, quantity: 1 }] });
    setLuckyInventory((current) => {
      const next = { ...current };
      const eggsLeft = (next['lucky-zodiac-egg'] ?? 0) - 1;
      if (eggsLeft > 0) next['lucky-zodiac-egg'] = eggsLeft;
      else delete next['lucky-zodiac-egg'];
      next[result.id] = (next[result.id] ?? 0) + 1;
      return next;
    });
    setLuckyLatest([{ id: Date.now(), itemId: result.id, quantity: 1 }]);
    setLuckyActionNotice(`生肖彩蛋开启：${result.name} ×1 · 可售 ¥${formatMoney(result.sellPrice)}`);
    if (result.celestial) {
      containerRevealTimer.current = window.setTimeout(() => {
        setContainerReveal(null);
        showRareAnnouncement({ icon: result.icon, name: result.name, eyebrow: '天命显现 · 万象共鸣', message: '祥瑞撕裂夜幕，传说灵兽已降临你的背包', tone: 'celestial' });
        containerRevealTimer.current = null;
      }, 320);
    } else {
      containerRevealTimer.current = null;
    }
  }

  function sellLuckyItem(itemId: string, sellAll: boolean) {
    const item = luckyItemById.get(itemId);
    const owned = luckyInventory[itemId] ?? 0;
    if (!item || !owned) return;
    const quantity = sellAll ? owned : 1;
    const revenue = item.sellPrice * quantity;
    if (!creditFund(revenue)) return;
    setLuckyInventory((current) => {
      const next = { ...current };
      const remaining = (next[itemId] ?? 0) - quantity;
      if (remaining > 0) next[itemId] = remaining;
      else delete next[itemId];
      return next;
    });
    setLuckySaleRevenue((current) => current + revenue);
    setLuckySoldCount((current) => current + quantity);
    setLuckyActionNotice(`卖出 ${item.name} ×${quantity} · 到账 ¥${formatMoney(revenue)}`);
  }

  function restartSession() {
    stopAutoTargetRun();
    stopRapidClicker();
    stopGuardianAutoRefresh();
    if (pendingForgeTimer.current !== null) {
      window.clearTimeout(pendingForgeTimer.current);
      pendingForgeTimer.current = null;
    }
    if (gachaTimer.current !== null) {
      window.clearTimeout(gachaTimer.current);
      gachaTimer.current = null;
    }
    if (luckyTimer.current !== null) {
      window.clearTimeout(luckyTimer.current);
      luckyTimer.current = null;
    }
    if (rareAnnouncementTimer.current !== null) {
      window.clearTimeout(rareAnnouncementTimer.current);
      rareAnnouncementTimer.current = null;
    }
    if (containerRevealTimer.current !== null) {
      window.clearTimeout(containerRevealTimer.current);
      containerRevealTimer.current = null;
    }
    window.localStorage.removeItem(sessionStorageKey);
    window.localStorage.removeItem(guardianStorageKey);
    window.localStorage.removeItem(gachaStorageKey);
    window.localStorage.removeItem(luckyStorageKey);
    window.localStorage.removeItem(fundStorageKey);
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
    setGuardianSlots(initialGuardianSlots);
    setGuardianHistory([]);
    setGuardianLatestSlot(null);
    setGachaHistory([]);
    setGachaInventory({});
    setGachaLootInventory({});
    setGachaTotalDraws(0);
    setGachaSaleRevenue(0);
    setGachaSoldCount(0);
    setGachaActionNotice(null);
    setGachaLatestLootId(null);
    setGachaLatest([]);
    setGachaRolling(false);
    setLuckyInventory({});
    setLuckyTotalOpens(0);
    setLuckySaleRevenue(0);
    setLuckySoldCount(0);
    setLuckyLatest([]);
    setLuckyRolling(false);
    setLuckyOpeningStep(0);
    setLuckyActionNotice(null);
    setRareAnnouncement(null);
    setContainerReveal(null);
    setCostLedger({ knownSpend: 0, pricedAttempts: 0, itemSpend: {} });
    const currentHour = localHourKey();
    fundBalanceRef.current = hourlyFundAmount;
    fundHourKeyRef.current = currentHour;
    setFundBalance(hourlyFundAmount);
    setFundHourKey(currentHour);
    setFundNow(Date.now());
    setFundNotice(null);
    fundBackdoorClicks.current = 0;
  }

  const currentLevelPalette = itemInstancePalette(selectedInstance, level);
  const theme = { '--accent': currentLevelPalette.accent, '--accent-soft': currentLevelPalette.soft } as CSSProperties;
  const pageTheme = activeSystem === 'guardian'
    ? { '--accent': '#65d3ac', '--accent-soft': '#153a30' } as CSSProperties
    : activeSystem === 'gacha'
      ? { '--accent': '#ffbd6d', '--accent-soft': '#4a2925' } as CSSProperties
      : activeSystem === 'lucky'
        ? { '--accent': '#ffcf62', '--accent-soft': '#5a1718' } as CSSProperties
        : theme;
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
  const canAffordAttempt = fundHasHydrated && (attemptUnitCost === null || fundBalance >= attemptUnitCost);
  const isRapidClickerRunning = rapidClickerItemId === itemKey;
  const fundCountdown = fundHasHydrated && fundNow ? countdownToNextHour(fundNow) : '--:--';
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

  rapidClickerTick.current = () => {
    if (rapidClickerItemId !== itemKey || activeSystem !== 'forge') {
      stopRapidClicker();
      return;
    }
    if (!canForge) {
      stopRapidClicker();
      showFundNotice('当前项目已完成，连点停止');
      return;
    }
    if (!canAffordAttempt) {
      stopRapidClicker();
      showFundNotice('资金不足，连点停止');
      return;
    }
    simulate(1, true);
  };

  return (
    <main className={`game-forge ${activeSystem === 'guardian' ? 'guardian-system-active' : ''} ${activeSystem === 'gacha' ? 'gacha-system-active' : ''} ${activeSystem === 'lucky' ? 'lucky-system-active' : ''} ${isRolling ? 'is-forging' : ''}`} style={pageTheme}>
      <header className="game-hud compact-hud cost-hud">
        <nav className="system-tabs" aria-label="养成系统">
          <button type="button" className={activeSystem === 'forge' ? 'active' : ''} onClick={() => { stopGuardianAutoRefresh(); setActiveSystem('forge'); }}><i>◇</i><span>装备打造</span></button>
          <button type="button" className={activeSystem === 'guardian' ? 'active' : ''} onClick={() => { stopRapidClicker(); setActiveSystem('guardian'); }}><i>守</i><span>守护技能</span></button>
          <button type="button" className={activeSystem === 'gacha' ? 'active' : ''} onClick={() => { stopRapidClicker(); stopGuardianAutoRefresh(); setActiveSystem('gacha'); }}><i>寻</i><span>猫猫寻宝</span></button>
          <button type="button" className={activeSystem === 'lucky' ? 'active' : ''} onClick={() => { stopRapidClicker(); stopGuardianAutoRefresh(); setActiveSystem('lucky'); }}><i>旺</i><span>旺旺幸运包</span></button>
        </nav>
        <div className="hud-cost-only">
          <div className={`hourly-fund ${fundBalance < 1000 ? 'low' : ''}`} title="每个整点重置为 ¥10,000">
            <span><i />整点资金池</span>
            <b>¥{fundBalance.toLocaleString('zh-CN', { minimumFractionDigits: Number.isInteger(fundBalance) ? 0 : 1, maximumFractionDigits: 1 })}</b>
            <small aria-live="polite">{fundNotice ?? `距刷新 ${fundCountdown}`}</small>
          </div>
          <span>已知累计花费</span>
          <button type="button" className="hud-cost-detail-trigger" onClick={() => setCostDetailsOpen(true)} disabled={!hasHydrated} title="查看每个强化物品的花费明细"><b>¥{costLedger.knownSpend.toFixed(2)}</b><small>查看明细</small></button>
          <em onClick={triggerFundBackdoor}>{hasHydrated ? '本地已保存' : '正在恢复进度'}</em>
          <button type="button" className={`graduation-trigger ${graduationReady ? 'ready' : ''}`} onClick={openGraduationPoster} disabled={!hasHydrated || !graduationReady} title={graduationReady ? '生成并分享毕业海报' : '毕业条件：燃烧宝石 +8、星月神话 +9、催化神石 +10、其余项目全 10、守护四席均为 5 级技能'}>毕业照</button>
          <button type="button" onClick={restartSession} disabled={!hasHydrated}>重新计算</button>
        </div>
      </header>

      <section className={`forge-layout ${activeSystem === 'forge' ? '' : 'system-hidden'}`}>
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
                      const instancePalette = itemInstancePalette(instance, instanceLevel);
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
            {item.mode !== 'draw' && <div className="level-route"><div className="level-focus"><span>当前等级</span><b>{levelLabel(level)}</b>{itemQuantity > 1 && <em className="current-instance">{selectedInstance.nickname} · {String(itemInstanceNumber).padStart(2, '0')} / {String(itemQuantity).padStart(2, '0')}</em>}</div><div className="level-steps" aria-label={`${itemInstanceName(selectedInstance)}强化等级进度`}>{Array.from({ length: maxSelectable - (item.minLevel ?? 0) + 1 }, (_, index) => (item.minLevel ?? 0) + index).map((step) => <span key={step} className={`${step === level ? 'current' : step < level ? 'done' : ''} ${isCheckpointLevel(item.id, step) ? 'checkpoint' : ''}`} aria-current={step === level ? 'step' : undefined} title={isCheckpointLevel(item.id, step) ? item.mode === 'adaptive' ? `${step} 星保级点` : `+${step} 保级点` : undefined} style={{ '--step-color': itemInstancePalette(selectedInstance, step).accent } as CSSProperties}><i /><b>{step}</b></span>)}</div></div>}
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
                      disabled={isAutoTargetRunning || isRapidClickerRunning}
                      aria-label={`${item.name}自动强化目标等级`}
                      onChange={(event) => {
                        const nextTarget = Math.min(autoTargetLimit, Math.max(1, Math.floor(Number(event.target.value) || 1)));
                        setTargetLevels((current) => ({ ...current, [itemKey]: nextTarget }));
                      }}
                    />
                    <span>停止</span>
                  </label>
                  <button type="button" onClick={toggleAutoTargetRun} disabled={!canForge || rapidClickerItemId !== null || (!isAutoTargetRunning && (level >= targetLevel || !canAffordAttempt))} title={rapidClickerItemId !== null ? '连点器运行中' : !canAffordAttempt ? '资金不足，等待整点刷新' : '每 0.2 秒结算一次单次强化'}>
                    {rapidClickerItemId !== null ? '连点中' : isAutoTargetRunning ? '停止' : level >= targetLevel ? '已到达' : !canAffordAttempt ? '余额不足' : '执行'}
                  </button>
                </div>
              )}
              <button type="button" className={`primary-action ${isRapidClickerRunning ? 'rapid-active' : ''}`} onClick={handlePrimaryActionClick} onPointerDown={beginRapidClickerHold} onPointerUp={releaseRapidClickerHold} onPointerCancel={releaseRapidClickerHold} onPointerLeave={releaseRapidClickerHold} onContextMenu={(event) => event.preventDefault()} disabled={isRolling || isAutoTargetRunning || (!isRapidClickerRunning && (!canForge || !canAffordAttempt))}>
                <span>{isRapidClickerRunning ? `连点中 · ¥${attemptUnitCost?.toFixed(0) ?? '—'} / 0.2 秒 · 点击停止` : isAutoTargetRunning ? `自动强化中 · ¥${attemptUnitCost?.toFixed(0) ?? '—'} / 0.2 秒` : isRolling ? '强化中…' : !canForge ? '已经毕业' : !canAffordAttempt ? '资金不足 · 等待整点刷新' : attemptUnitCost !== null ? `${actionLabel} · ¥${attemptUnitCost.toFixed(0)}` : actionLabel}</span>
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

      <section className={`guardian-layout ${activeSystem === 'guardian' ? '' : 'system-hidden'}`}>
        <aside className="guardian-atlas-panel">
          <header className="guardian-panel-heading"><span>技能谱系</span><b>16 类 · 80 项</b><small>每类最多占据两个技能席位</small></header>
          <div className="guardian-atlas-grid">
            {guardianSkillGroups.map((group) => {
              const equippedCount = equippedGuardianGroups[group.id] ?? 0;
              return (
                <article key={group.id} className={equippedCount >= 2 ? 'capped' : ''} style={{ '--group-skill-accent': group.accent } as CSSProperties} title={`${group.skills.join(' / ')}；对应等级 1–5`}>
                  <span><i>{group.name}</i><em>{equippedCount}/2</em></span>
                  <b>{group.skills[4]}</b>
                  <small>{group.skills[0]} → {group.skills[4]}</small>
                </article>
              );
            })}
          </div>
          <div className="guardian-rank-legend">
            <span>等级概率</span>
            {guardianRankProbabilities.map((probability, index) => <i key={probability} style={{ '--rank-color': guardianRankColors[index] } as CSSProperties} title={`${guardianRankNames[index]} · ${probability.toFixed(2)}%`}><b>{index + 1}</b><small>{guardianRankNames[index]}</small><em>{probability.toFixed(2)}%</em></i>)}
          </div>
        </aside>

        <section className="guardian-sanctum">
          <header className="guardian-sanctum-heading">
            <div><small>GUARDIAN INHERENT SKILLS</small><h2>守护天生技能</h2><p>单刷固定当前席位；四席全刷后按等级从高到低排列。</p></div>
            <div className="guardian-price-group">
              <div className="guardian-price"><span>单席刷新</span><b>¥5</b><small>只替换当前席位</small></div>
              <button type="button" className="guardian-refresh-all" onClick={refreshAllGuardianSlots} disabled={!hasHydrated || !fundHasHydrated || fundBalance < 1 || guardianAutoSlotId !== null} title={guardianAutoSlotId !== null ? '请先停止当前追橙' : fundBalance < 1 ? '资金不足，等待整点刷新' : '一次生成四项'}><span>四席全部刷新</span><b>¥1</b><small>{guardianAutoSlotId !== null ? '追橙进行中' : fundBalance < 1 ? '资金不足' : '一次生成四项'}</small></button>
            </div>
          </header>
          <div className="guardian-formation">
            <div className="guardian-crest" aria-hidden="true"><i /><i /><i /><b>守</b><span>四象归位</span></div>
            {guardianResolvedSlots.map((slot) => {
              const skill = slot.skill;
              const rankColor = skill ? guardianRankColors[skill.level - 1] : '#615e56';
              const groupCount = skill ? equippedGuardianGroups[skill.groupId] ?? 0 : 0;
              return (
                <article key={`${slot.id}-${slot.refreshes}`} className={`guardian-skill-slot ${skill ? `rank-${skill.level}` : 'empty'} ${guardianLatestSlot === slot.id || guardianLatestSlot === 0 ? 'latest' : ''} ${guardianAutoSlotId === slot.id ? 'auto-refreshing' : ''}`} style={{ '--skill-accent': skill?.accent ?? '#777066', '--rank-color': rankColor } as CSSProperties}>
                  <header><span>技能席位 {String(slot.id).padStart(2, '0')}</span><div>{skill && <b>{guardianRankNames[skill.level - 1]}</b>}<i>{slot.refreshes} 次刷新</i></div></header>
                  {skill ? (
                    <div className="guardian-skill-current">
                      <span className="guardian-skill-sigil"><b>{skill.name.slice(-1)}</b></span>
                      <div><small>{skill.groupName} · 同类 {groupCount}/2</small><h3>{skill.name}</h3><p><b>Lv.{skill.level}</b><i>{guardianRankNames[skill.level - 1]}</i><em>基础 {skill.probability.toFixed(2)}%</em></p></div>
                    </div>
                  ) : (
                    <div className="guardian-skill-empty"><span>◇</span><b>等待技能显现</b><small>首次刷新将从完整技能池抽取</small></div>
                  )}
                  <div className="guardian-slot-actions">
                    <button type="button" className="guardian-refresh-once" onClick={() => refreshGuardianSlot(slot.id)} disabled={!hasHydrated || !fundHasHydrated || fundBalance < 5 || guardianAutoSlotId !== null} title={guardianAutoSlotId !== null ? '请先停止当前追橙' : fundBalance < 5 ? '资金不足，等待整点刷新' : '只刷新当前席位一次'}><span>{guardianAutoSlotId !== null ? '追橙进行中' : fundBalance < 5 ? '资金不足' : skill ? '刷新一次' : '唤醒一次'}</span><b>¥5</b></button>
                    <button type="button" className={`guardian-refresh-until-five ${guardianAutoSlotId === slot.id ? 'active' : ''}`} onClick={() => toggleGuardianAutoRefresh(slot.id)} disabled={!hasHydrated || !fundHasHydrated || (guardianAutoSlotId !== slot.id && (fundBalance < 5 || skill?.level === 5 || guardianAutoSlotId !== null))} title={guardianAutoSlotId === slot.id ? '点击停止自动刷新' : skill?.level === 5 ? '当前已是橙卡' : '每隔0.3秒刷新当前席位，出现5级技能后自动停止'}><span>{guardianAutoSlotId === slot.id ? '停止追橙' : skill?.level === 5 ? '已达橙卡' : '追至橙卡'}</span><small>{guardianAutoSlotId === slot.id ? '0.3秒 / 次' : skill?.level === 5 ? '无需刷新' : '¥5 / 次'}</small></button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="guardian-ledger-panel">
          <header className="guardian-panel-heading"><span>守护账本</span><b>SKILL LEDGER</b><small>刷新花费计入极品号总成本</small></header>
          <div className="guardian-cost-card"><span>守护技能花费</span><strong>¥{guardianSpend.toFixed(2)}</strong><small>单席 {guardianSingleRefreshes} 次 · 全席 {guardianBulkRefreshes} 次 · 共生成 {guardianRefreshes} 个词条</small></div>
          <section className="guardian-rule-card">
            <header><b>刷新约束</b><i>已启用</i></header>
            <p><span>01</span>单席 ¥5；四席同时刷新 ¥1</p>
            <p><span>02</span>技能按公示基础概率随机出现</p>
            <p><span>03</span>其他席位已有两个同类时，该类本次不再出现</p>
            <p><span>04</span>追至橙卡每 0.3 秒刷新一次，5级或余额不足时停止</p>
          </section>
          <div className="guardian-history-heading"><span>最近显现</span><i>{guardianHistory.length}</i></div>
          <div className="guardian-history-list">
            {!guardianHistory.length ? <div className="guardian-history-empty"><i>守</i><b>四席尚未唤醒</b><small>从任意席位开始第一次刷新</small></div> : guardianHistory.slice(0, 7).map((entry) => {
              const skill = guardianSkillById.get(entry.skillId);
              const previousSkill = entry.previousSkillId ? guardianSkillById.get(entry.previousSkillId) : null;
              if (!skill) return null;
              return <article key={entry.id} style={{ '--history-accent': skill.accent } as CSSProperties}><span>{entry.mode === 'all' ? `全刷 · ${entry.slotId}` : entry.mode === 'until-five' ? `追橙 · ${entry.slotId}` : `第 ${entry.slotId} 席`}</span><div><b>{skill.name}</b><small>{entry.mode === 'until-five' ? `自动刷新 · ${previousSkill ? `${previousSkill.name} → ${skill.name}` : `首次获得 · ${skill.groupName}`}` : previousSkill ? `${previousSkill.name} → ${skill.name}` : `首次获得 · ${skill.groupName}`}</small></div><em>Lv.{skill.level}</em></article>;
            })}
          </div>
          <footer className="guardian-ledger-footer"><span><i /> 概率来源：用户提供公示表</span><p>显示的是原始基础概率；受同类上限约束时，会在可用技能中重新归一。</p></footer>
        </aside>
      </section>

      <section className={`gacha-layout ${activeSystem === 'gacha' ? '' : 'system-hidden'}`}>
        <aside className="gacha-pool-panel">
          <header className="gacha-panel-heading"><span>TREASURE CODEX</span><h2>秘境宝物图鉴</h2><small>{gachaPrizes.length} 种宝物 · 按稀有度陈列</small></header>
          <div className="gacha-rarity-legend">
            {(Object.entries(gachaRarityMeta) as Array<[GachaRarity, typeof gachaRarityMeta[GachaRarity]]>).map(([key, meta]) => <i key={key} style={{ '--gacha-color': meta.color } as CSSProperties}><b>{meta.short}</b><span>{meta.name}</span></i>)}
          </div>
          <div className="gacha-prize-list">
            {gachaPrizes.map((prize) => {
              const meta = gachaRarityMeta[prize.rarity];
              const container = gachaContainers[prize.id];
              return <article key={prize.id} className={`rarity-${prize.rarity}`} style={{ '--gacha-color': meta.color } as CSSProperties}><i>{prize.icon}</i><span><b>{prize.name}</b><small>{meta.name}</small></span><em>{container ? '可开启' : `¥${gachaSellPrices[prize.id]}`}</em></article>;
            })}
          </div>
          <footer>抽取概率仅用于内部计算，界面按稀有度、名称与售价展示。</footer>
        </aside>

        <section className={`gacha-stage ${gachaFeaturedPrize && !gachaRolling ? `result-${gachaFeaturedPrize.rarity}` : ''}`}>
          <header className="gacha-stage-heading"><div><small>CAT EXPEDITION · FORBIDDEN RUINS</small><h2>猫猫秘境寻宝</h2><p>校准星盘，派出猫猫探险队，从遗迹带回真正的宝藏。</p></div><span><b>{gachaTotalDraws}</b><small>累计探索</small></span></header>
          <div className={`cat-gacha-machine treasure-machine ${gachaRolling ? 'rolling' : ''} ${gachaFeaturedPrize && !gachaRolling ? `result-${gachaFeaturedPrize.rarity}` : ''}`} aria-label="猫猫秘境寻宝仪">
            <div className="treasure-map"><i /><i /><i /><i /><b>✕</b><span>遗迹坐标</span></div>
            <div className="treasure-compass"><i /><i /><b>寻</b><span>N</span><em>S</em><div className="treasure-vault" aria-hidden="true">{gachaVaultPrizes.map((prize, index) => <i key={prize.id} style={{ '--vault-color': gachaRarityMeta[prize.rarity].color, '--vault-delay': `${index * -90}ms` } as CSSProperties}>{prize.icon}</i>)}</div></div>
            <div className="treasure-cat"><i className="cat-ear left" /><i className="cat-ear right" /><span><i /><i /><b /><em /></span><strong>探险队长</strong></div>
            <div className={`treasure-chest ${gachaLatest.length && !gachaRolling ? 'opened' : ''}`}><i className="chest-lid"><b /></i><i className="chest-body"><b /></i><span>{gachaRolling ? '探索中' : '秘宝'}</span></div>
            {gachaFeaturedPrize && !gachaRolling && <div className={`treasure-winner rarity-${gachaFeaturedPrize.rarity}`} style={{ '--winner-color': gachaRarityMeta[gachaFeaturedPrize.rarity].color } as CSSProperties} aria-live="polite"><span className="winner-effects" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</span><em className="winner-ring" aria-hidden="true" /><i className="winner-icon">{gachaFeaturedPrize.icon}</i><span className="winner-copy"><small>{gachaRarityMeta[gachaFeaturedPrize.rarity].short} · 最终寻获</small><b>{gachaFeaturedPrize.name}</b><strong>{gachaRarityMeta[gachaFeaturedPrize.rarity].name}宝物</strong></span></div>}
            <div className="treasure-route"><i /><i /><i /><i /><i /></div>
          </div>

          <div className={`gacha-reveal ${gachaRolling ? 'rolling' : ''}`} aria-live="polite">
            {containerReveal?.source === 'gacha' ? containerReveal.phase === 'opening'
              ? <div className="gacha-opening container-opening-main"><i>{containerReveal.containerIcon}</i><i /><i /><b>正在开启{containerReveal.containerName}…</b><small>{containerReveal.openCount > 1 ? `连续开启 ${containerReveal.openCount} 个` : '正在破除封印'}</small></div>
              : <div className="main-container-result"><header><span>容器开启结果</span><b>{containerReveal.items.length} 种 · 总售价 ¥{formatMoney(containerReveal.items.reduce((sum, item) => sum + item.sellPrice * item.quantity, 0))}</b></header><div>{containerReveal.items.map((item, index) => {
                const meta = gachaRarityMeta[item.rarity];
                return <article key={item.id} style={{ '--reveal-color': meta.color, '--container-delay': `${index * 45}ms` } as CSSProperties}><i>{item.icon}</i><span><b>{item.name}</b><small>{meta.name} · ¥{formatMoney(item.sellPrice)}/件</small></span><strong>×{item.quantity}</strong></article>;
              })}</div></div>
              : gachaRolling ? <div className="gacha-opening"><i /><i /><i /><b>猫猫探险队正在深入遗迹…</b></div> : !gachaLatest.length ? <div className="gacha-awaiting"><i>✦</i><b>等待开启第一张藏宝图</b><small>单次探索与十次远征使用相同的完整宝物池</small></div> : <div className={`gacha-result-grid count-${gachaLatest.length}`}>{gachaLatest.map((pull, index) => {
              const prize = gachaPrizeById.get(pull.prizeId)!;
              const meta = gachaRarityMeta[prize.rarity];
              return <article key={pull.id} className={`rarity-${prize.rarity}`} style={{ '--gacha-color': meta.color, '--reveal-delay': `${index * 45}ms` } as CSSProperties}><span>{meta.short}</span><i>{prize.icon}</i><b>{prize.name}</b><small>{meta.name}宝物</small></article>;
            })}</div>}
          </div>

          <div className="gacha-actions">
            <button type="button" onClick={() => drawGacha(1)} disabled={gachaRolling || !gachaHasHydrated || !fundHasHydrated || fundBalance < gachaUnitCost}><span>开启藏宝图</span><b>探索一次</b><small>¥{gachaUnitCost} / 次</small></button>
            <button type="button" className="ten-pull" onClick={() => drawGacha(10)} disabled={gachaRolling || !gachaHasHydrated || !fundHasHydrated || fundBalance < gachaUnitCost * 10}><span>集结猫猫远征队</span><b>探索十次</b><small>¥{gachaUnitCost * 10} / 十次</small></button>
          </div>
        </section>

        <aside className="gacha-record-panel">
          <header className="gacha-panel-heading"><span>ADVENTURER BACKPACK</span><h2>猫猫探险背包</h2><small>开启容器、管理战利品、卖出补充资金池</small></header>
          <section className="gacha-economy-ledger">
            <header><span>寻宝账本</span><small>本地永久累计</small></header>
            <div><article className="expense"><span>寻宝花费</span><b>¥{formatMoney(gachaSpend)}</b><small>{gachaTotalDraws} 次探索</small></article><article className="income"><span>卖出收入</span><b>¥{formatMoney(gachaSaleRevenue)}</b><small>{gachaSoldCount} 件物品</small></article></div>
            <footer className={gachaSaleRevenue > gachaSpend ? 'profit' : ''}><span>{gachaSaleRevenue > gachaSpend ? '当前净赚' : '当前净花费'}</span><b>¥{formatMoney(Math.abs(gachaSpend - gachaSaleRevenue))}</b><small>背包现有 {gachaCollected + gachaLootCollected} 种 · {gachaBackpackCount} 件</small></footer>
          </section>
          <div className="gacha-collection-meter"><span><b>图鉴完成度</b><em>{Math.round((gachaCollected / gachaPrizes.length) * 100)}%</em></span><i><i style={{ width: `${(gachaCollected / gachaPrizes.length) * 100}%` }} /></i></div>
          <details className="gacha-container-rules">
            <summary><span>可开启容器奖池</span><i>3 类 · 查看明细</i></summary>
            <div>{Object.values(gachaContainers).map((container) => <article key={container.prizeId}><b>{gachaPrizeById.get(container.prizeId)?.icon} {gachaPrizeById.get(container.prizeId)?.name}</b>{container.items.map((loot) => <p key={loot.id}><span>{loot.icon} {loot.name}</span><strong>¥{loot.sellPrice}</strong></p>)}</article>)}</div>
          </details>
          {gachaActionNotice && <div className="gacha-action-notice" role="status"><i>✦</i><span>{gachaActionNotice}</span></div>}
          <div className="gacha-history-heading"><span>背包物品</span><i>{gachaBackpackCount ? `共 ${gachaBackpackCount} 件 · 高阶 ${gachaHighRarityCount}` : '尚无宝物'}</i></div>
          <div className="gacha-backpack-grid">
            {!gachaBackpackItems.length && !gachaLootBackpackItems.length ? <div className="gacha-history-empty"><i>囊</i><b>探险背包还是空的</b><small>完成寻宝后，获得的物品会自动装入背包</small></div> : <>
            {gachaLootBackpackItems.map((loot) => {
              const meta = gachaRarityMeta[loot.rarity];
              return <article key={loot.id} className={`rarity-${loot.rarity} loot-card ${loot.id === gachaLatestLootId ? 'new-loot' : ''}`} style={{ '--gacha-color': meta.color } as CSSProperties} title={`${loot.name} · 开箱产物 · 售价 ¥${loot.sellPrice}`}><i>{loot.icon}</i><span><b>{loot.name}</b><small>{meta.short} · 售价 ¥{loot.sellPrice}</small></span><em>×{gachaLootInventory[loot.id]}</em><div><button type="button" onClick={() => sellGachaItem('loot', loot.id, false)}>卖1</button><button type="button" onClick={() => sellGachaItem('loot', loot.id, true)}>全卖</button></div></article>;
            })}
            {gachaBackpackItems.map((prize) => {
              const meta = gachaRarityMeta[prize.rarity];
              const container = gachaContainers[prize.id];
              const sellPrice = gachaSellPrices[prize.id];
              const itemTitle = container
                ? `${prize.name} · 开启奖池\n${container.items.map((loot) => `${loot.icon} ${loot.name} · ¥${loot.sellPrice}`).join('\n')}`
                : `${prize.name} · ${meta.name} · 售价 ¥${sellPrice}`;
              return <article key={prize.id} className={`rarity-${prize.rarity} ${container ? 'container-card' : ''}`} style={{ '--gacha-color': meta.color } as CSSProperties} title={itemTitle}><i>{prize.icon}</i><span><b>{prize.name}</b><small>{container ? `${meta.short} · 内含 ${container.items.length} 种宝物` : `${meta.short} · 售价 ¥${sellPrice}`}</small></span><em>×{gachaInventory[prize.id]}</em><div>{container ? <><button type="button" className="open-container" onClick={() => openGachaContainer(prize.id)}>开1</button><button type="button" onClick={() => openGachaContainer(prize.id, true)}>全开</button></> : <><button type="button" onClick={() => sellGachaItem('prize', prize.id, false)}>卖1</button><button type="button" onClick={() => sellGachaItem('prize', prize.id, true)}>全卖</button></>}</div></article>;
            })}
            </>}
          </div>
          <footer className="gacha-record-note"><i>¥</i><span><b>寻宝 ¥2 / 次</b><small>卖出收入返还资金池；容器本体需开启后出售产物。</small></span></footer>
        </aside>
      </section>

      <section className={`lucky-layout ${activeSystem === 'lucky' ? '' : 'system-hidden'}`}>
        <aside className="lucky-rule-panel">
          <header className="lucky-panel-heading"><span>FORTUNE PROTOCOL · 28</span><h2>福袋内容录</h2><small>每一行单独判定，命中组合会整组入包</small></header>
          <div className="lucky-rule-list">
            {luckyChanceRows.map((row, index) => <article key={row.id}>
              <i>{String(index + 1).padStart(2, '0')}</i>
              <span>{row.rewards.map((reward) => {
                const rewardItem = luckyItemById.get(reward.itemId)!;
                const quantity = reward.min === reward.max ? `${reward.min}` : `${reward.min}–${reward.max}`;
                return <b key={`${row.id}-${reward.itemId}`}>{rewardItem.icon} {rewardItem.name}<em>×{quantity}</em></b>;
              })}</span>
              <strong>{row.probability}%</strong>
            </article>)}
          </div>
          <footer><i>逐包独立</i><span>每包独立判断 28 项；一次连续开启 10 包后合并入袋。</span></footer>
        </aside>

        <section className="lucky-stage">
          <header className="lucky-stage-heading">
            <div><small>WANGWANG FORTUNE HOUSE</small><h2>旺旺幸运包 ×10</h2><p>十包连开，每包的二十八道福运分别回应。</p></div>
            <span><b>{luckyTotalOpens}</b><small>累计开启</small></span>
          </header>
          <div className={`wangwang-pack-scene ${luckyRolling ? 'opening' : ''}`}>
            <span className="fortune-cloud cloud-one" /><span className="fortune-cloud cloud-two" />
            <div className="fortune-coins" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index}>◇</i>)}</div>
            <div className="lucky-pack-run" aria-label={luckyRolling ? `正在开启第 ${luckyOpeningStep || 1} 个，共 10 个` : '十个旺旺幸运包'}>{Array.from({ length: luckyPackBatchSize }, (_, index) => {
              const packNumber = index + 1;
              const state = luckyRolling ? packNumber < luckyOpeningStep ? 'opened' : packNumber === luckyOpeningStep ? 'active' : 'pending' : 'settled';
              return <i key={packNumber} className={state}><b>旺</b><small>{String(packNumber).padStart(2, '0')}</small></i>;
            })}</div>
            <div className="wangwang-pack" role="img" aria-label="朱红烫金旺旺幸运包">
              <i className="pack-knot"><b /></i>
              <div className="pack-mouth"><i /><i /><i /></div>
              <div className="pack-body"><span>旺</span><b>二十八运</b><i>福</i></div>
              <em>LUCKY</em>
            </div>
            <div className="fortune-seal"><i>開</i><span>八元启封</span></div>
          </div>
          <div className={`lucky-reveal-board ${luckyRolling ? 'rolling' : ''}`} aria-live="polite">
            {containerReveal?.source === 'zodiac' ? containerReveal.phase === 'opening'
              ? <div className="lucky-opening zodiac-opening-main"><i>🥚</i><i /><i /><b>生肖彩蛋正在破壳…</b><small>十四道命格即将显现</small><em><i style={{ width: '64%' }} /></em></div>
              : <><header><span>生肖彩蛋 · 开启结果</span><b>{containerReveal.items.length} 种 · 可售 ¥{formatMoney(containerReveal.items.reduce((sum, item) => sum + item.sellPrice * item.quantity, 0))}</b></header><div>{containerReveal.items.map((item, index) => <article key={item.id} className={`rarity-${item.rarity}`} style={{ '--lucky-color': gachaRarityMeta[item.rarity].color, '--lucky-delay': `${index * 38}ms` } as CSSProperties}><i>{item.icon}</i><span><b>{item.name}</b><small>单价 ¥{formatMoney(item.sellPrice)}</small></span><strong>×{item.quantity}</strong></article>)}</div></>
              : luckyRolling ? <div className="lucky-opening"><i /><i /><i /><b>正在开启第 {Math.max(1, luckyOpeningStep)} / {luckyPackBatchSize} 包</b><small>当前福签完成 28 项独立判定</small><em><i style={{ width: `${(luckyOpeningStep / luckyPackBatchSize) * 100}%` }} /></em></div>
              : luckyLatest.length ? <>
                <header><span>本次福运</span><b>{luckyLatest.length} 种 · 可售 ¥{formatMoney(luckyLatestValue)}</b></header>
                <div>{luckyLatest.map((drop, index) => {
                  const dropItem = luckyItemById.get(drop.itemId)!;
                  const meta = gachaRarityMeta[dropItem.rarity];
                  return <article key={drop.id} className={`rarity-${dropItem.rarity}`} style={{ '--lucky-color': meta.color, '--lucky-delay': `${index * 38}ms` } as CSSProperties}><i>{dropItem.icon}</i><span><b>{dropItem.name}</b><small>单价 ¥{formatMoney(dropItem.sellPrice)}</small></span><strong>×{drop.quantity}</strong></article>;
                })}</div>
              </> : luckyTotalOpens ? <div className="lucky-empty-result"><i>空</i><b>这次福签没有回应</b><small>每项独立判定，落空也是正常结果</small></div>
                : <div className="lucky-empty-result waiting"><i>旺</i><b>等待第一次十连启封</b><small>十包结果统一汇总并放入背包</small></div>}
          </div>
          <div className="lucky-main-action">
            <button type="button" onClick={openLuckyPack} disabled={luckyRolling || !luckyHasHydrated || !fundHasHydrated || fundBalance < luckyPackUnitCost * luckyPackBatchSize}><span>十包连开 · ¥{luckyPackUnitCost}/包</span><b>开启 ×10</b><small>本次共 ¥{luckyPackUnitCost * luckyPackBatchSize}</small></button>
            <p><i />{luckyActionNotice ?? '所得物品自动进入右侧福运背包'}</p>
          </div>
        </section>

        <aside className="lucky-backpack-panel">
          <header className="lucky-panel-heading"><span>FORTUNE INVENTORY</span><h2>福运背包</h2><small>生肖彩蛋可开启，其余物品可单卖或全卖</small></header>
          <section className="lucky-ledger">
            <div><span>开包花费</span><b>¥{formatMoney(luckySpend)}</b><small>{luckyTotalOpens} 次</small></div>
            <div><span>出售收入</span><b>¥{formatMoney(luckySaleRevenue)}</b><small>{luckySoldCount} 件</small></div>
            <footer className={luckySaleRevenue > luckySpend ? 'profit' : ''}><span>{luckySaleRevenue > luckySpend ? '当前净赚' : '当前净花费'}</span><b>¥{formatMoney(Math.abs(luckySpend - luckySaleRevenue))}</b></footer>
          </section>
          <div className="lucky-backpack-heading"><span>持有物品</span><i>{luckyCollected} 种 · {luckyBackpackCount} 件</i></div>
          <div className="lucky-backpack-grid">
            {!luckyBackpackItems.length ? <div className="lucky-backpack-empty"><i>囊</i><b>福运背包空空如也</b><small>开启幸运包后，奖励会自动存放在这里</small></div> : luckyBackpackItems.map((entry) => {
              const meta = gachaRarityMeta[entry.rarity];
              const isEgg = entry.container === 'zodiac';
              return <article key={entry.id} className={`rarity-${entry.rarity} ${isEgg ? 'zodiac-container' : ''}`} style={{ '--lucky-color': meta.color } as CSSProperties}>
                <i>{entry.icon}</i><span><b>{entry.name}</b><small>售价 ¥{formatMoney(entry.sellPrice)}</small></span><em>×{luckyInventory[entry.id]}</em>
                <div>{isEgg && <button type="button" className="open-zodiac" onClick={openZodiacEgg} disabled={luckyRolling}>开启</button>}<button type="button" onClick={() => sellLuckyItem(entry.id, false)}>卖1</button><button type="button" onClick={() => sellLuckyItem(entry.id, true)}>全卖</button></div>
              </article>;
            })}
          </div>
          <footer className="zodiac-hint"><i>辰</i><span><b>生肖彩蛋藏有十四道命格</b><small>十二生肖 ¥40–100 · 金龙与凤凰各 ¥3,000</small></span></footer>
        </aside>
      </section>

      {rareAnnouncement && <div className={`rare-announcement tone-${rareAnnouncement.tone}`} role="alert" onClick={() => setRareAnnouncement(null)}>
        <div className="rare-sky" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div>
        <span className="rare-beam" aria-hidden="true" />
        <section>
          <small>{rareAnnouncement.eyebrow}</small>
          <i>{rareAnnouncement.icon}</i>
          <h2>{rareAnnouncement.name}</h2>
          <p>{rareAnnouncement.message}</p>
          <b>传说级收获</b>
          <button type="button" onClick={() => setRareAnnouncement(null)}>收下祥瑞</button>
        </section>
      </div>}

      {costDetailsOpen && (
        <div className="cost-detail-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setCostDetailsOpen(false);
        }}>
          <section className="cost-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="cost-detail-title">
            <header>
              <div><small>BUILD COST LEDGER</small><h2 id="cost-detail-title">强化花费明细</h2></div>
              <button type="button" onClick={() => setCostDetailsOpen(false)} aria-label="关闭花费明细">×</button>
            </header>
            <div className="cost-detail-summary"><span>全部累计花费</span><strong>¥{costLedger.knownSpend.toFixed(2)}</strong><small>{costDetailItems.length} 项培养 · 每项独立记录</small></div>
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
                <span><i />催化神石 +10</span>
                <span><i />其余项目全 10</span>
                <span><i />守护四席 Lv.5</span>
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
