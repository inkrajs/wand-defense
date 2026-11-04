import assert from "node:assert/strict";
import test from "node:test";
import { chainHudSource } from "./chainVisuals";
const anchors = [{ characterId: "hero", x: 50, y: 84 }];
test("only the first caster-origin arc follows the HUD; later hops retain world coordinates", () => {
  const seen = new Set<string>();
  assert.equal(chainHudSource({ chainId: "one", sourceCharacterId: "hero", x: 50, y: 84 }, anchors, seen), "hero");
  assert.equal(chainHudSource({ chainId: "one", sourceCharacterId: "hero", x: 50, y: 84 }, anchors, seen), undefined);
  assert.equal(chainHudSource({ chainId: "two", sourceCharacterId: "hero", x: 30, y: 50 }, anchors, seen), undefined);
  assert.equal(chainHudSource({ chainId: "missing", x: 50, y: 84 }, anchors, seen), undefined);
});
test("seen chain IDs remain bounded", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 300; i++) chainHudSource({ chainId: String(i), sourceCharacterId: "hero", x: 0, y: 0 }, anchors, seen);
  assert.equal(seen.size, 256);
});
