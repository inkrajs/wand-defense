import assert from "node:assert/strict";
import test from "node:test";
import type { Command, ContentCatalog, GameState, RuntimePort } from "../contracts";
import { createFixtureState } from "../runtime/mock";
import { dispatchRemote, parseRemoteCommand, remoteCommandTypes } from "./protocol";
import { projectFrame } from "./projection";

const bulkActions = [
  "grantAllMagic", "maxMagic", "grantAllWands", "maxWands",
  "grantAllGear", "maxGear", "grantAllSupplies", "maxSupplies",
] as const;

function mockRuntime(state: GameState): RuntimePort & { calls: Command[] } {
  const calls: Command[] = [];
  return {
    calls,
    getState: () => state,
    dispatch(command) {
      calls.push(structuredClone(command));
      return { commandId: command.id, status: "executed", revision: state.revision + 1 };
    },
    subscribe: () => () => undefined,
  };
}

test("remote batch cheat actions construct exact no-payload commands and strip extra fields", () => {
  assert.ok(remoteCommandTypes.includes("cheat"));
  assert.equal((remoteCommandTypes as readonly string[]).includes("unlockCheats"), false);

  for (const action of bulkActions) {
    const state = createFixtureState();
    state.cheats = { unlocked: true, enabled: true };
    const runtime = mockRuntime(state);
    const result = dispatchRemote(runtime, {
      id: `command-${action}`, type: "cheat", action,
      characterId: "ignored-character", definitionId: "ignored-definition",
      grade: "legendary", level: 50, levels: 100, payload: { secret: true },
    });
    assert.equal(result.status, "executed", action);
    assert.deepEqual(runtime.calls, [{ id: `command-${action}`, type: "cheat", action }], action);
  }
});

test("levelCharacter accepts bounded ids and optional 1..100 safe levels, while forwarding only whitelisted fields", () => {
  assert.deepEqual(parseRemoteCommand({ id: "level-default", type: "cheat", action: "levelCharacter", characterId: "hero-1", extra: true }), {
    id: "level-default", type: "cheat", action: "levelCharacter", characterId: "hero-1",
  });
  assert.deepEqual(parseRemoteCommand({ id: "level-50", type: "cheat", action: "levelCharacter", characterId: "hero-1", levels: 50, level: 999 }), {
    id: "level-50", type: "cheat", action: "levelCharacter", characterId: "hero-1", levels: 50,
  });
  assert.deepEqual(parseRemoteCommand({ id: "level-100", type: "cheat", action: "levelCharacter", characterId: "h".repeat(160), levels: 100 }), {
    id: "level-100", type: "cheat", action: "levelCharacter", characterId: "h".repeat(160), levels: 100,
  });

  for (const levels of [0, -1, 1.5, 101, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, "2"]) {
    assert.equal(parseRemoteCommand({ id: "invalid-level", type: "cheat", action: "levelCharacter", characterId: "hero-1", levels }), undefined, String(levels));
  }
  for (const characterId of ["", "c".repeat(161), 17, null]) {
    assert.equal(parseRemoteCommand({ id: "invalid-character", type: "cheat", action: "levelCharacter", characterId }), undefined);
  }

  const state = createFixtureState();
  state.cheats = { unlocked: true, enabled: true };
  const runtime = mockRuntime(state);
  assert.equal(dispatchRemote(runtime, { id: "level-call", type: "cheat", action: "levelCharacter", characterId: "hero-1", levels: 50, ignored: "x" }).status, "executed");
  assert.deepEqual(runtime.calls, [{ id: "level-call", type: "cheat", action: "levelCharacter", characterId: "hero-1", levels: 50 }]);
});

test("cheats and local unlocking remain gated; unlockCheats is never remotely parseable or dispatched", () => {
  const lockedState = createFixtureState();
  lockedState.cheats = { unlocked: false, enabled: false };
  const locked = mockRuntime(lockedState);
  assert.equal(dispatchRemote(locked, { id: "locked", type: "cheat", action: "grantAllMagic" }).status, "rejected");
  assert.equal(dispatchRemote(locked, { id: "locked-toggle", type: "setCheats", enabled: true }).status, "rejected");
  assert.equal(parseRemoteCommand({ id: "unlock", type: "unlockCheats" }), undefined);
  assert.equal(dispatchRemote(locked, { id: "unlock", type: "unlockCheats" }).status, "rejected");
  assert.deepEqual(locked.calls, []);

  const disabledState = createFixtureState();
  disabledState.cheats = { unlocked: true, enabled: false };
  const disabled = mockRuntime(disabledState);
  assert.equal(dispatchRemote(disabled, { id: "disabled", type: "cheat", action: "maxWands" }).status, "rejected");
  assert.deepEqual(disabled.calls, []);

  disabledState.cheats.enabled = true;
  assert.equal(dispatchRemote(disabled, { id: "enabled", type: "cheat", action: "maxWands" }).status, "executed");
  assert.deepEqual(disabled.calls, [{ id: "enabled", type: "cheat", action: "maxWands" }]);
});

test("projected cheat capability is local-unlock gated and documents the safe schema without exposing hidden content", () => {
  const state = createFixtureState();
  const catalog: ContentCatalog = {
    spells: {
      "very-secret-catalog-entry": {
        id: "very-secret-catalog-entry", name: "隐藏魔法", element: "dark", shape: [{ x: 0, y: 0 }],
        asset: { key: "hidden", label: "隐藏" }, effect: "projectile", power: 1, manaCost: 1,
        cooldownMs: 1, range: 1, level: 1, grade: "common",
      },
    },
    arcana: {}, recipes: [], sequences: {},
  };

  const lockedFrame = projectFrame(state, [], [], catalog);
  assert.equal(lockedFrame.capabilities.commands.includes("cheat"), false);
  assert.equal(Object.hasOwn(lockedFrame.capabilities.commandSchemas, "cheat"), false);

  state.cheats = { unlocked: true, enabled: false };
  const unlockedFrame = projectFrame(state, [], [], catalog);
  assert.equal(unlockedFrame.capabilities.commands.includes("cheat"), true);
  assert.equal(Object.hasOwn(unlockedFrame.capabilities.commandSchemas, "cheat"), true);
  const cheatSchema = unlockedFrame.capabilities.commandSchemas.cheat as Record<string, string>;
  for (const action of bulkActions) assert.ok(cheatSchema.action.includes(action), action);
  assert.ok(cheatSchema.action.includes("levelCharacter"));
  assert.match(cheatSchema.description, /Lv\.50.*不是硬上限/);
  assert.match(cheatSchema.description, /保留.*品级/);
  assert.match(cheatSchema.levels, /1至100/);
  assert.equal(JSON.stringify(unlockedFrame).includes("very-secret-catalog-entry"), false);
});
