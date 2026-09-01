import React, { useEffect, useRef } from 'react';
import axios from 'axios';

// Ensure this matches your backend URL.
const COMPILER_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export default function VisitorTracker({ children }) {
  const sessionIdRef = useRef(`sess_${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    // 1. Ignore localhost / 127.0.0.1 during local development
    const isLocalhost = Boolean(
      window.location.hostname === 'localhost' ||
      window.location.hostname === '[::1]' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local')
    );

    if (isLocalhost) {
      // Skip tracking local development sessions
      return;
    }

    let intervalId;

    const ping = async () => {
      try {
        // Send lightweight ping. The server resolves IP and geolocation server-side.
        await axios.post(`${COMPILER_URL}/public/ping`, {
          sessionId: sessionIdRef.current
        });
      } catch (err) {
        // Silently fail if backend is unreachable
      }
    };

    // Initial ping
    ping();

    // Ping every 5 minutes (300,000 ms)
    intervalId = setInterval(ping, 300000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return <>{children}</>;
}
