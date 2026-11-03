import assert from "node:assert/strict";
import test from "node:test";
import { getMonsterPresentationIcon } from "./monsterPresentationIcons";

test("monster icon lookup rejects inherited object prototype keys", () => {
  for (const definitionId of ["constructor", "toString", "__proto__"]) {
    assert.equal(getMonsterPresentationIcon(definitionId, "prototype-key"), undefined);
  }
});

test("monster icon lookup resolves the registered creature and boss IDs", () => {
  for (const definitionId of [
    "enemy-moss", "enemy-ember", "enemy-frost-moth", "enemy-shadow-bat",
    "enemy-sand-beetle", "enemy-crystal-crab", "enemy-basic",
    "boss-minor", "boss-major", "boss-apex",
  ]) {
    assert.ok(getMonsterPresentationIcon(definitionId, "known-id"), definitionId);
  }
});
