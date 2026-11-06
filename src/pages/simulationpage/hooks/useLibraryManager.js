import { useEffect, useRef, useState } from "react";
import {
  searchLibraries,
  installLibrary,
  fetchInstalledLibraries,
} from "../../../services/simulatorService";

/**
 * Library Manager domain, extracted verbatim from SimulatorPage.jsx.
 *
 * Owns: libQuery/libResults/libInstalled/isSearchingLib/installingLib/
 * libMessage state + libSearchCache ref + the 400ms debounced search effect
 * + handleSearchLibraries (immediate, cache-first), handleInstallLibrary,
 * loadLibraries.
 *
 * Behavior contract: identical search cache semantics, identical 503-gated
 * error message, identical lastCompiledRef invalidation on install.
 * Verify via Libraries panel Playwright checks (search + install flows).
 */
export function useLibraryManager({ lastCompiledRef }) {
  // ── Library Manager State ───────────────────────────────────────────────────
  const [libQuery, setLibQuery] = useState("");
  const [libResults, setLibResults] = useState([]);
  const [libInstalled, setLibInstalled] = useState([]);
  const [isSearchingLib, setIsSearchingLib] = useState(false);
  const [installingLib, setInstallingLib] = useState(null);
  const [libMessage, setLibMessage] = useState(null);
  const libSearchCache = useRef({});

  useEffect(() => {
    if (!libQuery.trim() || libQuery.trim().length < 2) {
      setLibResults([]);
      return;
    }

    // Check cache first
    if (libSearchCache.current[libQuery.trim()]) {
      setLibResults(libSearchCache.current[libQuery.trim()]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingLib(true);
      try {
        const results = await searchLibraries(libQuery);
        libSearchCache.current[libQuery.trim()] = results;
        setLibResults(results);
      } catch (err) {
        console.error("[Library Search Error]", err);
      } finally {
        setIsSearchingLib(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [libQuery]);

  const loadLibraries = async () => {
    try {
      const libraries = await fetchInstalledLibraries();
      setLibInstalled(libraries);
      setLibMessage(null);
    } catch (err) {
      console.error("Failed to fetch installed libraries", err);
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.error || "Failed to load installed libraries.";
      if (status === 503) {
        setLibMessage({ type: "error", text: msg });
      }
    }
  };

  // loadLibraries is called from the demo-load effect below when no demo is loading,
  // or deferred so that circuit.png gets exclusive network priority on demo pages.

  const handleSearchLibraries = async (e) => {
    if (e) e.preventDefault();
    if (!libQuery.trim()) return;

    // Check cache first
    if (libSearchCache.current[libQuery.trim()]) {
      setLibResults(libSearchCache.current[libQuery.trim()]);
      setLibMessage(null);
      return;
    }

    setIsSearchingLib(true);
    setLibMessage(null);
    try {
      const libraries = await searchLibraries(libQuery);
      libSearchCache.current[libQuery.trim()] = libraries;
      setLibResults(libraries);
      if (libraries.length === 0)
        setLibMessage({ type: "error", text: "No libraries found." });
    } catch (err) {
      setLibMessage({ type: "error", text: "Failed to search libraries." });
    } finally {
      setIsSearchingLib(false);
    }
  };

  const handleInstallLibrary = async (libName) => {
    setInstallingLib(libName);
    setLibMessage(null);
    try {
      const res = await installLibrary(libName);
      setLibMessage({ type: "success", text: res.message });
      loadLibraries();
      lastCompiledRef.current = null;
    } catch (err) {
      setLibMessage({ type: "error", text: "Failed to install library." });
    } finally {
      setInstallingLib(null);
    }
  };

  return {
    libQuery,
    setLibQuery,
    libResults,
    setLibResults,
    libInstalled,
    setLibInstalled,
    isSearchingLib,
    setIsSearchingLib,
    installingLib,
    setInstallingLib,
    libMessage,
    setLibMessage,
    libSearchCache,
    loadLibraries,
    handleSearchLibraries,
    handleInstallLibrary,
  };
}
