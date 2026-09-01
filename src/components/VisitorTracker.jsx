import React, { useEffect, useRef } from 'react';
import axios from 'axios';

// Ensure this matches your backend URL.
const COMPILER_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export default function VisitorTracker({ children }) {
  const sessionIdRef = useRef(`sess_${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    let intervalId;
    let locationData = { lat: null, lng: null, locationStr: null, city: '', country: '', countryCode: '' };

    const startPinging = async () => {
      try {
        // Fetch approximate location using free IP Geo API
        const res = await axios.get('https://get.geojs.io/v1/ip/geo.json');
        if (res.data) {
          if (res.data.latitude && res.data.longitude) {
            locationData.lat = parseFloat(res.data.latitude);
            locationData.lng = parseFloat(res.data.longitude);
          }
          
          locationData.city = res.data.city || '';
          locationData.country = res.data.country || '';
          locationData.countryCode = res.data.country_code || '';
          if (locationData.city || locationData.country) {
            locationData.locationStr = [locationData.city, locationData.country].filter(Boolean).join(', ');
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
            locationStr: locationData.locationStr,
            city: locationData.city,
            country: locationData.country,
            countryCode: locationData.countryCode
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
