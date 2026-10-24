// Local, opt-in observations. These counters are NOT Firestore billing metrics.
// Never retain result document data/IDs, filters, credentials or snapshots.
// Context includes the selected company/store IDs, not result ownership.
export type ReadContext = { view: string; companyId: string; storeId: string };
export type ReadRow = ReadContext & { resource: string; operation: string; requests: number; errors: number;
  snapshots: number; serverChanges: number; cacheChanges: number; pendingChanges: number;
  unknownChanges: number; largestResult: number; missing: number; totalMs: number };
type Session = { id: number; label: string; startedAt: string; stoppedAt?: string; active: boolean;
  initialListeners: number; listenerStarts: number; listenerStops: number; transactionAttempts: number;
  droppedGroups: number; droppedTimings: number };
export type DiagnosticPhase = 'Login: cargar módulo de acceso' | 'Login: preparar Firebase' | 'Login: cerrar sesión previa' | 'Inicio de sesión: verificar acceso' | 'Login: cargar aplicación' | 'Login: servicio de identidad' | 'Login: autenticar en Firebase' | 'Login: validar identidad' | 'Guardar conciliación: hasta confirmación en cliente' | 'Transacción completa' | 'Callback de transacción' | 'Comprobar registro previo' | 'Lecturas de documentos' | 'Preparar movimientos' | 'Validar empresa y referencias' | 'Borrador: comprobar productos' | 'Borrador: validar y guardar';
type Timing = ReadContext & { id: number; phase: DiagnosticPhase; startOffsetMs: number; durationMs: number; status: 'running' | 'success' | 'error' | 'incomplete'; errorCode?: string };
const timings: Timing[] = [];
let sessionStarted = 0;
let context: ReadContext = { view: 'Inicio', companyId: '', storeId: '' };
let session: Session | null = null;
let nextId = 0, revision = 0, cachedRevision = -1;
const rows = new Map<string, ReadRow>();
const listeners = new Set<number>();
const subscribers = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let cached: ReturnType<typeof buildSnapshot>;
function buildSnapshot() { return { session: session ? { ...session } : null, rows: [...rows.values()].map(r => ({ ...r })), activeListeners: listeners.size, timings: timings.map(t => ({ ...t })) }; }
function changed(immediate = false) {
  revision++;
  if (!subscribers.size) return;
  const notify = () => { timer = undefined; subscribers.forEach(fn => fn()); };
  if (immediate) { if (timer) clearTimeout(timer); notify(); }
  else if (!timer) timer = setTimeout(notify, 100);
}
export function subscribeReadDiagnostics(fn: () => void) { subscribers.add(fn); return () => { subscribers.delete(fn); }; }
export function getReadDiagnostics() { if (revision !== cachedRevision) { cached = buildSnapshot(); cachedRevision = revision; } return cached; }
export function setReadContext(value: ReadContext) { context = value; }
export function startReadMeasurement(label: string) {
  rows.clear(); timings.length = 0; sessionStarted = performance.now(); session = { id: ++nextId, label: label.trim().slice(0, 100) || 'Medición', startedAt: new Date().toISOString(),
    active: true, initialListeners: listeners.size, listenerStarts: 0, listenerStops: 0, transactionAttempts: 0, droppedGroups: 0, droppedTimings: 0 };
  changed(true);
}
export function stopReadMeasurement() { if (session?.active) { for (const t of timings) if (t.status === 'running') { t.status = 'incomplete'; t.durationMs = performance.now() - sessionStarted - t.startOffsetMs; } session = { ...session, active: false, stoppedAt: new Date().toISOString() }; changed(true); } }
export function clearReadMeasurement() { if (!session && !rows.size) return; session = null; rows.clear(); timings.length = 0; changed(true); }
export function readMeasurementActive() { return !!session?.active; }
export function safeReadResource(path: string) { return path.split('/').map((part, i) => i % 2 ? '*' : part).join('/'); }
function rowFor(resource: string, operation: string, ctx: ReadContext) {
  const key = JSON.stringify([ctx.view, ctx.companyId, ctx.storeId, resource, operation]);
  let row = rows.get(key);
  if (!row) {
    if (rows.size >= 500) { session!.droppedGroups++; changed(); return; }
    row = { ...ctx, resource, operation, requests: 0, errors: 0, snapshots: 0, serverChanges: 0,
      cacheChanges: 0, pendingChanges: 0, unknownChanges: 0, largestResult: 0, missing: 0, totalMs: 0 };
    rows.set(key, row);
  }
  return row;
}
export function beginObservedRead(resource: string, operation: string) {
  if (!session?.active) return undefined;
  const ticket = { sessionId: session.id, resource, operation, context: { ...context }, started: performance.now() };
  const row = rowFor(resource, operation, ticket.context); if (row) row.requests++;
  changed(); return ticket;
}
export function finishObservedRead(ticket: ReturnType<typeof beginObservedRead>, snapshot?: any, error = false) {
  if (!ticket || !session?.active || ticket.sessionId !== session.id) return;
  const row = rowFor(ticket.resource, ticket.operation, ticket.context); if (!row) return;
  row.totalMs += performance.now() - ticket.started;
  if (error) row.errors++;
  else if (snapshot) observeSnapshot(row, snapshot);
  changed();
}
function observeSnapshot(row: ReadRow, snapshot: any) {
  const size = typeof snapshot.size === 'number' ? snapshot.size : snapshot.exists?.() ? 1 : 0;
  const changes = snapshot.docChanges ? snapshot.docChanges().filter((c: any) => c.type !== 'removed').length : size;
  row.snapshots++; row.largestResult = Math.max(row.largestResult, size);
  if (!size) row.missing++;
  if (snapshot.metadata?.hasPendingWrites) row.pendingChanges += changes;
  else if (snapshot.metadata?.fromCache === true) row.cacheChanges += changes;
  else if (snapshot.metadata?.fromCache === false) row.serverChanges += changes;
  else row.unknownChanges += changes;
}
export function observeListenerSnapshot(resource: string, snapshot: any) {
  if (!session?.active) return;
  const row = rowFor(resource, 'Listener', context); if (row) observeSnapshot(row, snapshot);
  changed();
}
export function observeListenerError(resource: string) {
  if (!session?.active) return;
  const row = rowFor(resource, 'Listener', context); if (row) row.errors++;
  changed();
}
export function listenerOpened() {
  const id = ++nextId; listeners.add(id);
  if (session?.active) session.listenerStarts++;
  changed(); return () => {
    if (!listeners.delete(id)) return;
    if (session?.active) session.listenerStops++;
    changed();
  };
}
export function observeTransactionAttempt() { if (session?.active) { session.transactionAttempts++; changed(); } }

// Fixed phase labels only: no records, amounts, IDs, messages or return values.
export function beginDiagnosticPhase(phase: DiagnosticPhase) {
  if (!session?.active) return undefined;
  if (timings.length >= 200) { session.droppedTimings++; changed(); return undefined; }
  const started = performance.now();
  const timing: Timing = { ...context, id: ++nextId, phase, startOffsetMs: started - sessionStarted, durationMs: 0, status: 'running' };
  timings.push(timing); changed();
  return { sessionId: session.id, started, timing };
}
const diagnosticErrorCodes = new Set(['permission-denied', 'unauthenticated', 'unavailable', 'deadline-exceeded', 'aborted', 'resource-exhausted', 'failed-precondition', 'invalid-argument', 'not-found', 'already-exists', 'cancelled', 'internal', 'unknown', 'data-loss', 'unimplemented']);
export function safeDiagnosticErrorCode(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code.replace(/^firestore\//, '') : '';
  return diagnosticErrorCodes.has(code) ? code : undefined;
}
export function finishDiagnosticPhase(ticket: ReturnType<typeof beginDiagnosticPhase>, error = false, cause?: unknown) {
  if (!ticket || !session?.active || ticket.sessionId !== session.id) return;
  ticket.timing.durationMs = performance.now() - ticket.started;
  ticket.timing.status = error ? 'error' : 'success';
  const code = error ? safeDiagnosticErrorCode(cause) : undefined;
  if (code) ticket.timing.errorCode = code;
  changed();
}
export function measureDiagnosticPhase<T>(phase: DiagnosticPhase, run: () => Promise<T>): Promise<T> {
  const ticket = beginDiagnosticPhase(phase);
  if (!ticket) return run();
  try {
    return run().then(value => { finishDiagnosticPhase(ticket); return value; }, error => { finishDiagnosticPhase(ticket, true, error); throw error; });
  } catch (error) { finishDiagnosticPhase(ticket, true, error); throw error; }
}
