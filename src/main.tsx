import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-ext-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-ext-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-ext-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-ext-700.css';
import '@fontsource/inter/latin-800.css';
import '@fontsource/inter/latin-ext-800.css';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { navigateFromPush } from './features/admin/adminPushNavigation';
import './styles/tokens.css';
import './styles/global.css';

const AdminApp = lazy(() => import('./features/admin/AdminApp'));

const PrivacyPolicy = lazy(() => import('./features/legal/PrivacyPolicy'));
const DrinksApp = lazy(() => import('./features/drinks/DrinksApp'));

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    navigateFromPush(event.data, window.location, import.meta.env.BASE_URL);
  });
}

function Root() {
  const adminPath = `${import.meta.env.BASE_URL}admin`.replace(/\/+$/, '');
  const privacyPath = `${import.meta.env.BASE_URL}datenschutz`.replace(/\/+$/, '');
  const drinksPath = `${import.meta.env.BASE_URL}getraenke`.replace(/\/+$/, '');
  const currentPath = window.location.pathname.replace(/\/+$/, '');
  const baseOnly = import.meta.env.BASE_URL.replace(/\/+$/, '');
  
  if (currentPath === privacyPath) {
    return (
      <Suspense fallback={null}>
        <PrivacyPolicy />
      </Suspense>
    );
  }
  if (currentPath === drinksPath) {
    return (
      <Suspense fallback={<main className="backend-state" aria-live="polite">Getränkekasse wird geladen …</main>}>
        <DrinksApp />
      </Suspense>
    );
  }
  return currentPath === adminPath ? (
    <Suspense fallback={<main className="backend-state" aria-live="polite">Admin-Bereich wird geladen …</main>}>
      <AdminApp />
    </Suspense>
  ) : (
    <App isRootView={currentPath === baseOnly} />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
