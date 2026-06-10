import React, { useState } from 'react';

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
  onSuccessInstall?: () => void;
}

export const PwaInstallModal: React.FC<PwaInstallModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onSuccessInstall
}) => {
  const [activeTab, setActiveTab] = useState<'android' | 'ios'>('android');
  const [installing, setInstalling] = useState(false);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      // Show the install prompt
      deferredPrompt.prompt();
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to install request: ${outcome}`);
      if (outcome === 'accepted') {
        if (onSuccessInstall) onSuccessInstall();
        onClose();
      }
    } catch (err) {
      console.error('Error during PWA installation:', err);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow effect at top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-accent/40 blur flex-shrink-0"></div>

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          aria-label="Cerrar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header Visual */}
        <div className="flex flex-col items-center text-center mt-2 mb-6">
          <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center text-accent mb-4 ring-4 ring-accent/5 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-slate-850 dark:text-white uppercase tracking-tight">Instalar App en el Celular</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-sm">
            Para usar la app de facturación con su icono propio, pantalla completa y modo nativo sin barra de navegación.
          </p>
        </div>

        {/* Browser Notice why they might see "Acceso Directo" */}
        <div className="bg-amber-500/10 border border-amber-550/20 text-amber-700 dark:text-amber-300 rounded-2xl p-4 text-xs space-y-1 mb-6">
          <div className="flex items-center gap-2 font-black uppercase text-[10px]">
            <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            ¿Por qué solo dice "Acceso Directo"?
          </div>
          <p className="leading-relaxed">
            Si abriste el enlace desde <strong>WhatsApp o Instagram</strong>, estás dentro de un navegador interno restrictivo que bloquea la instalación de aplicaciones nativas. Para solucionarlo, debes <strong>abrir la app en tu navegador normal (Chrome o Safari)</strong> de la siguiente manera:
          </p>
        </div>

        {/* Operating System Selector */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-6">
          <button 
            onClick={() => setActiveTab('android')}
            className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-200 flex items-center justify-center gap-2
              ${activeTab === 'android' 
                ? 'bg-white dark:bg-slate-700 text-accent shadow-sm' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-750'}`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.523 15.3l1.816 3.146a.5.5 0 1 1-.866.5l-1.836-3.181a10.932 10.932 0 0 1-9.274 0l-1.836 3.181a.5.5 0 1 1-.866-.5l1.816-3.146A11.144 11.144 0 0 1 2 9.42h20a11.144 11.144 0 0 1-4.477 5.88zM7 6.71a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm10 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
            </svg>
            Android (Chrome)
          </button>
          <button 
            onClick={() => setActiveTab('ios')}
            className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-200 flex items-center justify-center gap-2
              ${activeTab === 'ios' 
                ? 'bg-white dark:bg-slate-700 text-accent shadow-sm' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-750'}`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.13.67-2.85 1.51-.62.73-1.16 1.87-1.01 2.98 1.11.09 2.21-.62 2.87-1.43z" />
            </svg>
            iPhone (Safari)
          </button>
        </div>

        {/* Step by Step Content */}
        <div className="space-y-4 mb-6 text-sm text-slate-650 dark:text-slate-300">
          {activeTab === 'android' ? (
            <>
              {/* Android Custom Button if Available */}
              {deferredPrompt ? (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 text-center space-y-3">
                  <p className="text-xs font-medium">¡Tu navegador es compatible para instalación directa!</p>
                  <button 
                    onClick={handleInstallClick}
                    disabled={installing}
                    className="w-full bg-accent hover:bg-accent-hover text-white py-3 px-4 rounded-xl font-bold uppercase text-xs shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-2"
                  >
                    {installing ? (
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    )}
                    {installing ? 'Instalando...' : 'Instalar App de Facturación'}
                  </button>
                </div>
              ) : null}

              <div className="space-y-3.5">
                <div className="flex gap-4 items-start">
                  <div className="w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-xs font-black shrink-0 text-slate-800 dark:text-slate-200">
                    1
                  </div>
                  <p className="leading-relaxed">
                    Si abriste la app desde <strong>WhatsApp</strong>, toca el icono de los <strong>tres puntos ⋮</strong> arriba a la derecha de la pantalla y pulsa <strong>"Abrir en Chrome"</strong> (u "Abrir en el navegador").
                  </p>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-xs font-black shrink-0 text-slate-800 dark:text-slate-200">
                    2
                  </div>
                  <p className="leading-relaxed">
                    Una vez abierta la página directamente en <strong>Chrome</strong>, toca nuevamente el botón de los <strong>tres puntos ⋮</strong> arriba a la derecha.
                  </p>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="w-6 h-6 bg-accent/10 rounded-full flex items-center justify-center text-xs font-black shrink-0 text-accent">
                    3
                  </div>
                  <p className="leading-relaxed">
                    Selecciona la opción que dice <strong>"Instalar aplicación"</strong> (o <strong>"Agregar a la pantalla principal"</strong> si es una versión anterior). Esto descargará la app nativa en tu teléfono.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3.5">
              <div className="flex gap-4 items-start">
                <div className="w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-xs font-black shrink-0 text-slate-800 dark:text-slate-200">
                  1
                </div>
                <p className="leading-relaxed">
                  Abre la app utilizando obligatoriamente el navegador <strong>Safari</strong> de Apple.
                </p>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-xs font-black shrink-0 text-slate-800 dark:text-slate-200">
                  2
                </div>
                <p className="leading-relaxed">
                  Toca el botón <strong>"Compartir" ⎋</strong> (el cuadrado con la flecha apuntando hacia arriba) en la barra de menú inferior de Safari.
                </p>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-6 h-6 bg-accent/10 rounded-full flex items-center justify-center text-xs font-black shrink-0 text-accent">
                  3
                </div>
                <p className="leading-relaxed">
                  Desliza hacia abajo en el menú de compartir y selecciona la opción <strong>"Agregar a inicio"</strong>. Ponle de nombre "Street/Bombón" y pulsa Agregar.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action button */}
        <div className="mt-8 flex gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-750 dark:text-slate-200 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all"
          >
            Entendido, Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
