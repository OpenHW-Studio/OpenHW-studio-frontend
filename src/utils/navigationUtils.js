/**
 * navigationUtils.js
 * Centralized navigation helpers for OpenHW Studio Gamification & Role Dashboards.
 */

export const LAST_ADVENTURE_KEY = 'openhw_last_adventure_url';

/**
 * Saves the current adventure URL (pathname + search) to session and local storage
 */
export function saveLastAdventureUrl(url) {
  if (!url || typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(LAST_ADVENTURE_KEY, url);
    localStorage.setItem(LAST_ADVENTURE_KEY, url);
  } catch (err) {
    console.debug('Failed to save last adventure URL to storage:', err);
  }
}

/**
 * Retrieves the last visited adventure URL from storage
 */
export function getLastAdventureUrl() {
  if (typeof window === 'undefined') return null;
  try {
    const sessionUrl = sessionStorage.getItem(LAST_ADVENTURE_KEY);
    if (sessionUrl && sessionUrl.startsWith('/adventure')) return sessionUrl;
    const localUrl = localStorage.getItem(LAST_ADVENTURE_KEY);
    if (localUrl && localUrl.startsWith('/adventure')) return localUrl;
  } catch (err) {
    console.debug('Failed to get last adventure URL from storage:', err);
  }
  return null;
}

/**
 * Constructs a normalized adventure URL preserving mapId, journey, and classId.
 */
export function buildAdventureUrl({ mapId, journey, classId, extra = {} } = {}) {
  const sp = new URLSearchParams();
  if (mapId) {
    sp.set('mapId', mapId);
  } else if (journey) {
    sp.set('journey', journey);
  }
  if (classId) {
    sp.set('classId', classId);
  }
  Object.entries(extra).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      sp.set(k, String(v));
    }
  });
  const qs = sp.toString();
  return qs ? `/adventure?${qs}` : '/adventure';
}

/**
 * Resolves the accurate return URL when exiting a modal, certification, or sub-stage.
 * Resolution priority:
 * 1. location.state.returnTo
 * 2. query param ?returnTo=
 * 3. query params mapId / journey (+ classId)
 * 4. stored last adventure URL
 * 5. fallback journey (defaults to 'arduino')
 */
export function getAdventureReturnUrl({
  location,
  searchParams,
  fallbackJourney = 'arduino',
} = {}) {
  // 1. Direct router state returnTo
  if (location?.state?.returnTo && typeof location.state.returnTo === 'string') {
    return location.state.returnTo;
  }

  // 2. Query parameter ?returnTo=
  const returnToParam = searchParams?.get?.('returnTo');
  if (returnToParam && returnToParam.startsWith('/')) {
    return returnToParam;
  }

  // 3. Derived from current query params if mapId or journey is present
  const mapId = searchParams?.get?.('mapId');
  const journey = searchParams?.get?.('journey');
  const classId = searchParams?.get?.('classId');

  if (mapId) {
    return buildAdventureUrl({ mapId, classId });
  }
  if (journey) {
    return buildAdventureUrl({ journey, classId });
  }
  if (classId) {
    return buildAdventureUrl({ journey: fallbackJourney, classId });
  }

  // 4. Stored last adventure URL
  const storedUrl = getLastAdventureUrl();
  if (storedUrl) {
    return storedUrl;
  }

  // 5. Default fallback
  return buildAdventureUrl({ journey: fallbackJourney });
}

/**
 * Returns role-aware dashboard path with optional classroom context and tab retention.
 */
export function getRoleDashboardPath(user, { classId, tab } = {}) {
  if (classId) {
    if (user?.role === 'teacher') {
      return `/teacher/classes/${encodeURIComponent(classId)}`;
    }
    return `/student/classes/${encodeURIComponent(classId)}`;
  }

  let basePath = '/student/dashboard';
  if (user?.role === 'teacher') {
    basePath = '/teacher/dashboard';
  } else if (user?.role === 'admin') {
    basePath = '/admin/dashboard';
  }

  if (tab) {
    return `${basePath}?tab=${encodeURIComponent(tab)}`;
  }
  return basePath;
}

/**
 * Returns role-aware profile path.
 */
export function getRoleProfilePath(user) {
  if (user?.role === 'teacher') return '/teacher/profile';
  if (user?.role === 'admin') return '/admin/profile';
  return '/student/profile';
}
