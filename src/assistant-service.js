// CROPIE — Conversational Assistant & Intelligence Engine Coordinator
import { CROP_KNOWLEDGE, getKnowledgeForCrop, calculateCropStage, evaluateIntelligenceEngine } from './dashboard-data.js';

export class CropieAssistantService {
  constructor(dataService, khayaService) {
    this.dataService = dataService;
    this.khayaService = khayaService;
    this.conversationHistory = [];
    this.sessionContext = {
      lastUserMessage: '',
      lastIntent: '',
      lastTopic: 'farm_overview',
      lastCrop: 'Maize',
      lastResponse: '',
      lastRecommendation: '',
      lastQuestion: '',
      selectedLanguage: 'eng'
    };
  }

  // Build full farm, weather, and crop phenology context (SINGLE SOURCE OF TRUTH!)
  async buildFarmContext() {
    const liveData = await this.dataService.getLiveData();
    const farmInfo = liveData.headerInfo || {};
    const cropStatus = liveData.cropStatus || {};
    const weather = liveData.weather || {};

    let localSavedDate = null;
    try {
      const activeSaved = localStorage.getItem('cropie_active_farm');
      if (activeSaved) {
        const parsed = JSON.parse(activeSaved);
        if (parsed && parsed.plantingDate) localSavedDate = parsed.plantingDate;
      }
      if (!localSavedDate) {
        const localFarms = JSON.parse(localStorage.getItem('cropie_farms')) || [];
        if (localFarms.length > 0 && localFarms[0].plantingDate) localSavedDate = localFarms[0].plantingDate;
      }
    } catch {}

    const resolvedPlantingDate = cropStatus.plantingDate ||
      (cropStatus.cropsDetails && cropStatus.cropsDetails[0] && cropStatus.cropsDetails[0].plantingDate) ||
      farmInfo.plantingDate ||
      localSavedDate ||
      null;

    let locationStr = farmInfo.location || farmInfo.locationName || weather.locationName || null;
    if (!locationStr) {
      try {
        const activeSaved = localStorage.getItem('cropie_active_farm');
        if (activeSaved) {
          const parsed = JSON.parse(activeSaved);
          if (parsed && parsed.locationName) locationStr = parsed.locationName;
        }
      } catch {}
    }

    if (locationStr && (
      locationStr.toLowerCase().includes("set your farm location") ||
      locationStr.toLowerCase().includes("select your farm") ||
      locationStr.toLowerCase().includes("pending farm location")
    )) {
      locationStr = null;
    }

    const latVal = farmInfo.latitude !== undefined && farmInfo.latitude !== null ? parseFloat(farmInfo.latitude) : null;
    const lngVal = farmInfo.longitude !== undefined && farmInfo.longitude !== null ? parseFloat(farmInfo.longitude) : null;
    const hasValidGps = Boolean(latVal !== null && lngVal !== null && !isNaN(latVal) && !isNaN(lngVal));

    if (!locationStr && hasValidGps) {
      locationStr = `Farm Field (${latVal}° N, ${Math.abs(lngVal)}° W)`;
    } else if (!locationStr && farmInfo.gps && farmInfo.gps.trim()) {
      locationStr = `Farm Field (${farmInfo.gps})`;
    }

    const hasLocation = Boolean(hasValidGps || (locationStr && locationStr.trim().length > 0));

    const cropsList = (cropStatus.cropsList && cropStatus.cropsList.length > 0)
      ? cropStatus.cropsList
      : [cropStatus.cropName || 'Maize'];

    const cropsDetails = (cropStatus.cropsDetails && Array.isArray(cropStatus.cropsDetails) && cropStatus.cropsDetails.length > 0)
      ? cropStatus.cropsDetails
      : cropsList.map(cName => ({
          cropName: cName,
          plantingDate: resolvedPlantingDate
        }));

    // Independent multi-crop context list using calculateCropStage
    const cropContextMap = cropsDetails.map(cd => {
      const cName = cd.cropName || 'Crop';
      const pDate = cd.plantingDate || resolvedPlantingDate || null;
      const stageInfo = calculateCropStage(cName, pDate);
      return {
        cropId: cd.cropId || null,
        name: cName,
        plantingDate: stageInfo.hasPlantingDate ? stageInfo.plantingDate : null,
        daysAfterPlanting: stageInfo.hasPlantingDate ? stageInfo.daysAfterPlanting : null,
        daysAfterPlantingText: stageInfo.daysAfterPlantingText,
        growthStage: stageInfo.estimatedGrowthStage,
        calendarProgressText: stageInfo.calendarProgressText,
        hasPlantingDate: stageInfo.hasPlantingDate,
        knowledge: getKnowledgeForCrop(cName)
      };
    });

    const primaryCropObj = cropContextMap[0] || {
      name: 'Maize',
      plantingDate: null,
      daysAfterPlanting: null,
      daysAfterPlantingText: 'Planting date not provided',
      growthStage: 'Stage unestimated',
      calendarProgressText: 'Not available',
      hasPlantingDate: false,
      knowledge: getKnowledgeForCrop('Maize')
    };

    const isWeatherValid = Boolean(
      weather &&
      weather.temp !== null &&
      weather.temp !== undefined &&
      weather.temp !== 'Not available' &&
      weather.isAvailable !== false
    );

    const safeWeather = {
      temp: (weather && (weather.temp || weather.temperature)) || null,
      condition: (weather && (weather.condition || weather.weatherLabel)) || null,
      humidity: (weather && (weather.humidity || weather.relative_humidity_2m)) || null,
      rain: (weather && (weather.rain || weather.precipitation)) || null,
      wind: (weather && (weather.wind || weather.windSpeed)) || null,
      rainProb: (weather && (weather.rainProb !== undefined && weather.rainProb !== null ? String(weather.rainProb) : (weather.rainProbability ? String(weather.rainProbability) : null))) || null,
      rainNotice: (weather && weather.rainNotice) ? String(weather.rainNotice) : null,
      source: (weather && weather.source) || "Open-Meteo",
      isAvailable: isWeatherValid
    };

    let engineRecs = null;
    try {
      engineRecs = evaluateIntelligenceEngine(liveData);
    } catch {}

    // Diagnostic Logs
    console.log("[CROPIE CANONICAL WEATHER STATE]", weather);

    console.log("[CROPIE CHAT FARM CONTEXT]", {
      farm: farmInfo,
      crops: cropsList,
      primaryCrop: primaryCropObj.name,
      plantingDate: resolvedPlantingDate
    });

    console.log("[CROPIE CHAT WEATHER]", {
      temperature: safeWeather.temp,
      rainProbability: safeWeather.rainProb,
      condition: safeWeather.condition,
      source: safeWeather.source
    });

    console.log("[CROPIE CHAT LANGUAGE]", this.sessionContext.selectedLanguage || 'eng');

    return {
      farm: {
        id: farmInfo.farmId || farmInfo.id || null,
        name: farmInfo.farmName || 'My Farm',
        location: locationStr,
        latitude: latVal,
        longitude: lngVal,
        hasLocation: hasLocation
      },
      farmName: farmInfo.farmName || null,
      location: locationStr,
      latitude: latVal,
      longitude: lngVal,
      hasLocation: hasLocation,
      gps: farmInfo.gps || null,
      crops: cropsList,
      primaryCrop: primaryCropObj.name,
      primaryCropObj: primaryCropObj,
      cropContextMap: cropContextMap,
      plantingDate: resolvedPlantingDate,
      currentWeather: safeWeather,
      weatherAvailable: isWeatherValid,
      forecast: (weather && Array.isArray(weather.forecastList)) ? weather.forecastList : [],
      recommendations: engineRecs
    };
  }

  // Process user question through Conversational Intelligence Engine
  async processQuestion(userQuestionInEnglish, selectedLanguage = 'eng') {
    try {
      this.sessionContext.selectedLanguage = selectedLanguage || 'eng';
      const context = await this.buildFarmContext();

      let qRaw = (userQuestionInEnglish || '').toLowerCase().trim();

      // Auto-correct common typos
      qRaw = qRaw
        .replace(/\brhsi\b|\bthsi\b|\btish\b/gi, 'this')
        .replace(/\bwether\b|\bwather\b|\bweathr\b/gi, 'weather')
        .replace(/\bfertlizer\b|\bfert\b|\bfertilzer\b/gi, 'fertilizer')
        .replace(/\bpeste\b|\bpesticid\b|\bpsts\b/gi, 'pest')
        .replace(/\bchck\b|\bchek\b/gi, 'check')
        .replace(/\bthst\b|\btht\b/gi, 'that');

      const qLower = qRaw;
      const langCode = (selectedLanguage || 'eng').toLowerCase();

      // 1. Check for OUT-OF-DOMAIN non-farm questions FIRST
      const isOutofDomain = /\b(football|soccer|match|game|score|joke|jokes|laugh|funny|python|code|programming|script|crypto|bitcoin|eth|ethereum|president|politics|election|minister|movie|actor|film|cinema|music|song|singer|cv|resume|job|salary|car|vehicle|bank|capital of|celebrity|relationship)\b/i.test(qLower);

      if (isOutofDomain) {
        const refusalMsg = this.getOutofDomainRefusal(langCode);
        this.recordTurn(userQuestionInEnglish, refusalMsg, selectedLanguage, 'out_of_domain');
        return {
          finalAnswer: refusalMsg,
          rawEnglish: this.getOutofDomainRefusal('eng'),
          language: selectedLanguage
        };
      }

      // 2. Identify crop focus
      let targetedCropObj = context.primaryCropObj;
      context.cropContextMap.forEach(cObj => {
        if (new RegExp(`\\b${cObj.name.toLowerCase()}\\b`, 'i').test(qLower)) {
          targetedCropObj = cObj;
        }
      });

      const activeCropName = targetedCropObj.name;
      const dataTruth = {
        farmName: context.farmName || null,
        location: context.location || null,
        hasLocation: context.hasLocation,
        locationAvailable: context.hasLocation,
        weatherAvailable: context.weatherAvailable,
        crops: context.crops || [],
        primaryCrop: targetedCropObj.name,
        plantingDateAvailable: Boolean(targetedCropObj.hasPlantingDate),
        growthStageAvailable: Boolean(targetedCropObj.hasPlantingDate)
      };

      // 3. Short Follow-Up & Semantic Group Triggers
      const wordCount = qLower.split(/\s+/).filter(Boolean).length;
      let category = 'unknown';

      const isGreeting = /^\s*(hi|hello|hey|greetings|good\s*(morning|afternoon|evening)|akwaaba)\b/i.test(qLower) && wordCount <= 4;
      const isCasual = /\b(how are (you|u|r)|are (you|u|r) (okay|ok|doing ok)|you good|what are (you|u|r) doing|hmm|oh)\b/i.test(qLower);
      const isInsult = /\b(mad|you are dumb|you r dumb|dumb|this is useless|useless|you don't understand|you dont understand|you're wrong|your wrong|this is bad|stupid|crazy)\b/i.test(qLower);
      const isIdentity = /\b(who are you|what is cropie|what do you do|what can you help me with|who r u|about cropie|about yourself|who created you|who made you|what can you do)\b/i.test(qLower);

      const isTodayTrigger = /^\s*(today|for today|today's|today's advice|today's plan|today's work)\s*$/i.test(qLower) || (wordCount <= 3 && /\btoday\b/i.test(qLower));
      const isDetailsTrigger = /\b(in details?|details?|explain in detail|detailed|detailed explanation|explain more|tell me more|what does that mean|more)\b/i.test(qLower) && wordCount <= 5;
      const isWhyTrigger = /\b(why|why is that|why wait|why so|why are you saying that|how do you know|really|really\?|are you sure|seriously|for real|is that true|are you serious)\b/i.test(qLower) && wordCount <= 5;
      const isHowTrigger = /\b(how|how to|how to do it|how do i apply|how to apply|how to check|how to treat|how to do this|how should i do it|okay how)\b/i.test(qLower) && wordCount <= 5;
      const isOkayTrigger = /\b(okay|ok|alright|cool|nice|great|good|thanks|thank you)\b/i.test(qLower) && wordCount <= 3;
      const isGoAheadTrigger = /\b(go ahead|continue|proceed|keep going|next)\b/i.test(qLower) && wordCount <= 4;

      const isTodayActionPattern = /\b(what farming tasks should i prioritize today|prioritize today|what should i do today|what should i do on my farm today|what should i do on the farm|advise me on my farm|advice me on my farm|give me advice|give me farm advice|what advice do you have|what work should i do today|what should i focus on today|what should i work on today|what do i need to do today|what farm work should i do|what should i do now|today's farm advice|today's recommendations|give me today's farm advice|what should i do|what to do|what should i watch|anything i should know|today's advice|advice for today|recommend|recommendation|recommend something for my farm|recommend something|what needs attention|what is happening today|what's happening today)\b/i.test(qLower);

      const isFarmOverviewPattern = /\b(my farm|about my farm|the farm|farm|my farm info|my farm update|farm overview|overview|tell me about my farm|what is happening on my farm|what's happening on my farm|how is my farm|give me an update on my farm|give me an update|what is the current state of my farm|show me my farm status|current state|state of my farm|check my farm|farm update|farm report|farm summary|use the data on the site|use my farm data|use the information on my dashboard|based on my farm|look at my farm|site data|what is happening with my crops|check the system|check system|read the info from the site|read info from the site|read the info|read info|read site data|check site data)\b/i.test(qLower);

      const isPestPattern = /\b(pest|pests|how do i protect my crops from fall armyworm|protect my crops from fall armyworm|how do i control pests|what pests affect my maize|what should i look for on my crops|worm|armyworm|fall armyworm|bug|bugs|weed|weeds|disease|diagnose|diagnosis|sick|wilt|yellowing|spots|spot|leaves|leaf|blight|fungus|rot)\b/i.test(qLower);

      const isFertilizerPattern = /\b(can i apply fertilizer|should i apply fertilizer today|should i apply fertilizer to my farm today|will rain affect my fertilizer|will rain affect my fertilizer today|when should i apply fertilizer|can i fertilize my maize|fertilizer|fertiliser|npk|urea|nitrogen|topdress|topdress fertilizer)\b/i.test(qLower);

      const isStagePattern = /\b(what stage is my maize|how is my maize doing in its growth stage|how is my maize doing|what growth stage is my crop|how old is my maize|how many days has my maize been growing|growth stage|growth stages|days after planting|dap|stage|progress|tassel|tasseling|flower|flowering|plant|planted|planting|harvest|harvesting|cob|grain|mature|maturity)\b/i.test(qLower);

      const isWeatherPattern = /\b(explain today's weather|explain the weather|explain weather|how is the weather|what about rain|weather today|will rain affect my maize field today|will it rain|is it going to rain|what is the weather|what is the weather today|what's the weather|what's the weather on my farm|will rain affect my farm|what is the rain forecast|will it rain soon|will it rain today|weather|temperature|temp|storm|cloud|cloudy|sun|sunny|wind|forecast|humidity)\b/i.test(qLower);

      if (isGreeting) {
        category = 'greeting';
      } else if (isInsult) {
        category = 'insult';
      } else if (isCasual) {
        category = 'casual';
      } else if (isIdentity) {
        category = 'identity';
      } else if (isWhyTrigger) {
        category = 'why';
      } else if (isHowTrigger) {
        category = 'how';
      } else if (isDetailsTrigger) {
        category = 'details';
      } else if (isOkayTrigger) {
        category = 'okay';
      } else if (isGoAheadTrigger) {
        category = 'go_ahead';
      } else if (isTodayTrigger) {
        category = 'context_today';
      } else if (isTodayActionPattern) {
        category = 'today_action';
      } else if (isFarmOverviewPattern) {
        category = 'farm_overview';
      } else if (isPestPattern) {
        category = 'pests';
      } else if (isFertilizerPattern) {
        category = 'fertilizer';
      } else if (isStagePattern) {
        category = 'stage';
      } else if (isWeatherPattern) {
        category = 'weather';
      } else if (/\b(cassava|rice|yam|plantain|cocoa|maize|crop|crops)\b/i.test(qLower)) {
        category = 'specific_crop';
      }

      let responseText = '';
      const rainProbVal = parseInt(context.currentWeather.rainProb) || 0;
      const tempVal = context.currentWeather.temp || 'Not available';

      switch (category) {
        case 'greeting':
          responseText = `Hello! 👋 I'm Cropie. How can I help with your farm today?`;
          this.sessionContext.lastTopic = 'greeting';
          break;

        case 'identity':
          responseText = `I'm Cropie, your AI farm assistant. I use your farm information, crop data, planting dates, and live weather to help you manage your field.`;
          this.sessionContext.lastTopic = 'identity';
          break;

        case 'casual':
          responseText = `I'm doing well and ready to help with your farm! 🌱 What would you like to check today?`;
          this.sessionContext.lastTopic = 'casual';
          break;

        case 'insult':
          responseText = `I may have misunderstood you. Let me help you check your crops, weather, or field advice.`;
          this.sessionContext.lastTopic = 'insult';
          break;

        case 'okay':
          responseText = `Alright! I'm here whenever you want to check your crops, weather, or farm work.`;
          break;

        case 'details':
        case 'go_ahead':
          if (this.sessionContext.lastTopic === 'weather') {
            if (dataTruth.weatherAvailable) {
              responseText = `Here is your detailed weather breakdown for ${context.location || 'your farm'}:\n\n` +
                `🌡️ Temperature: ${context.currentWeather.temp || '25°C'}\n` +
                `☀️ Sky: ${context.currentWeather.condition || 'Clear'}\n` +
                `🌧️ Rain chance: ${context.currentWeather.rainProb || '0%'}\n\n` +
                `🌽 For your ${activeCropName.toLowerCase()}:\n` +
                `${targetedCropObj.hasPlantingDate ? `Your ${activeCropName.toLowerCase()} is around ${targetedCropObj.growthStage} (Day ${targetedCropObj.daysAfterPlanting}).` : `Your ${activeCropName.toLowerCase()} is monitored for field care.`} Check soil moisture before deciding on fertilizer application.`;
            } else {
              responseText = `Weather telemetry is currently unavailable for ${context.location || 'your farm'}. I will provide detailed weather metrics as soon as the weather connection refreshes.`;
            }
          } else {
            responseText = `Sure. Your ${activeCropName.toLowerCase()} is in the ${targetedCropObj.hasPlantingDate ? targetedCropObj.growthStage.toLowerCase() : 'current growth'} stage, which is an important period for plant development. ${dataTruth.weatherAvailable && (parseInt(context.currentWeather.rainProb) || 0) < 50 ? 'Since rain is not expected today, check soil moisture before deciding on fertilizer or other field work.' : 'Keep an eye on field drainage and inspect leaf whorls for early pests.'}`;
          }
          break;

        case 'why':
          responseText = `Yes. Based on current weather data${dataTruth.weatherAvailable ? ` (${context.currentWeather.temp || '25°C'}, ${context.currentWeather.rainProb || '0%'} rain chance)` : ''}, there is no major rain or heat warning for your farm right now. Your ${activeCropName.toLowerCase()} stage is estimated from the planting date you provided.`;
          break;

        case 'how':
          responseText = this.buildHowExplanation(context, targetedCropObj, dataTruth);
          break;

        case 'context_today':
          responseText = this.buildTodayActionReport(context, targetedCropObj, dataTruth);
          break;

        case 'farm_overview':
          responseText = this.buildDetailedFarmOverview(context, dataTruth);
          this.sessionContext.lastTopic = 'farm_overview';
          break;

        case 'today_action':
          responseText = this.buildTodayActionReport(context, targetedCropObj, dataTruth);
          this.sessionContext.lastTopic = 'today_action';
          break;

        case 'specific_crop':
          if (targetedCropObj.name.toLowerCase().includes('cocoa')) {
            responseText = `Your cocoa tree crop is monitored via local weather and humidity. Growth stage estimates apply to annual crops like maize, rice, and cassava.`;
          } else if (targetedCropObj.hasPlantingDate) {
            responseText = `Your ${targetedCropObj.name.toLowerCase()} is about Day ${targetedCropObj.daysAfterPlanting} after planting, so it is estimated to be at the ${targetedCropObj.growthStage.toLowerCase()} stage. ${dataTruth.weatherAvailable ? `Today's weather is ${context.currentWeather.temp} and ${context.currentWeather.condition ? context.currentWeather.condition.toLowerCase() : 'clear'}.` : ''}`;
          } else {
            responseText = `Your ${targetedCropObj.name.toLowerCase()} growth stage is not estimated yet because your planting date hasn't been added in settings.`;
          }
          this.sessionContext.lastTopic = 'specific_crop';
          this.sessionContext.lastCrop = targetedCropObj.name;
          break;

        case 'weather':
          if (dataTruth.weatherAvailable) {
            responseText = `Today's weather at your farm in ${context.location || 'your field'} is ${context.currentWeather.temp || '25°C'} and ${context.currentWeather.condition ? context.currentWeather.condition.toLowerCase() : 'clear'}, with a ${context.currentWeather.rainProb || '0%'} chance of rain.\n\n` +
              `For your ${activeCropName.toLowerCase()}, there is ${rainProbVal >= 50 ? 'a rain warning' : 'no major weather risk showing'} from the current forecast. ${rainProbVal >= 50 ? 'Wait before applying fertilizer.' : 'If the soil is dry, check soil moisture before applying fertilizer.'}`;
          } else if (dataTruth.locationAvailable) {
            responseText = `I couldn't get the latest weather right now. Please try again in a moment.`;
          } else {
            responseText = `I have your farm details, but I don't have the farm coordinates yet, so I can't get local weather.`;
          }
          this.sessionContext.lastTopic = 'weather';
          break;

        case 'fertilizer':
          if (!dataTruth.locationAvailable) {
            responseText = `I have your farm details, but I don't have the farm coordinates yet, so I can't check whether rain is forecast for your field today.`;
          } else if (!dataTruth.weatherAvailable) {
            responseText = `Weather telemetry is currently unavailable. Inspect your field and soil moisture directly before applying top-dressing fertilizer.`;
          } else if (rainProbVal >= 50) {
            responseText = `Rain may affect fertilizer if it falls soon after application (${context.currentWeather.rainProb || '50%'} chance of rain). Wait before applying fertilizer until the rain risk passes.`;
          } else {
            responseText = `No significant rain is expected in the next few hours (${tempVal}, ${context.currentWeather.rainProb || '0%'} rain chance). You can consider applying fertilizer today, while checking soil moisture.`;
          }
          this.sessionContext.lastTopic = 'fertilizer';
          break;

        case 'pests':
          responseText = `For ${activeCropName}: Inspect leaves and whorls for signs of Fall Armyworm or stalk borers. If detected, apply Neem seed extract or approved bio-pesticides early in the morning or late afternoon. Keep field edges clear of weeds.`;
          this.sessionContext.lastTopic = 'pests';
          break;

        case 'stage':
          if (activeCropName.toLowerCase().includes('cocoa')) {
            responseText = `Your cocoa tree crop is monitored using weather and crop-care conditions rather than a yearly harvest countdown.`;
          } else if (targetedCropObj.hasPlantingDate) {
            responseText = `Your ${activeCropName.toLowerCase()} is estimated to be in the ${targetedCropObj.growthStage.toLowerCase()} stage (Day ${targetedCropObj.daysAfterPlanting} after planting).`;
          } else {
            responseText = `Your planting date for ${activeCropName.toLowerCase()} is not available yet, so I can't estimate the growth stage. Please add your planting date in farm settings.`;
          }
          this.sessionContext.lastTopic = 'stage';
          break;

        default:
          responseText = `Hello! I'm Cropie. You can ask me about your crops, weather, rain, fertilizer, pests, or farm work.`;
          break;
      }

      // Update session memory
      this.sessionContext.lastUserMessage = userQuestionInEnglish;
      this.sessionContext.lastIntent = category;
      this.sessionContext.lastResponse = responseText;
      this.sessionContext.lastCrop = activeCropName;

      // 4. Native Ghanaian Language Translation Pipeline
      let finalAnswer = responseText;
      if (langCode !== 'eng') {
        try {
          const translatedFromKhaya = await this.khayaService.translateText(responseText, 'eng', langCode);
          if (translatedFromKhaya && translatedFromKhaya !== responseText) {
            finalAnswer = translatedFromKhaya;
          } else {
            finalAnswer = this.translateResponseToLanguage(responseText, langCode, context, targetedCropObj, category);
          }
        } catch {
          finalAnswer = this.translateResponseToLanguage(responseText, langCode, context, targetedCropObj, category);
        }
      }

      this.recordTurn(userQuestionInEnglish, finalAnswer, selectedLanguage, category);

      return {
        finalAnswer: finalAnswer,
        rawEnglish: responseText,
        language: selectedLanguage,
        cropContext: activeCropName,
        locationContext: context.location,
        weatherContext: context.currentWeather
      };

    } catch (procErr) {
      console.error('[CROPIE ASSISTANT ERROR]', procErr);
      const fallbackMsg = `I'm monitoring your farm context! Ask me about your crop stage, fertilizer application, or current weather.`;
      return {
        finalAnswer: fallbackMsg,
        rawEnglish: fallbackMsg,
        language: selectedLanguage
      };
    }
  }

  recordTurn(question, response, language, category = 'general') {
    this.conversationHistory.push({
      question: question,
      response: response,
      language: language,
      category: category,
      timestamp: Date.now()
    });
    if (this.conversationHistory.length > 10) {
      this.conversationHistory.shift();
    }
  }

  buildWhyExplanation(context, cropObj, dataTruth) {
    const cName = cropObj ? cropObj.name.toLowerCase() : 'maize';
    const tempStr = dataTruth.weatherAvailable ? `${context.currentWeather.temp || '25°C'}, ${context.currentWeather.condition || 'Clear'} (${context.currentWeather.rainProb || '0%'} rain chance)` : 'current weather forecast';
    return `Yes. Based on ${tempStr}, there is no major rain or heat warning for your farm right now. Your ${cName} stage is estimated from the planting date you provided.`;
  }

  buildHowExplanation(context, cropObj, dataTruth) {
    const cName = cropObj ? cropObj.name.toLowerCase() : 'maize';
    return `To check your ${cName} today, walk through your crop rows and inspect leaf whorls early in the morning for caterpillars or dark spots. Ensure drainage paths are clear in case of rain.`;
  }

  buildDetailedFarmOverview(context, dataTruth) {
    const cropStr = context.crops.join(' and ');
    const primaryObj = context.primaryCropObj;
    const locStr = (dataTruth.locationAvailable && context.location) ? `in ${context.location}` : '';
    
    let out = '';

    if (locStr) {
      out += `Your farm is ${locStr}, where you're growing ${cropStr.toLowerCase()}.\n\n`;
    } else {
      out += `You're growing ${cropStr.toLowerCase()} on your farm.\n\n`;
    }

    context.cropContextMap.forEach(cObj => {
      if (cObj.hasPlantingDate) {
        out += `Your ${cObj.name.toLowerCase()} is about Day ${cObj.daysAfterPlanting} after planting, so it is estimated to be at the ${cObj.growthStage.toLowerCase()} stage.\n\n`;
      } else {
        out += `Your ${cObj.name.toLowerCase()} growth stage is not estimated yet because your planting date hasn't been added in settings.\n\n`;
      }
    });

    if (dataTruth.weatherAvailable) {
      out += `Right now it is ${context.currentWeather.temp || '25°C'} with ${context.currentWeather.condition ? context.currentWeather.condition.toLowerCase() : 'clear weather'} and a ${context.currentWeather.rainProb || '0%'} chance of rain. `;
      const rainProbNum = parseInt(context.currentWeather.rainProb) || 0;
      if (rainProbNum >= 50) {
        out += `There is a rain warning in the forecast, so hold off on applying top-dressed fertilizer. Check your ${primaryObj.name.toLowerCase()} and make sure the soil has good drainage today.`;
      } else {
        out += `There is no major weather risk in the current forecast. Check your ${primaryObj.name.toLowerCase()} and make sure the soil has enough moisture today.`;
      }
    } else if (dataTruth.locationAvailable) {
      out += `I couldn't get the latest weather right now. Please try again in a moment.`;
    } else {
      out += `I have your farm details, but I don't have the farm coordinates yet, so I can't get local weather.`;
    }

    return out;
  }

  buildTodayActionReport(context, targetedCropObj, dataTruth) {
    const cName = targetedCropObj.name.toLowerCase();
    let out = '';

    if (targetedCropObj.hasPlantingDate) {
      out += `Today, your ${cName} is around ${targetedCropObj.growthStage.toLowerCase()}, Day ${targetedCropObj.daysAfterPlanting}. `;
    } else {
      out += `Today, your ${cName} is being monitored for field care. `;
    }

    if (dataTruth.weatherAvailable) {
      const rainProbNum = parseInt(context.currentWeather.rainProb) || 0;
      out += `The weather at your farm is ${context.currentWeather.temp || '25°C'} and ${context.currentWeather.condition ? context.currentWeather.condition.toLowerCase() : 'clear'}, with a ${context.currentWeather.rainProb || '0%'} chance of rain. `;
      if (rainProbNum >= 50) {
        out += `Rain is expected soon (${context.currentWeather.rainProb}), so wait before applying top-dressing fertilizer. Check soil moisture and keep an eye on the crop.`;
      } else {
        out += `There is no major weather risk showing right now. Check soil moisture and keep an eye on the crop.`;
      }
    } else if (dataTruth.locationAvailable) {
      out += `Weather telemetry is currently offline. Inspect your soil moisture and check leaf whorls for caterpillars today.`;
    } else {
      out += `I have your farm details, but I don't have the farm coordinates yet, so I can't get local weather.`;
    }

    return out;
  }

  getVoiceGreeting(langCode) {
    const lang = (langCode || 'eng').toLowerCase();
    if (lang === 'twi') {
      return `Akwaaba! Me yɛ Cropie. Me siesie me ho sɛ meboa wo afuo nnɛ.`;
    }
    if (lang === 'ewe') {
      return `Woezɔ! Nye wnye Cropie. Meli kple wò be makpe ɖe wò agble ŋu egbe.`;
    }
    if (lang === 'gaa' || lang === 'ga') {
      return `Blema baa! Mi ji Cropie. Miasiesie mihe ne maye mbua o-ŋmɔɔ ŋmɛnɛ.`;
    }
    if (lang === 'hau' || lang === 'hausa') {
      return `Sannu! Ni ne Cropie. Ina shirye don taimaka muku gona a yau.`;
    }
    return `Hello! 👋 I'm Cropie, your farm assistant. I'm ready to help you with your farm.`;
  }

  getNoSpeechMessage(langCode) {
    const lang = (langCode || 'eng').toLowerCase();
    if (lang === 'twi') {
      return `Mante hwee. Mepɛ sɛ wosɔ anomu bio.`;
    }
    if (lang === 'ewe') {
      return `Mese naneke o. Miagba ase.`;
    }
    if (lang === 'gaa' || lang === 'ga') {
      return `Minuu nɔvɔ. Ha biam nɔ bio.`;
    }
    if (lang === 'hau' || lang === 'hausa') {
      return `Ban ji komai ba. Da fatan za a sake gwadawa.`;
    }
    return `I couldn't hear anything. Please try again.`;
  }

  getOutofDomainRefusal(langCode) {
    const lang = (langCode || 'eng').toLowerCase();
    if (lang === 'twi') {
      return `Me tumi boa wo wɔ wo afuo, afuo nnwuma, ewiemu tebea ne afuo afotu nkuto ho. Meni tumi mboa wo wɔ asɛm yi ho.`;
    }
    if (lang === 'ewe') {
      return `Mate ŋu akpe ɖe wo ŋu le wò agble, agbledɔwo, xexeme kple agblenyãwo koe ŋuti. Nyemate ŋu akpe ɖe wo ŋu le biabia ma ŋu o.`;
    }
    if (lang === 'gaa' || lang === 'ga') {
      return `Mate ŋu maye mbua o yɛ o-ŋmɔɔ, nukuwo, je ŋmɛnɛ kɛ ŋmɔɔ ŋaawo he kɛkɛ. Minyoŋ ma-ye obua o yɛ sane nɛɛ he.`;
    }
    if (lang === 'hau' || lang === 'hausa') {
      return `Zan iya taimaka muku kawai da gonarku, shuka, yanayi da shawarwarin gona. Ban iya taimakawa da wannan tambayar ba.`;
    }
    return `I'm here mainly to help with your farm and Cropie. You can ask me about your crops, weather, rain, fertilizer, pests or farm work.`;
  }

  translateResponseToLanguage(responseText, selectedLanguage, context, cropObj, category = 'general') {
    if (selectedLanguage === 'eng' || !selectedLanguage) return responseText;

    const lang = selectedLanguage.toLowerCase();
    const activeCrop = cropObj ? cropObj.name : 'Maize';
    const rainProb = (context.currentWeather && context.currentWeather.rainProb) ? context.currentWeather.rainProb : "0%";
    const location = context.location || "your farm";
    const temp = (context.currentWeather && context.currentWeather.temp) ? context.currentWeather.temp : "25°C";
    const days = cropObj && cropObj.daysAfterPlanting ? `Da ${cropObj.daysAfterPlanting}` : '';
    const stage = cropObj && cropObj.growthStage ? cropObj.growthStage : '';

    if (lang === 'twi') {
      if (category === 'greeting') return `Akwaaba! Me yɛ Cropie. Me siesie me ho sɛ meboa wo afuo nnɛ. Mɛni na wopɛ sɛ wosɔ hwɛ?`;
      if (category === 'casual') return `Me ho yɛ, na measiesie me ho sɛ meboa wo afuo! Mɛni na wopɛ sɛ wosɔ hwɛ?`;
      if (category === 'acknowledgement' || category === 'okay') return `Yoo! Sɛ wopɛ sɛ wosɔ wo nsuban anaa ewiemu tebea hwɛ a, me wɔ ha.`;
      if (category === 'insult') return `Ebia mante wo ase yie. Kyerɛ me deɛ wopɛ sɛ wosɔ hwɛ wɔ wo afuo ho na measɔ bio.`;
      if (category === 'weather' || category === 'fertilizer') return `Ewiemu tebea wɔ ${location}: Ewiemu yɛ ${temp}, nsuo tɔ nteteeɔ yɛ ${rainProb}. Sɛ nsuo bɛtwa a, twɛn fertilizer guo kosi sɛ nsuo no bɛtwa.`;
      if (category === 'pests') return `Hwɛ Fall Armyworm ne aboa fi afuo no so wɔ ${activeCrop} so. Sɛ wohunu aboa bi a, sɔ Neem nsuo anaa bio-pesticides gu so.`;
      if (category === 'stage') {
        if (cropObj && cropObj.hasPlantingDate) return `Wo ${activeCrop} mpuntuo tebea yɛ ${stage} (${days}). Yɛde wo dua berɛ na ɛbuuu yi.`;
        return `Wo dua berɛ nni hɔ nti metumi nkyerɛ wo ${activeCrop} mpuntuo tebea. Fa wo dua berɛ hyɛ mu wɔ afuo nsɛm mu.`;
      }
      return `Wɔ wo afuo so wɔ ${location} (${activeCrop}): Ewiemu yɛ ${temp}, nsuo tɔ nteteeɔ yɛ ${rainProb}.`;
    }

    if (lang === 'ewe') {
      if (category === 'greeting') return `Woezɔ! Nye wnye Cropie. Aleke mate ŋu akpe kpe wo egbe le wò agble ŋu?`;
      if (category === 'casual') return `Ele nyuie, eye melolo be makpe ɖe wo ŋu le wò agble ŋu! Nu ka wòdi be yeakpɔ?`;
      if (category === 'acknowledgement' || category === 'okay') return `Akpe na wo! Ne èdi be yeakpɔ wò nukuwo alo xexeme ŋu la, mele afi.`;
      if (category === 'insult') return `Mese wo gme o. Gblɔ nu si èdi be yeakpɔ le wò agble ŋuti meagba ase.`;
      if (category === 'weather' || category === 'fertilizer') return `Xexeme le ${location}: Xexeme le ${temp}, tsidza le ${rainProb}. Megada duu egbe o ne tsi le dzadzam.`;
      if (category === 'pests') return `Lé ŋku ɖe agbledɔlele kple vɔ̃wo ŋu le wò ${activeCrop} dzi. Zã Neem amine.`;
      if (category === 'stage') {
        if (cropObj && cropObj.hasPlantingDate) return `Wò ${activeCrop} le ${stage} dzi.`;
        return `Wò ŋkeke si dzi èdo wò ${activeCrop} mele afi o. Da ŋkeke ma ɖe wò agble nutowomewomewo me.`;
      }
      return `Le wò agble dzi le ${location} (${activeCrop}): Xexeme le ${temp}, tsidza le ${rainProb}.`;
    }

    if (lang === 'gaa' || lang === 'ga') {
      if (category === 'greeting') return `Blema baa! Mi ji Cropie. Mɛni mafe ma-ye obua o-ŋmɔɔ ŋmɛnɛ?`;
      if (category === 'casual') return `Miyɛ kpakpa, eye míasiesie mihe ne maye mbua o-ŋmɔɔ! Mɛni wodi be okwɛ?`;
      if (category === 'acknowledgement' || category === 'okay') return `Oyiwaladon! Kedji o-di be o-kwɛ o-ŋmɔɔ nibii alo je ŋmɛnɛ la, mi yɛ bi.`;
      if (category === 'insult') return `Kɛji minuu o-gbee emli yie o, ha biam nɔ ni o-di yɛ o-ŋmɔɔ he ni mate bio.`;
      if (category === 'weather' || category === 'fertilizer') return `Je ŋmɛnɛ le ${location}: Je yɛ ${temp}, nu tɔɔ yɛ ${rainProb}. Kaafã nsoo amrɔ nɛɛ ne nu ematɔ.`;
      if (category === 'stage') {
        if (cropObj && cropObj.hasPlantingDate) return `O-ŋmɔɔ ${activeCrop} yɛ ${stage} nɔ.`;
        return `Be ni odu o-ŋmɔɔ ${activeCrop} bɛ bi. Ha be ni odu kɛ yaa o-ŋmɔɔ nibii le mli.`;
      }
      return `Yɛ o-ŋmɔɔ nɔ le ${location} (${activeCrop}): Je ŋmɛnɛ yɛ ${temp}, nu tɔɔ yɛ ${rainProb}.`;
    }

    if (lang === 'hau' || lang === 'hausa') {
      if (category === 'greeting') return `Sannu! Ni ne Cropie. Ina shirye don taimaka muku gona a yau. Menene kuke son sani?`;
      if (category === 'casual') return `Lafiya lau, kuma ina shirye don taimaka muku da gona! Me kuke son dubawa?`;
      if (category === 'acknowledgement' || category === 'okay') return `To Madalla! Ina nan a duk lokacin da kuke son duba amfanin gona ko yanayi.`;
      if (category === 'insult') return `Wataƙila ban fahimce ku da kyau ba. Sanar da ni abin da kuke son sani game da gonarku.`;
      if (category === 'weather' || category === 'fertilizer') return `Rana a ${location}: Zazzabi ${temp}, damar ruwa ${rainProb}. Kada a sa taki idan ana tsammanin ruwa.`;
      if (category === 'stage') {
        if (cropObj && cropObj.hasPlantingDate) return `Shukar ${activeCrop} tana matakin ${stage}.`;
        return `Ranar shukarku ba ta samuwa ba tukuna. Da fatan za a ƙara ranar shuka.`;
      }
      return `A gonarku a ${location} (${activeCrop}): Yanayi ${temp}, damar ruwa ${rainProb}.`;
    }

    return responseText;
  }
}
