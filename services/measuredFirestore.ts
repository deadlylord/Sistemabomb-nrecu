import * as sdk from 'firebase/firestore';
import { beginObservedRead, finishObservedRead, listenerOpened, observeListenerError, observeListenerSnapshot,
  observeTransactionAttempt, readMeasurementActive, safeReadResource, measureDiagnosticPhase } from './readDiagnostics';
export * from 'firebase/firestore';

const queryPaths = new WeakMap<object, string>();
const resource = (target: any): string => target?.path ? safeReadResource(target.path) : queryPaths.get(target) || 'Consulta sin ruta';
export const query: typeof sdk.query = ((base: any, ...constraints: any[]) => {
  const result = (sdk.query as any)(base, ...constraints);
  queryPaths.set(result, resource(base)); return result;
}) as typeof sdk.query;
export const collectionGroup: typeof sdk.collectionGroup = ((db: any, id: string) => {
  const result = sdk.collectionGroup(db, id); queryPaths.set(result, `Grupo: ${id}`); return result;
}) as typeof sdk.collectionGroup;

function measuredRead(fn: (...args: any[]) => Promise<any>, operation: string) {
  return async (...args: any[]) => {
    const ticket = beginObservedRead(resource(args[0]), operation);
    try { const result = await fn(...args); finishObservedRead(ticket, operation === 'Agregación' ? undefined : result); return result; }
    catch (error) { finishObservedRead(ticket, undefined, true); throw error; }
  };
}
export const getDoc = measuredRead(sdk.getDoc, 'Documento') as typeof sdk.getDoc;
export const getDocs = measuredRead(sdk.getDocs, 'Consulta') as typeof sdk.getDocs;
export const getDocFromServer = measuredRead(sdk.getDocFromServer, 'Documento servidor') as typeof sdk.getDocFromServer;
export const getDocsFromServer = measuredRead(sdk.getDocsFromServer, 'Consulta servidor') as typeof sdk.getDocsFromServer;
export const getAggregateFromServer = measuredRead(sdk.getAggregateFromServer, 'Agregación') as typeof sdk.getAggregateFromServer;

// Keep the SDK's original options and callback delivery. We deliberately do not
// request metadata-only events or resubscribe just to improve these observations.
export const onSnapshot: typeof sdk.onSnapshot = ((...args: any[]) => {
  const path = resource(args[0]);
  const index = args[1] && typeof args[1] === 'object' && !('next' in args[1] || 'error' in args[1] || 'complete' in args[1]) ? 2 : 1;
  const callback = args[index];
  if (typeof callback === 'function') {
    args[index] = (snapshot: any) => { observeListenerSnapshot(path, snapshot); callback(snapshot); };
    const onError = args[index + 1];
    if (onError) args[index + 1] = (error: any) => { observeListenerError(path); onError(error); };
  } else if (callback) {
    args[index] = { ...callback,
      ...(callback.next ? { next: (s: any) => { observeListenerSnapshot(path, s); callback.next.call(callback, s); } } : {}),
      ...(callback.error ? { error: (e: any) => { observeListenerError(path); callback.error.call(callback, e); } } : {}),
      ...(callback.complete ? { complete: () => callback.complete.call(callback) } : {}) };
  }
  const close = listenerOpened();
  try { const unsubscribe = (sdk.onSnapshot as any)(...args); return () => { close(); unsubscribe(); }; }
  catch (error) { close(); throw error; }
}) as typeof sdk.onSnapshot;

export const runTransaction: typeof sdk.runTransaction = ((db: any, callback: any, options?: any) => {
  if (!readMeasurementActive()) return sdk.runTransaction(db, callback, options);
  return measureDiagnosticPhase('Transacción completa', () => sdk.runTransaction(db, async transaction => {
    observeTransactionAttempt();
    const proxy = new Proxy(transaction, { get(target, key) {
      if (key === 'get') return (ref: any) => measuredRead(target.get.bind(target), 'Transacción/get')(ref);
      const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
    } });
    return measureDiagnosticPhase('Callback de transacción', () => callback(proxy));
  }, options));
}) as typeof sdk.runTransaction;
