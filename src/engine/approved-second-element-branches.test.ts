import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity } from "../contracts";
import { approvedRecipes, approvedSpells } from "../content/approved-5";
import { demoContent } from "../content/demo";
import { createInitialState } from "../runtime/initial";
import { createGameRuntime } from "../runtime";
import { stepBattle } from "./index";

const content = { ...demoContent, spells: { ...demoContent.spells, ...approvedSpells } };
const target: CombatEntity = {
  id: "target", definitionId: "enemy-basic", kind: "enemy", faction: "enemy", x: 50, y: 75,
  hp: 10000, maxHp: 10000, speed: 0, damage: 0, range: 0, cooldownMs: 1000, attackRemainingMs: 1000,
};

test("second-wave elemental recipes keep distinct advanced branches", () => {
  const recipesByOutput = new Map(approvedRecipes.map(recipe => [recipe.output, recipe]));
  for (const line of [
    ["gear-disc", "blade-wheel", "cutting-storm"],
    ["sand-dust", "quicksand", "sandstorm"],
    ["electric-charge", "electrostatic-shield", "ion-shield"],
    ["bone-armor", "bone-wall", "bone-prison"],
    ["ghost", "revenant", "ghost-legion"],
  ]) {
    for (let i = 1; i < line.length; i++) {
      assert.ok(recipesByOutput.get(line[i])?.inputs.includes(line[i - 1]), line.join(" → "));
      assert.ok(approvedSpells[line[i]].rewardMinWave! > approvedSpells[line[i - 1]].rewardMinWave!, line[i]);
    }
  }
});

test("second-wave spells execute real damage, defense and follow-ups", () => {
  for (const spell of Object.values(approvedSpells)) {
    let state = createInitialState();
    state.items["spark-1"].definitionId = spell.id;
    state.wands[0].placements = [{ itemId: "spark-1", x: 0, y: 0, rotation: 0 }];
    state.knowledge.spellIds.push(spell.id);
    state.territory.shield = 0;
    state.entities = [structuredClone(target)];

    if (spell.effect === "building") {
      const runtime = createGameRuntime(content, { checkpointVersion: 1, state, pausedBeforeBackpack: false, results: [] });
      try {
        const deployed = runtime.dispatch({ type: "deployConstruct", id: "build",
          characterId: "character-1", itemId: "spark-1", x: 50, y: spell.id === "ion-shield" ? 87 : 76 });
        assert.equal(deployed.status, "executed", spell.id);
        state = runtime.getState();
      } finally {
        runtime.dispose();
      }
    }
    state.phase = "battle";
    state.wave = 1;
    state = stepBattle(state, 50, content).state;
    state.wands[0].placements = [];
    for (let tick = 0; tick < 135; tick++) state = stepBattle(state, 50, content).state;

    if (spell.effect === "shield" || spell.id === "ion-shield") {
      assert.ok(state.events.some(event => event.type === "shieldRestored"), spell.id);
    } else {
      assert.ok(state.events.some(event => event.type === "damage" && event.data.effect === spell.id), spell.id);
    }
    if (spell.area?.finish) assert.ok(state.events.some(event => event.type === "areaFinalStage" && event.data.spawned), spell.id);
    if (spell.construct?.baseCount) {
      assert.equal(state.entities.filter(entity => entity.definitionId === spell.id &&
        (entity.kind === "summon" || entity.kind === "building")).length, spell.construct.baseCount, spell.id);
    }
  }
});
