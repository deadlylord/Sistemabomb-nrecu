import { collection, doc, getDocFromServer, getDocsFromServer, runTransaction } from './measuredFirestore';
import type { DocumentReference, Firestore, Transaction } from './measuredFirestore';

type UserIdentity = { id?: string; name?: string; username?: string; [key: string]: any };
type UserMutation = {
  ref: DocumentReference;
  action: 'create' | 'update' | 'delete';
  data?: UserIdentity;
  validate?: (before: UserIdentity | null, next: UserIdentity | null) => void;
};
export const loginAliases = (user: UserIdentity | null) => [...new Set(
  [user?.name, user?.username].filter((value): value is string => typeof value === 'string' && !!value.trim())
    .map(value => value.trim().toLowerCase())
)];

export function assertUniqueLoginAliases(users: UserIdentity[], candidate: UserIdentity, excludedId?: string) {
  const aliases = new Set(loginAliases(candidate));
  if (!aliases.size) throw new Error('Completa el nombre del usuario.');
  if (users.some(user => user.id !== excludedId && loginAliases(user).some(alias => aliases.has(alias)))) {
    // Do not disclose another company's name, store or account details.
    throw new Error('Ese nombre o usuario de inicio de sesión ya está en uso. Elige uno diferente.');
  }
}

class ChangedUserList extends Error {}
const revision = (snapshot: any) => {
  const value = snapshot.exists() ? snapshot.data().revision : 0;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('No se pudo validar la lista de usuarios.');
  return value;
};

// Compatibility path until verified identity owns production writes. Run only
// for account changes, never at login/startup. Server reads include disabled
// users and both login aliases across companies, regardless of UI filters.
// The shared revision makes concurrent writes from these clients serializable;
// every creation path (including initial admins) must use this same operation.
// Older clients/direct SDK writes do not participate: strict enforcement remains
// the responsibility of the already separate verified-identity migration/rules.
export async function commitUniqueLegacyUser(
  db: Firestore, mutation: UserMutation,
  relatedWrites?: (transaction: Transaction) => void
) {
  const lock = doc(db, 'userManagementState', 'loginIdentifiers');
  for (let attempt = 0; attempt < 5; attempt++) {
    // Read the revision BEFORE the authoritative list, so a concurrent account
    // creation/rename/deletion cannot slip between validation and commit.
    const expectedRevision = revision(await getDocFromServer(lock));
    const snapshot = await getDocsFromServer(collection(db, 'sellers'));
    const users = snapshot.docs.map(row => ({ ...row.data(), id: row.id }));
    try {
      await runTransaction(db, async transaction => {
        const state = await transaction.get(lock);
        if (revision(state) !== expectedRevision) throw new ChangedUserList();
        const current = await transaction.get(mutation.ref);
        const before = current.exists() ? current.data() : null;
        if (mutation.action === 'create' && before) throw new Error('Este usuario ya se guardó. Actualiza la lista.');
        if (mutation.action !== 'create' && !before) throw new Error('No se encontró el usuario.');
        const next = mutation.action === 'delete' ? null : { ...(before || {}), ...mutation.data };
        if (next) assertUniqueLoginAliases(users, next, mutation.ref.id);
        mutation.validate?.(before, next);
        // No writes occur until every validation has passed. Company/store/role
        // bootstrap writes are part of the same atomic commit as their admin.
        if (mutation.action === 'delete') transaction.delete(mutation.ref);
        else if (mutation.action === 'create') transaction.set(mutation.ref, next!);
        else transaction.update(mutation.ref, mutation.data!);
        relatedWrites?.(transaction);
        transaction.set(lock, { revision: expectedRevision + 1 }, { merge: true });
      });
      return;
    } catch (error) {
      if (!(error instanceof ChangedUserList)) throw error;
    }
  }
  throw new Error('La lista de usuarios está cambiando. Reintenta guardar en unos segundos.');
}
