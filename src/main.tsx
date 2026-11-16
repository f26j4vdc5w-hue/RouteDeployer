import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
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
  const roadbookBase = `${import.meta.env.BASE_URL}roadbook`.replace(/\/+$/, '');
  const adminPath = `${import.meta.env.BASE_URL}admin`.replace(/\/+$/, '');
  const privacyPath = `${import.meta.env.BASE_URL}datenschutz`.replace(/\/+$/, '');
  const drinksPath = `${import.meta.env.BASE_URL}getraenke`.replace(/\/+$/, '');
  const currentPath = window.location.pathname.replace(/\/+$/, '');
  
  if (currentPath === import.meta.env.BASE_URL.replace(/\/+$/, '')) {
    window.location.replace(`${roadbookBase}/`);
    return null;
  }
  
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
    <App />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
