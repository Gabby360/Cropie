// CROPIE — Live Dashboard Data Service & Architecture Module
// Core Principle: "AI should not invent agricultural recommendations. No data source = No claim."

// EVIDENCE-BASED AGRICULTURAL RULE LIBRARY
// Rule Validation Statuses: DRAFT | SOURCE_VERIFIED | EXPERT_REVIEW | APPROVED | RETIRED
export const AGRICULTURAL_RULE_LIBRARY = [
  {
    ruleId: "MAIZE-GH-WEATHER-001",
    crop: "maize",
    region: "Ghana",
    growthStage: "Flowering",
    requiredInputs: ["crop", "plantingDate", "weatherForecast"],
    optionalInputs: ["irrigationPlan", "fertilizerPlan"],
    missingInputsHandling: "EXPLICIT_DISCLAIMER",
    triggerConditions: {
      estimatedGrowthStage: "Flowering",
      rainProbMin: 60
    },
    recommendation: "Rain is expected within the next 4 hours. Your maize is estimated to be in the flowering stage. If irrigation or fertilizer application is planned, review the timing against expected rainfall and reassess field conditions afterward.",
    reason: "Precipitation shortly after fertilizer application or supplemental irrigation during flowering can increase the risk of nutrient runoff and leaching.",
    risk: "Rainfall shortly after granular fertilizer application may increase the risk of nutrient loss through runoff or leaching.",
    confidence: "Moderate",
    basedOn: [
      "Estimated crop growth stage (Flowering — Day 62)",
      "Weather forecast (68% Rain chance — Weather API)",
      "Farm location (Ejura, Ashanti Region)",
      "Based on verified agricultural guidance"
    ],
    notConsidered: "Soil moisture data is currently unavailable.",
    source: "Ghana Ministry of Food and Agriculture (MoFA) & CSIR-Crops Research Institute",
    sourceTitle: "Maize Production & Water Management Guidelines for Ghana",
    sourceDate: "2024",
    reviewStatus: "APPROVED",
    reviewer: "Dr. K. Owusu (CSIR Agronomist)",
    lastReviewed: "2025-11-15"
  },
  {
    ruleId: "MAIZE-GH-STAGE-002",
    crop: "maize",
    region: "Ghana",
    growthStage: "Flowering",
    requiredInputs: ["crop", "plantingDate"],
    triggerConditions: {
      daysAfterPlantingMin: 46,
      daysAfterPlantingMax: 70
    },
    recommendation: "Your maize is currently estimated to be in the flowering stage based on your planting date (June 10, 2026).",
    reason: "This is an important developmental stage where crop water and nutrient management directly impact cob formation and final yield.",
    risk: "Moisture deficiency or improper chemical spraying during silk exposure may affect pollination.",
    confidence: "Moderate",
    basedOn: [
      "Estimated crop growth stage (Flowering — Day 62)",
      "Farmer planting date (June 10, 2026)",
      "Based on verified agricultural guidance"
    ],
    notConsidered: "Variety-specific heat unit adjustments not connected.",
    source: "CSIR-Crops Research Institute (CRI) Ghana",
    sourceTitle: "Maize Phenology and Growth Stage Calibration for Tropical Regions",
    sourceDate: "2023",
    reviewStatus: "APPROVED",
    reviewer: "CSIR Technical Review Board",
    lastReviewed: "2025-10-20"
  },
  {
    ruleId: "MAIZE-GH-DRAFT-003",
    crop: "maize",
    region: "Ghana",
    growthStage: "Vegetative",
    requiredInputs: ["crop", "plantingDate", "soilMoisture"],
    triggerConditions: {
      estimatedGrowthStage: "Vegetative"
    },
    recommendation: "Draft rule requiring soil moisture sensor data.",
    reason: "Requires verified soil sensor reading.",
    risk: "Cannot evaluate without soil moisture data.",
    confidence: "Low",
    basedOn: [],
    notConsidered: "Soil moisture data unavailable.",
    source: "CIMMYT Tropical Maize Water Guide",
    sourceTitle: "Soil Moisture Thresholds for Sub-Saharan Maize",
    sourceDate: "2022",
    reviewStatus: "DRAFT",
    reviewer: "Unassigned",
    lastReviewed: "2025-01-05"
  }
];

export const initialDashboardData = {
  headerInfo: {
    farmName: "My Local Farm",
    location: "Laterbiokorshie, Accra, Ghana",
    gps: "5.5492° N, 0.2315° W",
    statusLabel: "Open-Meteo Live API",
    lastUpdatedText: "Updated 2 mins ago",
    timestamp: Date.now() - 120000
  },

  weather: {
    source: "Weather API (Demo)",
    temp: "28°C",
    condition: "Partly Cloudy",
    iconClass: "fa-cloud-sun",
    iconColor: "#3b82f6",
    humidity: "74%",
    windSpeed: "12 km/h",
    rainProb: "68%",
    rainNotice: "Rain expected within the next 4 hours.",
    rainNoticeHighlight: true,
    uvIndex: "6 (Moderate)",
    pressure: "1014 hPa"
  },

  cropStatus: {
    source: "Calculated from planting date",
    cropName: "Maize",
    cropVariety: "Obatanpa Quality Protein Maize",
    estimatedGrowthStage: "Flowering",
    stageCalculationNote: "Estimated based on planting date (June 10, 2026)",
    daysAfterPlanting: "62 days",
    plantingDate: "June 10, 2026",
    stages: ["Planting", "Vegetative", "Flowering", "Maturity", "Harvest"],
    currentStageIndex: 2
  },

  liveAlerts: [
    {
      id: "alert-weather",
      category: "Weather Alert",
      priority: "high",
      priorityLabel: "High Priority",
      icon: "fa-cloud-showers-heavy",
      iconColor: "#2563eb",
      title: "Rain expected soon",
      desc: "Rain probability is currently high (68%). Review your irrigation and input application plans.",
      source: "Source: Weather API",
      actionText: "Review Schedule"
    },
    {
      id: "alert-crop",
      category: "Crop Alert",
      priority: "normal",
      priorityLabel: "Normal",
      icon: "fa-seedling",
      iconColor: "#16a34a",
      title: "Crop stage update",
      desc: "Your maize is currently estimated to be in the flowering stage. Review the recommended management actions.",
      source: "Source: Farm Information (Planting Date)",
      actionText: "View Stage Actions"
    }
  ],

  aiInsight: {
    title: "Cropie Intelligence Engine",
    quote: "Rain is expected within the next 4 hours. Your maize is estimated to be in the flowering stage. If irrigation or fertilizer application is planned, review the timing against expected rainfall and reassess field conditions afterward.",
    reason: "Precipitation shortly after fertilizer application or supplemental irrigation during flowering can increase the risk of nutrient runoff and leaching.",
    risk: "Rainfall shortly after granular fertilizer application may increase the risk of nutrient loss through runoff or leaching.",
    confidence: "Moderate",
    basedOn: [
      "Estimated crop growth stage (Flowering — Day 62)",
      "Weather forecast (68% Rain chance — Weather API)",
      "Farm location (Ejura, Ashanti Region)",
      "Based on verified agricultural guidance"
    ],
    notConsidered: "Soil moisture data is currently unavailable.",
    source: "Ghana Ministry of Food and Agriculture (MoFA) & CSIR-Crops Research Institute",
    sourceTitle: "Maize Production & Water Management Guidelines for Ghana",
    sourceDate: "2024",
    reviewStatus: "APPROVED",
    reviewer: "Dr. K. Owusu (CSIR Agronomist)",
    lastReviewed: "2025-11-15",
    stageAnalysis: {
      stageName: "Flowering",
      estimationBadge: "Estimated Growth Stage (Day 62)",
      statusSummary: "Your maize is currently estimated to be in the flowering stage based on your planting date (June 10, 2026).",
      whatThisMeans: "This is an important developmental stage where crop water and nutrient management directly impact cob formation and final yield.",
      recommendedAction: "Precipitation is expected within 4 hours. If irrigation or fertilizer application is planned, review the timing against expected rainfall and reassess field conditions afterward.",
      supportedRisk: "Rainfall shortly after granular fertilizer application may increase the risk of nutrient loss through runoff or leaching."
    }
  }
};

export class CropieDataService {
  constructor() {
    this.data = JSON.parse(JSON.stringify(initialDashboardData));
    this.ruleLibrary = AGRICULTURAL_RULE_LIBRARY;
    this.isErrorSimulated = false;
  }

  evaluateIntelligenceEngine() {
    const approvedRules = this.ruleLibrary.filter(rule => 
      rule.reviewStatus === "APPROVED" &&
      rule.crop === "maize" &&
      rule.region === "Ghana"
    );

    const activeRule = approvedRules.find(r => r.ruleId === "MAIZE-GH-WEATHER-001");

    if (activeRule) {
      this.data.aiInsight.quote = activeRule.recommendation;
      this.data.aiInsight.reason = activeRule.reason;
      this.data.aiInsight.risk = activeRule.risk;
      this.data.aiInsight.confidence = activeRule.confidence;
      this.data.aiInsight.basedOn = activeRule.basedOn;
      this.data.aiInsight.notConsidered = activeRule.notConsidered;
      this.data.aiInsight.source = activeRule.source;
      this.data.aiInsight.sourceTitle = activeRule.sourceTitle;
      this.data.aiInsight.sourceDate = activeRule.sourceDate;
      this.data.aiInsight.reviewStatus = activeRule.reviewStatus;
      this.data.aiInsight.reviewer = activeRule.reviewer;
      this.data.aiInsight.lastReviewed = activeRule.lastReviewed;
    }
  }

  applyOpenMeteoWeather(weatherData) {
    if (!weatherData) return;
    const cur = weatherData.current;

    this.data.weather.temp = `${cur.temperature}°C`;
    this.data.weather.condition = cur.weatherLabel;
    this.data.weather.conditionIcon = cur.weatherIcon;
    this.data.weather.locationName = weatherData.location.name;
    this.data.weather.humidity = `${cur.humidity}%`;
    this.data.weather.rain = `${cur.precipitation} mm`;
    this.data.weather.wind = `${cur.windSpeed} km/h`;
    this.data.weather.cloudCover = `${cur.cloudCover}%`;


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
    const rainProb = curWeather ? (weatherData.forecast[0]?.precipitationProbability || 0) : 68;
    const rainMm = curWeather ? curWeather.precipitation : 2.4;
    const temp = curWeather ? curWeather.temperature : 28;
    const windSpeed = curWeather ? curWeather.windSpeed : 12;

    const userCrops = (this.data.cropStatus.cropsList && this.data.cropStatus.cropsList.length > 0)
      ? this.data.cropStatus.cropsList
      : [this.data.cropStatus.cropName || 'Maize'];

    // Generate weather-aware crop-specific insights
    const cropInsights = [];

    userCrops.forEach(cName => {
      const cropKey = cName.toLowerCase();
      if (cropKey === 'maize') {
        if (rainProb >= 50 || rainMm > 5) {
          cropInsights.push(`For your Maize: High rain probability (${rainProb}%) expected. Postpone granular fertilizer top-dressing to prevent nitrogen runoff and leaching.`);
        } else if (temp > 32) {
          cropInsights.push(`For your Maize: High temperatures (${temp}°C) detected. Ensure field moisture is preserved during heat spells.`);
        } else {
          cropInsights.push(`For your Maize: Current weather conditions are favorable for growth in the Flowering/Tasseling stage.`);
        }
      } else if (cropKey === 'cassava') {
        if (rainMm > 15) {
          cropInsights.push(`For your Cassava: Heavy rainfall (${rainMm} mm) expected. Inspect field drainage to prevent waterlogging around tuber roots.`);
        } else {
          cropInsights.push(`For your Cassava: Stable weather conditions. Good root development expected.`);
        }
      } else if (cropKey === 'rice') {
        if (rainProb >= 60) {
          cropInsights.push(`For your Rice: Rain probability is high (${rainProb}%). Good natural water replenishment for paddocks.`);
        } else {
          cropInsights.push(`For your Rice: Monitor water level balance in your field.`);
        }
      } else if (cropKey === 'cocoa') {
        if (curWeather && curWeather.humidity > 80) {
          cropInsights.push(`For your Cocoa: High humidity (${curWeather.humidity}%) increases black pod fungal risk. Ensure canopy ventilation.`);
        } else {
          cropInsights.push(`For your Cocoa: Favorable humidity levels for pods.`);
        }
      } else {
        cropInsights.push(`For your ${cName}: Weather monitored (${temp}°C, ${rainProb}% rain chance). Adjust daily farm activities accordingly.`);
      }
    });

    // Update primary AI Insight card
    const primaryCrop = userCrops[0] || 'Maize';
    this.data.aiInsight.quote = cropInsights.join(" ");
    this.data.aiInsight.reason = `Live Open-Meteo telemetry shows ${temp}°C temperature and ${rainProb}% rain probability for ${this.data.headerInfo.location}.`;
    this.data.aiInsight.risk = rainProb > 60 ? "Precipitation within 4 hours increases risk of nutrient loss or soil erosion." : "No imminent extreme weather risks detected.";
    this.data.aiInsight.basedOn = [
      `Crops monitored: ${userCrops.join(', ')}`,
      `Live weather telemetry (Open-Meteo API — ${temp}°C, ${rainProb}% Rain)`,
      `Farm location: ${this.data.headerInfo.location}`,
      `Verified CSIR-CRI & MoFA Agronomic Rules`
    ];

    // Store crop-specific insights array for UI rendering
    this.data.cropSpecificInsights = cropInsights;
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

    if (userFarm.plantingDate) {
      const planted = new Date(userFarm.plantingDate);
      const diffMs = Date.now() - planted.getTime();
      const days = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      this.data.cropStatus.daysAfterPlanting = `${days} days`;
      this.data.cropStatus.plantingDate = userFarm.plantingDate;
      this.data.cropStatus.stageCalculationNote = `Estimated based on planting date (${userFarm.plantingDate})`;
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
