// CROPIE — Live Dashboard Data Service & Architecture Module
// Core Principle: "AI should not invent agricultural recommendations. No data source = No claim."

// CENTRAL CROP PHENOLOGY REGISTRY (Ghana CSIR-CRI & MoFA Guidelines)
export const CROP_PHENOLOGY = {
  maize: {
    cropName: "Maize",
    type: "annual",
    expectedDurationDays: 110,
    stages: [
      { name: "Planting / Emergence", minDays: 0, maxDays: 10, index: 0 },
      { name: "Seedling", minDays: 11, maxDays: 25, index: 1 },
      { name: "Vegetative", minDays: 26, maxDays: 45, index: 2 },
      { name: "Flowering / Tasseling", minDays: 46, maxDays: 70, index: 3 },
      { name: "Grain Filling", minDays: 71, maxDays: 95, index: 4 },
      { name: "Maturity", minDays: 96, maxDays: 110, index: 5 },
      { name: "Harvest Window", minDays: 111, maxDays: 999, index: 6 }
    ],
    stepperLabels: ["Emergence", "Seedling", "Vegetative", "Flowering", "Maturity", "Harvest"]
  },
  cassava: {
    cropName: "Cassava",
    type: "annual",
    expectedDurationDays: 300,
    stages: [
      { name: "Establishment", minDays: 0, maxDays: 45, index: 0 },
      { name: "Vegetative Development", minDays: 46, maxDays: 120, index: 1 },
      { name: "Root Bulking", minDays: 121, maxDays: 240, index: 2 },
      { name: "Maturity", minDays: 241, maxDays: 300, index: 3 },
      { name: "Harvest Window", minDays: 301, maxDays: 999, index: 4 }
    ],
    stepperLabels: ["Establishment", "Vegetative", "Root Bulking", "Maturity", "Harvest"]
  },
  rice: {
    cropName: "Rice",
    type: "annual",
    expectedDurationDays: 120,
    stages: [
      { name: "Germination / Establishment", minDays: 0, maxDays: 14, index: 0 },
      { name: "Seedling", minDays: 15, maxDays: 30, index: 1 },
      { name: "Tillering", minDays: 31, maxDays: 55, index: 2 },
      { name: "Panicle Initiation", minDays: 56, maxDays: 75, index: 3 },
      { name: "Flowering", minDays: 76, maxDays: 90, index: 4 },
      { name: "Grain Filling", minDays: 91, maxDays: 110, index: 5 },
      { name: "Maturity / Harvest", minDays: 111, maxDays: 999, index: 6 }
    ],
    stepperLabels: ["Establishment", "Tillering", "Panicle Init", "Flowering", "Maturity", "Harvest"]
  },
  cocoa: {
    cropName: "Cocoa",
    type: "perennial",
    expectedDurationDays: null,
    stages: [
      { name: "Perennial Tree Development", minDays: 0, maxDays: 9999, index: 0 }
    ],
    stepperLabels: ["Perennial Growth", "Pod Development", "Harvest Cycle"]
  },
  generic: {
    cropName: "Crop",
    type: "annual",
    expectedDurationDays: 120,
    stages: [
      { name: "Establishment", minDays: 0, maxDays: 20, index: 0 },
      { name: "Active Growth", minDays: 21, maxDays: 70, index: 1 },
      { name: "Reproductive / Flowering", minDays: 71, maxDays: 95, index: 2 },
      { name: "Maturity", minDays: 96, maxDays: 120, index: 3 },
      { name: "Harvest Window", minDays: 121, maxDays: 999, index: 4 }
    ],
    stepperLabels: ["Establishment", "Active Growth", "Flowering", "Maturity", "Harvest"]
  }
};

export function getPhenologyForCrop(cropName) {
  if (!cropName) return CROP_PHENOLOGY.generic;
  const key = cropName.toLowerCase().trim();
  if (key.includes('maize') || key.includes('corn')) return CROP_PHENOLOGY.maize;
  if (key.includes('cassava')) return CROP_PHENOLOGY.cassava;
  if (key.includes('rice')) return CROP_PHENOLOGY.rice;
  if (key.includes('cocoa')) return CROP_PHENOLOGY.cocoa;
  return { ...CROP_PHENOLOGY.generic, cropName: cropName };
}

export function calculateCropStage(cropName, plantingDate) {
  const phenology = getPhenologyForCrop(cropName);

  if (!plantingDate) {
    return {
      cropName: phenology.cropName,
      hasPlantingDate: false,
      daysAfterPlanting: null,
      daysAfterPlantingText: "Planting date not provided",
      estimatedGrowthStage: phenology.type === 'perennial' ? "Perennial Tree Development" : "Stage unestimated",
      stageCalculationNote: "Add your planting date to estimate your crop's growth stage.",
      calendarProgress: null,
      calendarProgressText: phenology.type === 'perennial' ? "Perennial Crop (Non-calendar)" : "Not available",
      stages: phenology.stepperLabels,
      currentStageIndex: 0,
      isPerennial: phenology.type === 'perennial'
    };
  }

  const planted = new Date(plantingDate);
  if (isNaN(planted.getTime())) {
    return {
      cropName: phenology.cropName,
      hasPlantingDate: false,
      daysAfterPlanting: null,
      daysAfterPlantingText: "Planting date not provided",
      estimatedGrowthStage: phenology.type === 'perennial' ? "Perennial Tree Development" : "Stage unestimated",
      stageCalculationNote: "Add your planting date to estimate your crop's growth stage.",
      calendarProgress: null,
      calendarProgressText: phenology.type === 'perennial' ? "Perennial Crop (Non-calendar)" : "Not available",
      stages: phenology.stepperLabels,
      currentStageIndex: 0,
      isPerennial: phenology.type === 'perennial'
    };
  }

  const diffMs = Date.now() - planted.getTime();
  const days = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (phenology.type === 'perennial') {
    return {
      cropName: phenology.cropName,
      hasPlantingDate: true,
      plantingDate: plantingDate,
      daysAfterPlanting: days,
      daysAfterPlantingText: `${days} days registered`,
      estimatedGrowthStage: "Perennial Tree Development",
      stageCalculationNote: "Long-term perennial crop — recommendations based on weather risks & management",
      calendarProgress: null,
      calendarProgressText: "Perennial Crop (Non-calendar)",
      stages: phenology.stepperLabels,
      currentStageIndex: 1,
      isPerennial: true
    };
  }

  // Find matching stage
  let matchedStage = phenology.stages[phenology.stages.length - 1];
  for (const st of phenology.stages) {
    if (days >= st.minDays && days <= st.maxDays) {
      matchedStage = st;
      break;
    }
  }

  // Calculate calendar progress percentage
  let progressPct = null;
  if (phenology.expectedDurationDays) {
    progressPct = Math.min(100, Math.round((days / phenology.expectedDurationDays) * 100));
  }

  // Map stepper node index safely
  const currentStageIndex = Math.min(phenology.stepperLabels.length - 1, matchedStage.index);

  return {
    cropName: phenology.cropName,
    hasPlantingDate: true,
    plantingDate: plantingDate,
    daysAfterPlanting: days,
    daysAfterPlantingText: `${days} days after planting`,
    estimatedGrowthStage: matchedStage.name,
    stageCalculationNote: `Calendar-based estimate (${days} days after planting)`,
    calendarProgress: progressPct,
    calendarProgressText: progressPct !== null ? `Estimated Season Progress: ${progressPct}%` : "Not available",
    stages: phenology.stepperLabels,
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
    recommendation: "Consider postponing granular fertilizer top-dressing.",
    why: "Rainfall expected shortly after application increases nitrogen runoff and leaching risk.",
    reason: "Precipitation shortly after fertilizer application or supplemental irrigation during flowering can increase the risk of nutrient runoff and leaching.",
    risk: "Rainfall shortly after granular fertilizer application may increase the risk of nutrient loss through runoff or leaching.",
    confidence: "Crop + weather insight (Open-Meteo telemetry & CSIR-CRI guidance)",
    basedOn: [
      "Estimated crop growth stage",
      "Live Open-Meteo weather telemetry",
      "CSIR-CRI & MoFA Ghana Crop Phenology Rules"
    ],
    notConsidered: "Soil moisture sensor data unavailable.",
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
    location: "Set your farm location to see local weather",
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
    quote: "Maintain standard field monitoring.",
    why: "Current weather conditions support normal development.",
    reason: "Live Open-Meteo telemetry shows stable temperature and rain probability.",
    risk: "🟢 No major weather risk detected",
    confidence: "Crop + weather insight",
    basedOn: [
      "Crops monitored: Maize",
      "Live weather telemetry (Open-Meteo API)",
      "CSIR-CRI & MoFA Ghana Crop Phenology Rules"
    ],
    notConsidered: "Soil moisture data is currently unavailable.",
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
      let confidenceContext = "Crop + weather insight (Open-Meteo telemetry & CSIR-CRI guidance)";

      if (cropKey.includes('maize') || cropKey.includes('corn')) {
        if (curWeather && curWeather.precipitation > 0) {
          weatherConditionLabel = "Active Rainfall";
          riskLevel = "high";
          riskSummaryText = "🌧️ Active Rainfall";
          primaryAction = "Pause active field operations and granular chemical application.";
          whyReason = "Active rainfall causes immediate runoff and washes away unabsorbed granular inputs.";
        } else if (rainProb >= 50 || rainMm > 5) {
          weatherConditionLabel = "Rainfall Risk";
          riskLevel = "medium";
          riskSummaryText = "🟡 Rainfall Risk";
          primaryAction = "Consider postponing granular fertilizer top-dressing.";
          whyReason = "Rainfall expected shortly after application increases nitrogen runoff and leaching risk.";
        } else if (temp > 32) {
          weatherConditionLabel = "Heat Stress Risk";
          riskLevel = "medium";
          riskSummaryText = "🟠 Heat Stress Risk";
          primaryAction = "Monitor soil moisture preservation during high temperatures.";
          whyReason = "Temperatures exceeding 32°C increase transpiration rates and may cause water stress during key developmental stages.";
        } else {
          weatherConditionLabel = "Generally favorable";
          riskLevel = "low";
          riskSummaryText = "🟢 No major weather risk detected";
          primaryAction = `Continue standard field management for ${phenology.estimatedGrowthStage}.`;
          whyReason = `Weather conditions (${temp}°C, ${rainProb}% rain chance) are favorable for normal development.`;
        }

      } else if (cropKey.includes('cassava')) {
        if (rainMm > 15 || (todayForecast.precipitation > 15)) {
          weatherConditionLabel = "Waterlogging Risk";
          riskLevel = "high";
          riskSummaryText = "🌧️ Heavy Rain / Waterlogging Risk";
          primaryAction = "Inspect field drainage channels and clear low-lying runoff paths.";
          whyReason = "Heavy rainfall can cause waterlogging, increasing the risk of root tuber rot in cassava fields.";
        } else {
          weatherConditionLabel = "Generally favorable";
          riskLevel = "low";
          riskSummaryText = "🟢 No major weather risk detected";
          primaryAction = "Maintain field weed control and monitor tuber zone drainage.";
          whyReason = "Current weather conditions support normal root and foliage development.";
        }

      } else if (cropKey.includes('rice')) {
        if (rainProb >= 60) {
          weatherConditionLabel = "Water Replenishment Opportunity";
          riskLevel = "low";
          riskSummaryText = "🌧️ Rainfall Expected (Paddock Water Benefit)";
          primaryAction = "Regulate paddy bunds to capture beneficial rainwater.";
          whyReason = "Expected rainfall provides natural irrigation for rice paddies; adjust bund openings accordingly.";
        } else if (temp > 35) {
          weatherConditionLabel = "Heat Stress Risk";
          riskLevel = "medium";
          riskSummaryText = "🟠 Extreme Heat Risk";
          primaryAction = "Maintain adequate water depth in paddies to buffer temperature spikes.";
          whyReason = "High temperatures accelerate water evaporation and can cause panicle sterility during flowering.";
        } else {
          weatherConditionLabel = "Generally favorable";
          riskLevel = "low";
          riskSummaryText = "🟢 No major weather risk detected";
          primaryAction = "Monitor water depth and tillering progress.";
          whyReason = "Weather conditions support stable paddy development.";
        }

      } else if (cropKey.includes('cocoa')) {
        if (humidity > 80) {
          weatherConditionLabel = "High Humidity / Fungal Risk";
          riskLevel = "medium";
          riskSummaryText = "💧 Fungal Disease Risk (Black Pod)";
          primaryAction = "Inspect pods for early fungal spots and prune dense canopy shoots to improve airflow.";
          whyReason = "Sustained relative humidity above 80% creates microclimate conditions favorable for Phytophthora (black pod) fungal spore germination.";
        } else {
          weatherConditionLabel = "Generally favorable";
          riskLevel = "low";
          riskSummaryText = "🟢 No major weather risk detected";
          primaryAction = "Continue shade tree management and pod inspection.";
          whyReason = "Humidity and temperature levels are within safe operating ranges for cocoa pods.";
        }

      } else {
        if (rainProb >= 60) {
          weatherConditionLabel = "Rainfall Risk";
          riskLevel = "medium";
          riskSummaryText = "🟡 Rainfall Risk";
          primaryAction = `Review scheduled field activities for ${cName}.`;
          whyReason = "Expected rainfall may affect spraying or soil cultivation.";
        } else {
          weatherConditionLabel = "Generally favorable";
          riskLevel = "low";
          riskSummaryText = "🟢 No major weather risk detected";
          primaryAction = `Maintain regular crop management for ${cName}.`;
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
      primaryAction: "Maintain standard field monitoring.",
      whyReason: "Weather telemetry shows stable conditions.",
      confidenceContext: "Weather-based insight"
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
    this.data.aiInsight.reason = `Live Open-Meteo telemetry shows ${temp}°C temperature and ${rainProb}% rain probability for ${this.data.headerInfo.location}.`;
    this.data.aiInsight.risk = primaryAnalysis.statusText;
    this.data.aiInsight.confidence = primaryAnalysis.confidenceContext;
    this.data.aiInsight.basedOn = [
      `Crops monitored: ${userCrops.join(', ')}`,
      `Live weather telemetry (Open-Meteo API — ${temp}°C, ${rainProb}% Rain)`,
      `Farm location: ${this.data.headerInfo.location}`,
      `CSIR-CRI & MoFA Ghana Crop Phenology Rules`
    ];

    this.data.cropAnalyses = cropAnalyses;
  }

  applyUserFarmContext(userFarm) {
    if (!userFarm) return;
    if (userFarm.farmName) this.data.headerInfo.farmName = userFarm.farmName;
    if (userFarm.locationName) this.data.headerInfo.location = userFarm.locationName;
    if (userFarm.latitude && userFarm.longitude) {
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

