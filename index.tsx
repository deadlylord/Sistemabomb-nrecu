
import VestikaLoader from './components/VestikaLoader';
import React from 'react';
import ReactDOM from 'react-dom/client';
import AppErrorBoundary from './components/AppErrorBoundary';
const App = React.lazy(() => import('./components/App'));

function Startup() {
  React.useEffect(() => { window.dispatchEvent(new Event('vestika:mounted')); }, []);
  return <AppErrorBoundary><React.Suspense fallback={<VestikaLoader fullScreen />}><App /></React.Suspense></AppErrorBoundary>;
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