// Explicit administrative staging backfill/verification. No credentials are
// persisted. Activate only after every source version and aggregate agrees.
import { readFile } from "node:fs/promises";
import { stagingRest } from "./stagingRest.mjs";
import { restSourceVersion } from "./verifyStagingFinancialLedger.mjs";
import {
  BUSINESS_COLLECTIONS,
  businessRoot,
  emptyBusinessRoot,
  emptyBusinessDay,
  mergeBusinessDay,
  businessContribution,
  projectBusinessSource,
} from "../src/businessSummary.mjs";
const base =
  "https://firestore.googleapis.com/v1/projects/vestika-staging/databases/(default)/documents";
const name = (path) =>
  "projects/vestika-staging/databases/(default)/documents/" + path;
const valid = (value) =>
  typeof value === "string" &&
  value &&
  value.length <= 128 &&
  !value.includes("/");
export function businessRestDb(rest) {
  return {
    doc: (path) => ({ path }),
    runTransaction: async (callback) => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const { transaction } = await rest.request(base + ":beginTransaction", {
          method: "POST",
          body: JSON.stringify({ options: { readWrite: {} } }),
        });
        let committed = false;
        try {
          const writes = [];
          const result = await callback({
            get: async (ref) => {
              const rows = await rest.request(base + ":batchGet", {
                method: "POST",
                body: JSON.stringify({
                  transaction,
                  documents: [name(ref.path)],
                }),
              });
              const found = rows.find((row) => row.found)?.found;
              if (!found) return { exists: false, data: () => null };
              const value = rest.decodeDocument(found),
                [seconds, nanoseconds] = restSourceVersion(value.updateTime)
                  .split(":")
                  .map(Number);
              return {
                exists: true,
                data: () => value.data,
                updateTime: { seconds, nanoseconds },
              };
            },
            set: (ref, data) => writes.push(rest.set(ref.path, data)),
            delete: (ref) => writes.push(rest.remove(ref.path)),
          });
          await rest.request(base + ":commit", {
            method: "POST",
            body: JSON.stringify({ transaction, writes }),
          });
          committed = true;
          return result;
        } catch (error) {
          if (error.status !== 409 || attempt === 4) throw error;
        } finally {
          if (!committed)
            await rest
              .request(base + ":rollback", {
                method: "POST",
                body: JSON.stringify({ transaction }),
              })
              .catch(() => {});
        }
      }
    },
  };
}
const zero = (value) =>
  typeof value === "number"
    ? Math.abs(value) < 0.0001
    : value && typeof value === "object"
      ? Object.values(value).every(zero)
      : false;
const equivalent = (a, b) =>
  a === 0 && b && typeof b === "object"
    ? zero(b)
    : b === 0 && a && typeof a === "object"
      ? zero(a)
      : typeof a === "number" && typeof b === "number"
        ? Math.abs(a - b) < 0.0001
        : a && b && typeof a === "object" && typeof b === "object"
          ? [...new Set([...Object.keys(a), ...Object.keys(b)])].every((key) =>
              equivalent(a[key] ?? 0, b[key] ?? 0),
            )
          : a === b;
export async function verifyStagingBusinessSummary(
  getAccessToken,
  { companyId, storeId, backfill = false, activate = false },
) {
  if (![companyId, storeId].every(valid))
    throw new Error("Invalid staging company/store");
  const rest = stagingRest(getAccessToken),
    root = businessRoot(companyId, storeId);
  if (
    activate &&
    (await rest.deployedRules()).trim() !==
      (
        await readFile(
          new URL("../../security/firestore.staging.rules", import.meta.url),
          "utf8",
        )
      ).trim()
  )
    throw new Error("Deploy the reviewed staging rules first");
  const sources = async (transaction) => {
    const all = [];
    for (const kind of BUSINESS_COLLECTIONS) {
      const result = await rest.request(base + ":runQuery", {
        method: "POST",
        body: JSON.stringify({
          ...(transaction ? { transaction } : {}),
          structuredQuery: {
            from: [{ collectionId: kind }],
            where: {
              fieldFilter: {
                field: { fieldPath: "storeId" },
                op: "EQUAL",
                value: { stringValue: storeId },
              },
            },
            limit: 5001,
          },
        }),
      });
      for (const row of result)
        if (row.document)
          all.push({ kind, ...rest.decodeDocument(row.document) });
      if (all.length > 5000)
        throw new Error(
          "Staging gate is limited to 5,000 total sources per store; larger backfills require a paginated maintenance workflow",
        );
    }
    return all;
  };
  if (backfill) {
    const store = await rest.get("stores/" + storeId);
    if (!store || (store.data.companyId || "default_company") !== companyId)
      throw new Error("Store/company mismatch");
    const db = businessRestDb(rest);
    for (const source of await sources())
      await projectBusinessSource(db, source.kind, source.id);
  }
  const { transaction } = await rest.request(base + ":beginTransaction", {
    method: "POST",
    body: JSON.stringify({
      options: activate ? { readWrite: {} } : { readOnly: {} },
    }),
  });
  let committed = false;
  try {
    const get = async (paths) => {
      const values = new Map();
      for (let i = 0; i < paths.length; i += 200) {
        const result = await rest.request(base + ":batchGet", {
          method: "POST",
          body: JSON.stringify({
            transaction,
            documents: paths.slice(i, i + 200).map(name),
          }),
        });
        for (const row of result)
          if (row.found) {
            const d = rest.decodeDocument(row.found);
            values.set(d.path, d);
          }
      }
      return values;
    };
    const store = (await get(["stores/" + storeId])).get("stores/" + storeId);
    if (!store || (store.data.companyId || "default_company") !== companyId)
      throw new Error("Store/company mismatch");
    const rows = await sources(transaction),
      states = await get(
        rows.map((s) => "businessSummaryState/" + s.kind + "_" + s.id),
      );
    const expected = emptyBusinessRoot(companyId, storeId),
      days = new Map(),
      months = new Map(),
      expectedRepeats = new Map();
    for (const source of rows) {
      if (source.data.companyId && source.data.companyId !== companyId)
        throw new Error("Foreign source");
      const state = states.get(
        "businessSummaryState/" + source.kind + "_" + source.id,
      );
      if (
        !state ||
        state.data.sourceVersion !== restSourceVersion(source.updateTime) ||
        state.data.value?.companyId !== companyId ||
        state.data.value?.storeId !== storeId
      )
        throw new Error("Projection is catching up; retry verification");
      const value = businessContribution(source.kind, source.data);
      if (
        !equivalent(value.days, state.data.value.days) ||
        !equivalent(value.inventoryValue, state.data.value.inventoryValue) ||
        !equivalent(value.inventoryUnits, state.data.value.inventoryUnits) ||
        !equivalent(value.invoiceDays, state.data.value.invoiceDays)
      )
        throw new Error("Source contribution mismatch");
      expected.sourceCounts[source.kind] =
        (expected.sourceCounts[source.kind] || 0) + 1;
      if (value.invoiceDays.length > 1)
        expectedRepeats.set(source.kind + "_" + source.id, value.invoiceDays);
      expected.inventoryValue += value.inventoryValue;
      expected.inventoryUnits += value.inventoryUnits;
      for (const [date, contribution] of Object.entries(value.days)) {
        if (!days.has(date)) days.set(date, emptyBusinessDay());
        mergeBusinessDay(days.get(date), contribution);
        if (!months.has(date.slice(0, 7))) months.set(date.slice(0, 7), {});
        const month = months.get(date.slice(0, 7)),
          day = (month[date] ||= { income: 0, sales: 0 });
        day.income += contribution.income;
        day.sales += contribution.sales;
      }
    }
    const readProjection = async (collectionId) => {
      const result = await rest.request(base + "/" + root + ":runQuery", {
        method: "POST",
        body: JSON.stringify({
          transaction,
          structuredQuery: { from: [{ collectionId }], limit: 5001 },
        }),
      });
      const documents = result
        .filter((row) => row.document)
        .map((row) => rest.decodeDocument(row.document));
      if (documents.length > 5000)
        throw new Error("Staging projection verification limit exceeded");
      return documents;
    };
    const actual = await get([root]);
    const [actualDays, actualMonths, actualRepeats] = await Promise.all(
      ["days", "months", "repeats"].map(readProjection),
    );
    for (const document of [...actualDays, ...actualMonths, ...actualRepeats]) {
      if (
        document.data.companyId !== companyId ||
        document.data.storeId !== storeId
      )
        throw new Error("Projection detail scope mismatch");
      actual.set(document.path, document);
    }
    for (const document of actualDays) {
      const expectedDay = days.get(document.id) || emptyBusinessDay();
      if (
        !Object.keys(expectedDay).every((field) =>
          equivalent(document.data[field], expectedDay[field]),
        )
      )
        throw new Error("Unexpected daily projection: " + document.id);
    }
    for (const document of actualMonths)
      if (!equivalent(document.data.days, months.get(document.id) || {}))
        throw new Error("Unexpected monthly projection: " + document.id);
    if (actualRepeats.length !== expectedRepeats.size)
      throw new Error("Repeated invoice index mismatch");
    for (const document of actualRepeats) {
      const expectedDays = expectedRepeats.get(document.id);
      if (
        !expectedDays ||
        !equivalent(document.data.days, expectedDays) ||
        document.data.firstDay !== expectedDays[0] ||
        document.data.lastDay !== expectedDays.at(-1)
      )
        throw new Error("Repeated invoice dates mismatch");
    }
    const metadata =
      actual.get(root)?.data || emptyBusinessRoot(companyId, storeId);
    for (const field of ["inventoryValue", "inventoryUnits", "sourceCounts"])
      if (!equivalent(metadata[field], expected[field]))
        throw new Error("Business root mismatch: " + field);
    if (
      metadata.companyId !== companyId ||
      metadata.storeId !== storeId ||
      metadata.schemaVersion !== 1
    )
      throw new Error("Business metadata scope mismatch");
    for (const [date, expectedDay] of days) {
      const day = actual.get(root + "/days/" + date)?.data;
      if (
        !day ||
        !Object.keys(expectedDay).every((k) =>
          equivalent(day[k], expectedDay[k]),
        )
      )
        throw new Error("Business day mismatch: " + date);
    }
    for (const [month, expectedDays] of months)
      if (
        !equivalent(
          actual.get(root + "/months/" + month)?.data.days,
          expectedDays,
        )
      )
        throw new Error("Business month mismatch: " + month);
    if (activate) {
      await rest.request(base + ":commit", {
        method: "POST",
        body: JSON.stringify({
          transaction,
          writes: [
            rest.set(root, {
              ...metadata,
              ready: true,
              verifiedAt: new Date().toISOString(),
            }),
          ],
        }),
      });
      committed = true;
    }
    return {
      project: "vestika-staging",
      companyId,
      storeId,
      sources: rows.length,
      days: days.size,
      months: months.size,
      activated: activate,
    };
  } finally {
    if (!committed)
      await rest
        .request(base + ":rollback", {
          method: "POST",
          body: JSON.stringify({ transaction }),
        })
        .catch(() => {});
  }
}
