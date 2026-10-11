import React from 'react';

type ErrorState = { failed: boolean; message: string; component: string };

export default class AppErrorBoundary extends React.Component<React.PropsWithChildren, ErrorState> {
  state: ErrorState = { failed: false, message: '', component: '' };

  static getDerivedStateFromError(error: Error): Partial<ErrorState> {
    return { failed: true, message: error?.message || 'Error desconocido' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Error de aplicación:', error, info);
    this.setState({ component: info.componentStack || '' });
  }

  render() {
    const moduleLoadFailed = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .* failed/i.test(this.state.message);
    if (this.state.failed) return (
      <div role="alert" className="p-8 text-center text-slate-900 dark:text-white">
        <h1 className="text-xl font-bold">No se pudo cargar esta pantalla</h1>
        <p className="my-4">{moduleLoadFailed ? 'No se pudo descargar el módulo. Comprueba tu conexión y actualiza la aplicación. Si tienes una venta sin guardar, vuelve al punto de venta antes de actualizar.' : 'Puedes elegir otro módulo. Si vuelve a ocurrir, comparte el diagnóstico.'}</p>
        <details className="mx-auto my-4 max-w-xl rounded-lg border border-slate-500 p-3 text-left text-xs">
          <summary className="cursor-pointer font-semibold">Ver diagnóstico del error</summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words">{this.state.message}{'\n'}{this.state.component}</pre>
        </details>
        <button className="rounded-xl bg-indigo-600 px-5 py-3 text-white" onClick={() => moduleLoadFailed ? window.location.reload() : this.setState({ failed: false, message: '', component: '' })}>{moduleLoadFailed ? 'Actualizar aplicación' : 'Reintentar pantalla'}</button>
      </div>
    );
    return this.props.children;
  }
}
