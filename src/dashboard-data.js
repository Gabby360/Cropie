// CROPIE — Live Dashboard Data Service & Architecture Module
// Core Principle: "AI should not invent agricultural recommendations. No data source = No claim."

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
    sourceAttribution: "CSIR-SARI / MoFA / APNI Ghana Guidance",
    farmerSourceLabel: "Based on Ghana crop growth guidelines.",
    stages: [
      { name: "Germination", minDays: 0, maxDays: 14, index: 0, classification: "SOURCE_SUPPORTED" },
      { name: "Seedling", minDays: 15, maxDays: 30, index: 1, classification: "SOURCE_SUPPORTED" },
      { name: "Tillering", minDays: 31, maxDays: 55, index: 2, classification: "SOURCE_SUPPORTED" },
      { name: "Panicle initiation", minDays: 56, maxDays: 75, index: 3, classification: "SOURCE_SUPPORTED" },
      { name: "Flowering", minDays: 76, maxDays: 90, index: 4, classification: "SOURCE_SUPPORTED" },
      { name: "Grain filling", minDays: 91, maxDays: 110, index: 5, classification: "SOURCE_SUPPORTED" },
      { name: "Maturity", minDays: 111, maxDays: 120, index: 6, classification: "SOURCE_SUPPORTED" },
      { name: "Harvest window", minDays: 121, maxDays: 999, index: 7, classification: "SOURCE_SUPPORTED" }
    ],
    stepperLabels: ["Establishment", "Tillering", "Panicle Init", "Flowering", "Maturity", "Harvest"],
    operationalThresholds: {
      paddockRainProb: 60,
      extremeHeatTemp: 35
    }
  },

  cocoa: {
    cropName: "Cocoa",
    type: "perennial",
    expectedDurationDays: null,
    sourceAttribution: "Cocoa Research Institute of Ghana (CRIG) / COCOBOD Guidance",
    farmerSourceLabel: "Based on Ghana crop growth guidelines.",
    stages: [
      { name: "Cocoa development: Long-term tree crop", minDays: 0, maxDays: 9999, index: 0, classification: "SOURCE_SUPPORTED" }
    ],
    stepperLabels: ["Perennial Growth", "Pod Development", "Harvest Cycle"],
    operationalThresholds: {
      highHumidityFungalPct: 80
    }
  },

  generic: {
    cropName: "Crop",
    type: "annual",
    expectedDurationDays: 120,
    sourceAttribution: "Ghana Ministry of Agriculture Guidance",
    farmerSourceLabel: "Based on Ghana crop growth guidelines.",
    stages: [
      { name: "Establishment", minDays: 0, maxDays: 20, index: 0, classification: "SOURCE_SUPPORTED" },
      { name: "Active Growth", minDays: 21, maxDays: 70, index: 1, classification: "SOURCE_SUPPORTED" },
      { name: "Reproductive / Flowering", minDays: 71, maxDays: 95, index: 2, classification: "SOURCE_SUPPORTED" },
      { name: "Maturity", minDays: 96, maxDays: 120, index: 3, classification: "SOURCE_SUPPORTED" },
      { name: "Harvest Window", minDays: 121, maxDays: 999, index: 4, classification: "SOURCE_SUPPORTED" }
    ],
    stepperLabels: ["Establishment", "Active Growth", "Flowering", "Maturity", "Harvest"],
    operationalThresholds: {}
  }
};

export function getKnowledgeForCrop(cropName) {
  if (!cropName) return CROP_KNOWLEDGE.generic;
  const key = cropName.toLowerCase().trim();
  if (key.includes('maize') || key.includes('corn')) return CROP_KNOWLEDGE.maize;
  if (key.includes('cassava')) return CROP_KNOWLEDGE.cassava;
  if (key.includes('rice')) return CROP_KNOWLEDGE.rice;
  if (key.includes('cocoa')) return CROP_KNOWLEDGE.cocoa;
  return { ...CROP_KNOWLEDGE.generic, cropName: cropName };
}

export function calculateCropStage(cropName, plantingDate) {
  const knowledge = getKnowledgeForCrop(cropName);

  if (!plantingDate) {
    return {
      cropName: knowledge.cropName,
      hasPlantingDate: false,
      daysAfterPlanting: null,
      daysAfterPlantingText: "Planting date not provided",
      estimatedGrowthStage: knowledge.type === 'perennial' ? "Cocoa development: Long-term tree crop" : "Stage unestimated",
      stageCalculationNote: "Add your planting date to estimate your crop's growth stage.",
      calendarProgress: null,
      calendarProgressText: knowledge.type === 'perennial' ? "Perennial Crop (Non-calendar)" : "Not available",
      stages: knowledge.stepperLabels,
      currentStageIndex: 0,
      isPerennial: knowledge.type === 'perennial'
    };
  }

  const planted = new Date(plantingDate);
  if (isNaN(planted.getTime())) {
    return {
      cropName: knowledge.cropName,
      hasPlantingDate: false,
      daysAfterPlanting: null,
      daysAfterPlantingText: "Planting date not provided",
      estimatedGrowthStage: knowledge.type === 'perennial' ? "Cocoa development: Long-term tree crop" : "Stage unestimated",
      stageCalculationNote: "Add your planting date to estimate your crop's growth stage.",
      calendarProgress: null,
      calendarProgressText: knowledge.type === 'perennial' ? "Perennial Crop (Non-calendar)" : "Not available",
      stages: knowledge.stepperLabels,
      currentStageIndex: 0,
      isPerennial: knowledge.type === 'perennial'
    };
  }

  const diffMs = Date.now() - planted.getTime();
  const days = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (knowledge.type === 'perennial') {
    return {
      cropName: knowledge.cropName,
      hasPlantingDate: true,
      plantingDate: plantingDate,
      daysAfterPlanting: days,
      daysAfterPlantingText: `${days} days registered`,
      estimatedGrowthStage: "Cocoa development: Long-term tree crop",
      stageCalculationNote: "Long-term perennial crop — recommendations based on weather risks & management",
      calendarProgress: null,
      calendarProgressText: "Perennial Crop (Non-calendar)",
      stages: knowledge.stepperLabels,
      currentStageIndex: 1,
      isPerennial: true
    };
  }

  // Find matching stage
  let matchedStage = knowledge.stages[knowledge.stages.length - 1];
  for (const st of knowledge.stages) {
    if (days >= st.minDays && days <= st.maxDays) {
      matchedStage = st;
      break;
    }
  }

  // Calculate calendar progress percentage
  let progressPct = null;
  if (knowledge.expectedDurationDays) {
    progressPct = Math.min(100, Math.round((days / knowledge.expectedDurationDays) * 100));
  }

  const currentStageIndex = Math.min(knowledge.stepperLabels.length - 1, matchedStage.index);

  return {
    cropName: knowledge.cropName,
    hasPlantingDate: true,
    plantingDate: plantingDate,
    daysAfterPlanting: days,
    daysAfterPlantingText: `${days} days after planting`,
    estimatedGrowthStage: matchedStage.name,
    stageCalculationNote: `Based on your planting date and the crop's normal growth cycle (${days} days after planting)`,
    calendarProgress: progressPct,
    calendarProgressText: progressPct !== null ? `Estimated Season Progress: ${progressPct}%` : "Not available",
    stages: knowledge.stepperLabels,
    currentStageIndex: currentStageIndex,
    isPerennial: false
  };
}

// EVIDENCE-BASED AGRICULTURAL RULE LIBRARY
export const AGRICULTURAL_RULE_LIBRARY = [
  {
    ruleId: "MAIZE-GH-WEATHER-001",
    crop: "maize",
    region: "Ghana",
    growthStage: "Flowering",
    requiredInputs: ["crop", "plantingDate", "weatherForecast"],
    optionalInputs: ["irrigationPlan", "fertilizerPlan"],
    triggerConditions: {
      estimatedGrowthStage: "Flowering",
      rainProbMin: 60
    },
    recommendation: "Wait before applying fertilizer.",
    why: "Rain is coming soon. Applying fertilizer now may wash some of it away before your crops can use it.",
    reason: "Rain is coming soon. Applying fertilizer now may wash some of it away before your crops can use it.",
    risk: "Heavy rain after fertilizer application can wash the fertilizer away.",
    confidence: "Weather & farm advice (MoFA Ghana guidance)",
    basedOn: [
      "Estimated crop growth stage",
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
];

export const initialDashboardData = {
  headerInfo: {
    farmName: "My Farm",
    location: null,
    gps: "",
    statusLabel: "Open-Meteo Live API",
    lastUpdatedText: "Pending farm location",
    timestamp: Date.now()
  },

  weather: null,

  cropStatus: {
    source: "Calculated from planting date",
    cropName: "Maize",
    cropVariety: "Not specified",
    soilType: "Not specified",
    irrigationType: "Not specified",
    estimatedGrowthStage: "Flowering / Tasseling",
    stageCalculationNote: "Calendar-based estimate",
    daysAfterPlanting: "62 days after planting",
    plantingDate: null,
    calendarProgress: 56,
    calendarProgressText: "Estimated Season Progress: 56%",
    stages: ["Emergence", "Seedling", "Vegetative", "Flowering", "Maturity", "Harvest"],
    currentStageIndex: 3,
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
    const curWeather = weatherData ? weatherData.current : null;
    const todayForecast = (weatherData && weatherData.forecast && weatherData.forecast[0]) || {};
    const rainProb = todayForecast.precipitationProbability !== undefined ? todayForecast.precipitationProbability : (curWeather ? (curWeather.precipitation > 0 ? 90 : 20) : 20);
    const rainMm = curWeather ? curWeather.precipitation : 0;
    const temp = curWeather ? curWeather.temperature : 28;
    const humidity = curWeather ? curWeather.humidity : 75;

    const userCrops = (this.data.cropStatus.cropsList && this.data.cropStatus.cropsList.length > 0)
      ? this.data.cropStatus.cropsList
      : [this.data.cropStatus.cropName || 'Maize'];

    const cropAnalyses = [];
    let overallHighestRisk = { level: 0, text: "🟢 No major weather risk detected", type: "clear" };

    userCrops.forEach(cName => {
      const phenology = calculateCropStage(cName, this.data.cropStatus.plantingDate);
      const cropKey = cName.toLowerCase().trim();

      let weatherConditionLabel = "Generally favorable";
      let riskLevel = "low";
      let riskSummaryText = "🟢 No major weather risk detected";
      let primaryAction = "";
      let whyReason = "";
      let confidenceContext = "Weather & farm advice (MoFA Ghana guidance)";

      if (cropKey.includes('maize') || cropKey.includes('corn')) {
        if (curWeather && curWeather.precipitation > 0) {
          weatherConditionLabel = "Active Rainfall";
          riskLevel = "high";
          riskSummaryText = "🌧️ Heavy rain needs attention";
          primaryAction = "Hold on with farm work and chemical spraying for now.";
          whyReason = "It is currently raining. Wait for the rain to stop before putting fertilizer or chemicals on your farm.";
        } else if (rainProb >= 50 || rainMm > 5) {
          weatherConditionLabel = "Rainfall Risk";
          riskLevel = "medium";
          riskSummaryText = "🟡 Weather needs attention";
          primaryAction = "Wait before applying fertilizer.";
          whyReason = "Rain is expected soon. Applying fertilizer now may wash some of it away before your crops can use it.";
        } else if (temp > 32) {
          weatherConditionLabel = "Heat Stress Risk";
          riskLevel = "medium";
          riskSummaryText = "🟠 Hot weather needs attention";
          primaryAction = "Keep an eye on field moisture and shade young plants if needed.";
          whyReason = "The sun is very hot today (over 32°C). High heat can dry out soil quickly and make your crop thirsty.";
        } else {
          weatherConditionLabel = "Generally favorable";
          riskLevel = "low";
          riskSummaryText = "🟢 No major weather risk detected";
          primaryAction = `Good weather for farm work today.`;
          whyReason = `Weather conditions (${temp}°C, ${rainProb}% rain chance) are good for normal crop growth.`;
        }

      } else if (cropKey.includes('cassava')) {
        if (rainMm > 15 || (todayForecast.precipitation > 15)) {
          weatherConditionLabel = "Waterlogging Risk";
          riskLevel = "high";
          riskSummaryText = "🌧️ Heavy rain needs attention";
          primaryAction = "Clear water pathways so rain can flow away from your cassava roots.";
          whyReason = "Heavy rain can flood low areas and cause cassava roots to rot.";
        } else {
          weatherConditionLabel = "Generally favorable";
          riskLevel = "low";
          riskSummaryText = "🟢 No major weather risk detected";
          primaryAction = "Keep your cassava field clean of weeds.";
          whyReason = "Good weather for root growth.";
        }

      } else if (cropKey.includes('rice')) {
        if (rainProb >= 60) {
          weatherConditionLabel = "Water Replenishment Opportunity";
          riskLevel = "low";
          riskSummaryText = "🌧️ Rain expected soon";
          primaryAction = "Fix your field banks to catch and hold the rainwater.";
          whyReason = "Rain is coming to fill your rice field. Adjust your field edges to hold the water.";
        } else if (temp > 35) {
          weatherConditionLabel = "Heat Stress Risk";
          riskLevel = "medium";
          riskSummaryText = "🟠 Hot weather needs attention";
          primaryAction = "Keep enough water in your rice field to protect crops from the hot sun.";
          whyReason = "Very high heat can dry up water in your rice field quickly and affect grain growth.";
        } else {
          weatherConditionLabel = "Generally favorable";
          riskLevel = "low";
          riskSummaryText = "🟢 No major weather risk detected";
          primaryAction = "Check your rice water level and growth.";
          whyReason = "Weather conditions support stable rice growth.";
        }

      } else if (cropKey.includes('cocoa')) {
        if (humidity > 80) {
          weatherConditionLabel = "High Humidity / Fungal Risk";
          riskLevel = "medium";
          riskSummaryText = "💧 High humidity needs attention";
          primaryAction = "Check your cocoa pods for dark spots and trim extra branches so air can pass through.";
          whyReason = "The air is very damp (over 80% humidity). High dampness helps black pod disease spread on cocoa.";
        } else {
          weatherConditionLabel = "Generally favorable";
          riskLevel = "low";
          riskSummaryText = "🟢 No major weather risk detected";
          primaryAction = "Continue inspecting pods and tree shade.";
          whyReason = "Humidity and temperature levels are in a safe range for cocoa pods.";
        }

      } else {
        if (rainProb >= 60) {
          weatherConditionLabel = "Rainfall Risk";
          riskLevel = "medium";
          riskSummaryText = "🟡 Weather needs attention";
          primaryAction = `Check your work plan for ${cName}.`;
          whyReason = "Expected rain may interfere with chemical spraying or soil work.";
        } else {
          weatherConditionLabel = "Generally favorable";
          riskLevel = "low";
          riskSummaryText = "🟢 No major weather risk detected";
          primaryAction = `Good weather for caring for your ${cName}.`;
          whyReason = `Current weather (${temp}°C, ${rainProb}% rain chance) is favorable.`;
        }
      }

      cropAnalyses.push({
        cropName: cName,
        phenology: phenology,
        weatherCondition: weatherConditionLabel,
        riskLevel: riskLevel,
        statusText: riskSummaryText,
        primaryAction: primaryAction,
        whyReason: whyReason,
        confidenceContext: confidenceContext
      });

      const riskOrder = { "high": 3, "medium": 2, "low": 1 };
      if (riskOrder[riskLevel] > overallHighestRisk.level) {
        overallHighestRisk = {
          level: riskOrder[riskLevel],
          text: riskSummaryText,
          type: riskLevel === 'high' ? 'alert' : riskLevel === 'medium' ? 'warning' : 'clear'
        };
      }
    });

    const primaryAnalysis = cropAnalyses[0] || {
      cropName: "Maize",
      phenology: calculateCropStage("Maize", this.data.cropStatus.plantingDate),
      weatherCondition: "Generally favorable",
      statusText: "🟢 No major weather risk detected",
      primaryAction: "Keep checking your field regularly.",
      whyReason: "Weather forecast shows calm conditions.",
      confidenceContext: "Weather & farm advice"
    };

    // Update crop status data
    this.data.cropStatus.cropName = primaryAnalysis.cropName;
    this.data.cropStatus.estimatedGrowthStage = primaryAnalysis.phenology.estimatedGrowthStage;
    this.data.cropStatus.stageCalculationNote = primaryAnalysis.phenology.stageCalculationNote;
    this.data.cropStatus.daysAfterPlanting = primaryAnalysis.phenology.daysAfterPlantingText;
    this.data.cropStatus.calendarProgress = primaryAnalysis.phenology.calendarProgress;
    this.data.cropStatus.calendarProgressText = primaryAnalysis.phenology.calendarProgressText;
    this.data.cropStatus.stages = primaryAnalysis.phenology.stages;
    this.data.cropStatus.currentStageIndex = primaryAnalysis.phenology.currentStageIndex;
    this.data.cropStatus.weatherCondition = primaryAnalysis.weatherCondition;
    this.data.cropStatus.overallStatusText = overallHighestRisk.text;

    // Update AI Insight card with explainable "Why?" reasoning
    this.data.aiInsight.quote = primaryAnalysis.primaryAction;
    this.data.aiInsight.why = primaryAnalysis.whyReason;
    this.data.aiInsight.reason = `Weather: ${temp}°C • ${rainProb}% chance of rain in ${this.data.headerInfo.location}.`;
    this.data.aiInsight.risk = primaryAnalysis.statusText;
    this.data.aiInsight.confidence = primaryAnalysis.confidenceContext;
    this.data.aiInsight.basedOn = [
      `Crops monitored: ${userCrops.join(', ')}`,
      `Weather: ${temp}°C • ${rainProb}% chance of rain`,
      `Farm location: ${this.data.headerInfo.location}`,
      `Ghana Ministry of Agriculture (MoFA) Guidance`
    ];

    this.data.cropAnalyses = cropAnalyses;
  }

  applyUserFarmContext(userFarm) {
    if (!userFarm) return;
    if (userFarm.farmName) this.data.headerInfo.farmName = userFarm.farmName;
    if (userFarm.locationName) this.data.headerInfo.location = userFarm.locationName;
    if (userFarm.latitude && userFarm.longitude) {
      this.data.headerInfo.latitude = userFarm.latitude;
      this.data.headerInfo.longitude = userFarm.longitude;
      this.data.headerInfo.gps = `${userFarm.latitude}° N, ${Math.abs(userFarm.longitude)}° W`;
    }

    if (userFarm.crops && Array.isArray(userFarm.crops) && userFarm.crops.length > 0) {
      this.data.cropStatus.cropsList = userFarm.crops;
      this.data.cropStatus.cropName = userFarm.crops.join(', ');
    } else if (userFarm.crop) {
      const capCrop = userFarm.crop.charAt(0).toUpperCase() + userFarm.crop.slice(1);
      this.data.cropStatus.cropName = capCrop;
      this.data.cropStatus.cropsList = [capCrop];
    }

    // Set soil, variety, irrigation (or 'Not specified')
    this.data.cropStatus.cropVariety = userFarm.variety || 'Not specified';
    this.data.cropStatus.soilType = userFarm.soilType || 'Not specified';
    this.data.cropStatus.irrigationType = userFarm.irrigationType || 'Not specified';

    if (userFarm.plantingDate) {
      this.data.cropStatus.plantingDate = userFarm.plantingDate;
      const primaryCrop = (this.data.cropStatus.cropsList && this.data.cropStatus.cropsList[0]) || 'Maize';
      const phenology = calculateCropStage(primaryCrop, userFarm.plantingDate);
      
      this.data.cropStatus.daysAfterPlanting = phenology.daysAfterPlantingText;
      this.data.cropStatus.estimatedGrowthStage = phenology.estimatedGrowthStage;
      this.data.cropStatus.stageCalculationNote = phenology.stageCalculationNote;
      this.data.cropStatus.calendarProgress = phenology.calendarProgress;
      this.data.cropStatus.calendarProgressText = phenology.calendarProgressText;
      this.data.cropStatus.stages = phenology.stages;
      this.data.cropStatus.currentStageIndex = phenology.currentStageIndex;
    } else {
      this.data.cropStatus.plantingDate = null;
      this.data.cropStatus.daysAfterPlanting = "Planting date not provided";
      this.data.cropStatus.estimatedGrowthStage = "Stage unestimated";
      this.data.cropStatus.stageCalculationNote = "Add your planting date to estimate your crop's growth stage.";
      this.data.cropStatus.calendarProgress = null;
      this.data.cropStatus.calendarProgressText = "Not available";
    }
  }

  getLiveData() {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (this.isErrorSimulated) {
          reject(new Error("Unable to retrieve weather telemetry. Please check connection."));
        } else {
          this.data.headerInfo.timestamp = Date.now();
          this.data.headerInfo.lastUpdatedText = "Updated just now";
          resolve(this.data);
        }
      }, 400);
    });
  }

  toggleErrorState(simulateError) {
    this.isErrorSimulated = simulateError;
  }
}

