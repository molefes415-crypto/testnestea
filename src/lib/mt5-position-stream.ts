export const POSITION_REFRESH_MS = 1000;

/** The gateway exposes HTTP snapshots, not a tick/WebSocket stream. Never invent intermediate values. */
export function startPositionStream({ read, apply, failed, active, schedule = (fn: () => void, ms: number) => setTimeout(fn, ms), cancel = (id: ReturnType<typeof setTimeout>) => clearTimeout(id) }: {
  read: () => Promise<unknown>; apply: (data: unknown) => void; failed: (error: unknown) => void;
  active: () => boolean; schedule?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>; cancel?: (id: ReturnType<typeof setTimeout>) => void;
}) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function sample() {
    if (stopped) return;
    if (active()) {
      try { const data = await read(); if (!stopped && active()) apply(data); }
      catch (error) { if (!stopped && active()) failed(error); }
    }
    if (!stopped) timer = schedule(() => void sample(), POSITION_REFRESH_MS);
  }
  void sample();
  return () => { stopped = true; if (timer !== undefined) cancel(timer); };
}