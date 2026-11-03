import assert from "node:assert/strict";
import test from "node:test";
import type { MonsterBodySize } from "../contracts";
import { getMonsterSize, getUnlockedMinionDefinitions, MONSTER_SIZE_PRESETS, monsterDefinitions } from "./monsters";

test("monster size presets map each body size to the agreed pixels and hit radius", () => {
  assert.deepEqual(Object.values(MONSTER_SIZE_PRESETS), [
    { id: "small", pixels: 24, hitRadius: 1.35 },
    { id: "normal", pixels: 32, hitRadius: 1.8 },
    { id: "large", pixels: 48, hitRadius: 2.7 },
    { id: "huge", pixels: 64, hitRadius: 3.6 },
    { id: "colossal", pixels: 80, hitRadius: 4.5 },
  ]);
});

test("seven minions and three bosses keep stable names, asset keys, colors and sizes", () => {
  assert.deepEqual(Object.values(monsterDefinitions).map(({ id, name, bodySize, asset }) => [id, name, bodySize, asset.key, asset.color]), [
    ["enemy-basic", "灰泥怪", "normal", "monster.basic", "#8b8178"],
    ["enemy-moss", "苔团", "small", "monster.moss", "#65a85b"],
    ["enemy-ember", "焰灵", "small", "monster.ember", "#ef6b45"],
    ["enemy-frost-moth", "霜蛾", "small", "monster.frost-moth", "#79cde8"],
    ["enemy-shadow-bat", "影蝠", "small", "monster.shadow-bat", "#a784d9"],
    ["enemy-sand-beetle", "砂甲虫", "large", "monster.sand-beetle", "#c5a05d"],
    ["enemy-crystal-crab", "晶蟹", "normal", "monster.crystal-crab", "#8e9fe8"],
    ["boss-minor", "小型首领", "large", "monster.boss.minor", "#c77d53"],
    ["boss-major", "大型首领", "huge", "monster.boss.major", "#a57ad2"],
    ["boss-apex", "顶级首领", "colossal", "monster.boss.apex", "#e3a743"],
  ]);
  for (const definition of Object.values(monsterDefinitions)) {
    assert.ok(definition.name.length > 0);
    assert.ok(definition.asset.icon);
    assert.ok(definition.asset.color);
  }
});

test("minion spawn tuning preserves basic parity and the unlock-wave progression", () => {
  assert.deepEqual(monsterDefinitions["enemy-basic"].spawn, {
    unlockWave: 1, hpMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1, cooldownMultiplier: 1,
    movementMode: undefined,
  });
  const tuning = [
    ["enemy-moss", 2, 0.8, 0.8, 0.9, 1.1, "straight"],
    ["enemy-ember", 3, 0.75, 1.2, 1.2, 0.9, "huntCharacter"],
    ["enemy-frost-moth", 4, 0.65, 0.8, 1.35, 1.1, "huntCharacter"],
    ["enemy-shadow-bat", 6, 0.7, 1, 1.4, 0.9, "huntCharacter"],
    ["enemy-sand-beetle", 8, 1.8, 1.3, 0.7, 1.2, "straight"],
    ["enemy-crystal-crab", 10, 1.4, 1.15, 0.85, 1, undefined],
  ] as const;
  for (const [id, unlockWave, hpMultiplier, damageMultiplier, speedMultiplier, cooldownMultiplier, movementMode] of tuning) {
    assert.deepEqual(monsterDefinitions[id].spawn, {
      unlockWave, hpMultiplier, damageMultiplier, speedMultiplier, cooldownMultiplier, movementMode,
    });
  }
  const expected: Record<string, readonly string[]> = {
    "0": [],
    "1": ["enemy-basic"],
    "2": ["enemy-basic", "enemy-moss"],
    "3": ["enemy-basic", "enemy-moss", "enemy-ember"],
    "4": ["enemy-basic", "enemy-moss", "enemy-ember", "enemy-frost-moth"],
    "6": ["enemy-basic", "enemy-moss", "enemy-ember", "enemy-frost-moth", "enemy-shadow-bat"],
    "8": ["enemy-basic", "enemy-moss", "enemy-ember", "enemy-frost-moth", "enemy-shadow-bat", "enemy-sand-beetle"],
    "10": ["enemy-basic", "enemy-moss", "enemy-ember", "enemy-frost-moth", "enemy-shadow-bat", "enemy-sand-beetle", "enemy-crystal-crab"],
  };
  for (const [wave, ids] of Object.entries(expected)) {
    const definitions = getUnlockedMinionDefinitions(Number(wave));
    assert.deepEqual(definitions.map(definition => definition.id), ids);
    assert.equal(Object.isFrozen(definitions), true);
  }
  assert.deepEqual(getUnlockedMinionDefinitions(Number.NaN), []);
  assert.deepEqual(getUnlockedMinionDefinitions(Number.POSITIVE_INFINITY), []);

  for (const [id, unlockWave] of [
    ["enemy-basic", 1], ["enemy-moss", 2], ["enemy-ember", 3], ["enemy-frost-moth", 4],
    ["enemy-shadow-bat", 6], ["enemy-sand-beetle", 8], ["enemy-crystal-crab", 10],
  ] as const) {
    assert.equal(monsterDefinitions[id].spawn?.unlockWave, unlockWave);
  }
  for (const id of ["boss-minor", "boss-major", "boss-apex"]) {
    assert.equal(monsterDefinitions[id].spawn, undefined, `${id} stays out of the minion list`);
  }
});

test("an explicit legal runtime body size overrides the definition and missing size uses the definition", () => {
  assert.deepEqual(getMonsterSize({ definitionId: "boss-minor", bodySize: "small" }),
    { id: "small", pixels: 24, hitRadius: 1.35 });
  assert.deepEqual(getMonsterSize({ definitionId: "boss-major", bodySize: undefined }),
    { id: "huge", pixels: 64, hitRadius: 3.6 });
  assert.deepEqual(getMonsterSize({ definitionId: "enemy-moss", bodySize: undefined }),
    { id: "small", pixels: 24, hitRadius: 1.35 });
  assert.deepEqual(getMonsterSize({ definitionId: "enemy-sand-beetle", bodySize: undefined }),
    { id: "large", pixels: 48, hitRadius: 2.7 });
});

test("invalid sizes and unknown or prototype-like definition IDs safely fall back", () => {
  for (const bodySize of ["invalid", "__proto__", "constructor", "toString"] as unknown as MonsterBodySize[]) {
    assert.deepEqual(getMonsterSize({ definitionId: "boss-major", bodySize }),
      { id: "huge", pixels: 64, hitRadius: 3.6 });
  }
  for (const definitionId of ["missing-monster", "__proto__", "constructor", "toString"]) {
    assert.deepEqual(getMonsterSize({ definitionId, bodySize: undefined }),
      { id: "normal", pixels: 32, hitRadius: 1.8 });
  }
});

test("returned presets are detached and shared definitions cannot be mutated", () => {
  const first = getMonsterSize({ definitionId: "enemy-basic", bodySize: undefined });
  const mutableCopy = first as unknown as { pixels: number; hitRadius: number };
  mutableCopy.pixels = 999;
  mutableCopy.hitRadius = 999;
  assert.deepEqual(getMonsterSize({ definitionId: "enemy-basic", bodySize: undefined }),
    { id: "normal", pixels: 32, hitRadius: 1.8 });

  assert.equal(Object.isFrozen(MONSTER_SIZE_PRESETS), true);
  assert.equal(Object.isFrozen(MONSTER_SIZE_PRESETS.normal), true);
  assert.equal(Object.isFrozen(monsterDefinitions), true);
  for (const definition of Object.values(monsterDefinitions)) {
    assert.equal(Object.isFrozen(definition), true);
    assert.equal(Object.isFrozen(definition.asset), true);
    if (definition.spawn) assert.equal(Object.isFrozen(definition.spawn), true);
  }
  assert.equal(Reflect.set(MONSTER_SIZE_PRESETS.normal, "pixels", 999), false);
  assert.equal(Reflect.set(monsterDefinitions["enemy-basic"].asset, "key", "polluted"), false);
  assert.equal(Reflect.set(monsterDefinitions["enemy-ember"].spawn!, "unlockWave", 1), false);
});
