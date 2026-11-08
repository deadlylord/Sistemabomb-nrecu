import { auth, db } from '../firebase';
import { doc, getDocFromServer, runTransaction } from './measuredFirestore';
import { measureDiagnosticPhase, readMeasurementActive, incidentApprovalInFlight, getReadDiagnostics } from './readDiagnostics';

export type FirstReadTarget = { companyId: string; storeId: string; incidentId: string };
let running = false;
export async function probeFirstRead(target: FirstReadTarget, isCurrent: () => boolean) {
  if (import.meta.env.VITE_APP_ENV !== 'staging' || db.app.options.projectId !== 'vestika-staging' || auth.app.options.projectId !== 'vestika-staging') throw new Error('La prueba solo está habilitada en Firebase staging.');
  if (running) throw new Error('La prueba ya está en curso.');
  if (Object.values(target).some(value => !value || value.includes('/'))) throw new Error('Abre Novedades y selecciona una sede con registros de prueba.');
  running = true;
  try {
    const measurementId = getReadDiagnostics().session?.id;
    const check = () => { if (incidentApprovalInFlight()) throw new Error('Espera a que termine la aprobación antes de medir.'); if (!isCurrent() || !readMeasurementActive() || getReadDiagnostics().session?.id !== measurementId) throw new Error('La sesión, sede o medición cambió.'); };
    check();
    await measureDiagnosticPhase('Primera lectura: restaurar Auth', () => auth.authStateReady());
    check();
    const signed = auth.currentUser;
    if (!signed) throw new Error('Inicia sesión para ejecutar la prueba.');
    const sameSession = () => { check(); if (auth.currentUser !== signed) throw new Error('La sesión cambió.'); };
    const token = await measureDiagnosticPhase('Primera lectura: obtener token disponible', () => signed.getIdTokenResult(false));
    sameSession();
    if (token.claims.identityVersion !== 1 || (token.claims.companyId !== target.companyId && token.claims.platformDeveloper !== true)) throw new Error('La identidad no corresponde a la empresa seleccionada.');
    const ref = doc(db, 'incidents', target.incidentId);
    const validate = (snapshot: any) => {
      sameSession();
      if (!snapshot.exists()) throw new Error('No se encontró el registro de prueba.');
      const data = snapshot.data();
      if (data.companyId !== target.companyId || data.storeId !== target.storeId) throw new Error('El registro no pertenece a la empresa y sede seleccionadas.');
    };
    const direct = async () => { sameSession(); validate(await getDocFromServer(ref)); };
    const transaction = async () => {
      sameSession();
      // This transaction never sets, updates or deletes business documents.
      await runTransaction(db, async tx => { sameSession(); validate(await tx.get(ref)); }, { maxAttempts: 1 });
      sameSession();
    };
    await measureDiagnosticPhase('Primera lectura: directa A', direct);
    await measureDiagnosticPhase('Primera lectura: transacción A', transaction);
    await measureDiagnosticPhase('Primera lectura: transacción B', transaction);
    await measureDiagnosticPhase('Primera lectura: directa B', direct);
  } finally { running = false; }
}
