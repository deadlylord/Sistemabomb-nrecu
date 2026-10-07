# Vestika environments

## Production
- Branch: `main`
- Real users and real data.
- Firebase production project must only be supplied through the Netlify Production context.
- Never run load tests, seeds or destructive tests here.

## Staging
- Branch/deploy previews use `VITE_APP_ENV=staging`.
- Must use a dedicated Firebase project. Never reuse production.
- Use synthetic or anonymized test data only.

## Local development
1. Copy `.env.example` to `.env.local`.
2. Install Firebase CLI if needed.
3. Start emulators with `firebase emulators:start`.
4. Run Vestika with `npm run dev`.

Local development defaults to Firebase emulators. The app contains a guard that rejects a non-production environment configured with the production project ID.

## Safe release flow
1. Create/work on a feature branch.
2. Test locally with emulators.
3. Push the branch and test its staging/Deploy Preview.
4. Run build/tests and tenant-isolation checks.
5. Review the diff.
6. Merge to `main` only after explicit approval.

## Tenant invariants
All operational data must remain scoped by `companyId` and, where applicable, `storeId`. Caches must never be reused across company contexts.

## Netlify variables
Configure Firebase variables separately by Netlify context. Production gets production Firebase values. Deploy Preview and Branch Deploy get staging Firebase values. Never place real environment values in git.

Required:
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID
- VITE_FIREBASE_PRODUCTION_PROJECT_ID

Optional when used:
- VITE_FIREBASE_DATABASE_URL
- VITE_FIREBASE_MEASUREMENT_ID
