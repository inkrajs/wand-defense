import type { Command, CommandResult, ContentCatalog, GameEvent, RuntimePort } from "../contracts";
import { projectFrame } from "./projection";
import { dispatchRemote } from "./protocol";

export interface BrowserConnectionConfig {
  baseUrl: string;
  /** Reuse an existing session instead of creating a new one. Supply both or neither. */
  sessionId?: string;
  browserToken?: string;
  pollMs?: number;
  /** Passed to projectFrame so discovered content can be included when available. */
  content?: ContentCatalog;
  onSession?: (session: { sessionId: string; browserToken: string; pairCode?: string }) => void;
  onStatus?: (status: string) => void;
}

export interface BrowserConnection {
  close(): void;
}

const MIN_POLL_MS = 50;
const MAX_BACKOFF_MS = 30_000;
const MAX_PENDING_EVENTS = 2000;
const MAX_RESULT_CACHE = 1000;
const MAX_FRAME_EVENTS = 200;
const MAX_FRAME_RESULTS = 200;
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Outbound browser connection: uploads the player-visible projection and polls
 * for remote commands. The local runtime stays the only game authority; the
 * broker only relays frames and commands.
 */
export function createBrowserConnection(runtime: RuntimePort, config: BrowserConnectionConfig): BrowserConnection {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const pollMs = Math.max(MIN_POLL_MS, config.pollMs ?? 250);
  let sessionId = config.sessionId;
  let browserToken = config.browserToken;
  let closed = false;
  let running = false;
  let delay = pollMs;
  let lastStatus: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  const pendingEvents: GameEvent[] = [];
  const pendingResults: CommandResult[] = [];
  const resultCache = new Map<string, CommandResult>();

  const status = (value: string): void => {
    if (lastStatus === value) return;
    lastStatus = value;
    config.onStatus?.(value);
  };

  const unsubscribe = runtime.subscribe((_state, events) => {
    for (const event of events) {
      if (!pendingEvents.some((queued) => queued.seq === event.seq)) pendingEvents.push(event);
    }
    if (pendingEvents.length > MAX_PENDING_EVENTS) pendingEvents.splice(0, pendingEvents.length - MAX_PENDING_EVENTS);
  });

  for (const event of runtime.getState().events) {
    if (!pendingEvents.some((queued) => queued.seq === event.seq)) pendingEvents.push(event);
  }

  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (init.body !== undefined) headers.set("Content-Type", "application/json");
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers, signal });
    if (!response.ok) throw new Error(`broker responded ${response.status}`);
    return response;
  }

  async function ensureSession(): Promise<void> {
    const response = await request("/sessions", { method: "POST", body: "{}" });
    const data = (await response.json()) as { sessionId: string; browserToken: string; pairCode?: string };
    sessionId = data.sessionId;
    browserToken = data.browserToken;
    config.onSession?.({ sessionId: data.sessionId, browserToken: data.browserToken, pairCode: data.pairCode });
  }

  async function uploadFrame(frame: unknown): Promise<void> {
    await request(`/sessions/${encodeURIComponent(sessionId!)}/frame`, {
      method: "POST",
      headers: { Authorization: `Bearer ${browserToken}` },
      body: JSON.stringify(frame),
    });
  }

  async function pollCommands(): Promise<Command[]> {
    const response = await request(`/sessions/${encodeURIComponent(sessionId!)}/commands`, {
      headers: { Authorization: `Bearer ${browserToken}` },
    });
    const data = (await response.json()) as { commands?: unknown };
    if (!Array.isArray(data.commands)) return [];
    return data.commands.filter((entry): entry is Command => {
      return isObject(entry) && typeof entry.id === "string" && typeof entry.type === "string";
    });
  }

  async function tick(): Promise<void> {
    if (closed || running) return;
    running = true;
    try {
      if (!sessionId || !browserToken) await ensureSession();
      const state = runtime.getState();
      const frameEvents = pendingEvents.slice(0, MAX_FRAME_EVENTS);
      const frameResults = pendingResults.slice(0, MAX_FRAME_RESULTS);
      const sentEventSeqs = new Set(frameEvents.map((event) => event.seq));
      const sentResultIds = new Set(frameResults.map((result) => result.commandId));
      const frame = projectFrame(state, frameEvents, frameResults, config.content);
      await uploadFrame(frame);
      for (let index = pendingEvents.length - 1; index >= 0; index--) {
        if (sentEventSeqs.has(pendingEvents[index]!.seq)) pendingEvents.splice(index, 1);
      }
      for (let index = pendingResults.length - 1; index >= 0; index--) {
        if (sentResultIds.has(pendingResults[index]!.commandId)) pendingResults.splice(index, 1);
      }
      for (const command of await pollCommands()) {
        let result = resultCache.get(command.id);
        if (!result) {
          result = dispatchRemote(runtime, command);
          resultCache.set(command.id, result);
          if (resultCache.size > MAX_RESULT_CACHE) {
            const oldest = resultCache.keys().next().value;
            if (oldest !== undefined) resultCache.delete(oldest);
          }
        }
        pendingResults.push(result);
      }
      delay = pollMs;
      status("connected");
    } catch {
      if (closed) return;
      delay = Math.min(Math.max(delay * 2, pollMs), MAX_BACKOFF_MS);
      status("reconnecting");
    } finally {
      running = false;
      schedule();
    }
  }

  function schedule(): void {
    if (closed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { void tick(); }, delay);
  }

  status("connecting");
  void tick();

  return {
    close() {
      if (closed) return;
      closed = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
      controller.abort();
      status("closed");
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
