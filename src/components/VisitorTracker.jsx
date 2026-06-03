import React, { useEffect, useRef } from 'react';
import axios from 'axios';

// Ensure this matches your backend URL.
const COMPILER_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');

export default function VisitorTracker({ children }) {
  const sessionIdRef = useRef(`sess_${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    let intervalId;
    let locationData = { lat: null, lng: null, locationStr: null };

    const startPinging = async () => {
      try {
        // Fetch approximate location using free IP Geo API
        const res = await axios.get('https://get.geojs.io/v1/ip/geo.json');
        if (res.data && res.data.latitude && res.data.longitude) {
          locationData.lat = parseFloat(res.data.latitude);
          locationData.lng = parseFloat(res.data.longitude);
          
          const city = res.data.city || '';
          const country = res.data.country || '';
          if (city || country) {
              locationData.locationStr = [city, country].filter(Boolean).join(', ');
          }
        }
      } catch (err) {
        console.warn('Could not fetch geolocation for visitor tracker:', err.message);
      }

      const ping = async () => {
        try {
          await axios.post(`${COMPILER_URL}/public/ping`, {
            sessionId: sessionIdRef.current,
            lat: locationData.lat,
            lng: locationData.lng,
            locationStr: locationData.locationStr
          });
        } catch (err) {
            // Silently fail if backend is down to not pollute console during dev
        }
      };

      // Initial ping
      ping();

      // Ping every 5 minutes (300,000 ms)
      intervalId = setInterval(ping, 300000);
    };

    startPinging();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return <>{children}</>;
}
