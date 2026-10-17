import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from 'node:fs/promises';
import { verifyStagingBusinessSummary } from '../../functions/scripts/verifyStagingBusinessSummary.mjs';
import { createRequire } from "node:module";
import {
  projectBusinessSource,
  businessRoot,
} from "../../functions/src/businessSummary.mjs";
if (
  !/^(127\.0\.0\.1|localhost):\d+$/.test(
    process.env.FIRESTORE_EMULATOR_HOST || "",
  )
)
  throw new Error("Local emulator required");
const req = createRequire(
  new URL("../../functions/package.json", import.meta.url),
);
const { Firestore } = req("@google-cloud/firestore");
const db = new Firestore({ projectId: "demo-vestika-business-summary" });
test("real Firestore transactions converge across concurrent sales, inventory, payments and expenses without double sums", async () => {
  const prefix = "summary_test_",
    store = prefix + "store",
    root = businessRoot("summary_company", store);
  await db.doc("stores/" + store).set({ companyId: "summary_company" });
  const sources = [
    [
      "sales",
      prefix + "sale",
      {
        storeId: store,
        companyId: "summary_company",
        createdAt: "2026-10-01",
        totalAmount: 100,
        items: [{ price: 100, cost: 40, quantity: 1 }],
        payments: [{ date: "2026-10-16", amount: 100, method: "Efectivo" }],
      },
    ],
    [
      "inventory",
      prefix + "product",
      { storeId: store, companyId: "summary_company", stock: 4, cost: 50 },
    ],
    [
      "expenses",
      prefix + "expense",
      {
        storeId: store,
        companyId: "summary_company",
        date: "2026-10-16",
        category: "Arriendo",
        amount: 25,
      },
    ],
    [
      "layaways",
      prefix + "layaway",
      {
        storeId: store,
        companyId: "summary_company",
        createdAt: "2026-09-01",
        totalAmount: 200,
        status: "active",
        items: [{ price: 200, cost: 100, quantity: 1 }],
        payments: [
          { date: "2026-10-16", amount: 50, method: "Efectivo" },
          { date: "2026-10-17", amount: 150, method: "Tarjeta" },
        ],
      },
    ],
  ];
  for (const [kind, id, data] of sources)
    await db.doc(kind + "/" + id).set(data);
  await Promise.all(
    sources.map(([kind, id]) => projectBusinessSource(db, kind, id)),
  );
  await Promise.all(
    sources.map(([kind, id]) => projectBusinessSource(db, kind, id)),
  );
  assert.equal((await db.doc(root).get()).data().inventoryValue, 200);
  const day = (await db.doc(root + "/days/2026-10-16").get()).data();
  assert.equal(day.income, 150);
  assert.equal(day.expenses, 25);
  assert.equal(day.invoices, 2);
  assert.equal(
    (
      await db.doc(root + "/repeats/layaways_" + prefix + "layaway").get()
    ).data().days.length,
    2,
  );
  await db
    .doc("sales/" + prefix + "sale")
    .update({
      payments: [{ date: "2026-10-17", amount: 100, method: "Efectivo" }],
    });
  await projectBusinessSource(db, "sales", prefix + "sale");
  assert.equal(
    (await db.doc(root + "/days/2026-10-16").get()).data().income,
    50,
  );
  assert.equal(
    (await db.doc(root + "/days/2026-10-17").get()).data().income,
    250,
  );
  for (const [kind, id] of sources) {
    await db.doc(kind + "/" + id).delete();
    await projectBusinessSource(db, kind, id);
  }
  const after = (await db.doc(root).get()).data();
  assert.equal(after.inventoryValue, 0);
  assert.deepEqual(after.sourceCounts, {});
  assert.equal(
    (await db.doc(root + "/days/2026-10-17").get()).data().income,
    0,
  );
  const originalFetch = globalThis.fetch;
  const target = 'https://firestore.googleapis.com/v1/projects/vestika-staging/databases/(default)/documents';
  const rules = await readFile(new URL('../../security/firestore.staging.rules',import.meta.url),'utf8');
  globalThis.fetch = async (url,options={}) => {
    if (String(url).startsWith(target)) {
      const localUrl=String(url).replace(target,'http://'+process.env.FIRESTORE_EMULATOR_HOST+'/v1/projects/demo-vestika-business-summary/databases/(default)/documents');
      const body=options.body?.replaceAll('projects/vestika-staging/','projects/demo-vestika-business-summary/');
      return originalFetch(localUrl,{...options,body});
    }
    if (String(url).includes('/releases/cloud.firestore')) return new Response(JSON.stringify({rulesetName:'projects/vestika-staging/rulesets/test-only'}));
    if (String(url).includes('/rulesets/test-only')) return new Response(JSON.stringify({source:{files:[{name:'firestore.rules',content:rules}]}}));
    throw new Error('Unexpected external request in emulator test');
  };
  try {
    const options={companyId:'summary_company',storeId:store,activate:true};
    const verified=await verifyStagingBusinessSummary(async()=>({access_token:'owner'}),options);
    assert.equal(verified.sources,0);assert.equal(verified.activated,true);
    const [kind,id,data]=sources[3];await db.doc(kind+'/'+id).set(data);await projectBusinessSource(db,kind,id);
    assert.equal((await verifyStagingBusinessSummary(async()=>({access_token:'owner'}),options)).sources,1);
    await db.doc(kind+'/'+id).update({payments:[{date:'2026-10-18',amount:200,method:'Efectivo'}]});
    await assert.rejects(verifyStagingBusinessSummary(async()=>({access_token:'owner'}),options),/catching up/);
    await projectBusinessSource(db,kind,id);
    assert.equal((await verifyStagingBusinessSummary(async()=>({access_token:'owner'}),options)).sources,1);
    await db.doc(root+'/days/2026-01-01').set({companyId:'summary_company',storeId:store,income:999});
    await assert.rejects(verifyStagingBusinessSummary(async()=>({access_token:'owner'}),options),/Unexpected daily projection/);
  } finally { globalThis.fetch=originalFetch; await db.terminate(); }
});
