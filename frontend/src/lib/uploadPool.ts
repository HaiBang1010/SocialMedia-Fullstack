// A tiny fixed-concurrency promise pool (Phase 5.4a, D3). Runs `worker` over `items` with at
// most `concurrency` in flight at once, preserving result order. No p-limit dependency.
//
// The worker is expected to CATCH its own per-item errors for UI purposes (patching a "failed"
// state) and then re-throw if it wants the whole batch to reject. A re-throw rejects the
// returned promise; workers already running keep going (Promise.all does not cancel them), so
// any that finish remain available for a later retry.
export async function runPool<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency = 3,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function runner(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]!, i);
    }
  }

  const lanes = Array.from({ length: Math.min(concurrency, items.length) }, () => runner());
  await Promise.all(lanes);
  return results;
}
