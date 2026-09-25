// A successful empty collection is cached too. Failed reads can be retried.
// reset() prevents a previous user's/company's delayed response from being applied.
export function createSessionLoader() {
  let generation = 0;
  const requests = new Map<string, Promise<void>>();
  return {
    load<T>(key: string, read: () => Promise<T>, apply: (value: T) => void): Promise<void> {
      const existing = requests.get(key);
      if (existing) return existing;
      const startedAt = generation;
      const request = Promise.resolve().then(read).then(value => {
        if (generation === startedAt) apply(value);
      }).catch(error => {
        if (generation === startedAt) requests.delete(key);
        throw error;
      });
      requests.set(key, request);
      return request;
    },
    reset() {
      generation += 1;
      requests.clear();
    }
  };
}
