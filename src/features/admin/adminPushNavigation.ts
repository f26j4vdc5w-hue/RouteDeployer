export function navigateFromPush(
  data: unknown,
  location: Pick<Location, 'origin' | 'assign'>,
  baseUrl: string,
) {
  if (!data || typeof data !== 'object' || !('type' in data) || !('url' in data)) return;
  const adminUrl = new URL(`${baseUrl}admin/`, location.origin).href;
  if (data.type === 'ROADBOOK_OPEN_NOTIFICATION' && data.url === adminUrl) {
    location.assign(adminUrl);
  }
}
