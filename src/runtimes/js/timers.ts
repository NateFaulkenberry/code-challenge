/**
 * Timer functions that track outstanding work, so "Run" can finish when the
 * program goes quiet instead of immediately after the synchronous part.
 */
export interface TrackedTimers {
  bindings: {
    setTimeout: typeof setTimeout;
    clearTimeout: typeof clearTimeout;
    setInterval: typeof setInterval;
    clearInterval: typeof clearInterval;
  };
  /** Resolves once no timers are pending (after draining microtasks). */
  idle(): Promise<void>;
  clearAll(): void;
}

export function createTrackedTimers(): TrackedTimers {
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const intervals = new Set<ReturnType<typeof setInterval>>();
  let notify: (() => void) | undefined;

  const check = () => {
    if (timeouts.size === 0 && intervals.size === 0) notify?.();
  };

  const bindings = {
    setTimeout: ((callback: (...args: unknown[]) => void, ms?: number, ...args: unknown[]) => {
      const handle = setTimeout(() => {
        timeouts.delete(handle);
        try {
          callback(...args);
        } finally {
          queueMicrotask(check);
        }
      }, ms);
      timeouts.add(handle);
      return handle;
    }) as typeof setTimeout,
    clearTimeout: ((handle: ReturnType<typeof setTimeout> | undefined) => {
      if (handle === undefined) return;
      clearTimeout(handle);
      timeouts.delete(handle);
      queueMicrotask(check);
    }) as typeof clearTimeout,
    setInterval: ((callback: (...args: unknown[]) => void, ms?: number, ...args: unknown[]) => {
      const handle = setInterval(callback, ms, ...args);
      intervals.add(handle);
      return handle;
    }) as typeof setInterval,
    clearInterval: ((handle: ReturnType<typeof setInterval> | undefined) => {
      if (handle === undefined) return;
      clearInterval(handle);
      intervals.delete(handle);
      queueMicrotask(check);
    }) as typeof clearInterval,
  };

  return {
    bindings,
    idle: () =>
      new Promise<void>((resolve) => {
        notify = resolve;
        // Let already-queued promise callbacks schedule their timers first.
        setTimeout(check, 0);
      }),
    clearAll: () => {
      timeouts.forEach((h) => clearTimeout(h));
      intervals.forEach((h) => clearInterval(h));
      timeouts.clear();
      intervals.clear();
    },
  };
}
