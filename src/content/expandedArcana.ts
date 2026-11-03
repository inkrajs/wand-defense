import type { ArcanaDefinition } from "../contracts";

const cell = (x: number, y: number) => ({ x, y });

/** Additional configurable modifiers; effects are interpreted by loadout compilation. */
export const expandedArcana: Record<string, ArcanaDefinition> = {
  haste: {
    id: "haste",
    name: "迅捷",
    shape: [cell(0, 0)],
    asset: { key: "arcana.haste", label: "迅捷", color: "#58a6ff" },
    modifier: "haste",
    value: 0.85,
    level: 1,
    grade: "common",
  },
  efficiency: {
    id: "efficiency",
    name: "节能",
    shape: [cell(0, 0)],
    asset: { key: "arcana.efficiency", label: "节能", color: "#39b8a5" },
    modifier: "efficiency",
    value: 0.8,
    level: 1,
    grade: "common",
  },
  reach: {
    id: "reach",
    name: "延展",
    shape: [cell(0, 0), cell(1, 0)],
    asset: { key: "arcana.reach", label: "延展", color: "#9270db" },
    modifier: "reach",
    value: 1.25,
    level: 1,
    grade: "common",
  },
  velocity: {
    id: "velocity",
    name: "疾行",
    shape: [cell(0, 0), cell(0, 1)],
    asset: { key: "arcana.velocity", label: "疾行", color: "#42c2d3" },
    modifier: "velocity",
    value: 1.3,
    level: 1,
    grade: "common",
  },
  area: {
    id: "area",
    name: "广域",
    shape: [cell(0, 0), cell(1, 0), cell(0, 1)],
    asset: { key: "arcana.area", label: "广域", color: "#f2845c" },
    modifier: "area",
    value: 1.3,
    level: 1,
    grade: "common",
  },
  quadruple: {
    id: "quadruple",
    name: "四发",
    shape: [cell(0, 0), cell(1, 0), cell(0, 1), cell(1, 1)],
    asset: { key: "arcana.quadruple", label: "四发", color: "#e6a23c" },
    modifier: "double",
    value: 4,
    level: 1,
    grade: "common",
  },
  sextuple: {
    id: "sextuple",
    name: "六发",
    shape: [cell(0, 0), cell(1, 0), cell(2, 0), cell(0, 1), cell(1, 1), cell(2, 1)],
    asset: { key: "arcana.sextuple", label: "六发", color: "#dc765b" },
    modifier: "double",
    value: 6,
    level: 1,
    grade: "common",
  },
};

export const expandedArcanaDescriptions: Record<string, string> = {
  haste: "与法术四边相邻时，冷却时间减少15%。",
  efficiency: "与法术四边相邻时，法力消耗减少20%。",
  reach: "与法术四边相邻时，射程增加25%。",
  velocity: "与飞弹法术四边相邻时，飞弹速度增加30%（仅飞弹生效）。",
  area: "与法术四边相邻时，光束宽度、溅射/连锁半径及区域半径增加30%；环形攻击的实际射程也增加30%。",
  quadruple: `与法术四边相邻时，以基础连发次数${expandedArcana.quadruple.value}次分次施放，发射间隔120ms；高品级可提升次数。`,
  sextuple: `与法术四边相邻时，以基础连发次数${expandedArcana.sextuple.value}次分次施放，发射间隔120ms；高品级可提升次数。`,
};
