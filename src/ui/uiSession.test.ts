import assert from "node:assert/strict";
import test from "node:test";
import { readUiSession, writeUiSession, type UiSessionStorage } from "./uiSession";

class MemoryStorage implements UiSessionStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const characters = [{ id: "c1" }, { id: "c2" }];
const session = {
  activeCharacterId: "c2",
  characterOpen: true,
  territoryOpen: false,
  talentOpen: false,
  skillTreeOpen: false,
  inventoryCategory: "equipment" as const,
  characterTab: "pathways" as const,
};

test("UI session round-trips only the supported UI fields", () => {
  const storage = new MemoryStorage();
  assert.equal(writeUiSession("run-a", { ...session, menuPage: "menu", backpackOpen: true }, characters, storage), true);
  assert.deepEqual(readUiSession("run-a", characters, storage), session);
  assert.equal(storage.values.get("wand-defense:ui-session:run-a"), JSON.stringify(session));
  for (const characterTab of ["radar", "elements", "equipment"] as const) {
    assert.equal(writeUiSession("run-a", { ...session, characterTab }, characters, storage), true);
    assert.equal(readUiSession("run-a", characters, storage)?.characterTab, characterTab);
  }
});

test("invalid blobs and enum values are rejected", () => {
  const storage = new MemoryStorage();
  storage.values.set("wand-defense:ui-session:bad-json", "{");
  storage.values.set("wand-defense:ui-session:bad-enum", JSON.stringify({ ...session, inventoryCategory: "crafting" }));
  assert.equal(readUiSession("bad-json", characters, storage), null);
  assert.equal(readUiSession("bad-enum", characters, storage), null);
  assert.equal(writeUiSession("bad-enum", { ...session, characterTab: "unknown" }, characters, storage), false);
});

test("sessions are isolated by run id", () => {
  const storage = new MemoryStorage();
  assert.equal(writeUiSession("run-a", session, characters, storage), true);
  assert.equal(readUiSession("run-b", characters, storage), null);
  assert.deepEqual(readUiSession("run-a", characters, storage), session);
});

test("removed characters and mutually open panels are rejected", () => {
  const storage = new MemoryStorage();
  storage.values.set("wand-defense:ui-session:removed", JSON.stringify(session));
  storage.values.set("wand-defense:ui-session:conflict", JSON.stringify({ ...session, territoryOpen: true }));
  assert.equal(readUiSession("removed", [{ id: "c1" }], storage), null);
  assert.equal(readUiSession("conflict", characters, storage), null);
  assert.equal(writeUiSession("conflict", { ...session, territoryOpen: true }, characters, storage), false);
});

test("unavailable storage is safe", () => {
  assert.equal(readUiSession("run-a", characters, null), null);
  assert.equal(writeUiSession("run-a", session, characters, null), false);
});

test("legacy UI snapshot defaults talent closed", () => {
  const storage = new MemoryStorage();
  const { talentOpen: _talent, ...legacy } = session;
  storage.setItem("wand-defense:ui-session:legacy", JSON.stringify(legacy));
  assert.deepEqual(readUiSession("legacy", characters, storage), session);
  assert.equal(writeUiSession("conflict-talent", { ...session, talentOpen: true }, characters, storage), false);
});

test("skill tree session migrates old snapshots and stays exclusive with character workspaces", () => {
  const storage = new MemoryStorage();
  const {skillTreeOpen: _tree, ...legacy} = session;
  storage.setItem("wand-defense:ui-session:legacy-tree",JSON.stringify(legacy));
  assert.deepEqual(readUiSession("legacy-tree",characters,storage),session);
  const tree = {...session, characterOpen:false, skillTreeOpen:true};
  assert.equal(writeUiSession("tree",tree,characters,storage),true);
  assert.deepEqual(readUiSession("tree",characters,storage),tree);
  assert.equal(writeUiSession("conflict-tree",{...session,skillTreeOpen:true},characters,storage),false);
});
