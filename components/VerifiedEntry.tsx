import React, { lazy, Suspense, useState } from "react";
import { prepareLoginModules } from '../services/loginModules';
import LoginView from "./LoginView";
import { loginDiagnosticsEnabled } from "../services/identityConfig";
import { beginDiagnosticPhase, finishDiagnosticPhase, measureDiagnosticPhase } from "../services/readDiagnostics";
const ReadDiagnosticsPanel = lazy(() => import("./ReadDiagnosticsPanel"));
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
    const loginTiming = beginDiagnosticPhase("Inicio de sesión: verificar acceso");
    let succeeded = false;
    const appCode = measureDiagnosticPhase("Login: cargar aplicación", () => import("./App"));
    // Handle an early chunk failure while the authentication request is pending.
    appCode.catch(() => {});
    try {
      const { loginVerified, recordVerifiedLogin } =
        await measureDiagnosticPhase("Login: cargar módulo de acceso", () => import("../services/verifiedAuth"));
      const verified = await loginVerified(identifier, password);
      const module = await appCode;
      setApp(() => module.default);
      setSession(verified);
      succeeded = true;
      recordVerifiedLogin(verified.user);
    } catch (error: any) {
      alert(
        error?.code === "functions/resource-exhausted"
          ? "Demasiados intentos. Espera unos minutos."
          : error?.code === "functions/unauthenticated"
            ? "Usuario o contraseña incorrecta."
            : "No se pudo completar el ingreso. Revisa la conexión e intenta nuevamente.",
      );
    } finally { finishDiagnosticPhase(loginTiming, !succeeded); }
  }
  if (App && session) return <App initialSession={session} />;
  return (
    <><div className="min-h-screen flex items-center justify-center p-4">
      <LoginView onLogin={login} isAppReady onPrepareLogin={() => { prepareLoginModules().catch(() => {}); }} />
    </div>{loginDiagnosticsEnabled && <Suspense fallback={null}><ReadDiagnosticsPanel available loginMode /></Suspense>}</>
  );
}
