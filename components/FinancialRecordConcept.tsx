import React from 'react';
import type { FinancialRecord, Store } from '../types';
import { financialRecordPresentation } from '../services/financialRecordPresentation';

export default function FinancialRecordConcept({ record, stores }: {
  record: Pick<FinancialRecord, 'description' | 'subCategory' | 'amount' | 'debtStoreId'>;
  stores: Pick<Store, 'id' | 'name'>[];
}) {
  const view = financialRecordPresentation(record, stores);
  return <div className="min-w-0 space-y-1 text-left normal-case">
    {view.label && <span className="inline-block rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] sm:text-xs font-bold text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200 break-words">{view.label}</span>}
    {view.description !== view.label && <p className="font-semibold break-words text-gray-800 dark:text-gray-200">{view.description}</p>}
    {view.detail && <details onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
      <summary className="cursor-pointer text-[10px] sm:text-xs font-semibold text-blue-700 dark:text-blue-300 py-1">Ver detalle del pago</summary>
      <p className="whitespace-pre-wrap break-words text-xs font-normal text-gray-600 dark:text-gray-300">{view.detail}</p>
    </details>}
  </div>;
}
