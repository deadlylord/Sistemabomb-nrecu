
import React from 'react';
import ReactDOM from 'react-dom/client';
import AppErrorBoundary from './components/AppErrorBoundary';
const App = React.lazy(() => import('./components/App'));

function Startup() {
  React.useEffect(() => { window.dispatchEvent(new Event('vestika:mounted')); }, []);
  return <AppErrorBoundary><React.Suspense fallback={<div role="status" aria-label="Cargando Vestika" className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950"><div className="flex flex-col items-center gap-5"><div className="relative w-24 h-24 flex items-center justify-center"><div className="absolute inset-0 rounded-full border-[3px] border-slate-200 dark:border-slate-800 border-t-fuchsia-500 border-r-violet-500 animate-spin" /><img src="/assets/vestika.png" alt="Vestika" className="w-16 h-16 rounded-2xl object-contain" /></div><div className="flex gap-1.5"><span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" /><span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" /><span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" /></div></div></div>}><App /></React.Suspense></AppErrorBoundary>;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Startup />
  </React.StrictMode>
);