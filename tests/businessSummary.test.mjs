import test from "node:test";
import assert from "node:assert/strict";
import {
  businessContribution,
  projectBusinessSource,
  invalidateBusinessSummary,
  businessRoot,
  emptyBusinessDay,
  mergeBusinessDay,
} from "../functions/src/businessSummary.mjs";
function fixture() {
  const rows = new Map(),
    versions = new Map();
  let sequence = 0;
  const put = (path, value) => {
    rows.set(path, structuredClone(value));
    versions.set(path, ++sequence);
  };
  const db = {
    doc: (path) => ({ path }),
    runTransaction: async (callback) => {
      const writes = [];
      let writing = false;
      const tx = {
        get: async (ref) => {
          assert.equal(writing, false);
          return {
            exists: rows.has(ref.path),
            data: () => structuredClone(rows.get(ref.path)),
            updateTime: { seconds: 1, nanoseconds: versions.get(ref.path) },
          };
        },
        set: (ref, value) => {
          writing = true;
          writes.push(() => put(ref.path, value));
        },
        delete: (ref) => {
          writing = true;
          writes.push(() => rows.delete(ref.path));
        },
      };
      await callback(tx);
      writes.forEach((write) => write());
    },
  };
  put("stores/metro", { companyId: "bombon" });
  put("stores/divino", { companyId: "bombon" });
  put("stores/other", { companyId: "mayla" });
  return { db, rows, put };
}
const transaction = (extra = {}) => ({
  companyId: "bombon",
  storeId: "metro",
  createdAt: "2026-10-01T12:00:00-05:00",
  seller: "Ana",
  totalAmount: 100,
  items: [
    { price: 100, cost: 40, quantity: 1 },
    { price: 0, cost: 5, quantity: 1 },
  ],
  payments: [
    { amount: 40, method: "Efectivo", date: "2026-10-01T23:59:59-05:00" },
    { amount: 60, method: "Tarjeta", date: "2026-10-16T00:00:00-05:00" },
  ],
  ...extra,
});
test("old layaway creation and today payments remain separate, full Colombia day and distinct invoice dates", () => {
  const v = businessContribution("layaways", transaction({ status: "active" }));
  assert.equal(v.days["2026-10-01"].units, 1);
  assert.equal(v.days["2026-10-01"].gifts, 1);
  assert.equal(v.days["2026-10-16"].units, 0);
  assert.equal(v.days["2026-10-16"].income, 60);
  assert.equal(v.days["2026-10-16"].salesCollected, 60);
  assert.equal(v.days["2026-10-16"].profit, 60 * 0.6 - 60 * 0.0515);
  assert.equal(v.days["2026-10-16"].cogs, 24);
  assert.deepEqual(v.invoiceDays, ["2026-10-01", "2026-10-16"]);
  const total = emptyBusinessDay();
  Object.values(v.days).forEach((day) => mergeBusinessDay(total, day));
  assert.equal(total.invoices - 1, 1);
  assert.equal(total.income, 100);
  const boundary = businessContribution(
    "sales",
    transaction({
      createdAt: "2026-10-02T04:59:59.999Z",
      payments: [
        { date: "2026-10-02T05:00:00.000Z", amount: 100, method: "Efectivo" },
      ],
    }),
  );
  assert.equal(boundary.days["2026-10-01"].units, 1);
  assert.equal(boundary.days["2026-10-02"].income, 100);
});
test("voucher, cancelled layaway, completed layaway sale, preorders, fees and operating expenses match dashboard semantics", () => {
  assert.deepEqual(
    businessContribution("sales", transaction({ layawayId: "old" })).days,
    {},
  );
  const cancelled = businessContribution(
    "layaways",
    transaction({ status: "cancelled" }),
  );
  assert.equal(cancelled.days["2026-10-01"].units, 0);
  assert.equal(cancelled.days["2026-10-16"].salesCollected, 0);
  assert.equal(cancelled.days["2026-10-16"].income, 60);
  const preorder = businessContribution(
    "layaways",
    transaction({ status: "pre-order" }),
  );
  assert.equal(preorder.days["2026-10-01"].units, 0);
  assert.equal(preorder.days["2026-10-16"].salesCollected, 60);
  const voucher = businessContribution(
    "sales",
    transaction({
      payments: [{ amount: 100, method: "Bono de Regalo", date: "2026-10-01" }],
    }),
  );
  assert.equal(voucher.days["2026-10-01"].income, 0);
  assert.equal(voucher.days["2026-10-01"].methods["k_Bono%20de%20Regalo"], 100);
  const spend = businessContribution("expenses", {
    category: "Arriendo",
    amount: 50,
    date: "2026-10-01",
  });
  assert.equal(spend.days["2026-10-01"].expenses, 50);
  assert.deepEqual(
    businessContribution("expenses", {
      category: "Compra Mercancia",
      amount: 50,
      date: "2026-10-01",
    }).days,
    {},
  );
});
test("recaudos, surpluses, pending changes and additional income preserve income versus profit", () => {
  const recaudo = businessContribution("incidents", {
    type: "Recaudo",
    status: "Registrado",
    adjustmentAmount: 120,
    createdAt: "2026-10-16",
  }).days["2026-10-16"];
  assert.equal(recaudo.income, 120);
  assert.equal(recaudo.profit, 0);
  assert.equal(recaudo.directIncome, 120);
  const exchange = businessContribution("incidents", {
    type: "Cambio de Producto",
    status: "Cambio Procesado",
    adjustmentAmount: 30,
    paymentMethod: "Efectivo",
    createdAt: "2026-10-16",
  }).days["2026-10-16"];
  assert.equal(exchange.income, 30);
  assert.equal(exchange.salesCollected, 0);
  assert.deepEqual(
    businessContribution("incidents", {
      type: "Recaudo",
      status: "Pendiente de Aprobación",
      adjustmentAmount: 120,
      createdAt: "2026-10-16",
    }).days,
    {},
  );
});
test("duplicates and old events converge; editing date/payment, deleting and restoring updates exact daily/monthly totals and repeats", async () => {
  const { db, rows, put } = fixture(),
    root = businessRoot("bombon", "metro");
  put("layaways/a", transaction({ status: "active" }));
  await projectBusinessSource(db, "layaways", "a");
  const revision = rows.get(root).revision;
  await projectBusinessSource(db, "layaways", "a");
  assert.equal(rows.get(root).revision, revision);
  assert.equal(rows.get(root).ready, false);
  assert.equal(rows.get(root + "/repeats/layaways_a").days.length, 2);
  assert.equal(
    rows.get(root + "/months/2026-10").days["2026-10-16"].income,
    60,
  );
  put(
    "layaways/a",
    transaction({
      status: "active",
      createdAt: "2026-09-30",
      payments: [{ amount: 100, method: "Efectivo", date: "2026-09-30" }],
    }),
  );
  await projectBusinessSource(db, "layaways", "a");
  assert.equal(rows.get(root + "/days/2026-10-16").income, 0);
  assert.equal(rows.get(root + "/days/2026-09-30").income, 100);
  assert.equal(rows.has(root + "/repeats/layaways_a"), false);
  rows.delete("layaways/a");
  await projectBusinessSource(db, "layaways", "a");
  assert.equal(rows.get(root + "/days/2026-09-30").income, 0);
  assert.deepEqual(rows.get(root).sourceCounts, {});
  put("layaways/a", transaction({ status: "active" }));
  await projectBusinessSource(db, "layaways", "a");
  assert.equal(rows.get(root + "/days/2026-10-16").income, 60);
});
test("ownership resolves from trusted store, all five collections isolate companies; bad sources invalidate verified metadata", async () => {
  const { db, rows, put } = fixture(),
    root = businessRoot("bombon", "metro");
  put("sales/a", transaction());
  await projectBusinessSource(db, "sales", "a");
  put(root, { ...rows.get(root), ready: true });
  put("sales/a", transaction({ companyId: "mayla" }));
  await assert.rejects(
    projectBusinessSource(db, "sales", "a"),
    /company mismatch/,
  );
  await invalidateBusinessSummary(db, "sales", "a");
  assert.equal(rows.get(root).ready, false);
  assert.equal(rows.has(businessRoot("mayla", "metro")), false);
  put("sales/a", transaction());
  await projectBusinessSource(db, "sales", "a");
  assert.equal(rows.get(root).ready, false);
  put("inventory/i", {
    storeId: "other",
    companyId: "mayla",
    cost: 100,
    stock: 20,
  });
  await projectBusinessSource(db, "inventory", "i");
  assert.equal(rows.get(businessRoot("mayla", "other")).inventoryValue, 2000);
  assert.equal(rows.get(root).inventoryValue, 0);
  put("inventory/j", { storeId: "metro", cost: 50, stock: 4 });
  await projectBusinessSource(db, "inventory", "j");
  assert.equal(rows.get(root).inventoryValue, 200);
  put("inventory/j", { storeId: "metro", cost: 50, stock: 3 });
  await projectBusinessSource(db, "inventory", "j");
  assert.equal(rows.get(root).inventoryValue, 150);
});
test("50,000 sources aggregate into daily totals independently of history size", () => {
  const days = emptyBusinessDay();
  for (let i = 0; i < 50000; i++)
    mergeBusinessDay(
      days,
      businessContribution(
        "sales",
        transaction({
          payments: [{ date: "2026-10-16", amount: 100, method: "Efectivo" }],
        }),
      ).days["2026-10-16"],
    );
  assert.equal(days.income, 5000000);
  assert.equal(days.invoices, 50000);
});
