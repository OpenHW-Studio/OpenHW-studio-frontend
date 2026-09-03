import React, { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { RefreshCw, Sparkles, X } from "lucide-react";

/**
 * VersionWatcher
 *
 * Automatically monitors the deployed application version and alerts the user
 * or seamlessly reloads when an updated build is deployed, eliminating stale
 * cache issues across all pages.
 */
export default function VersionWatcher() {
  const location = useLocation();
  const [hasNewVersion, setHasNewVersion] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const checkingRef = useRef(false);

  // Read the build timestamp injected at compile time
  const currentBuildTime =
    typeof __APP_BUILD_TIME__ !== "undefined" ? Number(__APP_BUILD_TIME__) : null;

  const checkForUpdate = async () => {
    // Only perform version checks in production or non-file environments with a valid build timestamp
    if (!currentBuildTime || checkingRef.current) return;
    if (
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1"
    ) {
      return; // In local development, Vite HMR handles updates instantly
    }

    checkingRef.current = true;
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.buildTime && Number(data.buildTime) > currentBuildTime) {
          console.log(
            `[VersionWatcher] New version detected (Current: ${currentBuildTime}, Remote: ${data.buildTime})`
          );
          setHasNewVersion(true);
        }
      }
    } catch (err) {
      // Ignore network errors
    } finally {
      checkingRef.current = false;
    }
  };

  // Check on route transitions
  useEffect(() => {
    checkForUpdate();
  }, [location.pathname]);

  // Periodic check every 5 minutes
  useEffect(() => {
    const interval = setInterval(checkForUpdate, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleApplyUpdate = async () => {
    // Purge browser caches to guarantee fresh assets
    if ("caches" in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (e) {
        // Non-fatal
      }
    }
    // Hard reload
    window.location.reload();
  };

  if (!hasNewVersion || dismissed) return null;

  return (
    <div className="version-update-banner" role="alert">
      <div className="version-update-content">
        <Sparkles size={16} className="version-sparkle-icon" />
        <span>
          A new version of <strong>OpenHW-Studio</strong> is available!
        </span>
      </div>
      <div className="version-update-actions">
        <button
          className="version-update-btn"
          onClick={handleApplyUpdate}
        >
          <RefreshCw size={13} />
          <span>Update Now</span>
        </button>
        <button
          className="version-dismiss-btn"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          <X size={15} />
        </button>
      </div>

      <style>{`
        .version-update-banner {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 999999;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 18px;
          background: #0d1525;
          color: #f1f5f9;
          border: 1px solid #00d4ff;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 212, 255, 0.2);
          font-family: 'Space Grotesk', system-ui, sans-serif;
          font-size: 13.5px;
          animation: versionSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes versionSlideUp {
          from { transform: translateY(50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .version-update-content {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .version-sparkle-icon {
          color: #00d4ff;
          flex-shrink: 0;
        }
        .version-update-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .version-update-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 8px;
          background: #00d4ff;
          color: #050811;
          font-weight: 700;
          font-size: 12.5px;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .version-update-btn:hover {
          background: #38bdf8;
          transform: translateY(-1px);
        }
        .version-dismiss-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.15s ease;
        }
        .version-dismiss-btn:hover {
          color: #f1f5f9;
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}
