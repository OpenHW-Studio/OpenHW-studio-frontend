import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * VersionWatcher
 *
 * Headless background worker that monitors for new production deployments.
 * When a new version is detected, it automatically purges stale caches and
 * reloads seamlessly in the background without any manual clicks or popups.
 */
export default function VersionWatcher() {
  const location = useLocation();
  const checkingRef = useRef(false);

  // Read build timestamp injected by Vite at compile time
  const currentBuildTime =
    typeof __APP_BUILD_TIME__ !== "undefined" ? Number(__APP_BUILD_TIME__) : null;

  const checkForUpdate = async () => {
    // 1. Never run in development or on localhost (Vite HMR handles dev)
    if (
      import.meta.env.DEV ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.endsWith(".localhost") ||
      window.location.hostname === "[::1]"
    ) {
      return;
    }

    // 2. Needs valid build timestamp and must not overlap
    if (!currentBuildTime || checkingRef.current) return;

    checkingRef.current = true;
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      if (res.ok) {
        const data = await res.json();
        const remoteBuildTime = data?.buildTime ? Number(data.buildTime) : 0;

        // Check if remote build is strictly newer
        if (remoteBuildTime > currentBuildTime) {
          // Prevent infinite reload loops using sessionStorage
          const alreadyReloadedFor = sessionStorage.getItem("openhw_reloaded_version");
          if (alreadyReloadedFor !== String(remoteBuildTime)) {
            sessionStorage.setItem("openhw_reloaded_version", String(remoteBuildTime));

            // Purge service worker caches
            if ("caches" in window) {
              try {
                const keys = await caches.keys();
                await Promise.all(keys.map((k) => caches.delete(k)));
              } catch (e) {
                // Ignore cache delete error
              }
            }

            // Silently reload to the new version automatically
            window.location.reload();
          }
        }
      }
    } catch (err) {
      // Ignore network errors
    } finally {
      checkingRef.current = false;
    }
  };

  // Check on route navigation
  useEffect(() => {
    checkForUpdate();
  }, [location.pathname]);

  // Periodic background check every 10 minutes
  useEffect(() => {
    const interval = setInterval(checkForUpdate, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Completely headless — no visual popups or toasts
  return null;
}
