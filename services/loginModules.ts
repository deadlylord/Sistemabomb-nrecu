// Load SDK code only. Do not create a Firebase app, authenticate, read data,
// sign out, or send credentials while the user is still filling the form.
let preparation: Promise<[typeof import('firebase/auth'), typeof import('firebase/functions')]> | undefined;
export function prepareLoginModules() {
  if (!preparation) preparation = Promise.all([import('firebase/auth'), import('firebase/functions')]).catch(error => {
    preparation = undefined;
    throw error;
  });
  return preparation;
}
