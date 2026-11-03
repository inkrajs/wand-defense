import assert from "node:assert/strict";
import test from "node:test";
import { GAME_SPEEDS, type Command } from "../contracts";
import { createGameRuntime } from "./index";
import { parseRemoteCommand } from "../agent/protocol";
import { projectFrame } from "../agent/projection";

test("speed scales game time, respects pause, survives refresh and resets with a new run", () => {
  for (const speed of GAME_SPEEDS) {
    const runtime = createGameRuntime();
    runtime.dispatch({id:"speed",type:"setSpeed",speed});
    runtime.tick(50);
    assert.equal(runtime.getState().gameTimeMs,0); // Preparation never advances.
    runtime.dispatch({id:"start",type:"startWave"});
    runtime.tick(50);
    assert.equal(runtime.getState().gameTimeMs,50 * speed);
    const restored = createGameRuntime(undefined,runtime.checkpoint());
    assert.equal(restored.getState().speed,speed);
    restored.dispatch({id:"pause",type:"setPaused",paused:true});
    restored.tick(50);
    assert.equal(restored.getState().gameTimeMs,50 * speed);
    restored.dispatch({id:"unpause",type:"setPaused",paused:false});
    restored.tick(50);
    assert.equal(restored.getState().gameTimeMs,100 * speed);
    restored.dispatch({id:"restart",type:"restart"});
    assert.equal(restored.getState().speed,1);
    runtime.dispose(); restored.dispose();
  }
});

test("speed commands are validated and exposed through the same public protocol", () => {
  const runtime = createGameRuntime();
  for (const speed of [0, -1, 1.5, Infinity, NaN, "2", null]) {
    assert.equal(parseRemoteCommand({id:"invalid",type:"setSpeed",speed}),undefined);
    const before = runtime.getState();
    assert.equal(runtime.dispatch({id:`bad-${speed}`,type:"setSpeed",speed} as Command).status,"rejected");
    assert.deepEqual(runtime.getState(),before);
  }
  const command = parseRemoteCommand({id:"valid",type:"setSpeed",speed:2,privateField:"ignored"});
  assert.deepEqual(command,{id:"valid",type:"setSpeed",speed:2});
  runtime.dispatch(command!);
  const state = runtime.getState(), frame = projectFrame(state,state.events,[]);
  assert.equal(frame.state.speed,2);
  assert.ok(frame.capabilities.commands.includes("setSpeed"));
  assert.deepEqual(frame.events.at(-1)?.data,{speed:2});
  const checkpoint = runtime.checkpoint();
  delete (checkpoint.state as Partial<typeof state>).speed;
  assert.equal(createGameRuntime(undefined,checkpoint).getState().speed,1);
});
