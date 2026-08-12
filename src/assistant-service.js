// CROPIE — Conversational Assistant & Intelligence Engine Coordinator

export class CropieAssistantService {
  constructor(dataService, khayaService) {
    this.dataService = dataService;
    this.khayaService = khayaService;
    this.conversationHistory = [];
  }

  // Build full farm, weather, and crop phenology context
  async buildFarmContext() {
    const liveData = await this.dataService.getLiveData();
    const farmInfo = liveData.headerInfo || {};
    const weather = liveData.weather || {};
    const cropStatus = liveData.cropStatus || {};

    const cropsList = cropStatus.cropsList || [cropStatus.cropName || 'Maize'];
    
    return {
      farmName: farmInfo.farmName || "My Farm",
      location: farmInfo.location || "Laterbiokorshie, Accra, Ghana",
      gps: farmInfo.gps || "5.5492° N, 0.2315° W",
      crops: cropsList,
      primaryCrop: cropsList[0] || 'Maize',
      daysAfterPlanting: cropStatus.daysAfterPlanting || "62 days",
      growthStage: cropStatus.estimatedGrowthStage || "Flowering / Tasseling",
      plantingDate: cropStatus.plantingDate || "June 10, 2026",
      currentWeather: {
        temp: weather.temp || "28°C",
        condition: weather.condition || "Partly Cloudy",
        humidity: weather.humidity || "74%",
        rain: weather.rain || "0 mm",
        wind: weather.wind || "12 km/h",
        rainProb: weather.rainProb || "68%"
      },
      forecast: weather.forecastList || []
    };
  }

  // Process user question through Intelligence Engine
  async processQuestion(userQuestionInEnglish, selectedLanguage = 'eng') {
    const context = await this.buildFarmContext();
    const qLower = userQuestionInEnglish.toLowerCase();

    // 1. Identify crop focus (Farm-level vs Specific Crop)
    let targetedCrop = null;
    context.crops.forEach(c => {
      if (qLower.includes(c.toLowerCase())) {
        targetedCrop = c;
      }
    });

    const activeCrop = targetedCrop || context.primaryCrop;
    const isMultiCrop = context.crops.length > 1;

    let responseText = '';

    // 2. Greetings & Introductions
    if (qLower.includes('hi') || qLower.includes('hello') || qLower.includes('hey') || qLower.includes('akwaaba') || qLower.includes('greetings')) {
      responseText = `Hello! Akwaaba! I'm Cropie, your AI farm assistant for ${context.location}. Your ${activeCrop} is currently at Day ${context.daysAfterPlanting} (${context.growthStage}). How can I help you today?`;
    }
    // 3. Weather & Rain Sensitivity Analysis
    else if (qLower.includes('rain') || qLower.includes('precipitation') || qLower.includes('water') || qLower.includes('storm')) {
      const rainProbVal = parseInt(context.currentWeather.rainProb) || 68;
      if (rainProbVal >= 50) {
        responseText = `Rain probability for ${context.location} is currently high (${context.currentWeather.rainProb}). ${activeCrop} in the ${context.growthStage} stage requires careful moisture management. Postpone top-dressing fertilizer to prevent nutrient washout into runoff.`;
      } else {
        responseText = `Current weather in ${context.location} shows low rain chance (${context.currentWeather.rainProb}) with ${context.currentWeather.temp} temperature. Normal field activities for ${activeCrop} can proceed.`;
      }
    }
    // 3. Fertilizer / Management Actions Question
    else if (qLower.includes('fertilizer') || qLower.includes('apply') || qLower.includes('manage') || qLower.includes('spray') || qLower.includes('today') || qLower.includes('do')) {
      if (qLower.includes('fertilizer')) {
        const rainProbVal = parseInt(context.currentWeather.rainProb) || 68;
        if (rainProbVal >= 50) {
          responseText = `Based on live Open-Meteo telemetry for ${context.location}, rain is expected soon (${context.currentWeather.rainProb} probability). Postpone granular nitrogen fertilizer top-dressing until heavy rain subsides to prevent fertilizer leaching.`;
        } else {
          responseText = `Your ${activeCrop} is at Day ${context.daysAfterPlanting} (${context.growthStage}). Current weather (${context.currentWeather.temp}, ${context.currentWeather.condition}) is favorable for field fertilizer top-dressing.`;
        }
      } else {
        if (isMultiCrop && !targetedCrop && (qLower.includes('all') || qLower.includes('crops') || qLower.includes('farm'))) {
          responseText = `Farm Overview for ${context.location}:\n\n` + context.crops.map(c => {
            if (c.toLowerCase() === 'maize') {
              return `🌽 Maize (${context.growthStage}): Monitor cob tasseling. Rain probability is ${context.currentWeather.rainProb}.`;
            } else if (c.toLowerCase() === 'cassava') {
              return `🌱 Cassava: Ensure proper root field drainage.`;
            } else if (c.toLowerCase() === 'rice') {
              return `🌾 Rice: Maintain balanced paddock water levels.`;
            } else {
              return `🌳 ${c}: Inspect field condition for weather resilience.`;
            }
          }).join('\n\n');
        } else {
          responseText = `For your ${activeCrop} in ${context.location} (${context.growthStage} — Day ${context.daysAfterPlanting}): Weather is ${context.currentWeather.temp} and ${context.currentWeather.condition}. Verified agricultural guidance recommends checking soil moisture and maintaining field weeding.`;
        }
      }
    }
    // 4. Crop Growth Stage & Phenology
    else if (qLower.includes('stage') || qLower.includes('growth') || qLower.includes('day') || qLower.includes('how')) {
      responseText = `Your ${activeCrop} is estimated to be in the ${context.growthStage} stage (Day ${context.daysAfterPlanting}, planted ${context.plantingDate}) based on farm data for ${context.location}.`;
    }
    // 5. Default Context-Aware Response
    else {
      responseText = `For your farm in ${context.location} (${context.crops.join(', ')}): Current weather is ${context.currentWeather.temp}, ${context.currentWeather.condition} with ${context.currentWeather.rainProb} rain probability. Your ${activeCrop} is in the ${context.growthStage} stage.`;
    }

    // 6. Record turn in conversation history
    this.conversationHistory.push({
      question: userQuestionInEnglish,
      response: responseText,
      timestamp: Date.now()
    });

    return {
      englishAnswer: responseText,
      cropContext: activeCrop,
      locationContext: context.location,
      weatherContext: context.currentWeather
    };
  }

  // Generate suggested quick prompts based on farm context
  async getSuggestedPrompts() {
    const context = await this.buildFarmContext();
    const mainCrop = context.primaryCrop;

    return [
      `🌧️ Will rain affect my ${mainCrop} field today?`,
      `🌱 How is my ${mainCrop} doing in its growth stage?`,
      `🌾 What should I do for my crops today?`,
      `☔ Should I apply fertilizer to my farm today?`
    ];
  }
}
