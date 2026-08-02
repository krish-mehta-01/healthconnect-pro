// Offline write queue for the two actions field staff most need to keep working with no
// signal: submitting a report and registering a patient (see the round-2 research this
// session — offline-first is a real gap for the app's own high-altitude facility data,
// not a hypothetical). Deliberately simple: localStorage as the queue store, and a
// window 'online' listener to flush it — not the Background Sync API, which needs a
// service-worker 'sync' event and has inconsistent browser support (notably iOS Safari).
// A same-tab online-event flush covers the realistic case here: a field worker's device
// reconnects while the app is still open.

export type QueuedActionType = 'submitReport' | 'createPatient';

export interface QueuedAction {
  id: string;
  type: QueuedActionType;
  payload: unknown;
  timestamp: number;
}

const QUEUE_KEY = 'hcp_offline_queue';
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribeToQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getQueue(): QueuedAction[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function setQueue(queue: QueuedAction[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  notify();
}

export function enqueue(type: QueuedActionType, payload: unknown): void {
  const queue = getQueue();
  queue.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, payload, timestamp: Date.now() });
  setQueue(queue);
}

function removeFromQueue(id: string) {
  setQueue(getQueue().filter((a) => a.id !== id));
}

// A network-level failure (offline, DNS failure, connection reset) throws a bare
// TypeError from fetch() itself, before any Response exists — distinct from the server
// responding with a real error (4xx/5xx, or { success: false }), which should surface as
// an actual error rather than be silently queued and retried forever.
export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

// Handlers are registered by the components that own each action's real API call, so this
// module doesn't need to import submitNewReport/createPatient directly (avoids a circular
// dependency and keeps the queue generic).
const handlers: Partial<Record<QueuedActionType, (payload: any) => Promise<unknown>>> = {};

export function registerQueueHandler(type: QueuedActionType, handler: (payload: any) => Promise<unknown>) {
  handlers[type] = handler;
}

let flushing = false;

export async function flushQueue(): Promise<{ synced: number; remaining: number }> {
  if (flushing) return { synced: 0, remaining: getQueue().length };
  flushing = true;
  let synced = 0;
  try {
    // Process in order (oldest first) so, e.g., a facility's reports sync in the sequence
    // they were actually recorded.
    for (const action of getQueue()) {
      const handler = handlers[action.type];
      if (!handler) continue;
      try {
        await handler(action.payload);
        removeFromQueue(action.id);
        synced++;
      } catch (err) {
        if (isNetworkError(err)) {
          // Still offline (or connection dropped again mid-flush) — stop here, leave the
          // rest queued, try again on the next 'online' event.
          break;
        }
        // A real server-side rejection (e.g. validation failure) — drop it from the queue
        // rather than retrying forever on data that will never succeed, but don't lose the
        // record silently: log it so it's at least visible in the console for now.
        console.error('Queued action rejected by server, dropping:', action, err);
        removeFromQueue(action.id);
      }
    }
  } finally {
    flushing = false;
  }
  return { synced, remaining: getQueue().length };
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flushQueue(); });
}
