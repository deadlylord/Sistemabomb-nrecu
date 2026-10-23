import { useEffect, useState } from "react";
import {
  collection,
  doc,
  documentId,
  onSnapshot,
  orderBy,
  query,
  where,
} from "./measuredFirestore";
import { db } from "../firebase";
import {
  businessRoot,
  emptyBusinessDay,
  mergeBusinessDay,
} from "../functions/src/businessSummary.mjs";
export type SummaryDay = Omit<
  ReturnType<typeof emptyBusinessDay>,
  "methods" | "sellers"
> & {
  methods: Record<string, number>;
  sellers: Record<string, number>;
  date?: string;
};
export type BusinessRoot = {
  companyId: string;
  storeId: string;
  schemaVersion: number;
  ready: boolean;
  inventoryValue: number;
  inventoryUnits: number;
  updatedAt?: string;
};
export function useBusinessSummary(
  companyId: string,
  storeId: string,
  start: string,
  end: string,
  year: number | null,
  scope: string,
) {
  const key = `${scope}:${companyId}:${storeId}`;
  const [metadata, setMetadata] = useState<{
    key: string;
    value: BusinessRoot | null;
  }>({ key: "", value: null });
  const [days, setDays] = useState<{ key: string; rows: SummaryDay[] }>({
    key: "",
    rows: [],
  });
  const [months, setMonths] = useState<{ key: string; rows: any[] }>({
    key: "",
    rows: [],
  });
  const [repeats, setRepeats] = useState<{ key: string; rows: any[] }>({
    key: "",
    rows: [],
  });
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const root = businessRoot(companyId, storeId);
  const meta = metadata.key === key ? metadata.value : null;
  const ready = meta?.ready && meta.schemaVersion === 1;
  const rangeKey = `${key}:${start}:${end}`;
  const monthKey = `${key}:${year}`;
  useEffect(() => {
    if (!companyId || !storeId) return;
    setFailure(null);
    return onSnapshot(
      doc(db, root),
      (s) => {
        const value = s.exists() ? (s.data() as BusinessRoot) : null;
        if (
          value &&
          (value.companyId !== companyId || value.storeId !== storeId)
        ) {
          setFailure({
            key,
            message: "No se pudo verificar la sede del resumen.",
          });
          return;
        }
        setMetadata({ key, value });
      },
      () =>
        setFailure({
          key,
          message:
            "No se pudo cargar el resumen. Revisa la conexión y vuelve a abrir esta vista.",
        }),
    );
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    const stops = [
      onSnapshot(
        query(
          collection(db, root + "/days"),
          where(documentId(), ">=", start),
          where(documentId(), "<=", end),
        ),
        (s) => {
          const rows = s.docs.map(
            (d) => ({ ...d.data(), date: d.id }) as SummaryDay,
          );
          setDays({ key: rangeKey, rows });
        },
        () =>
          setFailure({
            key,
            message: "No se pudo consultar el período. Intenta nuevamente.",
          }),
      ),
    ];
    if (start !== end)
      stops.push(
        onSnapshot(
          query(
            collection(db, root + "/repeats"),
            where("lastDay", ">=", start),
            where("firstDay", "<=", end),
            orderBy("lastDay"),
            orderBy("firstDay"),
          ),
          (s) =>
            setRepeats({ key: rangeKey, rows: s.docs.map((d) => d.data()) }),
          () =>
            setFailure({
              key,
              message: "No se pudo verificar el número de ventas del período.",
            }),
        ),
      );
    else setRepeats({ key: rangeKey, rows: [] });
    return () => stops.forEach((stop) => stop());
  }, [rangeKey, ready]);
  useEffect(() => {
    if (!ready || year === null) return;
    return onSnapshot(
      query(
        collection(db, root + "/months"),
        where(documentId(), ">=", `${year}-01`),
        where(documentId(), "<=", `${year}-12`),
      ),
      (s) =>
        setMonths({
          key: monthKey,
          rows: s.docs.map((d) => ({ ...d.data(), month: d.id })),
        }),
      () =>
        setFailure({ key, message: "No se pudo cargar el gráfico del año." }),
    );
  }, [monthKey, ready]);
  const rows = days.key === rangeKey ? days.rows : [];
  function total(from: string, to: string): SummaryDay {
    const value = emptyBusinessDay() as SummaryDay;
    for (const row of rows)
      if (row.date! >= from && row.date! <= to) mergeBusinessDay(value, row);
    // Daily counts are unique per invoice. An invoice paid on several days
    // remains ONE transaction when those days are combined into a period.
    for (const repeated of repeats.key === rangeKey ? repeats.rows : []) {
      const count = repeated.days.filter(
        (day: string) => day >= from && day <= to,
      ).length;
      value.invoices -= Math.max(0, count - 1);
    }
    return value;
  }
  return {
    meta,
    ready,
    total,
    days: rows,
    months: months.key === monthKey ? months.rows : [],
    loading:
      metadata.key !== key ||
      (ready &&
        (days.key !== rangeKey ||
          repeats.key !== rangeKey ||
          (year !== null && months.key !== monthKey))),
    error: failure?.key === key ? failure.message : null,
  };
}
