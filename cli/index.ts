import type { Command, CommandResult, GameEvent, GameState } from "../src/contracts/index.js";

type Json = Record<string, unknown>;
type CliConfig = { url: string; session?: string; token?: string };

const usage = `Playlink CLI — inspect and control a running Wand Defense session

Usage:
  npm run playlink -- <command> [options]

Commands:
  pair <pairCode>                 Pair this CLI with a browser-created session
  state                           Read the player-visible game state
  capabilities                    Read available player actions/capabilities
  content [--q <query>]           Search content the player has discovered
  command <JSON>                  Submit an original Command object
  result <commandId>              Read accepted/final result for a command
  events [--after <seq>] [--stream] Read events or subscribe to SSE
  help                            Show this help

Options:
  --url <url>       Broker origin (or PLAYLINK_URL)
  --session <id>    Session id (or PLAYLINK_SESSION)
  --token <token>   Role token (or PLAYLINK_TOKEN)
  --after <seq>     Event cursor; --stream enables SSE subscription
  --q <query>       Player-known content search text

Pairing returns credentials. Store them in a trusted secret manager or set
PLAYLINK_URL, PLAYLINK_SESSION, and PLAYLINK_TOKEN for later commands. This
CLI never writes credentials to disk.
`;

function parse(argv: string[]): { command: string; positional: string[]; options: Record<string, string | boolean> } {
  const [command = "help", ...rest] = argv;
  const positional: string[] = [];
  const options: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i++) {
    const value = rest[i]!;
    if (!value.startsWith("--")) { positional.push(value); continue; }
    const key = value.slice(2);
    if (key === "stream") { options[key] = true; continue; }
    const next = rest[i + 1];
    if (!next || next.startsWith("--")) throw new Error(`Missing value for --${key}`);
    options[key] = next;
    i++;
  }
  return { command, positional, options };
}

function config(options: Record<string, string | boolean>): CliConfig {
  const url = String(options.url ?? process.env.PLAYLINK_URL ?? "").replace(/\/$/, "");
  if (!url) throw new Error("Set --url or PLAYLINK_URL.");
  return { url, session: String(options.session ?? process.env.PLAYLINK_SESSION ?? "") || undefined,
    token: String(options.token ?? process.env.PLAYLINK_TOKEN ?? "") || undefined };
}

async function request<T>(cfg: CliConfig, path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  if (auth && cfg.token) headers.set("Authorization", `Bearer ${cfg.token}`);
  let response: Response;
  try { response = await fetch(`${cfg.url}${path}`, { ...init, headers }); }
  catch { throw new Error("Could not reach the Playlink broker."); }
  if (!response.ok) {
    throw new Error(`Broker request failed (${response.status}).`);
  }
  return await response.json() as T;
}

function sessionPath(cfg: CliConfig, suffix: string): string {
  if (!cfg.session) throw new Error("Set --session or PLAYLINK_SESSION.");
  return `/sessions/${encodeURIComponent(cfg.session)}${suffix}`;
}

async function streamEvents(cfg: CliConfig, after: string): Promise<void> {
  const headers = new Headers({ Accept: "text/event-stream" });
  if (cfg.token) headers.set("Authorization", `Bearer ${cfg.token}`);
  let response: Response;
  try { response = await fetch(`${cfg.url}${sessionPath(cfg, `/events/stream?after=${encodeURIComponent(after)}`)}`, { headers }); }
  catch { throw new Error("Could not connect to the event stream."); }
  if (!response.ok || !response.body) throw new Error(`Event stream failed (${response.status}).`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separator: RegExpExecArray | null;
    while ((separator = /\r?\n\r?\n/.exec(buffer)) !== null) {
      const frame = buffer.slice(0, separator.index);
      buffer = buffer.slice(separator.index + separator[0].length);
      if (frame.startsWith(":")) continue;
      const data = frame.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trim()).join("\n");
      if (data) { try { console.log(JSON.stringify(JSON.parse(data), null, 2)); } catch { console.log(data); } }
    }
  }
}

async function main(): Promise<void> {
  const { command, positional, options } = parse(process.argv.slice(2));
  if (command === "help" || command === "--help" || command === "-h") { console.log(usage); return; }
  if (command === "pair") {
    const pairCode = positional[0];
    if (!pairCode) throw new Error("Usage: pair <pairCode>");
    const cfg = config(options);
    const result = await request<{ sessionId: string; agentToken: string }>(cfg, "/pair", { method: "POST", body: JSON.stringify({ pairCode }) }, false);
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const cfg = config(options);
  let result: unknown;
  switch (command) {
    case "state": result = await request<GameState>(cfg, sessionPath(cfg, "/state")); break;
    case "capabilities": result = await request<Json>(cfg, sessionPath(cfg, "/capabilities")); break;
    case "content": {
      const q = String(options.q ?? "");
      result = await request<Json>(cfg, `${sessionPath(cfg, "/content")}?q=${encodeURIComponent(q)}`); break;
    }
    case "command": {
      const raw = positional.join(" ");
      if (!raw) throw new Error("Usage: command '<Command JSON>'");
      let payload: Command;
      try { payload = JSON.parse(raw) as Command; } catch { throw new Error("Command must be valid JSON."); }
      if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("Command JSON must be an object.");
      }
      if (payload.type === "unlockCheats") throw new Error("unlockCheats is local-only and cannot be sent over Playlink.");
      result = await request<CommandResult>(cfg, sessionPath(cfg, "/commands"), { method: "POST", body: JSON.stringify(payload) }); break;
    }
    case "result": {
      const id = positional[0]; if (!id) throw new Error("Usage: result <commandId>");
      result = await request<CommandResult>(cfg, sessionPath(cfg, `/results/${encodeURIComponent(id)}`)); break;
    }
    case "events": {
      const after = String(options.after ?? "0");
      if (!/^\d+$/.test(after)) throw new Error("--after must be a non-negative sequence number.");
      if (options.stream) { await streamEvents(cfg, after); return; }
      result = await request<{ events: GameEvent[]; nextCursor: number; gap: boolean }>(cfg, sessionPath(cfg, `/events?after=${encodeURIComponent(after)}`)); break;
    }
    default: throw new Error(`Unknown command: ${command}\n\n${usage}`);
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Playlink command failed."); process.exitCode = 1; });
