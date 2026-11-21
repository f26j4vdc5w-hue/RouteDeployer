export const COMMUNITY_AUTH_RETURN_TO_KEY = 'community-auth-return-to';
export const COMMUNITY_AUTH_RETURN_TO_SAVED_AT_KEY = 'community-auth-return-to-saved-at';

export function getCommunityRouteReturnTo(basePath: string, pathname: string, search: string, hash: string): string | null {
  const normalizedBase = `/${basePath.replace(/^\/+|\/+$/g, '')}`;
  const appBase = normalizedBase === '/' ? '/' : `${normalizedBase}/`;
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const reservedPaths = new Set([
    normalizedBase === '/' ? '/einstellungen' : `${normalizedBase}/einstellungen`,
    normalizedBase === '/' ? '/profil' : `${normalizedBase}/profil`,
    normalizedBase === '/' ? '/getraenke' : `${normalizedBase}/getraenke`,
    normalizedBase === '/' ? '/admin' : `${normalizedBase}/admin`,
    normalizedBase === '/' ? '/datenschutz' : `${normalizedBase}/datenschutz`,
  ]);
  if (reservedPaths.has(normalizedPath)) return null;

  const params = new URLSearchParams(search);
  const basePathname = normalizedBase === '/' ? '/' : normalizedBase;
  if (normalizedPath === basePathname && !params.get('tour')) return null;
  if (normalizedPath === basePathname) return `${pathname}${search}${hash}`;
  if (pathname.startsWith(appBase)) return `${pathname}${search}${hash}`;
  return null;
}

export function rememberCommunityAuthReturnTo(basePath: string) {
  const target = getCommunityRouteReturnTo(
    basePath,
    window.location.pathname,
    window.location.search,
    window.location.hash,
  );
  if (!target) {
    sessionStorage.removeItem(COMMUNITY_AUTH_RETURN_TO_KEY);
    sessionStorage.removeItem(COMMUNITY_AUTH_RETURN_TO_SAVED_AT_KEY);
    return null;
  }
  sessionStorage.setItem(COMMUNITY_AUTH_RETURN_TO_KEY, target);
  sessionStorage.setItem(COMMUNITY_AUTH_RETURN_TO_SAVED_AT_KEY, String(Date.now()));
  return target;
}

export function redirectAfterCommunityLogin(basePath: string) {
  const target = rememberCommunityAuthReturnTo(basePath);
  window.location.replace(target ?? basePath);
}
