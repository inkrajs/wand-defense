import { useSyncExternalStore } from "react";

export type GraphicsSettings = {
  preset: "low" | "medium" | "high" | "custom";
  blood: boolean;
  bloodBudget: number;
  deathEffects: boolean;
  projectileTrails: boolean;
  impactSparks: boolean;
  areaDetails: boolean;
  effectResolution: number;
};

type Preset = Exclude<GraphicsSettings["preset"], "custom">;
type GraphicsSettingsUpdate = Partial<Omit<GraphicsSettings, "preset">>;

const STORAGE_KEY = "wand-defense.graphics-settings.v1";
const DEFAULT_SETTINGS: GraphicsSettings = Object.freeze({
  preset: "medium",
  blood: true,
  bloodBudget: 48,
  deathEffects: true,
  projectileTrails: false,
  impactSparks: true,
  areaDetails: false,
  effectResolution: 0.75,
});

const PRESETS: Record<Preset, Omit<GraphicsSettings, "preset">> = {
  low: {
    blood: false,
    bloodBudget: 24,
    deathEffects: false,
    projectileTrails: false,
    impactSparks: false,
    areaDetails: false,
    effectResolution: 0.5,
  },
  medium: {
    blood: true,
    bloodBudget: 48,
    deathEffects: true,
    projectileTrails: false,
    impactSparks: true,
    areaDetails: false,
    effectResolution: 0.75,
  },
  high: {
    blood: true,
    bloodBudget: 96,
    deathEffects: true,
    projectileTrails: true,
    impactSparks: true,
    areaDetails: true,
    effectResolution: 1,
  },
};

const PRESET_NAMES = new Set<string>(["low", "medium", "high", "custom"]);
const listeners = new Set<() => void>();
let settings = readSettings();

function storage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number, integer = false): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const clamped = Math.min(max, Math.max(min, value));
  return integer ? Math.round(clamped) : clamped;
}

function normalize(value: unknown): GraphicsSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_SETTINGS };
  const source = value as Record<string, unknown>;
  const preset = typeof source.preset === "string" && PRESET_NAMES.has(source.preset)
    ? source.preset as GraphicsSettings["preset"]
    : "custom";
  const normalized: GraphicsSettings = {
    preset,
    blood: typeof source.blood === "boolean" ? source.blood : DEFAULT_SETTINGS.blood,
    bloodBudget: boundedNumber(source.bloodBudget, DEFAULT_SETTINGS.bloodBudget, 0, 96, true),
    deathEffects: typeof source.deathEffects === "boolean" ? source.deathEffects : DEFAULT_SETTINGS.deathEffects,
    projectileTrails: typeof source.projectileTrails === "boolean" ? source.projectileTrails : DEFAULT_SETTINGS.projectileTrails,
    impactSparks: typeof source.impactSparks === "boolean" ? source.impactSparks : DEFAULT_SETTINGS.impactSparks,
    areaDetails: typeof source.areaDetails === "boolean" ? source.areaDetails : DEFAULT_SETTINGS.areaDetails,
    effectResolution: resolutionTier(source.effectResolution),
  };
  if (preset !== "custom" && !matchesPreset(normalized, preset)) normalized.preset = "custom";
  return normalized;
}

function resolutionTier(value: unknown): number {
  const candidate = boundedNumber(value, DEFAULT_SETTINGS.effectResolution, 0.5, 1);
  return [0.5, 0.75, 1].reduce((nearest, tier) =>
    Math.abs(tier - candidate) < Math.abs(nearest - candidate) ? tier : nearest,
  0.5);
}

function matchesPreset(value: GraphicsSettings, preset: Preset): boolean {
  const expected = PRESETS[preset];
  return (Object.keys(expected) as Array<keyof typeof expected>).every(key => value[key] === expected[key]);
}

function readSettings(): GraphicsSettings {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function publish(next: GraphicsSettings): void {
  if (sameSettings(settings, next)) return;
  settings = Object.freeze(next);
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Keep the in-memory store usable when storage is unavailable or full.
  }
  listeners.forEach(listener => listener());
}

function sameSettings(a: GraphicsSettings, b: GraphicsSettings): boolean {
  return a.preset === b.preset && a.blood === b.blood && a.bloodBudget === b.bloodBudget &&
    a.deathEffects === b.deathEffects && a.projectileTrails === b.projectileTrails &&
    a.impactSparks === b.impactSparks && a.areaDetails === b.areaDetails &&
    a.effectResolution === b.effectResolution;
}

function onStorage(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  let next: GraphicsSettings;
  try {
    next = event.newValue ? normalize(JSON.parse(event.newValue)) : { ...DEFAULT_SETTINGS };
  } catch {
    next = { ...DEFAULT_SETTINGS };
  }
  if (!sameSettings(settings, next)) {
    settings = Object.freeze(next);
    listeners.forEach(listener => listener());
  }
}

if (typeof window !== "undefined") {
  try {
    window.addEventListener("storage", onStorage);
  } catch {
    // Storage events are an optional cross-tab enhancement.
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): GraphicsSettings {
  return settings;
}

function getServerSnapshot(): GraphicsSettings {
  return DEFAULT_SETTINGS;
}

function setPreset(preset: Preset): void {
  publish({ preset, ...PRESETS[preset] });
}

function update(patch: GraphicsSettingsUpdate): void {
  const next = normalize({ ...settings, ...patch, preset: "custom" });
  next.preset = "custom";
  publish(next);
}

export function useGraphicsSettings(): {
  settings: GraphicsSettings;
  setPreset: (preset: Preset) => void;
  update: (patch: GraphicsSettingsUpdate) => void;
} {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { settings: snapshot, setPreset, update };
}
