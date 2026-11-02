import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AdminApp from './features/admin/AdminApp';
import App from './app/App';
import './styles/tokens.css';
import './styles/global.css';

function Root() {
  const adminPath = `${import.meta.env.BASE_URL}admin`.replace(/\/+$/, '');
  const currentPath = window.location.pathname.replace(/\/+$/, '');
  return currentPath === adminPath ? <AdminApp /> : <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
