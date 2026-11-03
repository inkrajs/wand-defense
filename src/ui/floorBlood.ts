import type { GameEvent, GameState, Grade } from "../contracts";
import { gradeOrder } from "../content/grades";
import { demoContent } from "../content/demo";

export const BLOOD_LIMIT = 96;
export const BLOOD_STORAGE_KEY = "wand-defense:blood:v1";
export interface BloodDecal {
  id: string; x: number; y: number; atMs: number; wave: number;
  maxHp: number; level: number; grade: Grade; effect: string; washed: number;
}
export interface BloodMemory { runId: string; cursor: number; marks: BloodDecal[] }
type Scene = Pick<GameState, "id" | "nextEventSeq" | "events" | "gameTimeMs" | "wave">;
const finite = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const pigments: Record<Grade, string> = {
  common: "#963e37", uncommon: "#8a302e", rare: "#762c3c",
  epic: "#64263c", legendary: "#542439", mythic: "#442039",
};

/** Presentation policy only. It never consumes combat RNG or changes a reward. */
export function bloodAppearance(mark: BloodDecal) {
  const rank = Math.max(0, gradeOrder.indexOf(mark.grade));
  const strength = Math.min(6, Math.log2(1 + mark.maxHp / 18) + Math.log2(1 + mark.level) * .35 + rank * .65);
  const element = demoContent.spells[mark.effect]?.element;
  const charred = element === "fire" || element === "lightning";
  const spread = mark.effect === "rock-shot" ? 1.55 : mark.effect === "wind-blade" ? 1.2 : 1;
  return {
    strength,
    color: charred ? (element === "lightning" ? "#41343e" : "#34302b") : element === "dark" ? "#54334e" : pigments[mark.grade],
    diameter: Math.min(116, (30 + strength * 9) * spread),
    opacity: Math.min(.78, .4 + strength * .045 + rank * .018),
    lifetimeMs: 70_000 + strength * 27_000,
    waveErosion: .24 / (1 + strength * .3),
    droplets: Math.min(22, 9 + Math.floor(strength * 1.5) + (mark.effect === "rock-shot" ? 4 : 0)),
    flatness: mark.effect === "wind-blade" ? .4 : mark.effect === "metal-needle" ? .58 : .72,
  };
}

export function bloodOpacity(mark: BloodDecal, gameTimeMs: number, wave: number): number {
  const appearance = bloodAppearance(mark);
  const erosion = Math.max(0, gameTimeMs - mark.atMs) / appearance.lifetimeMs
    + Math.max(0, wave - mark.wave) * appearance.waveErosion;
  return appearance.opacity * Math.pow(Math.max(0, 1 - erosion), .85) * Math.max(0, 1 - mark.washed);
}

/** Stable organic geometry, generated once per mark instead of randomizing each render. */
export function bloodSpots(mark: BloodDecal) {
  let seed = 2166136261;
  for (const character of mark.id) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 0x1_0000_0000; };
  const appearance = bloodAppearance(mark);
  return Array.from({ length: appearance.droplets }, (_, index) => {
    const angle = random() * Math.PI * 2;
    const distance = index < 4 ? random() * 10 : 12 + random() * 34;
    const radius = index < 4 ? 12 + random() * 9 : 1.5 + random() * 5;
    return { x: 60 + Math.cos(angle) * distance, y: 60 + Math.sin(angle) * distance,
      rx: radius, ry: radius * (.48 + random() * .5), angle: random() * 180, opacity: .5 + random() * .5 };
  });
}

/** Shape data only; the component library owns pigment, grain and rendering. */
export function bloodGeometry(mark: BloodDecal) {
  const point=(x:number,y:number)=>`${x.toFixed(3)} ${y.toFixed(3)}`;
  const d=bloodSpots(mark).map(spot=>{
    const rotation=spot.angle*Math.PI/180,cos=Math.cos(rotation),sin=Math.sin(rotation);
    const points=Array.from({length:10},(_,index)=>{
      const angle=index*Math.PI/5;
      const edge=.87+.13*Math.sin(index*2.7+spot.x*.31+spot.y*.17);
      const x=Math.cos(angle)*spot.rx*edge,y=Math.sin(angle)*spot.ry*edge;
      return {x:spot.x+x*cos-y*sin,y:spot.y+x*sin+y*cos};
    });
    const middle=(a:typeof points[number],b:typeof points[number])=>point((a.x+b.x)/2,(a.y+b.y)/2);
    return `M${middle(points.at(-1)!,points[0])}`+points.map((p,index)=>`Q${point(p.x,p.y)} ${middle(p,points[(index+1)%points.length])}`).join("")+"Z";
  }).join("");
  return {type:"path" as const,d,viewBox:{width:120,height:120},fillRule:"nonzero" as const};
}

function deathMark(event: GameEvent, scene: Scene): BloodDecal | undefined {
  const data = event.data;
  if (typeof data.x !== "number" || !Number.isFinite(data.x) || typeof data.y !== "number" || !Number.isFinite(data.y)) return;
  return {
    id: `${scene.id}:${event.seq}:${String(data.entityId ?? "enemy")}`,
    x: finite(data.x, 50, 0, 100), y: finite(data.y, 50, 0, 100),
    atMs: finite(event.gameTimeMs, scene.gameTimeMs, 0, scene.gameTimeMs),
    wave: finite(data.wave, Math.max(1, scene.wave), 1, Math.max(1, scene.wave)),
    maxHp: finite(data.maxHp, 18, 1, 1e9), level: finite(data.level, Math.max(1, scene.wave), 1, 1e6),
    grade: gradeOrder.includes(data.grade as Grade) ? data.grade as Grade : "common",
    effect: typeof data.effect === "string" ? data.effect.slice(0, 80) : "",
    washed: demoContent.spells[String(data.effect)]?.element === "water" ? .4 : 0,
  };
}

/** Real water hits wash nearby marks; stronger blood resists each local rinse. */
function washMarks(marks: BloodDecal[], event: GameEvent): BloodDecal[] {
  if (event.type !== "damage" || demoContent.spells[String(event.data.effect)]?.element !== "water" || typeof event.data.amount !== "number"
    || !Number.isFinite(event.data.amount) || event.data.amount <= 0) return marks;
  const { x, y } = event.data;
  if (typeof x !== "number" || !Number.isFinite(x) || typeof y !== "number" || !Number.isFinite(y)) return marks;
  let changed = false;
  const result = marks.map(mark => {
    const distance = Math.hypot(mark.x - x, mark.y - y);
    if (distance >= 9) return mark;
    changed = true;
    const rinse = .72 * (1 - distance / 9) / (1 + bloodAppearance(mark).strength * .25);
    return { ...mark, washed: Math.min(1, mark.washed + rinse) };
  });
  return changed ? result : marks;
}

export function advanceBloodMemory(previous: BloodMemory, scene: Scene): BloodMemory {
  const current = previous.runId === scene.id && previous.cursor <= scene.nextEventSeq
    ? previous : { runId: scene.id, cursor: 0, marks: [] };
  let marks = current.marks;
  for (const event of scene.events) {
    if (event.seq < current.cursor) continue;
    marks = washMarks(marks, event);
    if (event.type === "enemyKilled") {
      const mark = deathMark(event, scene);
      if (mark && !marks.some(existing => existing.id === mark.id)) marks = [...marks, mark];
    }
  }
  const retained = marks.filter(mark => bloodOpacity(mark, scene.gameTimeMs, scene.wave) > .015);
  if (retained.length !== marks.length) marks = retained;
  // At the decoration budget, faint weak traces give way before thick boss blood.
  if (marks.length > BLOOD_LIMIT) marks = marks.map((mark, index) => ({ mark, index,
    priority: bloodOpacity(mark, scene.gameTimeMs, scene.wave) * (1 + bloodAppearance(mark).strength * .25),
  })).sort((a, b) => b.priority - a.priority || b.index - a.index).slice(0, BLOOD_LIMIT)
    .sort((a, b) => a.index - b.index).map(entry => entry.mark);
  if (current === previous && current.cursor === scene.nextEventSeq && marks === current.marks) return previous;
  return { runId: scene.id, cursor: scene.nextEventSeq, marks };
}

/** This optional session cache preserves floor art across the game's ordinary reloads. */
export function restoreBloodMemory(raw: string | null, scene: Scene): BloodMemory {
  const empty = { runId: scene.id, cursor: 0, marks: [] };
  try {
    const saved = JSON.parse(raw ?? "null");
    if (!saved || saved.version !== 1 || saved.runId !== scene.id || !Array.isArray(saved.marks)) return empty;
    const marks = saved.marks.slice(-BLOOD_LIMIT).flatMap((value: unknown): BloodDecal[] => {
      if (!value || typeof value !== "object") return [];
      const entry = value as Record<string, unknown>;
      if (typeof entry.id !== "string" || entry.id.length > 200 || typeof entry.x !== "number" || !Number.isFinite(entry.x)
        || typeof entry.y !== "number" || !Number.isFinite(entry.y) || typeof entry.atMs !== "number" || entry.atMs > scene.gameTimeMs) return [];
      const parsed = deathMark({ seq: 0, type: "enemyKilled", gameTimeMs: entry.atMs, data: entry }, scene);
      return parsed ? [{ ...parsed, id: entry.id, washed: finite(entry.washed, 0, 0, 1) }] : [];
    });
    const cursor = finite(saved.cursor, 0, 0, scene.nextEventSeq);
    return { runId: scene.id, cursor, marks };
  } catch { return empty; }
}
