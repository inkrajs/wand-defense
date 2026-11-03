import assert from "node:assert/strict";
import test from "node:test";
import type { CombatEntity } from "../contracts";
import { createInitialState } from "../runtime/initial";
import { spawnProjectiles,advanceProjectiles } from "./projectiles";
import { firstProjectileCollision } from "./projectileCollision";

function enemy(id:string,x:number,y:number):CombatEntity {return {id,definitionId:"enemy-basic",kind:"enemy",faction:"enemy",
  x,y,hp:100,maxHp:100,damage:0,speed:0,range:0,cooldownMs:1000,attackRemainingMs:1000};}
function setup(speed=100) {
  const state=createInitialState();state.phase="battle";state.wave=1;
  state.entities=[enemy("aimed",50,70)];
  spawnProjectiles(state,"character-1",{itemId:"spark-1",definitionId:"spark",power:10,range:100,casts:1,speed},()=>{});
  return state;
}

test("flight continues past a dead target without seeking an off-path enemy",()=>{
  const state=setup();state.entities[0].hp=0;
  const other=enemy("off-path",60,60);state.entities.push(other);
  const bullet=state.entities.find(entity=>entity.kind === "projectile")!;
  for(let i=0;i<4;i++)advanceProjectiles(state,50,()=>{});
  assert.ok(bullet.hp>0);assert.ok(bullet.y<70);assert.equal(other.hp,100);
  other.x=50;other.y=55;
  for(let i=0;i<4&&bullet.hp>0;i++)advanceProjectiles(state,50,()=>{});
  assert.equal(other.hp,90);assert.equal(bullet.hp,0);
});

test("swept collision hits the first intervening enemy instead of tunnelling or binding to targetId",()=>{
  const state=setup(500);state.entities[0].y=20;
  const bullet=state.entities.find(entity=>entity.kind === "projectile")!;
  const blocker=enemy("blocker",50,60);state.entities.push(blocker);
  advanceProjectiles(state,100,()=>{});
  assert.equal(blocker.hp,90);assert.equal(state.entities[0].hp,100);assert.equal(bullet.hp,0);
});

test("unobstructed abandoned shots exit the field or exhaust their finite lifetime",()=>{
  const state=setup();state.entities[0].hp=0;const reasons:unknown[]=[];
  const bullet=state.entities.find(entity=>entity.kind === "projectile")!;
  for(let i=0;i<100&&bullet.hp>0;i++)advanceProjectiles(state,50,(type,data)=>{if(type === "projectileExpired")reasons.push(data.reason);});
  assert.equal(bullet.hp,0);assert.ok(reasons.includes("outOfBounds"));
  assert.equal(reasons.includes("targetLost"),false);
});

test("large monsters collide with grazing shots according to their shared body size",()=>{
  const state=createInitialState();
  const target=enemy("large",52.8,60);state.entities=[target];
  const from={x:50,y:70},to={x:50,y:50};
  assert.equal(firstProjectileCollision(state,from,to,new Set()),undefined);
  target.definitionId="boss-major";
  assert.equal(firstProjectileCollision(state,from,to,new Set())?.target.id,"large");
  target.bodySize="small";
  assert.equal(firstProjectileCollision(state,from,to,new Set()),undefined);
});
