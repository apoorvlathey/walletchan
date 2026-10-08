export interface PrivacyAspRootPair {
  mtRoot: string;
  onchainMtRoot: string;
}

/** One immutable snapshot per deployment; root reads remain fresh on every call. */
export function createRootSnapshotCache<R extends PrivacyAspRootPair, T>(dependencies: {
  readRoots: () => Promise<R>;
  load: (roots: R) => Promise<T>;
}) {
  let cached: { key: string; data: T } | undefined;
  let active: Promise<{ roots: R; data: T }> | undefined;
  let generation = 0;
  const key = (roots: R) => `${roots.mtRoot}:${roots.onchainMtRoot}`;

  async function refresh(): Promise<{ roots: R; data: T }> {
    const epoch = generation;
    // The ASP publishes roots and leaves separately. Retry one moving snapshot,
    // never install leaves fetched across a root change.
    for (let attempt = 0; attempt < 2; attempt++) {
      const roots = await dependencies.readRoots();
      if (epoch !== generation) throw new Error("ASP snapshot invalidated");
      if (cached?.key === key(roots)) return { roots, data: cached.data };
      const data = await dependencies.load(roots);
      const after = await dependencies.readRoots();
      if (epoch !== generation) throw new Error("ASP snapshot invalidated");
      if (key(roots) !== key(after)) continue;
      cached = { key: key(after), data };
      return { roots: after, data };
    }
    throw new Error("ASP snapshot changed during verification");
  }

  return {
    get(): Promise<{ roots: R; data: T }> {
      if (!active) {
        const pending = refresh();
        active = pending;
        void pending.finally(() => {
          if (active === pending) active = undefined;
        }).catch(() => undefined);
      }
      return active;
    },
    clear(): void {
      generation++;
      cached = undefined;
      active = undefined;
    },
  };
}
