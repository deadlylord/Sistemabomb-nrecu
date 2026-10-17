import { ledgerDay } from "./financialProjection.mjs";
export const BUSINESS_COLLECTIONS = [
  "sales",
  "layaways",
  "incidents",
  "expenses",
  "inventory",
];
export const businessRoot = (companyId, storeId) =>
  `businessSummaryCompanies/${companyId}/stores/${storeId}`;
export const emptyBusinessRoot = (companyId, storeId) => ({
  companyId,
  storeId,
  schemaVersion: 1,
  ready: false,
  inventoryValue: 0,
  inventoryUnits: 0,
  sourceCounts: {},
});
export const emptyBusinessDay = () => ({
  units: 0,
  gifts: 0,
  salesCollected: 0,
  profit: 0,
  cogs: 0,
  expenses: 0,
  directIncome: 0,
  income: 0,
  sales: 0,
  invoices: 0,
  methods: {},
  sellers: {},
});
const numbers = [
  "units",
  "gifts",
  "salesCollected",
  "profit",
  "cogs",
  "expenses",
  "directIncome",
  "income",
  "sales",
  "invoices",
];
const rates = { Addi: 0.065, Sistecredito: 0.03, Tarjeta: 0.0515 };
const list = (value) =>
  Array.isArray(value) ? value : Object.values(value || {});
const n = (value) => {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) throw new Error("Invalid business number");
  return number;
};
const key = (value) => "k_" + encodeURIComponent(String(value || "Sin nombre"));
export const summaryName = (value) => decodeURIComponent(value.slice(2));
const add = (map, name, amount) => {
  map[name] = Math.round(((map[name] || 0) + amount) * 1e8) / 1e8;
  if (Math.abs(map[name]) < 1e-8) delete map[name];
};
export function mergeBusinessDay(target, value, sign = 1) {
  for (const field of numbers)
    target[field] =
      Math.round((target[field] + (value[field] || 0) * sign) * 1e8) / 1e8;
  for (const field of ["methods", "sellers"])
    for (const [name, amount] of Object.entries(value[field] || {}))
      add(target[field], name, amount * sign);
  return target;
}
// Exact contributions by Colombia calendar day. Separate creation-day units
// from payment-day income: an old layaway's payment belongs to today's cash.
export function businessContribution(kind, data) {
  const days = {};
  const day = (date) => (days[ledgerDay(date)] ||= emptyBusinessDay());
  let inventoryValue = 0,
    inventoryUnits = 0;
  const invoiceDays = new Set();
  if (kind === "inventory") {
    inventoryValue = n(data.cost) * n(data.stock);
    inventoryUnits = n(data.stock);
  }
  if (kind === "sales" || kind === "layaways") {
    const sale = kind === "sales";
    if (sale && data.layawayId)
      return { days, inventoryValue, inventoryUnits, invoiceDays: [] };
    const items = list(data.items).filter(Boolean),
      payments = list(data.payments).filter(Boolean);
    const paidItems = items.filter((item) => n(item.price) > 0);
    if (sale || !["cancelled", "pre-order"].includes(data.status)) {
      const creation = day(data.createdAt);
      const units = paidItems.reduce((sum, item) => sum + n(item.quantity), 0);
      creation.units += units;
      creation.gifts += items
        .filter((item) => n(item.price) === 0)
        .reduce((sum, item) => sum + n(item.quantity), 0);
      add(creation.sellers, key(data.seller), units);
    }
    if (sale || ["active", "completed"].includes(data.status))
      day(data.createdAt).sales += n(data.totalAmount);
    const cost = paidItems.reduce(
      (sum, item) => sum + n(item.cost) * n(item.quantity),
      0,
    );
    const profit =
      paidItems.reduce(
        (sum, item) => sum + (n(item.price) - n(item.cost)) * n(item.quantity),
        0,
      ) - n(data.discountAmount);
    for (const payment of payments) {
      const p = day(payment.date),
        amount = n(payment.amount);
      add(p.methods, key(payment.method), amount);
      if (payment.method === "Bono de Regalo") continue;
      p.income += amount; // Matches Ingresos del período, including historical cancelled layaways.
      if (!sale && data.status === "cancelled") continue;
      p.salesCollected += amount;
      p.directIncome += amount;
      p.profit +=
        (profit * amount) / Math.max(n(data.totalAmount), 1) -
        amount * (rates[payment.method] || 0);
      p.cogs += (cost * amount) / Math.max(n(data.totalAmount), 1);
      invoiceDays.add(ledgerDay(payment.date));
    }
    for (const date of invoiceDays) days[date].invoices += 1;
  }
  if (kind === "expenses") {
    if (
      ![
        "MERCANCIA",
        "COMPRA MERCANCIA",
        "INVENTARIO",
        "ACTIVOS",
        "INVERSION",
      ].some((value) =>
        String(data.category || "")
          .toUpperCase()
          .includes(value),
      )
    )
      day(data.date).expenses += n(data.amount);
  }
  if (kind === "incidents" && data.status !== "Pendiente de Aprobación") {
    const amount = n(data.adjustmentAmount),
      type = data.type;
    if (
      type === "Recaudo" ||
      (type === "Ajuste de Caja" && data.adjustmentType === "income")
    ) {
      const p = day(data.createdAt);
      p.directIncome += amount;
      if (type !== "Recaudo") p.profit += amount;
    }
    const skipped =
      type === "Ajuste de Caja" &&
      String(data.description || "").includes("Excedente pagado");
    const valid =
      type === "Cambio de Producto" ||
      type === "Recaudo" ||
      type === "Ingreso Adicional" ||
      (type === "Ajuste de Caja" && data.adjustmentType === "income");
    const method =
      type === "Recaudo" ? "Recaudo Sistecredito" : data.paymentMethod;
    if (!skipped && valid && method && amount > 0) {
      const p = day(data.createdAt);
      add(p.methods, key(method), amount);
      if (method !== "Bono de Regalo") p.income += amount;
    }
  }
  if (
    ![
      inventoryValue,
      inventoryUnits,
      ...Object.values(days).flatMap((value) =>
        numbers.map((field) => value[field]),
      ),
    ].every(Number.isFinite)
  )
    throw new Error("Invalid business number");
  if (Object.keys(days).length > 180)
    throw new Error("Business source exceeds supported day count");
  return {
    days,
    inventoryValue,
    inventoryUnits,
    invoiceDays: [...invoiceDays].sort(),
  };
}
const validId = (value) =>
  typeof value === "string" &&
  !!value &&
  value.length <= 128 &&
  !value.includes("/");
export async function projectBusinessSource(db, kind, id) {
  if (!BUSINESS_COLLECTIONS.includes(kind) || !validId(id))
    throw new Error("Invalid business source");
  const sourceKey = kind + "_" + id;
  return db.runTransaction(async (tx) => {
    const [source, state] = await Promise.all([
      tx.get(db.doc(`${kind}/${id}`)),
      tx.get(db.doc(`businessSummaryState/${sourceKey}`)),
    ]);
    const version = source.exists
      ? `${source.updateTime.seconds}:${source.updateTime.nanoseconds}`
      : null;
    if (state.exists && state.data().sourceVersion === version) return;
    const before = state.exists ? state.data().value : null;
    let after = null;
    if (source.exists) {
      const data = source.data();
      if (!validId(data.storeId)) throw new Error("Invalid business store");
      const store = await tx.get(db.doc("stores/" + data.storeId));
      if (!store.exists) throw new Error("Missing business store");
      const companyId = store.data().companyId || "default_company";
      if (
        !validId(companyId) ||
        (data.companyId && data.companyId !== companyId)
      )
        throw new Error("Business company mismatch");
      after = {
        companyId,
        storeId: data.storeId,
        ...businessContribution(kind, data),
      };
    }
    const paths = new Map();
    for (const value of [before, after])
      if (value) {
        const root = businessRoot(value.companyId, value.storeId);
        paths.set(root, emptyBusinessRoot(value.companyId, value.storeId));
        for (const date of Object.keys(value.days)) {
          paths.set(root + "/days/" + date, {
            companyId: value.companyId,
            storeId: value.storeId,
            date,
            ...emptyBusinessDay(),
          });
          paths.set(root + "/months/" + date.slice(0, 7), {
            companyId: value.companyId,
            storeId: value.storeId,
            month: date.slice(0, 7),
            days: {},
          });
        }
      }
    const values = new Map();
    for (const [path, empty] of paths) {
      const snapshot = await tx.get(db.doc(path));
      values.set(path, snapshot.exists ? snapshot.data() : empty);
    }
    for (const [value, sign] of [
      [before, -1],
      [after, 1],
    ])
      if (value) {
        const root = businessRoot(value.companyId, value.storeId),
          summary = values.get(root);
        add(summary.sourceCounts, kind, sign);
        summary.inventoryValue =
          Math.round(
            (summary.inventoryValue + value.inventoryValue * sign) * 1e8,
          ) / 1e8;
        summary.inventoryUnits =
          Math.round(
            (summary.inventoryUnits + value.inventoryUnits * sign) * 1e8,
          ) / 1e8;
        for (const [date, contribution] of Object.entries(value.days)) {
          mergeBusinessDay(
            values.get(root + "/days/" + date),
            contribution,
            sign,
          );
          const month = values.get(root + "/months/" + date.slice(0, 7));
          const entry = (month.days[date] ||= { income: 0, sales: 0 });
          for (const field of ["income", "sales"])
            entry[field] =
              Math.round((entry[field] + contribution[field] * sign) * 1e8) /
              1e8;
        }
      }
    for (const value of values.values())
      if (Buffer.byteLength(JSON.stringify(value)) > 700000)
        throw new Error("Business source exceeds summary size");
    for (const [path, value] of values)
      tx.set(db.doc(path), {
        ...value,
        revision: (value.revision || 0) + 1,
        updatedAt: new Date().toISOString(),
      });
    const repeatPath = (value) =>
      `${businessRoot(value.companyId, value.storeId)}/repeats/${sourceKey}`;
    if (
      before &&
      (!after ||
        repeatPath(before) !== repeatPath(after) ||
        after.invoiceDays.length < 2)
    )
      tx.delete(db.doc(repeatPath(before)));
    if (after && after.invoiceDays.length > 1)
      tx.set(db.doc(repeatPath(after)), {
        companyId: after.companyId,
        storeId: after.storeId,
        days: after.invoiceDays,
        firstDay: after.invoiceDays[0],
        lastDay: after.invoiceDays.at(-1),
      });
    tx.set(db.doc(`businessSummaryState/${sourceKey}`), {
      sourceVersion: version,
      value: after,
    });
    tx.delete(db.doc(`businessSummaryErrors/${sourceKey}`));
  });
}
export async function invalidateBusinessSummary(db, kind, id) {
  return db.runTransaction(async (tx) => {
    const [source, state] = await Promise.all([
      tx.get(db.doc(`${kind}/${id}`)),
      tx.get(db.doc(`businessSummaryState/${kind}_${id}`)),
    ]);
    const roots = new Set();
    if (state.exists && state.data().value) {
      const v = state.data().value;
      roots.add(businessRoot(v.companyId, v.storeId));
    }
    if (source.exists && validId(source.data().storeId)) {
      const store = await tx.get(db.doc("stores/" + source.data().storeId));
      if (store.exists)
        roots.add(
          businessRoot(
            store.data().companyId || "default_company",
            source.data().storeId,
          ),
        );
    }
    const values = [];
    for (const root of roots) {
      const s = await tx.get(db.doc(root));
      if (s.exists) values.push([root, s.data()]);
    }
    for (const [root, value] of values)
      tx.set(db.doc(root), { ...value, ready: false });
    tx.set(db.doc(`businessSummaryErrors/${kind}_${id}`), {
      at: new Date().toISOString(),
      reason: "Invalid source or tenant ownership",
    });
  });
}
