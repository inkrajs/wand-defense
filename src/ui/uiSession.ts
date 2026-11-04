export type InventoryCategory = "items" | "spells" | "equipment" | "supplies";
export type CharacterTab = "equipment" | "overview" | "radar" | "attributes" | "elements" | "pathways" | "growth";

export type UiSession = {
  activeCharacterId: string;
  characterOpen: boolean;
  territoryOpen: boolean;
  talentOpen: boolean;
  skillTreeOpen: boolean;
  inventoryCategory: InventoryCategory;
  characterTab: CharacterTab;
};

export type UiSessionStorage = Pick<Storage, "getItem" | "setItem">;
export type CharacterRef = { id: string };

const INVENTORY_CATEGORIES = new Set<InventoryCategory>(["items", "spells", "equipment", "supplies"]);
const CHARACTER_TABS = new Set<CharacterTab>(["equipment", "overview", "radar", "attributes", "elements", "pathways", "growth"]);
const KEY_PREFIX = "wand-defense:ui-session:";

function sessionKey(runId: string): string {
  return `${KEY_PREFIX}${encodeURIComponent(runId)}`;
}

function browserStorage(): UiSessionStorage | null {
  try {
    return typeof globalThis.sessionStorage === "undefined" ? null : globalThis.sessionStorage;
  } catch {
    return null;
  }
}

function resolveStorage(storage: UiSessionStorage | null | undefined): UiSessionStorage | null {
  return storage === undefined ? browserStorage() : storage;
}

export function isValidUiSession(value: unknown, characters: readonly CharacterRef[]): value is UiSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Record<string, unknown>;
  if (typeof session.activeCharacterId !== "string" || !characters.some(character => character.id === session.activeCharacterId)) return false;
  if (typeof session.characterOpen !== "boolean" || typeof session.territoryOpen !== "boolean") return false;
  if (session.talentOpen !== undefined && typeof session.talentOpen !== "boolean") return false;
  if (session.skillTreeOpen !== undefined && typeof session.skillTreeOpen !== "boolean") return false;
  if ([session.characterOpen, session.territoryOpen, session.talentOpen === true, session.skillTreeOpen === true].filter(Boolean).length > 1) return false;
  if (typeof session.inventoryCategory !== "string" || !INVENTORY_CATEGORIES.has(session.inventoryCategory as InventoryCategory)) return false;
  if (typeof session.characterTab !== "string" || !CHARACTER_TABS.has(session.characterTab as CharacterTab)) return false;
  return true;
}

/** Reads a validated UI snapshot for this run; inaccessible storage and invalid blobs return null. */
export function readUiSession(
  runId: string,
  characters: readonly CharacterRef[],
  storage?: UiSessionStorage | null,
): UiSession | null {
  if (!runId) return null;
  const target = resolveStorage(storage);
  if (!target) return null;
  try {
    const raw = target.getItem(sessionKey(runId));
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (!isValidUiSession(value, characters)) return null;
    return {
      activeCharacterId: value.activeCharacterId,
      characterOpen: value.characterOpen,
      territoryOpen: value.territoryOpen,
      talentOpen: value.talentOpen === true,
      skillTreeOpen: value.skillTreeOpen === true,
      inventoryCategory: value.inventoryCategory,
      characterTab: value.characterTab,
    };
  } catch {
    return null;
  }
}

/** Writes only UI preferences; menu and backpack state are intentionally excluded. */
export function writeUiSession(
  runId: string,
  value: unknown,
  characters: readonly CharacterRef[],
  storage?: UiSessionStorage | null,
): boolean {
  if (!runId || !isValidUiSession(value, characters)) return false;
  const target = resolveStorage(storage);
  if (!target) return false;
  const snapshot: UiSession = {
    activeCharacterId: value.activeCharacterId,
    characterOpen: value.characterOpen,
    territoryOpen: value.territoryOpen,
    talentOpen: value.talentOpen === true,
    skillTreeOpen: value.skillTreeOpen === true,
    inventoryCategory: value.inventoryCategory,
    characterTab: value.characterTab,
  };
  try {
    target.setItem(sessionKey(runId), JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}
