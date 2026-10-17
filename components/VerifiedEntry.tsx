import React, { useState } from "react";
import LoginView from "./LoginView";
import type { loginVerified } from "../services/verifiedAuth";

export type VerifiedSession = Awaited<ReturnType<typeof loginVerified>>;

// No operational component is imported until the user actually submits login.
// Load its code concurrently with authentication, but mount only after success.
export default function VerifiedEntry() {
  const [session, setSession] = useState<VerifiedSession | null>(null);
  const [App, setApp] = useState<React.ComponentType<{
    initialSession?: VerifiedSession;
  }> | null>(null);
  async function login(identifier: string, password: string) {
    const appCode = import("./App");
    // Handle an early chunk failure while the authentication request is pending.
    appCode.catch(() => {});
    try {
      const { loginVerified, recordVerifiedLogin } =
        await import("../services/verifiedAuth");
      const verified = await loginVerified(identifier, password);
      const module = await appCode;
      setApp(() => module.default);
      setSession(verified);
      recordVerifiedLogin(verified.user);
    } catch (error: any) {
      alert(
        error?.code === "functions/resource-exhausted"
          ? "Demasiados intentos. Espera unos minutos."
          : error?.code === "functions/unauthenticated"
            ? "Usuario o contraseña incorrecta."
            : "No se pudo completar el ingreso. Revisa la conexión e intenta nuevamente.",
      );
    }
  }
  if (App && session) return <App initialSession={session} />;
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <LoginView onLogin={login} isAppReady />
    </div>
  );
}
