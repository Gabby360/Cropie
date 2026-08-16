// CROPIE — Pure Google Maps Farm Geolocation Service Module
// Handles Google Maps JavaScript API loading, interactive map initialization, Places Autocomplete,
// single draggable custom green farm marker pin, Google Geocoder reverse-geocoding, browser GPS telemetry, and accuracy evaluation.

export class CropieLocationService {
  constructor() {
    this.DEFAULT_TIMEOUT = 15000; // 15 seconds
    this.googleMapsPromise = null;
    this.mapInstance = null;
    this.markerInstance = null;
    this.infoWindowInstance = null;
    this.geocoderInstance = null;
  }

  /**
   * Retrieve Google Maps API Key from Vite or global environment
   */
  getApiKey() {
    let key = '';
    try {
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
      }
    } catch {}

    if (!key && typeof window !== 'undefined') {
      key = window.VITE_GOOGLE_MAPS_API_KEY || window.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    }

    return key ? key.trim() : '';
  }

  /**
   * Dynamically load official Google Maps JavaScript API (places, geometry libraries)
   */
  async loadGoogleMapsScript() {
    if (typeof window !== 'undefined' && window.google && window.google.maps) {
      return window.google.maps;
    }

    if (this.googleMapsPromise) {
      return this.googleMapsPromise;
    }

    const apiKey = this.getApiKey();

    this.googleMapsPromise = new Promise((resolve, reject) => {
      const callbackName = `__initCropieGoogleMaps_${Date.now()}`;
      
      // Register global authentication failure handler
      window.gm_authFailure = () => {
        delete window[callbackName];
        this.googleMapsPromise = null;
        reject(new Error("Unable to load Google Maps. Please check your API key and billing status in Google Cloud Console."));
      };

      window[callbackName] = () => {
        delete window[callbackName];
        if (window.google && window.google.maps) {
          resolve(window.google.maps);
        } else {
          reject(new Error("Google Maps JavaScript API initialized without maps object."));
        }
      };

      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.defer = true;

      const keyParam = apiKey ? `key=${encodeURIComponent(apiKey)}&` : '';
      script.src = `https://maps.googleapis.com/maps/api/js?${keyParam}libraries=places,geometry&callback=${callbackName}`;

      script.onerror = () => {
        delete window[callbackName];
        this.googleMapsPromise = null;
        reject(new Error("Unable to load Google Maps. Please check your network connection and try again."));
      };

      document.head.appendChild(script);
    });

    return this.googleMapsPromise;
  }

  /**
   * Acquire fresh, high-accuracy GPS coordinates from browser Geolocation API
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
            errObj.message = "Location access was denied.";
            errObj.detail = "You can still select your farm manually on the map.";
            errObj.type = 'PERMISSION_DENIED';
          } else if (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE) {
            errObj.message = "Your current location could not be detected.";
            errObj.detail = "Please try again or select your farm manually on the map.";
            errObj.type = 'TIMEOUT';
          } else {
            errObj.message = "We couldn't determine your current location.";
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
      accuracyText = `approximately ${acc} metres`;
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
   * Create an interactive Google Map instance with a single Draggable Custom Green Cropie Farm Marker Pin
   */
  async createFarmMap(containerEl, initialLat = 7.3824, initialLng = -1.3621, onMarkerChange = null) {
    if (!containerEl) return null;

    containerEl.innerHTML = '';

    try {
      const maps = await this.loadGoogleMapsScript();

      const mapOptions = {
        center: { lat: initialLat, lng: initialLng },
        zoom: 14,
        mapTypeId: maps.MapTypeId.ROADMAP,
        gestureHandling: 'greedy',
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        styles: [
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
        ]
      };

      this.mapInstance = new maps.Map(containerEl, mapOptions);

      // Custom Cropie Green SVG Pin Icon (#16a34a / #15803d + white circle & location icon)
      const cropieGreenSvgIcon = {
        url: `data:image/svg+xml;utf8,${encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="58" viewBox="0 0 48 58">
            <filter id="sdw" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.4"/>
            </filter>
            <g filter="url(#sdw)">
              <path d="M24 0C10.748 0 0 10.748 0 24c0 18 24 34 24 34s24-16 24-34C48 10.748 37.252 0 24 0z" fill="#16a34a"/>
              <path d="M24 3C12.402 3 3 12.402 3 24c0 15.5 21 30 21 30s21-14.5 21-30C45 12.402 35.598 3 24 3z" fill="#15803d"/>
              <circle cx="24" cy="22" r="11" fill="#ffffff"/>
              <path d="M24 15c-3.866 0-7 3.134-7 7 0 5.25 7 12 7 12s7-6.75 7-12c0-3.866-3.134-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#15803d"/>
            </g>
          </svg>
        `)}`,
        scaledSize: new maps.Size(48, 58),
        anchor: new maps.Point(24, 58)
      };

      // Single active Draggable Marker
      this.markerInstance = new maps.Marker({
        position: { lat: initialLat, lng: initialLng },
        map: this.mapInstance,
        icon: cropieGreenSvgIcon,
        draggable: true,
        animation: maps.Animation.DROP,
        title: '📍 Your Farm Location (Drag pin to adjust)'
      });

      // Marker InfoWindow Badge
      this.infoWindowInstance = new maps.InfoWindow({
        content: `<div style="font-weight: 800; font-family: sans-serif; font-size: 13px; color: #166534; padding: 2px 4px;">📍 Your Farm Location</div>`,
        disableAutoPan: true
      });
      this.infoWindowInstance.open(this.mapInstance, this.markerInstance);

      // Handle Marker Drag Event
      maps.event.addListener(this.markerInstance, 'dragend', () => {
        const pos = this.markerInstance.getPosition();
        const lat = pos.lat();
        const lng = pos.lng();
        if (typeof onMarkerChange === 'function') {
          onMarkerChange(lat, lng, 'drag');
        }
      });

      // Handle Map Click Event (moves single marker to clicked position)
      maps.event.addListener(this.mapInstance, 'click', (e) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        this.markerInstance.setPosition(e.latLng);
        if (typeof onMarkerChange === 'function') {
          onMarkerChange(lat, lng, 'click');
        }
      });

      // Add Custom Current Location Control Button inside map
      this.addMyLocationControl(this.mapInstance, onMarkerChange);

      return {
        map: this.mapInstance,
        marker: this.markerInstance
      };

    } catch (err) {
      console.error("Google Maps initialization error:", err);
      throw err;
    }
  }

  /**
   * Center map & update marker position
   */
  updateMapPosition(lat, lng, zoom = 15) {
    if (this.mapInstance && this.markerInstance) {
      const pos = { lat: parseFloat(lat), lng: parseFloat(lng) };
      this.mapInstance.setCenter(pos);
      this.mapInstance.setZoom(zoom);
      this.markerInstance.setPosition(pos);
    }
  }

  /**
   * Add custom floating "Center on My Location" control button on the Google Map
   */
  addMyLocationControl(map, onMarkerChange) {
    if (!map || !window.google || !window.google.maps) return;

    const controlDiv = document.createElement('div');
    controlDiv.style.margin = '10px';

    const controlBtn = document.createElement('button');
    controlBtn.type = 'button';
    controlBtn.className = 'google-maps-my-location-btn';
    controlBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Center on My Location';
    controlBtn.title = 'Center map on current GPS location';

    controlBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      controlBtn.disabled = true;
      controlBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Locating...';

      try {
        const pos = await this.getCurrentPosition();
        this.updateMapPosition(pos.latitude, pos.longitude, 16);
        if (typeof onMarkerChange === 'function') {
          onMarkerChange(pos.latitude, pos.longitude, 'my_location_button', pos.accuracy);
        }
      } catch (err) {
        alert(err.message || "Unable to acquire current location.");
      } finally {
        controlBtn.disabled = false;
        controlBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Center on My Location';
      }
    });

    controlDiv.appendChild(controlBtn);
    map.controls[window.google.maps.ControlPosition.TOP_RIGHT].push(controlDiv);
  }

  /**
   * Attach Google Places Autocomplete to an input element
   */
  async attachPlacesAutocomplete(inputEl, onPlaceSelect) {
    if (!inputEl) return null;

    try {
      const maps = await this.loadGoogleMapsScript();
      if (!maps.places) return null;

      const autocomplete = new maps.places.Autocomplete(inputEl, {
        types: ['geocode', 'establishment']
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place && place.geometry && place.geometry.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const formattedName = place.formatted_address || place.name || inputEl.value;

          if (this.mapInstance && this.markerInstance) {
            this.updateMapPosition(lat, lng, 15);
          }

          if (typeof onPlaceSelect === 'function') {
            onPlaceSelect({
              name: formattedName,
              latitude: lat,
              longitude: lng,
              place
            });
          }
        }
      });

      return autocomplete;

    } catch (err) {
      console.warn("Places Autocomplete notice:", err);
      return null;
    }
  }

  /**
   * Reverse-geocode latitude and longitude using Google Maps Geocoder API with robust fallbacks
   */
  async reverseGeocode(latitude, longitude) {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    try {
      const maps = await this.loadGoogleMapsScript();
      if (maps && maps.Geocoder) {
        if (!this.geocoderInstance) {
          this.geocoderInstance = new maps.Geocoder();
        }

        const res = await new Promise((resolve) => {
          this.geocoderInstance.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === 'OK' && results && results.length > 0) {
              resolve(results);
            } else {
              resolve(null);
            }
          });
        });

        if (res && res.length > 0) {
          const best = res[0];
          const components = best.address_components || [];
          
          let locality = '';
          let adminArea1 = '';
          let adminArea2 = '';
          let country = 'Ghana';

          components.forEach(c => {
            const types = c.types || [];
            if (types.includes('locality') || types.includes('sublocality') || types.includes('neighborhood') || types.includes('administrative_area_level_3')) {
              if (!locality) locality = c.long_name;
            }
            if (types.includes('administrative_area_level_2')) {
              adminArea2 = c.long_name;
            }
            if (types.includes('administrative_area_level_1')) {
              adminArea1 = c.long_name;
            }
            if (types.includes('country')) {
              country = c.long_name;
            }
          });

          const town = locality || adminArea2 || best.formatted_address.split(',')[0] || '';
          const region = (adminArea1 && adminArea1 !== town) ? `${adminArea1.replace(/Region/i, '').trim()} Region, ` : '';

          return {
            locationName: town ? `${town}, ${region}${country}` : best.formatted_address,
            town: town || best.formatted_address.split(',')[0],
            region: adminArea1,
            district: adminArea2,
            country,
            formattedAddress: best.formatted_address
          };
        }
      }
    } catch (gErr) {
      console.warn("Google Geocoder notice:", gErr);
    }

    // Secondary HTTP Reverse Geocode Fallbacks
    try {
      const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
      const res = await fetch(bdcUrl);
      if (res.ok) {
        const data = await res.json();
        const locality = data.locality || data.city || data.localityInfo?.administrative?.[2]?.name || '';
        const principalSubdivision = data.principalSubdivision || data.localityInfo?.administrative?.[1]?.name || '';
        const countryName = data.countryName || 'Ghana';
        
        if (locality) {
          const region = (principalSubdivision && principalSubdivision !== locality) ? `${principalSubdivision}, ` : '';
          return {
            locationName: `${locality}, ${region}${countryName}`,
            town: locality,
            region: principalSubdivision,
            country: countryName
          };
        }
      }
    } catch (err) {}

    return {
      locationName: `Farm Location (${lat.toFixed(4)}° N, ${Math.abs(lng).toFixed(4)}° W)`,
      town: 'Farm Location',
      region: '',
      country: 'Ghana'
    };
  }

  /**
   * Search location string using Open-Meteo / Google Geocoding presets fallback
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

    for (const p of presets) {
      if (p.keys.some(k => new RegExp(`\\b${k}\\b`, 'i').test(q)) || p.name.toLowerCase().includes(q)) {
        results.push({
          name: p.name,
          lat: p.lat,
          lon: p.lon
        });
      }
    }

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
    } catch (err) {}

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
   * Log location telemetry
   */
  logLocationDebug(details) {
    console.log("%c📍 Cropie Google Maps Location Telemetry", "color: #16a34a; font-weight: bold; font-size: 13px;");
    console.log("Permission Status:", details.permissionStatus || 'granted');
    console.log("Latitude:", details.latitude);
    console.log("Longitude:", details.longitude);
    console.log("Accuracy:", details.accuracy ? `${Math.round(details.accuracy)} metres` : 'Unknown');
    console.log("Timestamp:", new Date(details.timestamp || Date.now()).toISOString());
    console.log("Resolved Location:", details.locationName || details.resolvedLocation || 'Unresolved');
  }
}
