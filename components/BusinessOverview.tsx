import React, { lazy, Suspense, useEffect, useState } from "react";
import type { Store } from "../types";
import { useBusinessSummary } from "../services/useBusinessSummary";
import { summaryName } from "../functions/src/businessSummary.mjs";
import { bogotaDateKey, completeChartYear } from "../services/incomeChart";
import { previousPeriod } from "../services/previousPeriod";
import { useViewFilter } from "../services/viewFilters";
import VestikaLoader from "./VestikaLoader";
import { COMMISSION_RATES } from "../constants";
import { ChevronLeftIcon, ChevronRightIcon } from "./Icons";
const SalesHistoryChart = lazy(() => import("./SalesHistoryChart"));
const cop = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
const tile =
  "min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm";
const StoreComparison: React.FC<{
  store: Store;
  companyId: string;
  start: string;
  end: string;
  scope: string;
}> = ({ store, companyId, start, end, scope }) => {
  const result = useBusinessSummary(
    companyId,
    store.id,
    start,
    end,
    null,
    scope,
  );
  return (
    <tr>
      <td className="p-3">{store.name}</td>
      <td className="p-3 text-right">
        {result.error
          ? "Error de conexión"
          : result.loading
            ? "Cargando…"
            : !result.ready
              ? "Resumen pendiente"
              : cop(result.total(start, end).income)}
      </td>
    </tr>
  );
};
export default function BusinessOverview({
  companyId,
  store,
  stores,
  scope,
  onOpenDetails,
  onOpenVerification,
  onSummaryUnavailable,
}: {
  companyId: string;
  store?: Store;
  stores: Store[];
  scope: string;
  onOpenDetails: (section?: string) => void;
  onOpenVerification: () => void;
  onSummaryUnavailable?: () => void;
}) {
  const today = bogotaDateKey(new Date());
  const [start, setStart] = useViewFilter("DashboardView:startDate", today);
  const [end, setEnd] = useViewFilter("DashboardView:endDate", today);
  const rangeStart = start || "1900-01-01",
    rangeEnd = end || today;
  const previous = previousPeriod(start, end);
  const localKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const previousStart = previous ? localKey(previous.start) : rangeStart,
    previousEnd = previous ? localKey(previous.end) : rangeStart;
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [metric, setMetric] = useState<"income" | "sales">("income");
  const [mode, setMode] = useState<"daily" | "monthly">("monthly");
  const [chartOpen, setChartOpen] = useState(false);
  const [compare, setCompare] = useState(false),
    [sellerUnits, setSellerUnits] = useState(false);
  const result = useBusinessSummary(
    companyId,
    store?.id || "",
    previousStart < rangeStart ? previousStart : rangeStart,
    rangeEnd,
    chartOpen && mode === "monthly" ? year : null,
    scope,
  );
  useEffect(() => {
    if (!result.loading && !result.error && !result.ready) onSummaryUnavailable?.();
  }, [result.loading, result.error, result.ready, onSummaryUnavailable]);
  const values = result.total(rangeStart, rangeEnd),
    before = result.total(previousStart, previousEnd);
  const dates = (a: string, b: string) => {
    setStart(a);
    setEnd(b);
  };
  const shift = (offset: number) => {
    const d = new Date(`${offset < 0 ? rangeStart : rangeEnd}T12:00:00-05:00`);
    d.setUTCDate(d.getUTCDate() + offset);
    const value = bogotaDateKey(d);
    dates(value, value);
  };
  const scrollToSection = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const setLast7Days = () => {
    const d = new Date(today + "T12:00:00-05:00");
    d.setUTCDate(d.getUTCDate() - 6);
    dates(bogotaDateKey(d), today);
  };
  const chartData =
    mode === "daily"
      ? result.days
          .filter((d) => d.date! >= rangeStart && d.date! <= rangeEnd)
          .map((d) => ({
            label: d.date!,
            total: d[metric],
            partialTotal: d[metric],
          }))
      : completeChartYear(
          result.months.map((month) => ({
            label: month.month,
            total: Object.values(month.days).reduce(
              (sum: number, day: any) => sum + (day[metric] || 0),
              0,
            ) as number,
            partialTotal: Object.entries(month.days).reduce(
              (sum, [date, day]: [string, any]) =>
                sum +
                (Number(date.slice(-2)) <= Number(today.slice(-2))
                  ? day[metric] || 0
                  : 0),
              0,
            ),
          })),
          year,
        );
  const cards = [
    ["Ventas cobradas", cop(values.salesCollected)],
    ["Unidades vendidas", String(Math.round(values.units))],
    ["Número de ventas", String(values.invoices)],
    [
      "Ticket promedio",
      cop(values.invoices ? values.salesCollected / values.invoices : 0),
    ],
    [
      "Prendas por venta",
      (values.invoices ? values.units / values.invoices : 0).toFixed(2),
    ],
    [
      "Margen bruto estimado",
      `${(values.salesCollected ? ((values.salesCollected - values.cogs) / values.salesCollected) * 100 : 0).toFixed(1)}%`,
    ],
    ["Valor del inventario", cop(result.meta?.inventoryValue || 0)],
    ["Utilidad neta estimada", cop(values.profit - values.expenses)],
  ];
  return (
    <div className="max-w-7xl mx-auto min-w-0 space-y-4 sm:space-y-8 overflow-x-clip pb-[calc(12rem+env(safe-area-inset-bottom))] lg:pb-0">
      {/* Mobile compact date controls and shortcuts, directly above bottom navigation. */}
      <div className="lg:hidden fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-[95] bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-700 shadow-lg px-2 py-1.5 space-y-1">
        <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto whitespace-nowrap pb-0.5">
          <button onClick={() => dates(today, today)} className="shrink-0 px-2.5 py-1.5 rounded-lg bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-200 text-xs font-bold">Hoy</button>

          <button onClick={setLast7Days} className="shrink-0 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold">Semana</button>
          <button onClick={() => dates(today.slice(0, 7) + "-01", today)} className="shrink-0 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold">Mes</button>

          <input aria-label="Fecha desde" type="date" value={start} onChange={e => setStart(e.target.value)} className="shrink-0 w-[115px] rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-1 py-1.5 text-xs" />
          <span className="text-xs text-slate-400">–</span>
          <input aria-label="Fecha hasta" type="date" value={end} onChange={e => setEnd(e.target.value)} className="shrink-0 w-[115px] rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-1 py-1.5 text-xs" />
          <div className="ml-auto flex shrink-0 items-center gap-1 rounded-xl border border-accent/20 bg-accent/10 p-0.5 shadow-sm"><button aria-label="Día anterior" onClick={() => shift(-1)} className="shrink-0 px-1.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"><ChevronLeftIcon className="w-4 h-4" /></button><button aria-label="Día siguiente" onClick={() => shift(1)} disabled={rangeEnd >= today} className="shrink-0 px-1.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-40"><ChevronRightIcon className="w-4 h-4" /></button></div>

        </div>
        <div className="flex items-center justify-between gap-1 overflow-x-auto whitespace-nowrap">
          <button onClick={() => scrollToSection('payment-report')} className="px-2 py-1 text-[11px] font-semibold text-accent">Pagos</button>
          <button onClick={() => onOpenDetails('price-analysis')} className="px-2 py-1 text-[11px] font-semibold text-accent">Precios</button>
          <button onClick={() => onOpenDetails('sales-history')} className="px-2 py-1 text-[11px] font-semibold text-accent">Historial</button>
          <button onClick={() => { setChartOpen(true); scrollToSection('sales-chart'); }} className="px-2 py-1 text-[11px] font-semibold text-accent">Gráficos</button>
          <button onClick={onOpenVerification} className="px-2 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-300">Inventario</button>
        </div>
      </div>
      <div className={`hidden lg:block ${tile}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold">Resumen del negocio</h1>
          <button
            className="text-sm font-bold text-accent"
            onClick={() => onOpenDetails()}
          >
            Historial y herramientas
          </button>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          {store?.name || "Selecciona una sede"}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            aria-label="Fecha inicial"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded-lg p-2 bg-slate-100 dark:bg-slate-900 min-w-0"
          />
          <input
            aria-label="Fecha final"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded-lg p-2 bg-slate-100 dark:bg-slate-900 min-w-0"
          />
          <button
            onClick={() => shift(-1)}
            aria-label="Día anterior"
            className="px-3 py-2"
          >
            ‹
          </button>
          <button
            onClick={() => shift(1)}
            disabled={rangeEnd >= today}
            aria-label="Día siguiente"
            className="px-3 py-2 disabled:opacity-30"
          >
            ›
          </button>
        </div>
        <div className="mt-2 flex gap-3 text-sm font-semibold">
          <button onClick={() => dates(today, today)}>Hoy</button>
          <button
            onClick={() => {
              const d = new Date(today + "T12:00:00-05:00");
              d.setUTCDate(d.getUTCDate() - 6);
              dates(bogotaDateKey(d), today);
            }}
          >
            Semana
          </button>
          <button onClick={() => dates(today.slice(0, 7) + "-01", today)}>
            Mes
          </button>
          <button onClick={() => dates("", "")}>Todo</button>
        </div>
      </div>
      {result.error ? (
        <div role="alert" className={tile}>
          {result.error}
          <button
            className="ml-2 text-accent"
            onClick={() => window.location.reload()}
          >
            Reintentar
          </button>
        </div>
      ) : result.loading ? (
        <VestikaLoader />
      ) : !result.ready ? (
        <div role="status" className={tile}>
          El resumen de esta sede está pendiente de verificación. Puedes
          consultar sus datos en{" "}
          <button className="text-accent font-bold" onClick={() => onOpenDetails()}>
            Historial y herramientas
          </button>
          .
        </div>
      ) : (
        <>
          <div id="payment-report" className={tile}>
            <h1 className="text-2xl font-bold text-accent mb-4">Resumen del negocio</h1>
            <p className="text-sm text-slate-500 mb-3">{store?.name}</p>
            <p className="text-sm font-semibold text-accent">
              Ingresos del período
            </p>
            <p className="text-3xl font-extrabold mt-1">{cop(values.income)}</p>
            {previous && (
              <p className="mt-2 text-xs text-slate-500">
                Período anterior ({previousStart} a {previousEnd}):{" "}
                {cop(before.income)}
                {before.income !== 0
                  ? ` · ${(((values.income - before.income) / Math.abs(before.income)) * 100).toFixed(1)}%`
                  : ""}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Días completos, horario de Colombia. Incluye abonos y recaudos
              recibidos.
            </p>
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {cards.map(([name, value]) => (
              <div key={name} className={tile}>
                <p className="text-[10px] sm:text-xs font-bold uppercase text-slate-500">
                  {name}
                </p>
                <p className="mt-1 text-lg sm:text-xl font-extrabold break-words">
                  {value}
                </p>
                {name === "Unidades vendidas" && (
                  <button
                    className="text-xs text-accent mt-1"
                    onClick={() => setSellerUnits(!sellerUnits)}
                  >
                    Ver por vendedor
                  </button>
                )}
              </div>
            ))}
          </div>
          {sellerUnits && (
            <div className={tile}>
              {Object.entries(values.sellers)
                .sort((a, b) => b[1] - a[1])
                .map(([name, units]) => (
                  <p key={name} className="flex justify-between py-1">
                    <span>{summaryName(name)}</span>
                    <strong>{units}</strong>
                  </p>
                ))}
            </div>
          )}
          <div className={tile}>
            <h2 className="font-bold mb-2">Medios de pago</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(values.methods).map(([method, amount]) => (
                <div key={method}>
                  <p className="text-xs text-slate-500">
                    {summaryName(method) === "Efectivo" ? "Efectivo (ingresos)" : summaryName(method)}
                  </p>
                  <strong className="text-sm">{cop(amount)}</strong>
                  {(COMMISSION_RATES[summaryName(method)] || 0) > 0 && <p className="text-[10px] text-slate-500">Descuento {(COMMISSION_RATES[summaryName(method)] * 100).toLocaleString("es-CO", { maximumFractionDigits: 2 })}%: -{cop(amount * COMMISSION_RATES[summaryName(method)])}</p>}
                </div>
              ))}
            </div>
            <button
              onClick={() => onOpenDetails()}
              className="text-sm text-accent mt-3 font-semibold"
            >
              Ver movimientos y desglose completo
            </button>
          </div>
          <div id="sales-chart" className={tile}>
            <button type="button" onClick={() => setChartOpen(!chartOpen)} aria-expanded={chartOpen} className="font-bold text-accent">{chartOpen ? "Cerrar gráfico" : "Mostrar gráfico"}</button>
            {chartOpen && <>
            <div className="flex flex-wrap gap-2 items-center mb-4">
              <h2 className="font-bold mr-auto">Evolución del negocio</h2>
              <select
                aria-label="Métrica del gráfico"
                value={metric}
                onChange={(e) => setMetric(e.target.value as any)}
                className="p-2 rounded bg-slate-100 dark:bg-slate-900"
              >
                <option value="income">Ingresos</option>
                <option value="sales">Ventas</option>
              </select>
              <select
                aria-label="Vista del gráfico"
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
                className="p-2 rounded bg-slate-100 dark:bg-slate-900"
              >
                <option value="monthly">Mensual</option>
                <option value="daily">Diaria</option>
              </select>
              {mode === "monthly" && (
                <input
                  aria-label="Año del gráfico"
                  type="number"
                  min="2000"
                  max="2100"
                  value={year}
                  onChange={(e) => {
                    const y = Number(e.target.value);
                    if (y >= 2000 && y <= 2100) setYear(y);
                  }}
                  className="p-2 w-24 rounded bg-slate-100 dark:bg-slate-900"
                />
              )}
            </div>
            {result.chartLoading ? <VestikaLoader /> : <Suspense fallback={<VestikaLoader />}>
              <SalesHistoryChart
                data={chartData}
                viewMode={mode}
                seriesLabel={metric === "income" ? "Ingresos" : "Ventas"}
                showPartial={mode === "monthly"}
              />
            </Suspense>}
            </>}
          </div>
        </>
      )}
      <div className={tile}>
        <h2 className="font-bold mb-2">Historial y herramientas</h2>
        <div className="flex flex-wrap gap-3 text-sm font-semibold text-accent">{[["Historial de ventas y abonos", "sales-history"], ["Análisis de precios", "price-analysis"], ["Top productos y categorías", "top-products"], ["Pagos detallados", "payment-report"]].map(([label, section]) => <button type="button" key={section} onClick={() => onOpenDetails(section)}>{label}</button>)}<button type="button" onClick={onOpenVerification}>Verificar inventario</button></div>
      </div>
      <div className={tile}>
        <button
          className="text-accent font-bold"
          onClick={() => setCompare(!compare)}
        >
          {compare ? "Cerrar comparación" : "Comparar ingresos de mis sedes"}
        </button>
        {compare && (
          <table className="w-full mt-3 text-sm">
            <thead>
              <tr>
                <th className="text-left p-3">Sede</th>
                <th className="text-right p-3">Ingresos del período</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <StoreComparison
                  key={s.id}
                  store={s}
                  companyId={companyId}
                  start={rangeStart}
                  end={rangeEnd}
                  scope={scope}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
