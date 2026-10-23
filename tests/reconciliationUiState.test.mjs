import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const reconciliation = await readFile(new URL('../components/FinancialReconciliationView.tsx', import.meta.url), 'utf8');
const app = await readFile(new URL('../components/App.tsx', import.meta.url), 'utf8');

test('reconciliation keeps search and expanded panels in view filter state', () => {
  for (const key of ['searchTerm', 'isSystemLoadsOpen', 'isDebtsSectionOpen']) {
    assert.match(reconciliation, new RegExp("useViewFilter\\('FinancialReconciliationView:" + key + "'"));
  }
});

test('filter provider is scoped to user/company, not current store', () => {
  assert.match(app, /<ViewFiltersProvider key=\{`filters:\$\{dataScope\}\`\}>/);
  assert.match(app, /<main key=\{`\$\{dataScope\}:\$\{currentStoreId\}:\$\{currentView\}\`\}/);
});
