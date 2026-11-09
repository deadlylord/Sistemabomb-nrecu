import { auth } from '../firebase';
import { beginDiagnosticPhase, finishDiagnosticPhase, readMeasurementActive, attachServerApprovalTiming } from './readDiagnostics';
export const serverTransferApprovalEnabled = import.meta.env?.VITE_APP_ENV === 'staging' && import.meta.env?.VITE_SERVER_TRANSFER_APPROVAL === 'true';
export async function callServerTransferApproval(companyId: string, storeId: string, incidentId: string) {
  if (!serverTransferApprovalEnabled || auth.app.options.projectId !== 'vestika-staging') throw new Error('La aprobación de prueba no está habilitada en este entorno.');
  const ticket = beginDiagnosticPhase('Novedades: aprobación en servidor');
  try {
    const sdk = await import('firebase/functions');
    const result = (await sdk.httpsCallable(sdk.getFunctions(auth.app, 'southamerica-east1'), 'vestikaStagingApproveTransfer', {timeout:60000})({companyId,storeId,incidentId,...(readMeasurementActive() ? {diagnostics:true} : {})})).data as any;
    if (result?.processed !== true) throw new Error('No se recibió confirmación. Revisa el estado de la solicitud.');
    finishDiagnosticPhase(ticket); attachServerApprovalTiming(ticket, result.diagnostics);
    return result;
  } catch (error) { finishDiagnosticPhase(ticket,true,error); throw error; }
}
