import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, getDoc, getDocs, getAggregateFromServer, sum, limit, onSnapshot, orderBy, query, startAfter, where } from 'firebase/firestore';
import { db } from '../firebase';
import { assertTenantData } from './tenantWrites';
import { useCompanyCollection } from './useCompanyCollection';
import type { FinancialRecord } from '../types';

export const LEDGER_PAGE_SIZE = 50;
export type LedgerSummary = { companyId: string; storeId: string; schemaVersion: number; ready: boolean; revision?: number;
  accounts: Record<string, number>; peers: Record<string, { total: number; cash: number; qr: number; count: number }>; count: number };
const rootPath = (companyId: string, storeId: string) => `financialLedgerCompanies/${companyId}/stores/${storeId}`;
const enabled = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_FINANCIAL_LEDGER_INDEXED === 'true';

// The indexed path is used only AFTER server-side verification/backfill. Until
// then, the existing source of truth is kept, scoped to the active store.
export function useFinancialLedger({ companyId, storeId, storeIds, scopeKey, accountType, month, showGlobal, showClosures = false, search, rangeStart, rangeEnd, setRows }: {
  companyId: string; storeId: string; storeIds: string[]; scopeKey: string; accountType: string; month: string; showGlobal: boolean;
  showClosures?: boolean; search: string; rangeStart: string; rangeEnd: string; setRows: (value: FinancialRecord[]) => void;
}) {
  const key = `${scopeKey}:${storeId}`;
  const accountKey = `${key}:${accountType}`;
  const currentKey = useRef(key); currentKey.current = key;
  const peerRequest = useRef(new Map<string, number>());
  const [metadata, setMetadata] = useState<{ key: string; value: LedgerSummary | null }>({ key: '', value: null });
  const [monthly, setMonthly] = useState<{ key: string; rows: FinancialRecord[]; value: any }>({ key: '', rows: [], value: null });
  const [account, setAccount] = useState<{ key: string; rows: FinancialRecord[]; cursor?: any; more: boolean; newerTotal?: number }>({ key: '', rows: [], more: false });
  const [peers, setPeers] = useState<{ key: string; rows: FinancialRecord[]; pages: Record<string, { cursor?: any; more: boolean }> }>({ key: '', rows: [], pages: {} });
  const [peerReading, setPeerReading] = useState<Record<string, boolean>>({});
  const [globalMetadata, setGlobalMetadata] = useState<{ key: string; values: Record<string, LedgerSummary | null> }>({ key: '', values: {} });
  const [legacyRows, setLegacyRows] = useState<FinancialRecord[]>([]);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [closureKey, setClosureKey] = useState('');
  const summary = metadata.key === key ? metadata.value : null;
  const indexed = !!summary?.ready && summary.schemaVersion === 1;
  const scope = useMemo(() => ({ companyId, storeIds: new Set(storeIds) }), [companyId, JSON.stringify(storeIds)]);
  const allowed = scope.storeIds.has(storeId);
  const validate = useCallback((rows: any[]) => rows.filter(row => {
    try { assertTenantData('financialRecords', row, scope); return row.storeId === storeId; } catch { return false; }
  }) as FinancialRecord[], [scope, storeId]);
  const globals = globalMetadata.key === scopeKey && showGlobal ? globalMetadata.values : {};
  useEffect(() => {
    for (const [id, request] of peerRequest.current) peerRequest.current.set(id, request + 1);
    setPeers({ key, rows: [], pages: {} });
    setPeerReading({});
  }, [key, indexed, summary?.revision]);
  const legacyStores = (showGlobal ? storeIds : [storeId]).filter(id => {
    if (!scope.storeIds.has(id)) return false;
    if (!enabled) return true;
    if (id === storeId) return metadata.key === key && !indexed;
    return Object.prototype.hasOwnProperty.call(globals, id) && !globals[id]?.ready;
  });
  useCompanyCollection('financialRecords', legacyStores, scopeKey, legacyStores.length > 0, setLegacyRows, storeIds);

  useEffect(() => {
    if (!enabled || !allowed) return;
    setError('');
    return onSnapshot(doc(db, rootPath(companyId, storeId)), snapshot => {
      const value = snapshot.exists() ? snapshot.data() as LedgerSummary : null;
      if (value && (value.companyId !== companyId || value.storeId !== storeId)) { setError('No se pudo verificar la sede del libro.'); return; }
      setMetadata({ key, value });
    }, () => { setMetadata({ key, value: null }); setError('Se está usando el libro histórico porque no se pudo cargar el resumen.'); });
  }, [key, allowed]);

  useEffect(() => {
    if (!indexed || !allowed) return;
    const monthKey = `${key}:${month}`;
    const base = `${rootPath(companyId, storeId)}/months/${month}`;
    const stopSummary = onSnapshot(doc(db, base), snapshot => {
      const value = snapshot.exists() && snapshot.data().companyId === companyId && snapshot.data().storeId === storeId ? snapshot.data() : null;
      setMonthly(previous => ({ key: monthKey, rows: previous.key === monthKey ? previous.rows : [], value }));
    }, () => setError('No se pudo cargar el resumen del mes.'));
    return stopSummary;
  }, [key, month, indexed, allowed, validate]);

  useEffect(() => {
    setClosureKey('');
    if (!indexed || !allowed || !showClosures) return;
    const monthKey = `${key}:${month}`;
    return onSnapshot(query(collection(db, `${rootPath(companyId, storeId)}/months/${month}/entries`), orderBy('ledgerTime', 'desc')), snapshot => {
      const rows = validate(snapshot.docs.map(d => ({ ...d.data(), id: d.id })));
      setMonthly(previous => ({ key: monthKey, rows, value: previous.key === monthKey ? previous.value : null }));
      setClosureKey(monthKey);
    }, () => setError('No se pudieron cargar los movimientos del mes.'));
  }, [key, month, indexed, allowed, showClosures, validate]);

  useEffect(() => {
    if (!indexed || !allowed || search || rangeStart || rangeEnd) return;
    const base = collection(db, `${rootPath(companyId, storeId)}/accounts/${accountType}/entries`);
    return onSnapshot(query(base, orderBy('ledgerTime', 'desc'), limit(LEDGER_PAGE_SIZE)), snapshot => {
      setAccount({ key: accountKey, rows: validate(snapshot.docs.map(d => ({ ...d.data(), id: d.id }))), cursor: snapshot.docs.at(-1), more: snapshot.size === LEDGER_PAGE_SIZE });
    }, () => setError('No se pudo cargar la página del libro.'));
  }, [accountKey, indexed, allowed, validate, search, rangeStart, rangeEnd]);

  useEffect(() => {
    if (!enabled || !showGlobal) return;
    const stops = storeIds.map(id => onSnapshot(doc(db, rootPath(companyId, id)), snapshot => {
      const value = snapshot.exists() ? snapshot.data() as LedgerSummary : null;
      if (value && (value.companyId !== companyId || value.storeId !== id)) return;
      setGlobalMetadata(previous => ({ key: scopeKey, values: { ...(previous.key === scopeKey ? previous.values : {}), [id]: value } }));
    }, () => { setGlobalMetadata(previous => ({ key: scopeKey, values: { ...(previous.key === scopeKey ? previous.values : {}), [id]: null } })); setError('No se pudo cargar el resumen de una sede.'); }));
    return () => stops.forEach(stop => stop());
  }, [scopeKey, JSON.stringify(storeIds), showGlobal]);

  const readAll = useCallback(async (path: string, filters: any[] = [], newerThan?: number) => {
    for (let attempt = 0; attempt < 3; attempt++) {
    const before = await getDoc(doc(db, rootPath(companyId, storeId)));
    const rows: FinancialRecord[] = [];
    let cursor: any;
    while (true) {
      const constraints: any[] = [...filters, orderBy('ledgerTime', 'desc')];
      if (cursor) constraints.push(startAfter(cursor));
      constraints.push(limit(200));
      const page = await getDocs(query(collection(db, path), ...constraints));
      rows.push(...validate(page.docs.map(d => ({ ...d.data(), id: d.id }))));
      if (page.size < 200) break;
      cursor = page.docs.at(-1);
    }
    const newerTotal = newerThan === undefined ? 0 : (await getAggregateFromServer(query(collection(db, path), where('ledgerTime', '>', newerThan)), { amount: sum('balanceAmount') })).data().amount || 0;
    const after = await getDoc(doc(db, rootPath(companyId, storeId)));
    if (before.exists() && after.exists() && before.data().revision === after.data().revision) return { rows, newerTotal };
    }
    throw new Error('El libro cambió durante la consulta. Inténtalo nuevamente.');
  }, [validate, companyId, storeId]);

  const readAccount = useCallback(() => {
    const filters: any[] = [];
    if (rangeStart) filters.push(where('ledgerTime', '>=', new Date(`${rangeStart}T00:00:00-05:00`).getTime()));
    const end = rangeEnd ? new Date(`${rangeEnd}T23:59:59.999-05:00`).getTime() : undefined;
    if (end !== undefined) filters.push(where('ledgerTime', '<=', end));
    return readAll(`${rootPath(companyId, storeId)}/accounts/${accountType}/entries`, filters, end);
  }, [key, accountType, readAll, rangeStart, rangeEnd]);
  // Full history is reserved for explicit exports. Opening a crossing reads
  // only one page, irrespective of the amount of accumulated history.
  const readPeer = useCallback(async (peerId: string) => {
    if (!indexed || !allowed || !scope.storeIds.has(peerId)) return [];
    const { rows } = await readAll(`${rootPath(companyId, storeId)}/peers/${peerId}/entries`);
    return rows;
  }, [key, indexed, allowed, scope, readAll]);
  const loadPeerPage = useCallback(async (peerId: string, append = false) => {
    if (!indexed || !allowed || !scope.storeIds.has(peerId)) return;
    const page = peers.key === key ? peers.pages[peerId] : undefined;
    if (append && (!page?.more || !page.cursor)) return;
    const request = (peerRequest.current.get(peerId) || 0) + 1; peerRequest.current.set(peerId, request);
    const readingKey = `${key}:${peerId}`;
    setPeerReading(previous => ({ ...previous, [readingKey]: true }));
    try {
      const base = collection(db, `${rootPath(companyId, storeId)}/peers/${peerId}/entries`);
      const constraints: any[] = [orderBy('ledgerTime', 'desc')];
      if (append) constraints.push(startAfter(page!.cursor));
      constraints.push(limit(LEDGER_PAGE_SIZE));
      const snapshot = await getDocs(query(base, ...constraints));
      if (currentKey.current !== key || peerRequest.current.get(peerId) !== request) return;
      const rows = validate(snapshot.docs.map(d => ({ ...d.data(), id: d.id }))).filter(row => row.debtStoreId === peerId);
      setPeers(previous => ({ key,
        rows: [...new Map([...(previous.key === key ? previous.rows.filter(row => append || row.debtStoreId !== peerId) : []), ...rows].map(row => [row.id, row])).values()],
        pages: { ...(previous.key === key ? previous.pages : {}), [peerId]: { cursor: snapshot.docs.at(-1), more: snapshot.size === LEDGER_PAGE_SIZE } }
      }));
    } finally {
      if (peerRequest.current.get(peerId) === request) setPeerReading(previous => ({ ...previous, [readingKey]: false }));
    }
  }, [key, indexed, allowed, scope, peers, validate]);
  const readAllPeers = useCallback(async () => {
    const ids = Object.keys(summary?.peers || {}).filter(id => scope.storeIds.has(id));
    const rows: FinancialRecord[] = [];
    // Limit concurrency: opening an export for 100 stores must not launch 100 reads at once.
    for (let i = 0; i < ids.length; i += 4) rows.push(...(await Promise.all(ids.slice(i, i + 4).map((id: string) => readPeer(id)))).flat() as FinancialRecord[]);
    return rows;
  }, [summary, scope, readPeer]);
  const loadMore = useCallback(async () => {
    if (!indexed || reading || account.key !== accountKey || !account.more || !account.cursor) return;
    setReading(true);
    try {
      const page = await getDocs(query(collection(db, `${rootPath(companyId, storeId)}/accounts/${accountType}/entries`), orderBy('ledgerTime', 'desc'), startAfter(account.cursor), limit(LEDGER_PAGE_SIZE)));
      const rows = validate(page.docs.map(d => ({ ...d.data(), id: d.id })));
      setAccount(previous => previous.key !== accountKey ? previous : { key: accountKey, rows: [...new Map([...previous.rows, ...rows].map(r => [r.id, r])).values()], cursor: page.docs.at(-1), more: page.size === LEDGER_PAGE_SIZE });
    } finally { setReading(false); }
  }, [indexed, account, accountKey, reading, validate]);
  useEffect(() => {
    if (!indexed || !(search || rangeStart || rangeEnd)) { setReading(false); return; }
    let current = true;
    const timer = setTimeout(() => {
      setReading(true);
      readAccount().then(({ rows, newerTotal }) => { if (current) setAccount({ key: accountKey, rows, newerTotal, more: false }); }).catch(() => { if (current) setError('No se pudo completar la búsqueda.'); }).finally(() => { if (current) setReading(false); });
    }, 300);
    return () => { current = false; clearTimeout(timer); };
  }, [accountKey, indexed, search, rangeStart, rangeEnd, summary?.revision]);

  useEffect(() => {
    if (!indexed) return;
    setAccount(previous => previous.key !== accountKey || previous.rows.length <= LEDGER_PAGE_SIZE ? previous :
      { ...previous, rows: previous.rows.slice(0, LEDGER_PAGE_SIZE), more: true });
  }, [accountKey, indexed, summary?.revision]);

  const activeRows = useMemo(() => {
    if (!indexed) return [];
    return [...(showClosures && monthly.key === `${key}:${month}` ? monthly.rows : []), ...(account.key === accountKey ? account.rows : [])];
  }, [indexed, monthly, account, key, accountKey, month, showClosures]);
  const legacyKey = JSON.stringify(legacyStores);
  useEffect(() => {
    const validLegacy = legacyRows.filter(row => legacyStores.includes(row.storeId));
    const merged = [...new Map([...validLegacy, ...activeRows].map(row => [row.id, row])).values()];
    setRows(merged);
  }, [legacyRows, legacyKey, activeRows, setRows]);
  return { indexed, loading: enabled && allowed && metadata.key !== key, closuresLoading: indexed && showClosures && closureKey !== `${key}:${month}`, summary, globals, month: monthly.key === `${key}:${month}` ? monthly.value : null,
    accountNewerTotal: account.key === accountKey ? account.newerTotal || 0 : 0,
    peerRows: peers.key === key ? peers.rows : [],
    accountRows: account.key === accountKey ? account.rows : [], hasMore: indexed && account.key === accountKey && account.more,
    peerHasMore: (peerId: string) => peers.key === key && !!peers.pages[peerId]?.more,
    peerLoading: (peerId: string) => !!peerReading[`${key}:${peerId}`],
    reading, error, loadMore, loadPeerPage, readAccount, readPeer, readAllPeers };
}
