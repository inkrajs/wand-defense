import assert from "node:assert/strict";
import test from "node:test";
import { createBrokerServer, type BrokerOptions, type BrokerServer } from "./broker.js";
import { createMockRuntime } from "../src/runtime/mock.js";
import { projectFrame } from "../src/agent/projection.js";

interface Started {
  base: string;
  broker: BrokerServer;
  stop(): Promise<void>;
}

async function start(options: BrokerOptions = {}): Promise<Started> {
  const broker = createBrokerServer(options);
  const { port } = await broker.listen(0, "127.0.0.1");
  return {
    base: `http://127.0.0.1:${port}`,
    broker,
    stop: async () => broker.close(),
  };
}

async function createSession(base: string): Promise<{ sessionId: string; browserToken: string; agentToken: string; pairCode: string }> {
  const create = await fetch(`${base}/sessions`, { method: "POST", body: "{}" });
  assert.equal(create.status, 200);
  const created = (await create.json()) as { sessionId: string; browserToken: string; pairCode: string };
  const pair = await fetch(`${base}/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairCode: created.pairCode }),
  });
  assert.equal(pair.status, 200);
  const paired = (await pair.json()) as { sessionId: string; agentToken: string };
  return { sessionId: created.sessionId, browserToken: created.browserToken, agentToken: paired.agentToken, pairCode: created.pairCode };
}

test("session create, pair, frame upload, command poll and result confirmation", async () => {
  const started = await start();
  try {
    const { sessionId, browserToken, agentToken } = await createSession(started.base);
    const runtime = createMockRuntime();
    const frame = projectFrame(runtime.getState(), [], [], undefined);

    const upload = await fetch(`${started.base}/sessions/${sessionId}/frame`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${browserToken}` },
      body: JSON.stringify(frame),
    });
    assert.equal(upload.status, 200);

    const stateRes = await fetch(`${started.base}/sessions/${sessionId}/state`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    assert.equal(stateRes.status, 200);
    const state = (await stateRes.json()) as { revision: number };
    assert.equal(state.revision, 0);

    const contentRes = await fetch(`${started.base}/sessions/${sessionId}/content`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    assert.equal(contentRes.status, 200);

    const post = await fetch(`${started.base}/sessions/${sessionId}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${agentToken}` },
      body: JSON.stringify({ id: "cmd-1", type: "setBackpack", open: true }),
    });
    assert.equal(post.status, 202);
    assert.equal(((await post.json()) as { status: string }).status, "accepted");

    const poll = await fetch(`${started.base}/sessions/${sessionId}/commands`, {
      headers: { Authorization: `Bearer ${browserToken}` },
    });
    assert.equal(poll.status, 200);
    const polled = (await poll.json()) as { commands: { id: string }[] };
    assert.equal(polled.commands.length, 1);
    assert.equal(polled.commands[0]!.id, "cmd-1");

    const confirm = await fetch(`${started.base}/sessions/${sessionId}/frame`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${browserToken}` },
      body: JSON.stringify({ state, events: [], capabilities: {}, content: {}, results: [{ commandId: "cmd-1", status: "executed", revision: 1 }] }),
    });
    assert.equal(confirm.status, 200);

    const pollAfter = await fetch(`${started.base}/sessions/${sessionId}/commands`, {
      headers: { Authorization: `Bearer ${browserToken}` },
    });
    assert.equal(((await pollAfter.json()) as { commands: unknown[] }).commands.length, 0);

    const result = await fetch(`${started.base}/sessions/${sessionId}/results/cmd-1`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    assert.equal(result.status, 200);
    assert.equal(((await result.json()) as { status: string }).status, "executed");
  } finally {
    await started.stop();
  }
});

test("commands are idempotent by id and reject conflicting payloads", async () => {
  const started = await start();
  try {
    const { sessionId, agentToken } = await createSession(started.base);
    const command = { id: "dup-1", type: "setPaused", paused: true };
    const first = await fetch(`${started.base}/sessions/${sessionId}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${agentToken}` },
      body: JSON.stringify(command),
    });
    assert.equal(first.status, 202);

    const replay = await fetch(`${started.base}/sessions/${sessionId}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${agentToken}` },
      body: JSON.stringify(command),
    });
    assert.equal(replay.status, 200);
    assert.equal(((await replay.json()) as { commandId: string }).commandId, "dup-1");

    const conflict = await fetch(`${started.base}/sessions/${sessionId}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${agentToken}` },
      body: JSON.stringify({ id: "dup-1", type: "setPaused", paused: false }),
    });
    assert.equal(conflict.status, 409);
  } finally {
    await started.stop();
  }
});

test("network unlockCheats is always rejected", async () => {
  const started = await start();
  try {
    const { sessionId, agentToken } = await createSession(started.base);
    const res = await fetch(`${started.base}/sessions/${sessionId}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${agentToken}` },
      body: JSON.stringify({ id: "u-1", type: "unlockCheats" }),
    });
    assert.equal(res.status, 400);
    assert.equal(((await res.json()) as { error: { code: string } }).error.code, "UNLOCK_CHEATS_FORBIDDEN");
  } finally {
    await started.stop();
  }
});

test("browser and agent tokens are isolated to their own routes", async () => {
  const started = await start();
  try {
    const { sessionId, browserToken, agentToken } = await createSession(started.base);
    const agentAsBrowser = await fetch(`${started.base}/sessions/${sessionId}/frame`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${agentToken}` },
      body: JSON.stringify({}),
    });
    assert.equal(agentAsBrowser.status, 403);

    const agentPoll = await fetch(`${started.base}/sessions/${sessionId}/commands`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    assert.equal(agentPoll.status, 403);

    const browserAsAgent = await fetch(`${started.base}/sessions/${sessionId}/state`, {
      headers: { Authorization: `Bearer ${browserToken}` },
    });
    assert.equal(browserAsAgent.status, 403);

    const noToken = await fetch(`${started.base}/sessions/${sessionId}/state`);
    assert.equal(noToken.status, 401);
  } finally {
    await started.stop();
  }
});

test("oversized payloads are rejected with 413", async () => {
  const started = await start({ maxPayloadBytes: 1024 });
  try {
    const { sessionId, agentToken } = await createSession(started.base);
    const res = await fetch(`${started.base}/sessions/${sessionId}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${agentToken}` },
      body: JSON.stringify({ id: "x".repeat(4096), type: "startWave" }),
    });
    assert.equal(res.status, 413);
  } finally {
    await started.stop();
  }
});

test("events support cursor reads and report gaps when the buffer trims", async () => {
  const started = await start({ eventBufferSize: 3 });
  try {
    const { sessionId, browserToken, agentToken } = await createSession(started.base);
    const events = [1, 2, 3, 4, 5].map((seq) => ({ seq, type: "waveStarted", gameTimeMs: seq * 100, data: { wave: seq } }));
    const upload = await fetch(`${started.base}/sessions/${sessionId}/frame`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${browserToken}` },
      body: JSON.stringify({ state: { revision: 0 }, events, results: [], capabilities: {}, content: {} }),
    });
    assert.equal(upload.status, 200);

    const read = await fetch(`${started.base}/sessions/${sessionId}/events?after=0`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    const body = (await read.json()) as { events: { seq: number }[]; nextCursor: number; gap: boolean };
    assert.equal(body.gap, true);
    assert.deepEqual(body.events.map((event) => event.seq), [3, 4, 5]);
    assert.equal(body.nextCursor, 5);

    const tail = await fetch(`${started.base}/sessions/${sessionId}/events?after=5`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    const tailBody = (await tail.json()) as { events: unknown[]; gap: boolean };
    assert.equal(tailBody.events.length, 0);
    assert.equal(tailBody.gap, false);
  } finally {
    await started.stop();
  }
});

test("events report a gap for a hole inside the retained batch", async () => {
  const started = await start();
  try {
    const { sessionId, browserToken, agentToken } = await createSession(started.base);
    const events = [1, 4].map((seq) => ({ seq, type: "waveStarted", gameTimeMs: seq * 100, data: { wave: seq } }));
    const upload = await fetch(`${started.base}/sessions/${sessionId}/frame`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${browserToken}` },
      body: JSON.stringify({ state: { revision: 0 }, events, results: [], capabilities: {}, content: {} }),
    });
    assert.equal(upload.status, 200);

    const read = await fetch(`${started.base}/sessions/${sessionId}/events?after=0`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    const body = (await read.json()) as { events: { seq: number }[]; gap: boolean; nextCursor: number };
    assert.equal(body.gap, true);
    assert.deepEqual(body.events.map((event) => event.seq), [1, 4]);
    assert.equal(body.nextCursor, 4);
  } finally {
    await started.stop();
  }
});

test("SSE streams backlog and live events", async () => {
  const started = await start();
  try {
    const { sessionId, browserToken, agentToken } = await createSession(started.base);
    const upload = await fetch(`${started.base}/sessions/${sessionId}/frame`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${browserToken}` },
      body: JSON.stringify({
        state: { revision: 0 },
        events: [{ seq: 1, type: "waveStarted", gameTimeMs: 100, data: { wave: 1 } }],
        results: [], capabilities: {}, content: {},
      }),
    });
    assert.equal(upload.status, 200);

    const stream = await fetch(`${started.base}/sessions/${sessionId}/events/stream?after=0`, {
      headers: { Accept: "text/event-stream", Authorization: `Bearer ${agentToken}` },
    });
    assert.equal(stream.status, 200);
    assert.ok(stream.body);
    const reader = stream.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      if (text.includes("waveStarted")) break;
    }
    assert.ok(text.includes("waveStarted"), "SSE backlog event was not received");
    await reader.cancel();
  } finally {
    await started.stop();
  }
});

test("accepted frame results never complete a pending command", async () => {
  const started = await start();
  try {
    const { sessionId, browserToken, agentToken } = await createSession(started.base);
    const post = await fetch(`${started.base}/sessions/${sessionId}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${agentToken}` },
      body: JSON.stringify({ id: "cmd-accepted", type: "setPaused", paused: true }),
    });
    assert.equal(post.status, 202);

    const masquerade = await fetch(`${started.base}/sessions/${sessionId}/frame`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${browserToken}` },
      body: JSON.stringify({
        state: { revision: 0 }, events: [], capabilities: {}, content: {},
        results: [{ commandId: "cmd-accepted", status: "accepted", revision: 0 }],
      }),
    });
    assert.equal(masquerade.status, 200);

    const poll = await fetch(`${started.base}/sessions/${sessionId}/commands`, {
      headers: { Authorization: `Bearer ${browserToken}` },
    });
    assert.equal(((await poll.json()) as { commands: unknown[] }).commands.length, 1);

    const result = await fetch(`${started.base}/sessions/${sessionId}/results/cmd-accepted`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    assert.equal(((await result.json()) as { status: string }).status, "accepted");
  } finally {
    await started.stop();
  }
});

test("SSE emits an explicit gap event when the cursor predates the retained buffer", async () => {
  const started = await start({ eventBufferSize: 3 });
  try {
    const { sessionId, browserToken, agentToken } = await createSession(started.base);
    const events = [1, 2, 3, 4, 5].map((seq) => ({ seq, type: "waveStarted", gameTimeMs: seq * 100, data: { wave: seq } }));
    const upload = await fetch(`${started.base}/sessions/${sessionId}/frame`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${browserToken}` },
      body: JSON.stringify({ state: { revision: 0 }, events, results: [], capabilities: {}, content: {} }),
    });
    assert.equal(upload.status, 200);

    const stream = await fetch(`${started.base}/sessions/${sessionId}/events/stream?after=0`, {
      headers: { Accept: "text/event-stream", Authorization: `Bearer ${agentToken}` },
    });
    assert.equal(stream.status, 200);
    assert.ok(stream.body);
    const reader = stream.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      if (text.includes("event: gap") && text.includes("waveStarted")) break;
    }
    assert.ok(text.includes("event: gap"), "SSE gap event was not emitted");
    assert.ok(text.includes('"gap":true'), "SSE gap payload was not emitted");
    assert.ok(text.includes('"nextCursor":5'), "SSE gap payload should carry the latest syncable cursor");
    assert.ok(text.includes("waveStarted"), "retained backlog events were not streamed");
    await reader.cancel();
  } finally {
    await started.stop();
  }
});
