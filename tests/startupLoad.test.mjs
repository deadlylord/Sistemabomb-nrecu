import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import React from "react";
import { create, act } from "react-test-renderer";
import {
  developerSession,
  browserGlobals,
} from "./helpers/developerSession.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
test("login form loads no Firebase or operational module before submit; pending authentication never mounts App", async () => {
  const dir = await mkdtemp(join(process.cwd(), "tests/.startup-"));
  let renderer;
  try {
    const result = await build({
      bundle: true,
      write: false,
      format: "esm",
      platform: "node",
      external: ["react"],
      stdin: {
        contents:
          "export {default as Entry} from './components/VerifiedEntry';export {control} from 'control';",
        resolveDir: process.cwd(),
      },
      plugins: [
        {
          name: "entry-fixture",
          setup(b) {
            b.onResolve({ filter: /^control$/ }, () => ({
              path: "control",
              namespace: "fake",
            }));
            b.onResolve({ filter: /services\/verifiedAuth$/ }, () => ({
              path: "auth",
              namespace: "fake",
            }));
            b.onResolve({ filter: /^\.\/App$/ }, () => ({
              path: "app",
              namespace: "fake",
            }));
            b.onLoad({ filter: /.*/, namespace: "fake" }, (a) => ({
              contents:
                a.path === "control"
                  ? "export const control={loaded:[],mounted:[],finish:null,logged:0};"
                  : a.path === "auth"
                    ? "import{control}from'control';control.loaded.push('firebase');export const loginVerified=()=>new Promise(r=>control.finish=r);export const recordVerifiedLogin=()=>control.logged++;"
                    : "import React from'react';import{control}from'control';control.loaded.push('app-code');export default function App({initialSession}){control.mounted.push(initialSession);return React.createElement('main',null,'Signed in');}",
            }));
          },
        },
      ],
    });
    const path = join(dir, "entry.mjs");
    await writeFile(path, result.outputFiles[0].text);
    const { Entry, control } = await import(pathToFileURL(path).href);
    await act(async () => {
      renderer = create(React.createElement(Entry));
    });
    assert.deepEqual(control.loaded, []);
    await act(async () => {
      renderer.root
        .findByProps({ id: "username" })
        .props.onChange({ target: { value: "fixture" } });
      renderer.root
        .findByProps({ id: "password" })
        .props.onChange({ target: { value: "fixture-password" } });
    });
    await act(async () =>
      renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }),
    );
    assert.deepEqual(control.loaded.sort(), ["app-code", "firebase"]);
    assert.equal(control.mounted.length, 0);
    assert.equal(renderer.root.findAllByProps({ role: "status" }).length, 1);
    const session = { user: { id: "u", companyId: "a", storeId: "a1" } };
    await act(async () => control.finish(session));
    assert.deepEqual(control.mounted, [session]);
    assert.equal(control.logged, 1);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    await rm(dir, { recursive: true, force: true });
  }
});
for (const verified of [true, false]) test(`complete dashboard loads active store only with ${verified ? "verified" : "legacy"} identity`, async () => {
  const restore = browserGlobals(),
    m = await developerSession({ summaries: true, verified });
  let renderer;
  try {
    const company = {
        id: "a",
        name: "A",
        status: "active",
        allowedViews: Object.values(m.View),
      },
      store = {
        id: "a1",
        companyId: "a",
        name: "A1",
        accentColorsUpdated: true,
      };
    const role = {
        id: "admin",
        companyId: "a",
        name: "Administrator",
        userType: "admin",
        permissions: Object.values(m.View),
      },
      user = {
        id: "u",
        name: "User",
        companyId: "a",
        storeId: "a1",
        roleId: "admin",
        authVersion: 1,
      };
    m.records.set("companies", [company]);
    m.records.set("stores", [
      store,
      { ...store, id: "a2", name: "A2" },
      { ...store, id: "foreign", companyId: "b" },
    ]);
    m.records.set("roles", [role]);
    m.records.set("sellers", [user]);
    m.records.set("inventory", [
      { id: "p1", companyId: "a", storeId: "a1", stock: 1 },
      { id: "p2", companyId: "a", storeId: "a2", stock: 2 },
    ]);
    await act(async () => {
      renderer = create(
        React.createElement(m.App, {
          initialSession: { user, store, role, company },
        }),
      );
    });
    const live = () => m.connections.filter((c) => !c.closed),
      rawNames = [
        "inventory",
        "sales",
        "purchases",
        "stockTakes",
        "daily_notes",
        "inventoryTransfers",
      ];
    const dashboard = () => renderer.root.findByProps({ screen: "DashboardView" });
    assert.equal(renderer.root.findAllByProps({screen:"BusinessOverview"}).length, 0);
    assert.equal(dashboard().props.currentStore.id, "a1");
    for (const name of ["inventory", "sales", "layaways", "incidents", "stockTakes", "expenses"]) {
      assert.equal(live().filter(c => c.q.name === name).length, 1, name + " has one shared subscription");
    }
    assert.equal(live().some(c => ["purchases", "giftVouchers", "dailyNotes", "inventoryTransfers", "productHistory", "customers"].includes(c.q.name)), false, "unused operational data stays deferred on dashboard");
    const before = live().filter(c => ["sales", "layaways"].includes(c.q.name));
    await act(async () => renderer.root.findByType(m.Header).props.setCurrentView(m.View.POS));
    await act(async () => renderer.root.findByType(m.Header).props.setCurrentView(m.View.DASHBOARD));
    for (const connection of before) assert.equal(connection.closed, false, "shared sales connections survive navigation");
    for (const c of live().filter((c) =>
      ["inventory", "sales", "purchases", "layaways", "incidents"].includes(
        c.q.name,
      ),
    ))
      assert.equal(c.q.filters.find((f) => f.field === "storeId").value, "a1");
    await act(async () =>
      renderer.root.findByType(m.Header).props.onSwitchStore("a2"),
    );
    assert.equal(dashboard().props.currentStore.id, "a2");
    for (const c of live().filter(c => rawNames.includes(c.q.name))) assert.equal(c.q.filters.find(f=>f.field==="storeId").value,"a2");
    await act(async () =>
      renderer.root.findByType(m.Header).props.onSwitchStore("foreign"),
    );
    assert.equal(dashboard().props.currentStore.id, "a2");
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    await m.cleanup();
    restore();
  }
});
