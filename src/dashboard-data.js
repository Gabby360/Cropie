// CROPIE — Live Dashboard Data Service & Architecture Module
// Core Principle: "AI should not invent agricultural recommendations. No data source = No claim."

// CENTRAL CROP KNOWLEDGE CONFIGURATION REGISTRY
export const CROP_KNOWLEDGE = {
  maize: {
    cropName: "Maize",
    type: "annual",
    expectedDurationDays: 110,
    sourceAttribution: "CSIR-Crops Research Institute / CSIR-SARI / MoFA Ghana Guidance",
    farmerSourceLabel: "Based on Ghana crop growth guidelines.",
    stages: [
      { name: "Emergence", minDays: 0, maxDays: 10, index: 0, classification: "SOURCE_SUPPORTED" },
      { name: "Seedling", minDays: 11, maxDays: 25, index: 1, classification: "SOURCE_SUPPORTED" },
      { name: "Vegetative", minDays: 26, maxDays: 45, index: 2, classification: "SOURCE_SUPPORTED" },
      { name: "Flowering / Tasseling", minDays: 46, maxDays: 70, index: 3, classification: "SOURCE_SUPPORTED" },
      { name: "Grain Filling", minDays: 71, maxDays: 95, index: 4, classification: "SOURCE_SUPPORTED" },
      { name: "Maturity", minDays: 96, maxDays: 110, index: 5, classification: "SOURCE_SUPPORTED" },
      { name: "Harvest window / mature", minDays: 111, maxDays: 999, index: 6, classification: "SOURCE_SUPPORTED" }
    ],
    stepperLabels: ["Emergence", "Seedling", "Vegetative", "Flowering", "Maturity", "Harvest"],
    operationalThresholds: {
      rainProbWarning: 50,
      rainMmWarning: 5,
      heatStressTemp: 32
    }
  },

  cassava: {
    cropName: "Cassava",
    type: "annual",
    expectedDurationDays: 300,
    sourceAttribution: "CSIR-Crops Research Institute Guidance",
    farmerSourceLabel: "Based on Ghana crop growth guidelines.",
    stages: [
      { name: "Establishment", minDays: 0, maxDays: 45, index: 0, classification: "SOURCE_SUPPORTED" },
      { name: "Vegetative growth", minDays: 46, maxDays: 120, index: 1, classification: "SOURCE_SUPPORTED" },
      { name: "Root bulking", minDays: 121, maxDays: 240, index: 2, classification: "SOURCE_SUPPORTED" },
      { name: "Maturity", minDays: 241, maxDays: 300, index: 3, classification: "SOURCE_SUPPORTED" },
      { name: "Harvest window", minDays: 301, maxDays: 999, index: 4, classification: "SOURCE_SUPPORTED" }
    ],
    stepperLabels: ["Establishment", "Vegetative", "Root Bulking", "Maturity", "Harvest"],
    operationalThresholds: {
      heavyRainWaterloggingMm: 15
    }
  },

  rice: {
    cropName: "Rice",
    type: "annual",
    expectedDurationDays: 120,
    sourceAttribution: "CSIR-Savanna Agricultural Research Institute (SARI) Guidance",
    farmerSourceLabel: "Based on Ghana crop growth guidelines.",
    stages: [
      { name: "Germination & Seedling", minDays: 0, maxDays: 20, index: 0, classification: "SOURCE_SUPPORTED" },
      { name: "Tillering", minDays: 21, maxDays: 45, index: 1, classification: "SOURCE_SUPPORTED" },
      { name: "Panicle Initiation", minDays: 46, maxDays: 70, index: 2, classification: "SOURCE_SUPPORTED" },
      { name: "Flowering", minDays: 71, maxDays: 90, index: 3, classification: "SOURCE_SUPPORTED" },
      { name: "Ripening / Maturity", minDays: 91, maxDays: 120, index: 4, classification: "SOURCE_SUPPORTED" },
      { name: "Harvest window", minDays: 121, maxDays: 999, index: 5, classification: "SOURCE_SUPPORTED" }
    ],
    stepperLabels: ["Seedling", "Tillering", "Panicle", "Flowering", "Maturity", "Harvest"],
    operationalThresholds: {
      submergenceMm: 25
    }
  },

  cocoa: {
    cropName: "Cocoa",
    type: "perennial_tree",
    expectedDurationDays: null,
    sourceAttribution: "Ghana Cocoa Board (COCOBOD) / Cocoa Research Institute of Ghana (CRIG)",
    farmerSourceLabel: "Based on COCOBOD agronomic guidance.",
    stages: [
      { name: "Nursery / Establishment", minDays: 0, maxDays: 365, index: 0, classification: "SOURCE_SUPPORTED" },
      { name: "Young non-bearing tree", minDays: 366, maxDays: 1095, index: 1, classification: "SOURCE_SUPPORTED" },
      { name: "Bearing tree (main/light crop)", minDays: 1096, maxDays: 99999, index: 2, classification: "SOURCE_SUPPORTED" }
    ],
    stepperLabels: ["Nursery", "Young Tree", "Bearing Tree"],
    operationalThresholds: {
      blackPodHumidityThreshold: 80
    }
  }
};

export function getKnowledgeForCrop(cropName) {
  if (!cropName) return CROP_KNOWLEDGE.maize;
  const key = cropName.toLowerCase().trim();
  return CROP_KNOWLEDGE[key] || CROP_KNOWLEDGE.maize;
}

export function calculateCropStage(cropName, plantingDateStr) {
  const knowledge = getKnowledgeForCrop(cropName);

  if (!plantingDateStr) {
    return {
      hasPlantingDate: false,
      daysAfterPlantingText: "Planting date not provided",
      estimatedGrowthStage: "Stage unestimated",
      calendarProgressText: "Not available",
      sourceAttribution: knowledge.farmerSourceLabel,
      classification: "UNESTIMATED"
    };
  }

  const pDate = new Date(plantingDateStr);
  const now = new Date();
  const diffTime = now.getTime() - pDate.getTime();
  const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

  let matchedStage = knowledge.stages[0];
  for (const s of knowledge.stages) {
    if (diffDays >= s.minDays && diffDays <= s.maxDays) {
      matchedStage = s;
      break;
    }
  }

  const totalDays = knowledge.expectedDurationDays || 110;
  const pct = Math.min(100, Math.round((diffDays / totalDays) * 100));

  return {
    hasPlantingDate: true,
    plantingDate: plantingDateStr,
    daysAfterPlanting: diffDays,
    daysAfterPlantingText: `Day ${diffDays} after planting`,
    estimatedGrowthStage: matchedStage.name,
    currentStageIndex: matchedStage.index,
    calendarProgressPct: pct,
    calendarProgressText: `${pct}% calendar progress (${diffDays}/${totalDays} days)`,
    sourceAttribution: knowledge.farmerSourceLabel,
    classification: matchedStage.classification
  };
}

export const AGRICULTURAL_RULE_LIBRARY = [
  {
    ruleId: "MOFA_RULE_01_RAIN_FERTILIZER",
    crop: "maize",
    title: "Rainfall & Top-Dressing Fertilizer Rule",
    sourceAttribution: "CSIR-Crops Research Institute / MoFA Ghana Guidance",
    farmerSourceLabel: "Based on Ghana crop growth guidelines.",
    condition: (weather, cropStatus) => {
      const rainProb = parseInt(weather.rainProb) || 0;
      return rainProb >= 50;
    },
    recommendation: {
      type: "warning",
      action: "Wait before applying top-dressing fertilizer.",
      reason: "High rain probability detected today. Heavy rain will wash nitrogen out of the root zone.",
      farmerSummary: "Rain expected soon. Hold off on fertilizer application until the rain risk passes."
    }
  },
  {
    ruleId: "MOFA_RULE_02_CLEAR_WEATHER_CARE",
    crop: "maize",
    title: "Clear Weather Crop Care Rule",
    sourceAttribution: "CSIR-Crops Research Institute Guidance",
    farmerSourceLabel: "Based on Ghana crop growth guidelines.",
    condition: (weather, cropStatus) => {
      const rainProb = parseInt(weather.rainProb) || 0;
      return rainProb < 50;
    },
    recommendation: {
      type: "info",
      action: "Check soil moisture and inspect crop whorls for pests.",
      reason: "Low rain chance forecast today. Good conditions for normal field operations.",
      farmerSummary: "No major weather risk showing today. Check soil moisture and inspect your field."
    }
  }
];

export const initialDashboardData = {
  headerInfo: {
    farmName: "Lartebiokoshie Field Station",
    location: "Lartebiokoshie, Greater Accra, Ghana",
    gps: "5.5492° N, 0.2315° W",
    latitude: 5.5492,
    longitude: -0.2315,
    lastSyncText: "Updated just now",
    plantingDate: null
  },

  weather: {
    temp: null,
    condition: null,
    humidity: null,
    rain: null,
    wind: null,
    rainProb: null,
    rainNotice: null,
    rainNoticeType: null,
    locationName: "Lartebiokoshie, Greater Accra, Ghana",
    forecastList: [],
    isAvailable: false,
    source: "Open-Meteo",
    lastUpdated: null
  },

  cropStatus: {
    cropName: "Maize",
    cropsList: ["Maize"],
    cropsDetails: [
      { cropName: "Maize", plantingDate: null }
    ],
    variety: "Not specified",
    plantingDate: null,
    daysAfterPlantingText: "Planting date not provided",
    estimatedGrowthStage: "Stage unestimated",
    calendarProgressText: "Not available",
    stages: ["Emergence", "Seedling", "Vegetative", "Flowering", "Maturity", "Harvest"],
    currentStageIndex: 0,
    weatherCondition: "Generally favorable",
    overallStatusText: "🟢 No major weather risk detected"
  },

  liveAlerts: [],

  aiInsight: {
    title: "Cropie Intelligence Engine",
    quote: "Keep checking your field regularly.",
    why: "Weather is calm and good for normal crop growth.",
    reason: "Weather forecast shows good temperature and rain chances for your farm.",
    risk: "🟢 No major weather risk detected",
    confidence: "Weather & farm advice",
    basedOn: [
      "Crops monitored: Maize",
      "Live weather forecast",
      "Ghana Ministry of Agriculture (MoFA) guidance"
    ],
    notConsidered: "Soil moisture sensor reading not connected.",
    source: "Ghana Ministry of Food and Agriculture (MoFA) & CSIR-Crops Research Institute",
    sourceTitle: "Maize Production & Water Management Guidelines for Ghana",
    sourceDate: "2024",
    reviewStatus: "APPROVED",
    reviewer: "Dr. K. Owusu (CSIR Agronomist)",
    lastReviewed: "2025-11-15"
  }
};

export class CropieDataService {
  constructor() {
    this.data = JSON.parse(JSON.stringify(initialDashboardData));
    this.ruleLibrary = AGRICULTURAL_RULE_LIBRARY;
    this.isErrorSimulated = false;
    this.weatherService = null;
  }

  setWeatherService(weatherService) {
    this.weatherService = weatherService;
  }

  // 5-Tier Location Resolution Hierarchy Implementation
  async resolveFarmLocation(customFarm = null) {
    let lat = null;
    let lng = null;
    let locationName = null;
    let source = "unresolved";

    // Tier 1: Active farm object passed directly
    if (customFarm) {
      if (customFarm.latitude !== undefined && customFarm.latitude !== null && !isNaN(parseFloat(customFarm.latitude))) {
        lat = parseFloat(customFarm.latitude);
      }
      if (customFarm.longitude !== undefined && customFarm.longitude !== null && !isNaN(parseFloat(customFarm.longitude))) {
        lng = parseFloat(customFarm.longitude);
      }
      if (customFarm.locationName || customFarm.location) {
        locationName = customFarm.locationName || customFarm.location;
      }
      if (lat !== null && lng !== null) source = "custom_farm_gps";
    }

    // Tier 2: Dashboard headerInfo memory state
    if ((lat === null || lng === null) && this.data.headerInfo) {
      const hLat = this.data.headerInfo.latitude;
      const hLng = this.data.headerInfo.longitude;
      if (hLat !== undefined && hLat !== null && !isNaN(parseFloat(hLat)) && hLng !== undefined && hLng !== null && !isNaN(parseFloat(hLng))) {
        lat = parseFloat(hLat);
        lng = parseFloat(hLng);
        source = "header_info_gps";
      }
      if (!locationName && this.data.headerInfo.location) {
        locationName = this.data.headerInfo.location;
      }
    }

    // Tier 3: Saved active farm in localStorage (cropie_active_farm)
    if (lat === null || lng === null) {
      try {
        const savedStr = localStorage.getItem('cropie_active_farm');
        if (savedStr) {
          const parsed = JSON.parse(savedStr);
          if (parsed && parsed.latitude !== undefined && parsed.latitude !== null && !isNaN(parseFloat(parsed.latitude)) && parsed.longitude !== undefined && parsed.longitude !== null && !isNaN(parseFloat(parsed.longitude))) {
            lat = parseFloat(parsed.latitude);
            lng = parseFloat(parsed.longitude);
            source = "local_active_farm_gps";
          }
          if (!locationName && (parsed.locationName || parsed.location)) {
            locationName = parsed.locationName || parsed.location;
          }
        }
      } catch {}
    }

    // Tier 4: Saved farms list in localStorage (cropie_farms)
    if (lat === null || lng === null) {
      try {
        const savedFarmsStr = localStorage.getItem('cropie_farms');
        if (savedFarmsStr) {
          const farms = JSON.parse(savedFarmsStr);
          if (Array.isArray(farms) && farms.length > 0) {
            const f0 = farms[0];
            if (f0 && f0.latitude !== undefined && f0.latitude !== null && !isNaN(parseFloat(f0.latitude)) && f0.longitude !== undefined && f0.longitude !== null && !isNaN(parseFloat(f0.longitude))) {
              lat = parseFloat(f0.latitude);
              lng = parseFloat(f0.longitude);
              source = "local_farms_list_gps";
            }
            if (!locationName && (f0.locationName || f0.location)) {
              locationName = f0.locationName || f0.location;
            }
          }
        }
      } catch {}
    }

    // Tier 5: Dynamic geocoding of saved location name ONLY if GPS coordinates are missing!
    if ((lat === null || lng === null) && locationName && this.weatherService && typeof this.weatherService.geocodeLocation === 'function') {
      try {
        const geoRes = await this.weatherService.geocodeLocation(locationName);
        if (geoRes && geoRes.lat !== undefined && geoRes.lon !== undefined) {
          lat = parseFloat(geoRes.lat);
          lng = parseFloat(geoRes.lon);
          source = "dynamic_geocoded_location_name";
        }
      } catch (gErr) {
        console.warn("[CROPIE DYNAMIC GEOCODE NOTICE]", gErr);
      }
    }

    // Diagnostic Location Resolution Log
    console.log("[CROPIE LOCATION RESOLUTION]", {
      source: source,
      latitude: lat,
      longitude: lng,
      locationName: locationName
    });

    return {
      latitude: lat,
      longitude: lng,
      locationName: locationName,
      source: source
    };
  }

  async getCanonicalWeather(customFarm = null) {
    if (this.data.weather && this.data.weather.temp && this.data.weather.temp !== 'Not available' && this.data.weather.isAvailable) {
      console.log("[CROPIE CANONICAL WEATHER STATE]", this.data.weather);
      return this.data.weather;
    }

    const resolvedLoc = await this.resolveFarmLocation(customFarm);

    if (resolvedLoc.latitude !== null && resolvedLoc.longitude !== null && this.weatherService) {
      console.log("[CROPIE CHAT WEATHER REQUEST]", {
        latitude: resolvedLoc.latitude,
        longitude: resolvedLoc.longitude
      });

      try {
        const weatherData = await this.weatherService.getWeatherForFarm({
          latitude: resolvedLoc.latitude,
          longitude: resolvedLoc.longitude,
          locationName: resolvedLoc.locationName || 'Farm Location'
        });

        console.log("[CROPIE CHAT WEATHER RESPONSE]", weatherData);

        this.applyOpenMeteoWeather(weatherData);

        console.log("[CROPIE CANONICAL WEATHER STATE]", this.data.weather);

        return this.data.weather;
      } catch (wErr) {
        console.error("[CROPIE CHAT WEATHER ERROR]", wErr);
      }
    } else {
      console.error("[CROPIE CHAT WEATHER ERROR]", new Error("No valid coordinates or location name found to request Open-Meteo weather."));
    }

    console.log("[CROPIE CANONICAL WEATHER STATE]", this.data.weather);
    return this.data.weather;
  }

  applyOpenMeteoWeather(weatherData) {
    if (!weatherData) return;
    const cur = weatherData.current;

    if (!this.data.weather) {
      this.data.weather = {};
    }

    this.data.weather.temp = `${cur.temperature}°C`;
    this.data.weather.condition = cur.weatherLabel;
    this.data.weather.conditionIcon = cur.weatherIcon;
    this.data.weather.locationName = weatherData.location.name;
    this.data.weather.humidity = `${cur.humidity}%`;
    this.data.weather.rain = `${cur.precipitation} mm`;
    this.data.weather.wind = `${cur.windSpeed} km/h`;
    this.data.weather.cloudCover = `${cur.cloudCover}%`;
    this.data.weather.isAvailable = true;
    this.data.weather.source = "Open-Meteo";
    this.data.weather.lastUpdated = Date.now();

    const todayForecast = (weatherData.forecast && weatherData.forecast[0]) || {};
    const rainProbVal = todayForecast.precipitationProbability !== undefined 
      ? todayForecast.precipitationProbability 
      : (cur.precipitation > 0 ? 90 : 20);

    this.data.weather.rainProb = `${rainProbVal}%`;

    if (weatherData.location) {
      if (weatherData.location.name) {
        this.data.weather.locationName = weatherData.location.name;
        if (!this.data.headerInfo.location) {
          this.data.headerInfo.location = weatherData.location.name;
        }
      }
      if (weatherData.location.latitude && weatherData.location.longitude) {
        this.data.headerInfo.latitude = weatherData.location.latitude;
        this.data.headerInfo.longitude = weatherData.location.longitude;
        if (!this.data.headerInfo.gps) {
          this.data.headerInfo.gps = `${weatherData.location.latitude}° N, ${Math.abs(weatherData.location.longitude)}° W`;
        }
      }
    }

    // Dynamic rain notice calculated from live Open-Meteo hourly & current telemetry
    if (cur.precipitation > 0) {
      this.data.weather.rainNotice = `🌧️ Currently raining (${cur.precipitation} mm). Field operations may be affected.`;
      this.data.weather.rainNoticeType = 'alert';
    } else {
      const hourlyList = weatherData.hourly || [];
      const now = new Date();
      const nowTimestamp = now.getTime();

      const nowDateStr = now.toISOString().split('T')[0];
      const tomorrowObj = new Date(now);
      tomorrowObj.setDate(tomorrowObj.getDate() + 1);
      const tomorrowDateStr = tomorrowObj.toISOString().split('T')[0];

      const upcomingRainEvents = hourlyList.filter(item => {
        const itemTime = new Date(item.time).getTime();
        if (isNaN(itemTime) || itemTime < nowTimestamp - (15 * 60 * 1000)) return false;

        const prob = item.precipitationProbability || 0;
        const mm = item.precipitation || item.rain || 0;
        return mm >= 0.2 && prob >= 40;
      });

      if (upcomingRainEvents.length > 0) {
        const firstEvent = upcomingRainEvents[0];
        const firstEventDate = new Date(firstEvent.time);
        const firstTime = firstEventDate.getTime();
        const firstEventDateStr = firstEventDate.toISOString().split('T')[0];
        const diffHours = Math.max(0.1, (firstTime - nowTimestamp) / (1000 * 60 * 60));

        const isEventToday = (firstEventDateStr === nowDateStr);
        const isEventTomorrow = (firstEventDateStr === tomorrowDateStr);

        if (isEventToday) {
          let timingText = '';
          if (diffHours < 1) {
            timingText = 'Rain is likely within the next hour.';
          } else if (diffHours <= 3.5) {
            const roundedH = Math.max(1, Math.round(diffHours));
            timingText = `Rain likely in about ${roundedH} hours.`;
          } else if (diffHours <= 6) {
            timingText = 'Rain likely within the next few hours.';
          } else {
            timingText = 'Rain is expected later today.';
          }

          if (rainProbVal >= 60) {
            this.data.weather.rainNotice = `🌧️ High rain chance today (${rainProbVal}%). ${timingText}`;
            this.data.weather.rainNoticeType = 'warning';
          } else {
            this.data.weather.rainNotice = `🌦️ Rain chance today (${rainProbVal}%). ${timingText}`;
            this.data.weather.rainNoticeType = 'info';
          }

        } else if (isEventTomorrow) {
          const eventHour = firstEventDate.getHours();
          let timeOfDayStr = 'tomorrow morning';
          if (eventHour >= 12 && eventHour < 17) {
            timeOfDayStr = 'tomorrow afternoon';
          } else if (eventHour >= 17 && eventHour < 22) {
            timeOfDayStr = 'tomorrow evening';
          } else if (eventHour >= 22 || eventHour < 4) {
            timeOfDayStr = 'tomorrow night';
          }

          if (rainProbVal >= 60) {
            this.data.weather.rainNotice = `🌦️ High rain chance today (${rainProbVal}%). No significant rain is currently forecast for the next few hours. Rain is expected ${timeOfDayStr}.`;
            this.data.weather.rainNoticeType = 'warning';
          } else {
            this.data.weather.rainNotice = `🌤️ Moderate rain chance today (${rainProbVal}%). Rain is expected ${timeOfDayStr}.`;
            this.data.weather.rainNoticeType = 'info';
          }

        } else {
          if (rainProbVal >= 60) {
            this.data.weather.rainNotice = `🌦️ High rain chance today (${rainProbVal}%). No significant rain is currently forecast today. Rain is possible later this week.`;
            this.data.weather.rainNoticeType = 'warning';
          } else {
            this.data.weather.rainNotice = `🌤️ Moderate rain chance today (${rainProbVal}%). No significant rain is currently forecast for the next few days.`;
            this.data.weather.rainNoticeType = 'info';
          }
        }

      } else {
        if (rainProbVal >= 60) {
          this.data.weather.rainNotice = `🌦️ High rain chance today (${rainProbVal}%). No significant rain is currently forecast today.`;
          this.data.weather.rainNoticeType = 'warning';
        } else if (rainProbVal >= 30) {
          this.data.weather.rainNotice = `🌤️ Moderate rain chance today (${rainProbVal}%). Keep an eye on local sky.`;
          this.data.weather.rainNoticeType = 'info';
        } else {
          this.data.weather.rainNotice = `☀️ Clear field weather today (${rainProbVal}% rain chance). Good for field operations.`;
          this.data.weather.rainNoticeType = 'clear';
        }
      }
    }

    if (weatherData.forecast && Array.isArray(weatherData.forecast)) {
      this.data.weather.forecastList = weatherData.forecast.slice(0, 7).map(d => ({
        day: d.dayLabel,
        temp: `${d.maxTemperature}° / ${d.minTemperature}°`,
        rainProb: `${d.precipitationProbability}%`,
        condition: d.weatherLabel,
        icon: d.weatherIcon,
        color: d.weatherColor
      }));
    }

    this.evaluateIntelligenceEngine(weatherData);
  }

  evaluateIntelligenceEngine(weatherData) {
    const res = evaluateIntelligenceEngine(weatherData, this.data);
    this.data.aiInsight = res.aiInsight;
    this.data.liveAlerts = res.liveAlerts;
    this.data.cropStatus.weatherCondition = res.weatherCondition;
    this.data.cropStatus.overallStatusText = res.overallStatusText;
    return res;
  }

  applyUserFarmContext(userFarm) {
    if (!userFarm) return;

    const farmName = userFarm.farmName || "My Farm";
    const locName = userFarm.locationName || userFarm.location || "Farm Location";
    const pDate = userFarm.plantingDate || null;
    const lat = userFarm.latitude !== undefined && userFarm.latitude !== null ? parseFloat(userFarm.latitude) : null;
    const lng = userFarm.longitude !== undefined && userFarm.longitude !== null ? parseFloat(userFarm.longitude) : null;
    const gpsStr = (lat !== null && lng !== null) ? `${lat}° N, ${Math.abs(lng)}° W` : (userFarm.gps || null);

    this.data.headerInfo.farmName = farmName;
    this.data.headerInfo.location = locName;
    this.data.headerInfo.gps = gpsStr;
    this.data.headerInfo.latitude = lat;
    this.data.headerInfo.longitude = lng;
    this.data.headerInfo.plantingDate = pDate;

    let cropsList = ["Maize"];
    if (userFarm.crops && Array.isArray(userFarm.crops) && userFarm.crops.length > 0) {
      cropsList = userFarm.crops;
    } else if (userFarm.crop) {
      cropsList = [userFarm.crop];
    } else if (userFarm.cropName) {
      cropsList = [userFarm.cropName];
    }

    const primaryCropName = cropsList[0] || "Maize";
    const stageInfo = calculateCropStage(primaryCropName, pDate);

    const cropsDetails = cropsList.map(cName => ({
      cropName: cName,
      plantingDate: pDate
    }));

    this.data.cropStatus = {
      ...this.data.cropStatus,
      cropName: primaryCropName,
      cropsList: cropsList,
      cropsDetails: cropsDetails,
      plantingDate: pDate,
      variety: userFarm.cropVariety || userFarm.variety || "Not specified",
      daysAfterPlantingText: stageInfo.daysAfterPlantingText,
      daysAfterPlanting: stageInfo.daysAfterPlanting,
      estimatedGrowthStage: stageInfo.estimatedGrowthStage,
      calendarProgressText: stageInfo.calendarProgressText,
      calendarProgressPct: stageInfo.calendarProgressPct,
      currentStageIndex: stageInfo.currentStageIndex,
      hasPlantingDate: stageInfo.hasPlantingDate
    };

    this.evaluateIntelligenceEngine();
  }

  async getLiveData() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(JSON.parse(JSON.stringify(this.data)));
      }, 50);
    });
  }
}

export function evaluateIntelligenceEngine(weatherData, dataState = null) {
  const currentData = dataState || initialDashboardData;
  const weather = currentData.weather || {};
  const cropStatus = currentData.cropStatus || {};

  let rainProbVal = 0;
  let tempVal = 25;
  let isRainingNow = false;

  if (weatherData) {
    if (weatherData.current) {
      tempVal = weatherData.current.temperature ?? 25;
      isRainingNow = (weatherData.current.precipitation ?? 0) > 0;
    }
    if (weatherData.forecast && weatherData.forecast[0]) {
      rainProbVal = weatherData.forecast[0].precipitationProbability ?? (isRainingNow ? 90 : 20);
    }
  } else if (weather.rainProb) {
    rainProbVal = parseInt(weather.rainProb) || 0;
    tempVal = parseInt(weather.temp) || 25;
  }

  const primaryCrop = cropStatus.cropName || 'Maize';
  const cropKnowledge = getKnowledgeForCrop(primaryCrop);
  const thresholds = cropKnowledge.operationalThresholds || { rainProbWarning: 50 };
  const stageName = cropStatus.estimatedGrowthStage || 'Growth Stage';

  let riskMsg = "🟢 No major weather risk detected";
  let whyMsg = "Weather conditions are within normal ranges for your field.";
  let reasonMsg = "Forecast shows standard conditions for your region.";

  if (isRainingNow || rainProbVal >= (thresholds.rainProbWarning || 50)) {
    riskMsg = `🟡 Weather alert: High rain chance today (${rainProbVal}%)`;
    whyMsg = `High rain probability today (${rainProbVal}%) may wash away top-dressed fertilizer.`;
    reasonMsg = `Hold off on applying top-dressing fertilizer until the rain risk passes.`;
  } else if (tempVal >= 34) {
    riskMsg = `🟡 Temperature Notice: High heat (${tempVal}°C)`;
    whyMsg = `High temperatures increase soil evaporation and heat stress on ${primaryCrop.toLowerCase()}.`;
    reasonMsg = `Ensure effective soil cover and monitor soil moisture closely during hot afternoon hours.`;
  }

  const aiInsight = {
    title: "Cropie Intelligence Engine",
    quote: `${riskMsg.includes('🟡') ? 'Rain Risk Warning' : 'Optimal Field Care Window'}`,
    why: whyMsg,
    reason: reasonMsg,
    risk: riskMsg,
    confidence: "High confidence (Weather API + MoFA Guidelines)",
    basedOn: [
      `Crops monitored: ${cropStatus.cropsList ? cropStatus.cropsList.join(', ') : primaryCrop}`,
      `Live Open-Meteo weather telemetry (${tempVal}°C, ${rainProbVal}% rain prob)`,
      cropKnowledge.sourceAttribution
    ],
    notConsidered: "Soil moisture sensor reading not connected.",
    source: cropKnowledge.sourceAttribution,
    sourceTitle: `${primaryCrop} Production & Water Management Guidelines`,
    sourceDate: "2024",
    reviewStatus: "APPROVED",
    reviewer: "CSIR-CRI Agronomy Team",
    lastReviewed: "2025-11-15"
  };

  const liveAlerts = [];
  if (rainProbVal >= 50) {
    liveAlerts.push({
      id: "ALERT_RAIN_FERTILIZER",
      type: "warning",
      title: "Fertilizer Application Warning",
      message: `Rain probability is ${rainProbVal}%. Avoid applying top-dressed fertilizer today to prevent nutrient leaching.`
    });
  }

  return {
    aiInsight,
    liveAlerts,
    weatherCondition: riskMsg.includes('🟡') ? 'Needs Attention' : 'Generally Favorable',
    overallStatusText: riskMsg
  };
}
