// CROPIE — Browser Geolocation & Reverse Geocoding Service
// Handles high-accuracy GPS detection, accuracy verification, reverse-geocoding, error handling, and location search

export class CropieLocationService {
  constructor() {
    this.DEFAULT_TIMEOUT = 15000; // 15 seconds
  }

  /**
   * Acquire fresh, high-accuracy GPS coordinates from the browser Geolocation API
   * Options: enableHighAccuracy: true, maximumAge: 0, timeout: 15000
   */
  async getCurrentPosition() {
    if (!navigator.geolocation) {
      const err = new Error("Geolocation is not supported by your browser.");
      err.type = 'UNSUPPORTED';
      throw err;
    }

    return new Promise((resolve, reject) => {
      const options = {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: this.DEFAULT_TIMEOUT
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = position.coords;
          resolve({
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy || 0,
            timestamp: position.timestamp || Date.now(),
            permissionStatus: 'granted'
          });
        },
        (error) => {
          let errObj = new Error();
          if (error.code === error.PERMISSION_DENIED) {
            errObj.message = "Cropie can't access your location.";
            errObj.detail = "Please enable location permission for your browser/device or search for your farm location manually.";
            errObj.type = 'PERMISSION_DENIED';
          } else if (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE) {
            errObj.message = "Cropie is having trouble detecting your location.";
            errObj.detail = "GPS fix timed out or signal was unavailable. Please try again or search manually.";
            errObj.type = 'TIMEOUT';
          } else {
            errObj.message = "Unable to detect your location.";
            errObj.detail = error.message || "An unknown location error occurred.";
            errObj.type = 'UNKNOWN';
          }
          errObj.code = error.code;
          reject(errObj);
        },
        options
      );
    });
  }

  /**
   * Evaluate location accuracy and return human-readable level and text
   */
  evaluateAccuracy(accuracyMeters) {
    const acc = Math.round(accuracyMeters);
    const isAccurate = acc <= 1000;
    
    let accuracyText = '';
    if (acc < 1000) {
      accuracyText = `approximately ${acc} m`;
    } else {
      accuracyText = `approximately ${(acc / 1000).toFixed(1)} km`;
    }

    let level = 'high';
    if (acc > 1000) {
      level = 'poor';
    } else if (acc > 100) {
      level = 'moderate';
    }

    return {
      isAccurate,
      accuracyText,
      level,
      meters: acc
    };
  }

  /**
   * Reverse-geocode latitude and longitude into human-readable display location name
   */
  async reverseGeocode(latitude, longitude) {
    // 1. Try BigDataCloud reverse-geocode client API
    try {
      const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
      const res = await fetch(bdcUrl);
      if (res.ok) {
        const data = await res.json();
        const locality = data.locality || data.city || data.localityInfo?.administrative?.[2]?.name || '';
        const principalSubdivision = data.principalSubdivision || data.localityInfo?.administrative?.[1]?.name || '';
        const country = data.countryName || 'Ghana';
        
        if (locality) {
          const region = (principalSubdivision && principalSubdivision !== locality) ? `${principalSubdivision}, ` : '';
          return `${locality}, ${region}${country}`;
        }
      }
    } catch (err) {
      console.warn('BigDataCloud reverse geocode notice:', err);
    }

    // 2. Secondary Fallback: OpenStreetMap Nominatim reverse geocode API
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=en`;
      const res = await fetch(nomUrl, { headers: { 'User-Agent': 'Cropie-Farm-App/1.0' } });
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const town = addr.town || addr.city || addr.village || addr.suburb || addr.county || '';
        const state = addr.state || addr.region || '';
        const country = addr.country || 'Ghana';

        if (town) {
          const regionStr = (state && state !== town) ? `${state}, ` : '';
          return `${town}, ${regionStr}${country}`;
        }
      }
    } catch (err) {
      console.warn('Nominatim reverse geocode notice:', err);
    }

    // 3. Fallback: Formatted Coordinate String
    return `Farm Location (${latitude.toFixed(4)}° N, ${Math.abs(longitude).toFixed(4)}° W)`;
  }

  /**
   * Search location string using Open-Meteo Geocoding API + preset fallbacks
   */
  async searchLocations(query) {
    if (!query || !query.trim()) return [];
    const q = query.trim().toLowerCase();

    const presets = [
      { name: 'Ejura, Ashanti Region, Ghana', lat: 7.3824, lon: -1.3621, keys: ['ejura'] },
      { name: 'Accra, Greater Accra, Ghana', lat: 5.5593, lon: -0.1974, keys: ['accra'] },
      { name: 'Laterbiokorshie, Accra, Ghana', lat: 5.5492, lon: -0.2315, keys: ['laterbiokorshie', 'laterbiokershie'] },
      { name: 'Dansoman, Accra, Ghana', lat: 5.5526, lon: -0.2524, keys: ['dansoman'] },
      { name: 'Madina, Accra, Ghana', lat: 5.6681, lon: -0.1663, keys: ['madina'] },
      { name: 'East Legon, Accra, Ghana', lat: 5.6358, lon: -0.1601, keys: ['east legon'] },
      { name: 'Kasoa, Central Region, Ghana', lat: 5.5344, lon: -0.4168, keys: ['kasoa'] },
      { name: 'Kumasi, Ashanti Region, Ghana', lat: 6.6885, lon: -1.6244, keys: ['kumasi'] },
      { name: 'Tamale, Northern Region, Ghana', lat: 9.4008, lon: -0.8393, keys: ['tamale'] },
      { name: 'Koforidua, Eastern Region, Ghana', lat: 6.0941, lon: -0.2591, keys: ['koforidua'] },
      { name: 'Sunyani, Bono Region, Ghana', lat: 7.3349, lon: -2.3123, keys: ['sunyani'] },
      { name: 'Cape Coast, Central Region, Ghana', lat: 5.1053, lon: -1.2466, keys: ['cape coast'] },
      { name: 'Ho, Volta Region, Ghana', lat: 6.6008, lon: 0.4713, keys: ['ho'] },
      { name: 'Takoradi, Western Region, Ghana', lat: 4.9016, lon: -1.7831, keys: ['takoradi'] },
      { name: 'Techiman, Bono East Region, Ghana', lat: 7.5828, lon: -1.9395, keys: ['techiman'] },
      { name: 'Bolgatanga, Upper East Region, Ghana', lat: 10.7856, lon: -0.8514, keys: ['bolgatanga'] },
      { name: 'Wa, Upper West Region, Ghana', lat: 10.0601, lon: -2.5099, keys: ['wa'] }
    ];

    const results = [];

    // Check presets first
    for (const p of presets) {
      if (p.keys.some(k => new RegExp(`\\b${k}\\b`, 'i').test(q)) || p.name.toLowerCase().includes(q)) {
        results.push({
          name: p.name,
          lat: p.lat,
          lon: p.lon
        });
      }
    }

    // Call Open-Meteo Geocoding API for dynamic world/Ghana locations
    try {
      const omUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
      const res = await fetch(omUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && data.results && data.results.length > 0) {
          data.results.forEach(item => {
            const region = item.admin1 ? `${item.admin1} Region, ` : '';
            const country = item.country || 'Ghana';
            const name = `${item.name}, ${region}${country}`;
            
            // Avoid exact duplicate names
            if (!results.some(r => r.name.toLowerCase() === name.toLowerCase())) {
              results.push({
                name,
                lat: parseFloat(item.latitude),
                lon: parseFloat(item.longitude)
              });
            }
          });
        }
      }
    } catch (err) {
      console.warn('Open-Meteo geocoding search notice:', err);
    }

    // Fallback item if no results match
    if (results.length === 0) {
      results.push({
        name: `${query.charAt(0).toUpperCase() + query.slice(1)}, Ghana`,
        lat: 5.5593,
        lon: -0.1974
      });
    }

    return results;
  }

  /**
   * Log comprehensive location telemetry for debugging as required
   */
  logLocationDebug(details) {
    console.log("%c📍 Cropie Location Telemetry Detected", "color: #16a34a; font-weight: bold; font-size: 13px;");
    console.log("Permission Status:", details.permissionStatus || 'granted');
    console.log("Latitude:", details.latitude);
    console.log("Longitude:", details.longitude);
    console.log("Accuracy:", details.accuracy ? `${Math.round(details.accuracy)} meters` : 'Unknown');
    console.log("Timestamp:", new Date(details.timestamp || Date.now()).toISOString());
    console.log("Resolved Location:", details.locationName || details.resolvedLocation || 'Unresolved');
  }
}
