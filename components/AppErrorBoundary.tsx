import React from 'react';

export default class AppErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('Error de aplicación:', error, info); }
  render() {
    if (this.state.failed) return (
      <div role="alert" className="p-8 text-center text-slate-900 dark:text-white">
        <h1 className="text-xl font-bold">No se pudo cargar esta pantalla</h1>
        <p className="my-4">Puedes elegir otro módulo o volver a abrir la aplicación.</p>
        <button className="rounded-xl bg-indigo-600 px-5 py-3 text-white" onClick={() => window.location.reload()}>Volver a abrir</button>
      </div>
    );
    return this.props.children;
  }
}
