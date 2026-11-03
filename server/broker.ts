import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import type { Command, CommandResult, GameEvent } from "../src/contracts/index.js";

/** Explicit broker configuration. Defaults keep the prototype open for development. */
export interface BrokerOptions {
  /** Origins allowed for cross-origin browser access. Defaults to `"*"`. */
  corsOrigin?: string | string[];
  /** Maximum accepted request body size. Defaults to 256 KiB. */
  maxPayloadBytes?: number;
  /** Lifetime of a pair code. Defaults to 10 minutes. */
  pairCodeTtlMs?: number;
  /** Number of retained events per session before older ones are dropped. */
  eventBufferSize?: number;
  /** Maximum events returned by one JSON `/events` read. */
  eventsPerRead?: number;
}

export interface BrokerServer {
  server: Server;
  listen(port?: number, host?: string): Promise<{ port: number; host: string }>;
  close(): Promise<void>;
  readonly sessions: ReadonlyMap<string, Session>;
}

interface Session {
  id: string;
  browserToken: string;
  agentToken: string;
  pairCode: string;
  pairCodeExpiresAt: number;
  state?: unknown;
  capabilities?: unknown;
  content?: unknown;
  /** Every command ever received, keyed by id for idempotency and conflict checks. */
  commands: Map<string, Command>;
  /** Commands accepted but not yet confirmed by a frame result. */
  pending: Map<string, Command>;
  /** Latest result per command id (accepted until a frame confirms it). */
  results: Map<string, CommandResult>;
  events: GameEvent[];
  sseClients: Set<ServerResponse>;
  lastFrameAt: number;
}

const DEFAULT_MAX_PAYLOAD_BYTES = 256 * 1024;
const DEFAULT_PAIR_CODE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_EVENT_BUFFER_SIZE = 2000;
const DEFAULT_EVENTS_PER_READ = 500;
const PAIR_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

class PayloadTooLargeError extends Error {}

function randomToken(): string {
  return randomBytes(24).toString("base64url");
}

function randomPairCode(): string {
  let code = "";
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) code += PAIR_ALPHABET[bytes[i]! % PAIR_ALPHABET.length];
  return code;
}

/** Order-independent JSON form so idempotency ignores object key order. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isEvent(value: unknown): value is GameEvent {
  return isObject(value) && typeof value.seq === "number" && typeof value.type === "string";
}

function isCommandResult(value: unknown): value is CommandResult {
  return isObject(value) && typeof value.commandId === "string" &&
    (value.status === "accepted" || value.status === "executed" || value.status === "rejected");
}

function parseAfter(raw: string | null): number {
  if (raw === null) return 0;
  const number = Number(raw);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

function readBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        tooLarge = true;
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    });
    req.on("end", () => {
      if (tooLarge) reject(new PayloadTooLargeError());
      else resolve(Buffer.concat(chunks));
    });
    req.on("error", reject);
  });
}

function parseJson(raw: Buffer): unknown {
  if (!raw.length) return undefined;
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch {
    return undefined;
  }
}

function corsHeaders(req: IncomingMessage, corsOrigins: string[]): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,Accept",
    "Access-Control-Max-Age": "86400",
  };
  const origin = req.headers.origin;
  if (corsOrigins.includes("*")) {
    headers["Access-Control-Allow-Origin"] = "*";
  } else if (origin && corsOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return headers;
}

function sendJson(res: ServerResponse, status: number, body: unknown, cors: Record<string, string>): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...cors });
  res.end(JSON.stringify(body));
}

function sendError(res: ServerResponse, status: number, code: string, cors: Record<string, string>): void {
  sendJson(res, status, { error: { code } }, cors);
}

function bearerToken(req: IncomingMessage): string | undefined {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return undefined;
  const token = auth.slice("Bearer ".length).trim();
  return token || undefined;
}

function currentRevision(session: Session): number {
  const state = session.state as { revision?: unknown } | undefined;
  return typeof state?.revision === "number" && Number.isSafeInteger(state.revision) ? state.revision : 0;
}

/** True when any sequence in `(after, maxSeq]` is missing, including trim or overflow holes. */
function computeGap(events: GameEvent[], after: number): boolean {
  let expected = after + 1;
  for (const event of events) {
    if (event.seq <= after) continue;
    if (event.seq > expected) return true;
    expected = event.seq + 1;
  }
  return false;
}

/** Generic text filter over projected content detail arrays. Id lists stay as-is. */
function filterContent(content: unknown, query: string): unknown {
  if (!query || !isObject(content)) return content;
  const needle = query.toLowerCase();
  const matches = (value: unknown): boolean => {
    if (typeof value === "string") return value.toLowerCase().includes(needle);
    if (typeof value === "number") return String(value).includes(needle);
    if (Array.isArray(value)) return value.some(matches);
    if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).some(matches);
    return false;
  };
  const filtered: Record<string, unknown> = { ...content };
  for (const key of ["spells", "arcana", "recipes", "sequences"]) {
    const list = content[key];
    if (Array.isArray(list)) filtered[key] = list.filter(matches);
  }
  return filtered;
}

export function createBrokerServer(options: BrokerOptions = {}): BrokerServer {
  const maxPayloadBytes = options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES;
  const pairCodeTtlMs = options.pairCodeTtlMs ?? DEFAULT_PAIR_CODE_TTL_MS;
  const eventBufferSize = Math.max(1, options.eventBufferSize ?? DEFAULT_EVENT_BUFFER_SIZE);
  const eventsPerRead = Math.max(1, options.eventsPerRead ?? DEFAULT_EVENTS_PER_READ);
  const corsOrigins = options.corsOrigin === undefined
    ? ["*"]
    : typeof options.corsOrigin === "string"
      ? [options.corsOrigin]
      : [...options.corsOrigin];
  const sessions = new Map<string, Session>();

  function appendEvents(session: Session, events: GameEvent[]): void {
    const appended: GameEvent[] = [];
    let previousSeq = session.events.length ? session.events[session.events.length - 1]!.seq : 0;
    for (const event of events) {
      const last = session.events[session.events.length - 1];
      if (last && event.seq <= last.seq) continue;
      if (event.seq > previousSeq + 1) {
        for (const client of session.sseClients) {
          try { client.write(`event: gap\ndata: ${JSON.stringify({ gap: true, nextCursor: event.seq })}\n\n`); } catch { /* client gone */ }
        }
      }
      session.events.push(event);
      appended.push(event);
      previousSeq = event.seq;
    }
    if (session.events.length > eventBufferSize) session.events.splice(0, session.events.length - eventBufferSize);
    for (const event of appended) {
      for (const client of session.sseClients) {
        try { client.write(`data: ${JSON.stringify(event)}\n\n`); } catch { /* client gone */ }
      }
    }
  }

  function acceptCommand(session: Session, command: Command): CommandResult {
    const accepted: CommandResult = { commandId: command.id, status: "accepted", revision: currentRevision(session) };
    session.commands.set(command.id, command);
    session.pending.set(command.id, command);
    session.results.set(command.id, accepted);
    return accepted;
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const cors = corsHeaders(req, corsOrigins);
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      res.end();
      return;
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    const segments = url.pathname.split("/").filter(Boolean);
    const method = req.method ?? "GET";

    if (method === "GET" && segments.length === 1 && segments[0] === "health") {
      sendJson(res, 200, { ok: true }, cors);
      return;
    }

    if (method === "POST" && segments.length === 1 && segments[0] === "sessions") {
      await readBody(req, maxPayloadBytes);
      const session: Session = {
        id: randomToken(), browserToken: randomToken(), agentToken: randomToken(),
        pairCode: randomPairCode(), pairCodeExpiresAt: Date.now() + pairCodeTtlMs,
        commands: new Map(), pending: new Map(), results: new Map(),
        events: [], sseClients: new Set(), lastFrameAt: 0,
      };
      sessions.set(session.id, session);
      sendJson(res, 200, { sessionId: session.id, browserToken: session.browserToken, pairCode: session.pairCode }, cors);
      return;
    }

    if (method === "POST" && segments.length === 1 && segments[0] === "pair") {
      const body = parseJson(await readBody(req, maxPayloadBytes));
      const pairCode = isObject(body) && typeof body.pairCode === "string" ? body.pairCode : "";
      for (const session of sessions.values()) {
        if (session.pairCode === pairCode && session.pairCodeExpiresAt > Date.now()) {
          sendJson(res, 200, { sessionId: session.id, agentToken: session.agentToken }, cors);
          return;
        }
      }
      sendError(res, 404, "PAIR_FAILED", cors);
      return;
    }

    if (segments.length >= 2 && segments[0] === "sessions") {
      const session = sessions.get(segments[1]!);
      if (!session) {
        sendError(res, 404, "NOT_FOUND", cors);
        return;
      }
      const token = bearerToken(req);
      if (!token) {
        sendError(res, 401, "UNAUTHORIZED", cors);
        return;
      }
      const role = token === session.browserToken ? "browser" : token === session.agentToken ? "agent" : null;
      if (!role) {
        sendError(res, 401, "UNAUTHORIZED", cors);
        return;
      }
      const route = segments.slice(2);

      // Browser-only routes: frame upload and command polling.
      if (route.length === 1 && route[0] === "frame" && method === "POST") {
        if (role !== "browser") { sendError(res, 403, "FORBIDDEN", cors); return; }
        const body = parseJson(await readBody(req, maxPayloadBytes));
        if (!isObject(body)) { sendError(res, 400, "BAD_JSON", cors); return; }
        if (isObject(body.state)) session.state = body.state;
        if (isObject(body.capabilities)) session.capabilities = body.capabilities;
        if (isObject(body.content)) session.content = body.content;
        if (Array.isArray(body.events)) appendEvents(session, body.events.filter(isEvent));
        if (Array.isArray(body.results)) {
          for (const result of body.results.filter(isCommandResult)) {
            if (session.commands.has(result.commandId) && (result.status === "executed" || result.status === "rejected")) {
              session.results.set(result.commandId, result);
              session.pending.delete(result.commandId);
            }
          }
        }
        session.lastFrameAt = Date.now();
        sendJson(res, 200, { ok: true }, cors);
        return;
      }

      if (route.length === 1 && route[0] === "commands" && method === "GET") {
        if (role !== "browser") { sendError(res, 403, "FORBIDDEN", cors); return; }
        sendJson(res, 200, { commands: [...session.pending.values()] }, cors);
        return;
      }

      // Agent-only routes: observation and command submission.
      if (role !== "agent") { sendError(res, 403, "FORBIDDEN", cors); return; }

      if (route.length === 1 && route[0] === "state" && method === "GET") {
        sendJson(res, 200, session.state ?? null, cors);
        return;
      }
      if (route.length === 1 && route[0] === "capabilities" && method === "GET") {
        sendJson(res, 200, session.capabilities ?? null, cors);
        return;
      }
      if (route.length === 1 && route[0] === "content" && method === "GET") {
        sendJson(res, 200, filterContent(session.content, url.searchParams.get("q") ?? "") ?? null, cors);
        return;
      }
      if (route.length === 1 && route[0] === "events" && method === "GET") {
        const after = parseAfter(url.searchParams.get("after"));
        const events = session.events.filter((event) => event.seq > after).slice(0, eventsPerRead);
        const gap = computeGap(session.events, after);
        const nextCursor = events.length ? events[events.length - 1]!.seq : after;
        sendJson(res, 200, { events, nextCursor, gap }, cors);
        return;
      }
      if (route.length === 2 && route[0] === "events" && route[1] === "stream" && method === "GET") {
        const after = parseAfter(url.searchParams.get("after"));
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          ...cors,
        });
        res.write(": connected\n\n");
        if (computeGap(session.events, after)) {
          res.write(`event: gap\ndata: ${JSON.stringify({ gap: true, nextCursor: session.events[session.events.length - 1]!.seq })}\n\n`);
        }
        for (const event of session.events) {
          if (event.seq > after) res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
        session.sseClients.add(res);
        const heartbeat = setInterval(() => {
          try { res.write(": ping\n\n"); } catch { /* ignore */ }
        }, 15000);
        const cleanup = (): void => {
          clearInterval(heartbeat);
          session.sseClients.delete(res);
          try { res.end(); } catch { /* ignore */ }
        };
        res.on("close", cleanup);
        res.on("error", cleanup);
        return;
      }
      if (route.length === 1 && route[0] === "commands" && method === "POST") {
        const body = parseJson(await readBody(req, maxPayloadBytes));
        if (!isObject(body) || typeof body.id !== "string" || !body.id || typeof body.type !== "string" || !body.type) {
          sendError(res, 400, "INVALID_COMMAND", cors);
          return;
        }
        if (body.type === "unlockCheats") {
          sendError(res, 400, "UNLOCK_CHEATS_FORBIDDEN", cors);
          return;
        }
        const command = body as unknown as Command;
        const existing = session.commands.get(command.id);
        if (existing) {
          if (stableStringify(existing) === stableStringify(command)) {
            sendJson(res, 200, session.results.get(command.id) ?? acceptCommand(session, command), cors);
          } else {
            sendError(res, 409, "COMMAND_ID_CONFLICT", cors);
          }
          return;
        }
        sendJson(res, 202, acceptCommand(session, command), cors);
        return;
      }
      if (route.length === 2 && route[0] === "results" && method === "GET") {
        const commandId = decodeURIComponent(route[1]!);
        if (!session.commands.has(commandId)) {
          sendError(res, 404, "NOT_FOUND", cors);
          return;
        }
        sendJson(res, 200, session.results.get(commandId) ?? { commandId, status: "accepted", revision: currentRevision(session) }, cors);
        return;
      }
      sendError(res, 404, "NOT_FOUND", cors);
      return;
    }

    sendError(res, 404, "NOT_FOUND", cors);
  }

  const server = createServer((req, res) => {
    void handle(req, res).catch((error: unknown) => {
      const cors = corsHeaders(req, corsOrigins);
      if (res.headersSent) {
        try { res.end(); } catch { /* ignore */ }
        return;
      }
      if (error instanceof PayloadTooLargeError) sendError(res, 413, "PAYLOAD_TOO_LARGE", cors);
      else sendError(res, 500, "INTERNAL", cors);
    });
  });

  function listen(port = 8787, host = "0.0.0.0"): Promise<{ port: number; host: string }> {
    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, host, () => {
        server.off("error", reject);
        const address = server.address();
        const boundPort = typeof address === "object" && address ? address.port : port;
        resolve({ port: boundPort, host });
      });
    });
  }

  function close(): Promise<void> {
    return new Promise((resolve, reject) => {
      for (const session of sessions.values()) {
        for (const client of session.sseClients) {
          try { client.end(); } catch { /* ignore */ }
        }
      }
      sessions.clear();
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  return { server, listen, close, sessions };
}
