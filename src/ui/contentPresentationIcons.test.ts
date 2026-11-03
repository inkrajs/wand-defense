import assert from "node:assert/strict";
import test from "node:test";
import { demoContent } from "../content/demo";
import { gearDefinitions } from "../content/gear";
import { gradeDefinitions } from "../content/grades";
import { supplyDefinitions } from "../content/supplies";
import { getGearPresentationIcon } from "./gearPresentationIcons";
import { getMagicPresentationDefinition } from "./magicPresentationIcons";
import { getGameItemAppearance } from "./itemAppearance";
import { getSupplyPresentationDefinition } from "./supplyPresentationIcons";

const arcanaIds = ["pierce", "slow", "burn", "knockback", "duration", "capacity", "precision"];
const attackSpellIds = ["piercing-gale", "glacial-lance", "ember-comet", "solar-storm", "tidal-prison", "cinder-ring", "repulse-wave", "prism-ray", "storm-spear"];
const constructSpellIds = ["ember-familiar", "frost-wisp", "thorn-guardian", "ember-turret", "frost-pylon", "restorative-totem"];
const gearIds = ["ember-circlet", "frost-lens", "sage-crown", "windweave-mantle", "heartwood-vest", "gale-greaves", "tracker-boots", "fortune-knot", "starfall-signet"];
const supplyIds = ["restoration-elixir", "mana-surge", "hourglass-dust", "vitality-essence", "aegis-essence"];

test("new arcana and spell art follows the authoritative content shape and asset color", () => {
  for (const id of [...arcanaIds, ...attackSpellIds, ...constructSpellIds]) {
    const definition = getMagicPresentationDefinition(id);
    const content = demoContent.arcana[id] ?? demoContent.spells[id];
    assert.ok(definition, `${id} has a registered presentation`);
    assert.ok(content, `${id} exists in content`);
    assert.equal(definition.id, id);
    assert.equal(definition.label, content.name);
    assert.equal(definition.color, content.asset.color);
    assert.deepEqual(definition.shape, content.shape);
    assert.deepEqual(definition.clipGeometry.cells, content.shape);
    assert.ok(definition.paths.length > 0, `${id} has outline artwork`);
    assert.ok(definition.filledPaths.length > 0, `${id} has filled artwork`);
  }
});

test("new gear icons use content names and their item asset color", () => {
  for (const id of gearIds) {
    const icon = getGearPresentationIcon(id);
    const content = gearDefinitions[id];
    assert.ok(icon, `${id} has a registered presentation`);
    assert.equal(icon.id, id);
    assert.equal(icon.label, content.name);
    assert.equal(icon.materialColor, content.asset.color);
    assert.ok(icon.paths.length > 0);
    assert.ok(icon.filledPaths.length > 0);
  }
});

test("new supply icons retain definition shapes and item appearance uses authoritative asset pigment", () => {
  for (const id of supplyIds) {
    const icon = getSupplyPresentationDefinition(id);
    const content = supplyDefinitions[id];
    assert.ok(icon, `${id} has a registered presentation`);
    assert.equal(icon.id, id);
    assert.equal(icon.label, content.name);
    assert.equal(icon.color, content.asset.color);
    assert.deepEqual(icon.shape, content.shape);
    assert.deepEqual(icon.clipGeometry.cells, content.shape);
    assert.ok(icon.paths.length > 0);
    assert.ok(icon.filledPaths.length > 0);
    assert.equal(getGameItemAppearance({ kind: "supply", definitionId: id, grade: "legendary" }).fillColor, content.asset.color);
    assert.equal(getGameItemAppearance({ kind: "supply", definitionId: id, grade: "legendary" }).outlineColor, gradeDefinitions.legendary.color);
  }
});
