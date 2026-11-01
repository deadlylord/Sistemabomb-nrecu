import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from './measuredFirestore';
import { DEFAULT_COMPANY_ID, IncidentStatus, IncidentType, type Sale } from '../types';

// Read only the exchanges linked to this invoice, only while its editor is open.
export function useSaleExchangePayments(sale: Sale, enabled: boolean) {
  const companyId = sale.companyId || DEFAULT_COMPANY_ID;
  const key = JSON.stringify([companyId, sale.storeId, sale.id]);
  const [state, setState] = useState({ key: '', amount: 0, error: '', ready: false });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setState({ key, amount: 0, error: '', ready: false });
    const stop = onSnapshot(query(collection(db, 'incidents'), where('companyId', '==', companyId), where('storeId', '==', sale.storeId), where('originalSaleId', '==', sale.id)), snapshot => {
      if (!active) return;
      try {
        let amount = 0;
        for (const document of snapshot.docs) {
          const incident = document.data();
          if (incident.companyId !== companyId || incident.storeId !== sale.storeId || incident.originalSaleId !== sale.id) throw new Error('La novedad no corresponde a esta factura.');
          if (incident.type !== IncidentType.PRODUCT_EXCHANGE || incident.status !== IncidentStatus.CAMBIO_PROCESADO) continue;
          const paid = Number(incident.adjustmentAmount || 0);
          if (!Number.isFinite(paid) || paid < 0 || paid > 0 && !incident.paymentMethod) throw new Error('Revisa los pagos de las novedades de esta factura.');
          amount += paid;
        }
        setState({ key, amount: Math.round(amount * 100) / 100, error: '', ready: true });
      } catch (error) {
        setState({ key, amount: 0, error: error instanceof Error ? error.message : 'No se pudieron verificar los excedentes.', ready: false });
      }
    }, () => { if (active) setState({ key, amount: 0, error: 'No se pudieron verificar los excedentes. Cierra y vuelve a abrir la factura.', ready: false }); });
    return () => { active = false; stop(); };
  }, [enabled, key, companyId, sale.id, sale.storeId]);
  return state.key === key ? state : { amount: 0, error: '', ready: false };
}
