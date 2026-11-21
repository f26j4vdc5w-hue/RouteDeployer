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
import { CommunityAccount } from './features/community/CommunityAccount';
import { useCommunityAuth } from './features/community/useCommunityAuth';
import './styles/tokens.css';
import './styles/global.css';
import './features/admin/admin.css';

const AdminApp = lazy(() => import('./features/admin/AdminApp'));

const PrivacyPolicy = lazy(() => import('./features/legal/PrivacyPolicy'));
const DrinksApp = lazy(() => import('./features/drinks/DrinksApp'));

function SettingsApp() {
  const community = useCommunityAuth();
  return (
    <CommunityAccount
      email={community.session?.user.email ?? null}
      member={community.member}
      isAdmin={community.session?.user.app_metadata.role === 'admin'}
      loading={!community.authReady || community.loading}
      error={community.error}
      onRefresh={community.refresh}
      standalone
      showDrinks={Boolean(community.session)}
    />
  );
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    navigateFromPush(event.data, window.location, import.meta.env.BASE_URL);
  });
}

function Root() {
  const adminPath = `${import.meta.env.BASE_URL}admin`.replace(/\/+$/, '');
  const privacyPath = `${import.meta.env.BASE_URL}datenschutz`.replace(/\/+$/, '');
  const drinksPath = `${import.meta.env.BASE_URL}getraenke`.replace(/\/+$/, '');
  const settingsPath = `${import.meta.env.BASE_URL}einstellungen`.replace(/\/+$/, '');
  const oldProfilePath = `${import.meta.env.BASE_URL}profil`.replace(/\/+$/, '');
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
  if (currentPath === oldProfilePath) {
    const query = window.location.search;
    const hash = window.location.hash;
    window.history.replaceState(null, '', `${settingsPath}${query}${hash}`);
    return <SettingsApp />;
  }
  if (currentPath === settingsPath) {
    return <SettingsApp />;
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
