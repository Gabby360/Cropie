// CROPIE — Open-Meteo Weather API Integration Service
// Fetches real weather telemetry and 7-day forecasts from https://api.open-meteo.com/v1/forecast

export class CropieWeatherService {
  constructor() {
    this.BASE_URL = 'https://api.open-meteo.com/v1/forecast';
    this.CACHE_KEY_PREFIX = 'cropie_weather_cache_';
    this.CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache TTL
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
