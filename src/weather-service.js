// CROPIE — Open-Meteo Weather API Integration Service
// Fetches real weather telemetry and 7-day forecasts from https://api.open-meteo.com/v1/forecast

export class CropieWeatherService {
  constructor() {
    this.BASE_URL = 'https://api.open-meteo.com/v1/forecast';
    this.CACHE_KEY_PREFIX = 'cropie_weather_cache_';
    this.CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache TTL
  }

  // Reverse geocode latitude and longitude into locality display name
  async reverseGeocode(latitude, longitude) {
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

    return `Location (${latitude.toFixed(4)}° N, ${Math.abs(longitude).toFixed(4)}° W)`;
  }

  // Geocode location string into latitude, longitude, and display name using Open-Meteo Geocoding API
  async geocodeLocation(locationQuery) {
    if (!locationQuery) return null;
    const q = locationQuery.toLowerCase().trim();

    const ghanaPresetMap = {
      'laterbiokorshie': { name: 'Laterbiokorshie, Accra, Ghana', lat: 5.5492, lon: -0.2315 },
      'laterbiokershie': { name: 'Laterbiokorshie, Accra, Ghana', lat: 5.5492, lon: -0.2315 },
      'accra': { name: 'Accra, Greater Accra, Ghana', lat: 5.5593, lon: -0.1974 },
      'dansoman': { name: 'Dansoman, Accra, Ghana', lat: 5.5526, lon: -0.2524 },
      'madina': { name: 'Madina, Accra, Ghana', lat: 5.6681, lon: -0.1663 },
      'east legon': { name: 'East Legon, Accra, Ghana', lat: 5.6358, lon: -0.1601 },
      'spintex': { name: 'Spintex, Accra, Ghana', lat: 5.6268, lon: -0.1147 },
      'kasoa': { name: 'Kasoa, Central Region, Ghana', lat: 5.5344, lon: -0.4168 },
      'kumasi': { name: 'Kumasi, Ashanti Region, Ghana', lat: 6.6885, lon: -1.6244 },
      'ejura': { name: 'Ejura, Ashanti Region, Ghana', lat: 7.3824, lon: -1.3621 },
      'tamale': { name: 'Tamale, Northern Region, Ghana', lat: 9.4008, lon: -0.8393 },
      'koforidua': { name: 'Koforidua, Eastern Region, Ghana', lat: 6.0941, lon: -0.2591 },
      'sunyani': { name: 'Sunyani, Bono Region, Ghana', lat: 7.3349, lon: -2.3123 },
      'cape coast': { name: 'Cape Coast, Central Region, Ghana', lat: 5.1053, lon: -1.2466 },
      'ho': { name: 'Ho, Volta Region, Ghana', lat: 6.6008, lon: 0.4713 },
      'takoradi': { name: 'Takoradi, Western Region, Ghana', lat: 4.9016, lon: -1.7831 },
      'tema': { name: 'Tema, Greater Accra, Ghana', lat: 5.6698, lon: -0.0166 },
      'wa': { name: 'Wa, Upper West Region, Ghana', lat: 10.0601, lon: -2.5099 },
      'bolgatanga': { name: 'Bolgatanga, Upper East Region, Ghana', lat: 10.7856, lon: -0.8514 },
      'techiman': { name: 'Techiman, Bono East Region, Ghana', lat: 7.5828, lon: -1.9395 }
    };

    // Strict word boundary matching so 'ho' doesn't match 'who' or 'wa' match 'swap'
    for (const [key, preset] of Object.entries(ghanaPresetMap)) {
      if (new RegExp(`\\b${key}\\b`, 'i').test(q)) {
        return preset;
      }
    }

    // Open-Meteo Geocoding API (Fast, free, reliable, no CORS restrictions)
    try {
      const omUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationQuery)}&count=5&language=en&format=json`;
      const res = await fetch(omUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && data.results && data.results.length > 0) {
          const gh = data.results.find(r => r.country_code === 'GH') || data.results[0];
          const region = gh.admin1 ? `${gh.admin1} Region, ` : '';
          const country = gh.country || 'Ghana';
          return {
            name: `${gh.name}, ${region}${country}`,
            lat: parseFloat(gh.latitude),
            lon: parseFloat(gh.longitude)
          };
        }
      }
    } catch (err) {
      console.warn('Open-Meteo geocoding notice:', err);
    }

    return { name: `${locationQuery}, Ghana`, lat: 5.5593, lon: -0.1974 };
  }

  // Map WMO Weather Codes to human labels and FontAwesome icon classes
  getWmoWeatherInfo(code) {
    const wmoMap = {
      0: { label: 'Clear sky', icon: 'fa-sun', color: '#eab308' },
      1: { label: 'Mainly clear', icon: 'fa-cloud-sun', color: '#3b82f6' },
      2: { label: 'Partly cloudy', icon: 'fa-cloud-sun', color: '#3b82f6' },
      3: { label: 'Overcast', icon: 'fa-cloud', color: '#64748b' },
      45: { label: 'Foggy', icon: 'fa-smog', color: '#64748b' },
      48: { label: 'Depositing rime fog', icon: 'fa-smog', color: '#64748b' },
      51: { label: 'Light drizzle', icon: 'fa-cloud-rain', color: '#2563eb' },
      53: { label: 'Moderate drizzle', icon: 'fa-cloud-rain', color: '#2563eb' },
      55: { label: 'Dense drizzle', icon: 'fa-cloud-rain', color: '#2563eb' },
      61: { label: 'Slight rain', icon: 'fa-cloud-showers-heavy', color: '#2563eb' },
      63: { label: 'Moderate rain', icon: 'fa-cloud-showers-heavy', color: '#2563eb' },
      65: { label: 'Heavy rain', icon: 'fa-cloud-showers-heavy', color: '#1d4ed8' },
      80: { label: 'Slight rain showers', icon: 'fa-cloud-showers-heavy', color: '#2563eb' },
      81: { label: 'Moderate rain showers', icon: 'fa-cloud-showers-heavy', color: '#2563eb' },
      82: { label: 'Violent rain showers', icon: 'fa-cloud-showers-heavy', color: '#1d4ed8' },
      95: { label: 'Thunderstorm', icon: 'fa-cloud-bolt', color: '#dc2626' },
      96: { label: 'Thunderstorm with hail', icon: 'fa-cloud-bolt', color: '#dc2626' },
      99: { label: 'Heavy thunderstorm', icon: 'fa-cloud-bolt', color: '#dc2626' }
    };
    return wmoMap[code] || { label: 'Partly cloudy', icon: 'fa-cloud-sun', color: '#3b82f6' };
  }

  // Format date to short day label e.g., "Mon", "Today"
  formatDayLabel(dateStr, index) {
    if (index === 0) return 'Today';
    if (index === 1) return 'Tomorrow';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  // Fetch real live weather from Open-Meteo API
  async fetchLiveWeather(latitude, longitude, farmLocationName = 'Farm Location') {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      current: 'temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover',
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,precipitation_probability_max,weather_code,wind_speed_10m_max',
      timezone: 'auto'
    });

    const url = `${this.BASE_URL}?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Open-Meteo API HTTP error ${response.status}`);
    }

    const data = await response.json();
    return this.normalizeWeatherData(data, latitude, longitude, farmLocationName);
  }

  // Normalize Open-Meteo raw JSON into Cropie standard weather object
  normalizeWeatherData(data, latitude, longitude, farmLocationName) {
    const cur = data.current || {};
    const daily = data.daily || {};
    const curWmo = this.getWmoWeatherInfo(cur.weather_code || 0);

    const forecastList = [];
    if (daily.time && Array.isArray(daily.time)) {
      daily.time.forEach((dateStr, i) => {
        const wCode = daily.weather_code ? daily.weather_code[i] : 0;
        const wInfo = this.getWmoWeatherInfo(wCode);

        forecastList.push({
          date: dateStr,
          dayLabel: this.formatDayLabel(dateStr, i),
          minTemperature: Math.round(daily.temperature_2m_min ? daily.temperature_2m_min[i] : 22),
          maxTemperature: Math.round(daily.temperature_2m_max ? daily.temperature_2m_max[i] : 30),
          precipitation: daily.precipitation_sum ? daily.precipitation_sum[i] : 0,
          precipitationProbability: daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : 0,
          rain: daily.rain_sum ? daily.rain_sum[i] : 0,
          weatherCode: wCode,
          weatherLabel: wInfo.label,
          weatherIcon: wInfo.icon,
          weatherColor: wInfo.color,
          windSpeed: daily.wind_speed_10m_max ? Math.round(daily.wind_speed_10m_max[i]) : 10
        });
      });
    }

    return {
      location: {
        name: farmLocationName,
        latitude: latitude,
        longitude: longitude
      },
      current: {
        temperature: Math.round(cur.temperature_2m ?? 28),
        humidity: Math.round(cur.relative_humidity_2m ?? 75),
        precipitation: cur.precipitation ?? 0,
        rain: cur.rain ?? 0,
        weatherCode: cur.weather_code ?? 0,
        weatherLabel: curWmo.label,
        weatherIcon: curWmo.icon,
        weatherColor: curWmo.color,
        windSpeed: Math.round(cur.wind_speed_10m ?? 12),
        windDirection: Math.round(cur.wind_direction_10m ?? 180),
        cloudCover: Math.round(cur.cloud_cover ?? 45)
      },
      forecast: forecastList,
      fetchedAt: Date.now(),
      isCached: false
    };
  }

  // Get Weather for Farm with automatic Caching & Fallback
  async getWeatherForFarm(farm) {
    if (!farm || farm.latitude === undefined || farm.longitude === undefined) {
      throw new Error('Farm location coordinates are not available.');
    }

    const cacheKey = `${this.CACHE_KEY_PREFIX}${farm.id || 'default'}`;
    
    try {
      // 1. Attempt Live Fetch from Open-Meteo
      const liveWeather = await this.fetchLiveWeather(farm.latitude, farm.longitude, farm.locationName || farm.farmName);
      
      // Save to localStorage cache
      localStorage.setItem(cacheKey, JSON.stringify(liveWeather));
      return liveWeather;

    } catch (apiError) {
      console.warn('Open-Meteo live API fetch notice:', apiError);

      // 2. Fallback to cached weather if offline or API error
      const cachedStr = localStorage.getItem(cacheKey);
      if (cachedStr) {
        try {
          const cachedWeather = JSON.parse(cachedStr);
          cachedWeather.isCached = true;
          const ageHours = Math.round((Date.now() - cachedWeather.fetchedAt) / (1000 * 60 * 60));
          cachedWeather.cacheAgeText = ageHours === 0 ? 'Updated less than an hour ago' : `Updated ${ageHours} hour(s) ago`;
          return cachedWeather;
        } catch {
          // ignore JSON parse error
        }
      }

      throw new Error("We couldn't retrieve the latest weather. Please check connection.");
    }
  }
}
