import { performance } from 'node:perf_hooks';
import { authenticateIdentity } from './identity.mjs';

// Only used by the staging endpoint. No document IDs, values or credentials.
export async function authenticateStagingLogin(input, dependencies, enabled = false) {
  if (!enabled) return authenticateIdentity(input, dependencies);
  const started = performance.now(), phases = [];
  const result = await authenticateIdentity(input, {
    ...dependencies,
    measure: async (phase, run) => {
      const start = performance.now();
      const value = await run();
      phases.push({ phase, durationMs: performance.now() - start });
      return value;
    }
  });
  // Failed attempts keep the existing generic error, without timing details.
  return { ...result, loginDiagnostics: { version: 1, totalMs: performance.now() - started, phases } };
}
