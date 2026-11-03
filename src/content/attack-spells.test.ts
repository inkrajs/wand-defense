import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity } from "../contracts";
import { createInitialState } from "../runtime/initial";
import { applyLoadoutCommand, compileWand } from "../loadout";
import { startBattle, stepBattle } from "../engine";
import { demoContent } from "./demo";

const attackIds = ["water-bolt", "lightning-bolt", "wind-blade", "rock-shot"] as const;
for (const definitionId of attackIds) {
  test(`${definitionId} equips on a real 3x3 wand and deals configured damage only on contact`, () => {
    const definition = demoContent.spells[definitionId];
    assert.ok(definition);
    let state = createInitialState();
    state.backpackOpen = true; state.paused = true;
    state.items["new-spell"] = { id: "new-spell", definitionId, kind: "spell", level: 1, grade: "common" };
    state.backpack.push("new-spell"); state.knowledge.spellIds.push(definitionId);
    const removed = applyLoadoutCommand(state, {id:"remove",type:"removeItem",wandId:"wand-1",itemId:"spark-1"}, demoContent);
    assert.equal(removed.result.status, "executed");
    const placed = applyLoadoutCommand(removed.state, {id:"equip",type:"placeItem",wandId:"wand-1",itemId:"new-spell",x:0,y:0,rotation:0}, demoContent);
    assert.equal(placed.result.status, "executed");
    state = placed.state;
    assert.equal(compileWand(state, "wand-1", demoContent)?.spells[0].id, definitionId);
    state.backpackOpen = false; state.paused = false; state.characters[0].manaRegen = 0;
    state = startBattle(state, demoContent).state;
    state.waveSpawnRemaining = 0;
    const enemy: CombatEntity = { id:"target",definitionId:"enemy-basic",kind:"enemy",faction:"enemy",x:50,y:64,
      hp:500,maxHp:500,damage:0,speed:0,range:1,cooldownMs:1000,attackRemainingMs:0 };
    state.entities = [enemy];
    const launch = stepBattle(state, 50, demoContent);
    const bullet = launch.state.entities.find(entity => entity.kind === "projectile")!;
    assert.ok(bullet); assert.equal(bullet.speed, definition.speed);
    assert.equal(launch.state.characters[0].mana, 100 - definition.manaCost);
    assert.equal(launch.state.wands[0].cooldowns["new-spell"], definition.cooldownMs);
    assert.equal(launch.state.entities.find(entity => entity.id === "target")!.hp, 500);
    assert.equal(launch.events.some(event => event.type === "damage"), false);
    state = stepBattle(launch.state, 50, demoContent).state;
    assert.ok(Math.abs(state.entities.find(entity => entity.id === bullet.id)!.y - (84 - definition.speed! * .05)) < 1e-8);
    for (let i = 0; i < 80 && !state.events.some(event => event.type === "damage" && event.data.projectileId === bullet.id); i++) {
      state = stepBattle(state, 50, demoContent).state;
    }
    const hits = state.events.filter(event => event.type === "damage" && event.data.projectileId === bullet.id);
    assert.equal(hits.length, 1); assert.equal(hits[0].data.amount, definition.power);
    assert.equal(state.entities.find(entity => entity.id === "target")!.hp, 500 - definition.power);
    assert.equal(state.entities.some(entity => entity.id === bullet.id), false);
  });
}
