// CROPIE — Conversational Assistant & Intelligence Engine Coordinator
import { CROP_KNOWLEDGE, getKnowledgeForCrop, calculateCropStage } from './dashboard-data.js';

export class CropieAssistantService {
  constructor(dataService, khayaService) {
    this.dataService = dataService;
    this.khayaService = khayaService;
    this.conversationHistory = [];
  }

  // Build full farm, weather, and crop phenology context (NO FAKE DEFAULTS!)
  async buildFarmContext() {
    const liveData = await this.dataService.getLiveData();
    const farmInfo = liveData.headerInfo || {};
    const weather = liveData.weather || {};
    const cropStatus = liveData.cropStatus || {};

    const cropsList = (cropStatus.cropsList && cropStatus.cropsList.length > 0)
      ? cropStatus.cropsList
      : [cropStatus.cropName || 'Maize'];
    
    const plantingDate = cropStatus.plantingDate || null;
    let locationStr = farmInfo.location || farmInfo.locationName || null;
    if (locationStr && (
      locationStr.toLowerCase().includes("set your farm location") ||
      locationStr.toLowerCase().includes("select your farm") ||
      locationStr.toLowerCase().includes("pending farm location")
    )) {
      locationStr = null;
    }

    // Independent multi-crop context list using calculateCropStage
    const cropContextMap = cropsList.map(cName => {
      const stageInfo = calculateCropStage(cName, plantingDate);
      return {
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

    return {
      farmName: farmInfo.farmName || null,
      location: locationStr,
      gps: farmInfo.gps || null,
      crops: cropsList,
      primaryCrop: primaryCropObj.name,
      primaryCropObj: primaryCropObj,
      cropContextMap: cropContextMap,
      plantingDate: plantingDate,
      currentWeather: {
        temp: weather.temp || null,
        condition: weather.condition || null,
        humidity: weather.humidity || null,
        rain: weather.rain || null,
        wind: weather.wind || null,
        rainProb: weather.rainProb || null
      },
      forecast: weather.forecastList || []
    };
  }

  // Process user question through Intelligence Engine
  async processQuestion(userQuestionInEnglish, selectedLanguage = 'eng') {
    const context = await this.buildFarmContext();
    let qRaw = (userQuestionInEnglish || '').toLowerCase().trim();

    // 0. Auto-correct common typos
    qRaw = qRaw
      .replace(/\brhsi\b|\bthsi\b|\btish\b/gi, 'this')
      .replace(/\bwether\b|\bwather\b|\bweathr\b/gi, 'weather')
      .replace(/\bfertlizer\b|\bfert\b|\bfertilzer\b/gi, 'fertilizer')
      .replace(/\bpeste\b|\bpesticid\b|\bpsts\b/gi, 'pest');

    const qLower = qRaw;
    const langCode = (selectedLanguage || 'eng').toLowerCase();

    // 1. Check for OUT-OF-DOMAIN non-farm questions FIRST
    const isOutofDomain = /\b(football|soccer|match|game|score|joke|jokes|laugh|funny|python|code|programming|script|crypto|bitcoin|eth|ethereum|president|politics|election|minister|movie|actor|film|cinema|music|song|singer|cv|resume|job|salary|car|vehicle|bank)\b/i.test(qLower);

    if (isOutofDomain) {
      const refusalMsg = this.getOutofDomainRefusal(langCode);
      this.recordTurn(userQuestionInEnglish, refusalMsg, selectedLanguage);
      return {
        finalAnswer: refusalMsg,
        rawEnglish: this.getOutofDomainRefusal('eng'),
        language: selectedLanguage
      };
    }

    // 2. Identify crop focus (Farm-level vs Specific Crop)
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
      hasLocation: Boolean(context.location),
      crops: context.crops || [],
      primaryCrop: targetedCropObj.name,
      weatherAvailable: Boolean(context.location && context.currentWeather && context.currentWeather.temp),
      plantingDateAvailable: Boolean(targetedCropObj.hasPlantingDate),
      growthStageAvailable: Boolean(targetedCropObj.hasPlantingDate)
    };

    // 3. Classify intent using distinct category patterns and conversation memory
    let category = 'unknown';

    const isFollowupTrigger = /\b(more|tell me more|explain more|expand|detail|details|how|oh how|how so|how to do it|how do i apply|how to apply|how to treat|why|why is that|why wait|why so|when|when can i apply|what next|then what|really|really\?|are you sure|seriously|for real|is that true|what about tomorrow\??|what about tomorrow|and tomorrow\??|tomorrow\??|next week|recommend|recommendation|what do you recommend|what should i do|at what time|what time|hmm|oh|oh okay|okay|ok|alright|i see|and\?|then\?|what do you mean\??)\b/i.test(qLower);

    const isFarmOverviewPattern = /\b(what is happening|what's happening|what is going on|what's going on|how is my farm|how is my maize|how is my cassava|how is my crop|current state|state of my farm|check my farm|farm update|farm report|farm summary|tell me about my farm|give me an update|give me my farm update|use the data on the site|use my farm data|use the information on my dashboard|based on my farm|look at my farm|site data|what is happening today|what is happening now|what's happening today|what is happening with my crops)\b/i.test(qLower);

    const isTodayActionPattern = /\b(advise me on my farm|advice me on my farm|give me advice|give me farm advice|what advice do you have|what should i do|what should i do today|what should i do on my farm|what should i do on the farm|what do you advise|what do you recommend|recommend something for my farm|recommend|help me with my farm|what should i work on today|what do i need to do today|what should i watch|anything i should know|what should i do now|today's advice|advice for today)\b/i.test(qLower);

    const isIdentityPattern = /\b(what is cropie|who is cropie|about cropie|about yourself|who created you|who made you|what can you do)\b/i.test(qLower);

    if (isFollowupTrigger && this.conversationHistory.length > 0 && qLower.split(/\s+/).length <= 6) {
      category = 'followup';
    } else if (isTodayActionPattern) {
      category = 'today_action';
    } else if (isFarmOverviewPattern) {
      category = 'farm_overview';
    } else if (isIdentityPattern) {
      category = 'identity';
    } else if (/^\s*(hi|hello|hey|greetings|good\s*(morning|afternoon|evening)|akwaaba)\b/i.test(qLower) && qLower.split(/\s+/).length <= 4) {
      category = 'greeting';
    } else if (/\b(how are (you|u|r)|are (you|u|r) (okay|ok|doing ok)|you good|what are (you|u|r) doing|who are (you|u|r)|who r u|what is your name)\b/i.test(qLower)) {
      category = 'casual';
    } else if (/\b(thanks|thank you|okay|ok|alright|good|nice|cool|great)\b/i.test(qLower) && qLower.split(/\s+/).length <= 3) {
      category = 'acknowledgement';
    } else if (/\b(mad|you are dumb|you r dumb|dumb|this is useless|useless|you don't understand|you dont understand|you're wrong|your wrong|this is bad|stupid|crazy)\b/i.test(qLower)) {
      category = 'frustration';
    } else if (/\b(help|how to use|commands|features|what to ask|guide|guidance)\b/i.test(qLower)) {
      category = 'help';
    } else if (/\b(health|healthy|disease|diagnose|diagnosis|sick|wilt|yellowing|spots|spot|leaves|leaf|pest|pests|pesticide|worm|armyworm|fall armyworm|bug|bugs|weed|weeds|blight|fungus|rot)\b/i.test(qLower)) {
      category = 'pests';
    } else if (/\b(rain|rainy|weather|temperature|temp|storm|cloud|cloudy|sun|sunny|wind|forecast|humidity)\b/i.test(qLower)) {
      category = 'weather';
    } else if (/\b(fertilizer|fertiliser|npk|urea|nitrogen|topdress|apply|manure|spray|spraying|chemical|feed|soil)\b/i.test(qLower)) {
      category = 'fertilizer';
    } else if (/\b(stage|stages|growth|days|age|progress|tassel|tasseling|flower|flowering|plant|planted|planting|harvest|harvesting|yield|cob|grain|mature|maturity)\b/i.test(qLower)) {
      category = 'stage';
    } else if (/\b(cassava|rice|yam|plantain|cocoa|maize|crop|crops)\b/i.test(qLower)) {
      category = 'specific_crop';
    } else if (/\b(farm|overview)\b/i.test(qLower)) {
      category = 'multicrop';
    }

    let responseText = '';
    const rainProbVal = parseInt(context.currentWeather.rainProb) || 0;
    const tempVal = context.currentWeather.temp || '28°C';
    const locText = context.location ? `in ${context.location}` : '';

    switch (category) {
      case 'greeting':
        responseText = `Hello! 👋 I'm Cropie. How can I help with your farm today?`;
        break;

      case 'casual':
        if (qLower.includes('who are you') || qLower.includes('who r u') || qLower.includes('what is your name')) {
          responseText = `I'm Cropie, your AI farm assistant for Ghana! 🌱 I'm here to help you with your crops, weather, and farm care.`;
        } else if (qLower.includes('doing') || qLower.includes('what are you')) {
          responseText = `I'm checking the farm information and weather available to me. 🌱 Ask me about your crops, rain, planting, or farm care.`;
        } else {
          responseText = `I'm doing well and ready to help with your farm! 🌱 What would you like to check?`;
        }
        break;

      case 'acknowledgement':
        if (qLower.includes('ok') || qLower.includes('alright')) {
          responseText = `Alright! 🌱 I'm here whenever you want to check your crops or weather.`;
        } else {
          responseText = `You're welcome! 🌱 I'm here whenever you need help with your farm.`;
        }
        break;

      case 'frustration':
        responseText = `I may have misunderstood you. Tell me what you want to know about your farm and I'll try again.`;
        break;

      case 'followup':
        responseText = this.handleFollowupQuery(qLower, context, activeCropName);
        break;

      case 'farm_overview':
        responseText = this.buildDetailedFarmOverview(context, dataTruth);
        break;

      case 'today_action':
        responseText = this.buildTodayActionReport(context, targetedCropObj, dataTruth);
        break;

      case 'specific_crop':
        if (targetedCropObj.name.toLowerCase().includes('cocoa')) {
          responseText = `🌳 Cocoa • Long-term tree crop\n\nStatus: Monitored via weather and humidity. Growth stage estimates apply to annual crops like maize, rice, and cassava.`;
        } else if (targetedCropObj.hasPlantingDate) {
          responseText = `🌱 Your ${targetedCropObj.name}\n\n• Estimated Growth Stage: ${targetedCropObj.growthStage}\n• Crop Age: Day ${targetedCropObj.daysAfterPlanting} after planting (Planted: ${targetedCropObj.plantingDate})\n\nRecommendations for ${targetedCropObj.name}: Maintain effective weed control and inspect leaf whorls early in the morning for pests.`;
        } else {
          responseText = `🌱 Your ${targetedCropObj.name}\n\n• Planting Date: Not provided (I can't estimate ${targetedCropObj.name}'s growth stage yet because your planting date hasn't been added in settings).\n\nWeather forecast ${locText}: ${tempVal}, ${context.currentWeather.condition || 'Clear'}. Weather conditions look favorable for field activities.`;
        }
        break;

      case 'identity':
        responseText = `I'm Cropie, your AI farm assistant! 🌱\n\nI combine live weather forecasts, your farm location, planting dates, and Ghana Ministry of Agriculture guidelines to provide clear recommendations for your farm.\n\nYou can ask me about:\n🌦️ Weather and rain forecasts\n🌽 Crop growth stages\n🧪 Fertilizer timing\n🐛 Fall Armyworm and pest care\n🌾 Daily farm actions`;
        break;

      case 'help':
        responseText = `I can assist you with your farm ${locText}! You can ask questions such as:\n• 🌧️ "Will rain affect my fertilizer today?"\n• 🌽 "How is my ${activeCropName} doing in its growth stage?"\n• 🐛 "How do I protect my crops from Fall Armyworm?"\n• 🌾 "What farming tasks should I prioritize today?"`;
        break;

      case 'weather':
        if (!dataTruth.hasLocation) {
          responseText = `I don't have your farm location yet, so I can't check your local weather. Please set your farm location in settings.`;
        } else if (rainProbVal >= 50) {
          responseText = `Weather forecast ${locText}: Temperature is ${tempVal} with a ${context.currentWeather.rainProb} chance of rain.\n\n🌧️ WAIT BEFORE APPLYING FERTILIZER\nWhy? Rain is expected soon. Some fertilizer may be washed away.`;
        } else {
          responseText = `Weather forecast ${locText}: Temperature is ${tempVal} (${context.currentWeather.condition || 'Clear'}) with a low rain chance (${context.currentWeather.rainProb || '20%'}). No major weather risk detected from the current forecast.`;
        }
        break;

      case 'fertilizer':
        if (!dataTruth.hasLocation) {
          responseText = `I don't have your farm location yet, so I can't check rain forecasts for fertilizer. Please set your farm location in settings.`;
        } else if (rainProbVal >= 50) {
          responseText = `🌧️ WAIT BEFORE APPLYING FERTILIZER\n\nWhy? Rain is expected soon (${context.currentWeather.rainProb} rain chance). Applying fertilizer now may wash some of it away before your ${activeCropName} can use it.`;
        } else {
          responseText = `Weather conditions (${tempVal}, low rain chance) are favorable for applying fertilizer to your ${activeCropName} today. Make sure the soil has adequate moisture before starting.`;
        }
        break;

      case 'pests':
        responseText = `I don't have a photo or physical sensor reading of your crop, so I can't physically confirm its health or diagnose diseases.\n\nFor ${activeCropName}: Inspect leaves and cobs for signs of Fall Armyworm or stalk borers. If detected, apply Neem seed extract or approved bio-pesticides early in the morning or late afternoon. Keep field edges clear of weeds.`;
        break;

      case 'stage':
        if (activeCropName.toLowerCase().includes('cocoa')) {
          responseText = `🌳 Cocoa • Long-term tree crop\n\nYour cocoa is monitored using weather and crop-care conditions rather than a yearly harvest countdown. Growth stage estimates apply to annual crops like maize, rice, and cassava.`;
        } else if (targetedCropObj.hasPlantingDate) {
          responseText = `Your ${activeCropName} is estimated to be in the ${targetedCropObj.growthStage} stage (Day ${targetedCropObj.daysAfterPlanting} after planting).\n\nNote: Growth stage is an estimate calculated from your planting date (${targetedCropObj.plantingDate}) and the normal crop growth cycle.`;
        } else {
          responseText = `I don't have your planting date for ${activeCropName} yet, so I can't estimate its growth stage. Please add your planting date in your farm settings to enable growth stage calculations.`;
        }
        break;

      case 'multicrop':
        responseText = `Farm Overview ${locText}:\n\n` + context.cropContextMap.map(cObj => {
          if (cObj.name.toLowerCase().includes('cocoa')) {
            return `🌳 Cocoa: Long-term tree crop (Monitored via weather & humidity).`;
          }
          if (cObj.hasPlantingDate) {
            return `🌱 ${cObj.name}: Estimated ${cObj.growthStage} (Day ${cObj.daysAfterPlanting}).`;
          }
          return `🌱 ${cObj.name}: Growth stage unestimated (Add planting date in settings).`;
        }).join('\n\n');
        break;

      default:
        responseText = `I'm not sure what you mean. You can ask me about your crops, weather, rain, fertilizer, pests or farm care.`;
        break;
    }

    // 4. Native Ghanaian Language Translation Engine (if selected)
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

    // 5. Record turn in conversation history (rolling 10-turn memory)
    this.recordTurn(userQuestionInEnglish, finalAnswer, selectedLanguage, category);

    return {
      finalAnswer: finalAnswer,
      rawEnglish: responseText,
      language: selectedLanguage,
      cropContext: activeCropName,
      locationContext: context.location,
      weatherContext: context.currentWeather
    };
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

  handleFollowupQuery(qLower, context, activeCropName) {
    const lastTurn = this.conversationHistory[this.conversationHistory.length - 1];
    const lastA = lastTurn ? (lastTurn.response || '').toLowerCase() : '';

    // Acknowledgements (hmm, oh, okay, ok, alright, i see)
    if (/^\s*(hmm|oh|oh okay|okay|ok|alright|i see)\b/i.test(qLower)) {
      return `Alright 👍. I'm ready whenever you want to check your crops, weather, or farm advice.`;
    }

    // Really / Are you sure
    if (/\b(really|really\?|are you sure|seriously|for real|is that true)\b/i.test(qLower)) {
      if (lastA.includes('not provided') || lastA.includes('missing') || lastA.includes('not set') || lastA.includes('don\'t have')) {
        return `Yes. That's based on the information currently available on your Cropie account. I don't want to guess about information that hasn't been provided.`;
      }
      return `Yes! This recommendation is calculated from your active farm settings and live Open-Meteo weather telemetry.`;
    }

    // How / Oh how
    if (/\b(oh how|how|how to do it)\b/i.test(qLower)) {
      if (lastA.includes('planting date') || lastA.includes('location') || lastA.includes('settings')) {
        return `Open your farm settings, choose your crop, and enter your planting date or location. This will allow Cropie to calculate your crop's growth stage and fetch local weather advice.`;
      }
      if (lastA.includes('fertilizer')) {
        return `Apply top-dressing fertilizer 5 to 10 cm away from the base of the plant stem (side-dressing) into moist soil, then lightly cover with soil.`;
      }
      return `Inspect crop leaf whorls early in the morning for Fall Armyworm caterpillars, keep field edges clear of weeds, and check weather before applying chemicals.`;
    }

    // Why
    if (/\b(why|why is that|why wait|why so)\b/i.test(qLower)) {
      if (lastA.includes('fertilizer') || lastA.includes('rain')) {
        return `Because rain expected soon can wash away top-dressed fertilizer (leaching risk). It is safer to wait until the rain risk has passed.`;
      }
      return `Because agricultural recommendations are based on live weather telemetry and Ministry of Agriculture guidelines to prevent crop loss and nutrient wastage.`;
    }

    // When
    if (/\b(when|when can i apply|at what time|tomorrow)\b/i.test(qLower)) {
      return `Rain is expected tomorrow morning. You can check your farm forecast again after the rain risk has passed.`;
    }

    // More / Tell me more
    if (/\b(more|tell me more|expand|detail|details|and\?|then\?)\b/i.test(qLower)) {
      return `I can currently see that ${activeCropName} is listed on your farm. If you add your planting date and farm location in settings, Cropie will provide tailored growth stage estimates, rain alerts, and localized fertilizer timing.`;
    }

    return `Alright 👍. I'm here whenever you need help with your crops or farm advice.`;
  }

  buildDetailedFarmOverview(context, dataTruth) {
    let out = `WHAT I KNOW\n\n`;

    out += `🌽 Crop: ${context.crops.join(', ')}\n\n`;

    out += `🌱 Growth:\n`;
    context.cropContextMap.forEach(cObj => {
      if (cObj.hasPlantingDate) {
        out += `• ${cObj.name}: Estimated ${cObj.growthStage} stage (Day ${cObj.daysAfterPlanting} after planting)\n`;
      } else {
        out += `• ${cObj.name}: Not estimated yet — planting date is missing.\n`;
      }
    });

    out += `\n📍 Location:\n`;
    if (dataTruth.hasLocation) {
      out += `${context.location}\n`;
    } else {
      out += `Not set yet.\n`;
    }

    out += `\n🌦️ Weather:\n`;
    if (dataTruth.weatherAvailable) {
      out += `${context.currentWeather.temp}, ${context.currentWeather.condition || 'Clear'} (${context.currentWeather.rainProb} rain chance)\n`;
    } else {
      out += `Not available because farm location is not set.\n`;
    }

    out += `\nWHAT THIS MEANS\n`;
    if (!dataTruth.hasLocation || !context.primaryCropObj.hasPlantingDate) {
      const missing = [];
      if (!context.primaryCropObj.hasPlantingDate) missing.push('planting date');
      if (!dataTruth.hasLocation) missing.push('farm location');
      out += `I can monitor your ${context.primaryCropObj.name}, but I need your ${missing.join(' and ')} to give you more specific advice.\n\nOnce added, I can estimate your crop's growth stage and check local weather.`;
    } else {
      const rainProbNum = parseInt(context.currentWeather.rainProb) || 0;
      if (rainProbNum >= 50) {
        out += `Rain is expected soon (${context.currentWeather.rainProb}), which may wash away top-dressed fertilizer.\n\nTODAY'S ADVICE\nWait before applying fertilizer until the rain risk passes.`;
      } else {
        out += `No major weather risk detected from the current forecast.\n\nTODAY'S ADVICE\nEnsure adequate soil moisture before top-dressing fertilizer.`;
      }
    }

    return out;
  }

  buildTodayActionReport(context, targetedCropObj, dataTruth) {
    let out = `Here is my advice for your farm today:\n\n`;

    out += `🌽 ${targetedCropObj.name}\nI can see you are growing ${targetedCropObj.name.toLowerCase()}.\n\n`;

    out += `🌱 Growth stage\n`;
    if (dataTruth.growthStageAvailable) {
      out += `Estimated ${targetedCropObj.growthStage} stage (Day ${targetedCropObj.daysAfterPlanting} after planting, planted ${targetedCropObj.plantingDate}).\n\n`;
    } else {
      out += `I can't estimate this yet because your planting date has not been provided.\n\n`;
    }

    out += `🌦️ Weather\n`;
    if (dataTruth.weatherAvailable) {
      const tempVal = context.currentWeather.temp || '28°C';
      const rainProbVal = context.currentWeather.rainProb || '20%';
      out += `${tempVal}, ${context.currentWeather.condition || 'Clear'} (${rainProbVal} rain chance).\n\n`;
    } else {
      out += `I don't have your farm location yet, so I can't give you local weather advice.\n\n`;
    }

    out += `👉 What you can do:\n`;
    const actions = [];

    if (dataTruth.weatherAvailable) {
      const rainProbNum = parseInt(context.currentWeather.rainProb) || 0;
      if (rainProbNum >= 50) {
        actions.push(`• 🌧️ Wait before applying fertilizer because rain is expected soon (${context.currentWeather.rainProb}).`);
      } else {
        actions.push(`• 🟢 No major weather risk detected from the current forecast.`);
      }
    }

    actions.push(`• Check your ${targetedCropObj.name.toLowerCase()} leaves for signs of pests.`);
    actions.push(`• Keep field borders free from heavy weeds.`);

    if (!dataTruth.hasLocation || !dataTruth.plantingDateAvailable) {
      const missing = [];
      if (!dataTruth.hasLocation) missing.push('farm location');
      if (!dataTruth.plantingDateAvailable) missing.push('planting date');
      actions.push(`• Add your ${missing.join(' and ')} in settings so I can give you more specific advice.`);
    }

    out += actions.join('\n');
    return out;
  }

  getVoiceGreeting(langCode) {
    const lang = (langCode || 'eng').toLowerCase();
    if (lang === 'twi') {
      return `Mema wo akwaaba! Me ne Cropie. Kyerɛ me deɛ ɛrekɔ so wɔ wo afuo so anaa bisa me nsɛmmisa.`;
    }
    if (lang === 'ewe') {
      return `Woezɔ! Nye wnye Cropie. Gblɔ nu si le dzadzam le wò agble dzi alo bia biabia m.`;
    }
    if (lang === 'gaa' || lang === 'ga') {
      return `Blema baa! Mi ji Cropie. Gbeee mi nɔ ni yaa no yɛ o-ŋmɔɔ nɔ alo biam sane.`;
    }
    if (lang === 'hau' || lang === 'hausa') {
      return `Sannu, ni ne Cropie. Fada min abin da ke faruwa a gonarku ko ka tambaye ni.`;
    }
    return `Hi, I'm Cropie. Tell me what is happening on your farm or ask me a question.`;
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
      return `Metumi boa wo wɔ wo afuo, afuo nnwuma, ne Cropie nkuto ho. Bisam nsɛmmisa fa wo afuo, ewiemu tebea, anaa fertilizer guo ho.`;
    }
    if (lang === 'ewe') {
      return `Mate ŋu akpe ɖe wo ŋu le wò agble, agbledɔwo kple Cropie koe ŋuti. Biam nu le wò nukuwo, xexeme, alo agbledɔwo ŋu.`;
    }
    if (lang === 'gaa' || lang === 'ga') {
      return `Mate ŋu maye mbua o yɛ o-ŋmɔɔ, nukuwo kɛ Cropie he kɛkɛ. Biam sane yɛ o-ŋmɔɔ, je ŋmɛnɛ, kɛ ŋmɔɔ dɔwo he.`;
    }
    if (lang === 'hau' || lang === 'hausa') {
      return `Zan iya taimaka muku kawai da gonarku, shuka, da Cropie. Tambaye ni game da shukarku, yanayi, ko kula da gona.`;
    }
    return `I can only help with your farm, crops, and Cropie. Ask me about your crops, weather, planting, or farm care.`;
  }

  // Localized Ghanaian Language Translation Engine Fallback
  translateResponseToLanguage(responseText, selectedLanguage, context, cropObj, category = 'general') {
    if (selectedLanguage === 'eng' || !selectedLanguage) return responseText;

    const lang = selectedLanguage.toLowerCase();
    const activeCrop = cropObj ? cropObj.name : 'Maize';
    const rainProb = context.currentWeather.rainProb || "20%";
    const location = context.location || "your farm";
    const temp = context.currentWeather.temp || "28°C";
    const days = cropObj && cropObj.daysAfterPlanting ? `Da ${cropObj.daysAfterPlanting}` : '';
    const stage = cropObj && cropObj.growthStage ? cropObj.growthStage : '';

    if (lang === 'twi') {
      if (category === 'greeting') {
        return `Hello! 👋 Me ne Cropie. Ɛyɛ deɛn na me tumi boa wo afuo nnɛ?`;
      }
      if (category === 'casual') {
        return `Me ho yɛ, na measiesie me ho sɛ meboa wo afuo! 🌱 Mɛni na wopɛ sɛ wosɔ hwɛ?`;
      }
      if (category === 'acknowledgement') {
        return `Yoo! 🌱 Sɛ wopɛ sɛ wosɔ wo nsuban anaa ewiemu tebea hwɛ a, me wɔ ha.`;
      }
      if (category === 'frustration') {
        return `Ebia mante wo ase yie. Kyerɛ me deɛ wopɛ sɛ wosɔ hwɛ wɔ wo afuo ho na measɔ bio.`;
      }
      if (category === 'weather' || category === 'fertilizer') {
        return `Ewiemu tebea wɔ ${location}: Ewiemu yɛ ${temp}, nsuo tɔ nteteeɔ yɛ ${rainProb}. Sɛ nsuo bɛtwa a, twɛn fertilizer guo kosi sɛ nsuo no bɛtwa.`;
      }
      if (category === 'pests') {
        return `Hwɛ Fall Armyworm ne aboa fi afuo no so wɔ ${activeCrop} so. Sɛ wohunu aboa bi a, sɔ Neem nsuo anaa bio-pesticides gu so.`;
      }
      if (category === 'stage') {
        if (cropObj && cropObj.hasPlantingDate) {
          return `Wo ${activeCrop} mpuntuo tebea yɛ ${stage} (${days}). Yɛde wo dua berɛ na ɛbuuu yi.`;
        }
        return `Mni wo dua berɛ nti metumi nkyerɛ wo ${activeCrop} mpuntuo tebea. Kɔ wo afuo nsɛm mu na fa wo dua berɛ hyɛ mu.`;
      }
      return `Wɔ wo afuo so wɔ ${location} (${activeCrop}): Ewiemu yɛ ${temp}, nsuo tɔ nteteeɔ yɛ ${rainProb}.`;
    }

    if (lang === 'ewe') {
      if (category === 'greeting') {
        return `Woezɔ! 👋 Nye wnye Cropie. Aleke mate ŋu akpe kpe wo egbe le wò agble ŋu?`;
      }
      if (category === 'casual') {
        return `Ele nyuie, eye melolo be makpe ɖe wo ŋu le wò agble ŋu! 🌱 Nu ka wòdi be yeakpɔ?`;
      }
      if (category === 'acknowledgement') {
        return `Akpe na wo! 🌱 Ne èdi be yeakpɔ wò nukuwo alo xexeme ŋu la, mele afi.`;
      }
      if (category === 'frustration') {
        return `Mese wo gme o. Gblɔ nu si èdi be yeakpɔ le wò agble ŋuti meagba ase.`;
      }
      if (category === 'weather' || category === 'fertilizer') {
        return `Xexeme le ${location}: Xexeme le ${temp}, tsidza le ${rainProb}. Megada duu egbe o ne tsi le dzadzam.`;
      }
      if (category === 'pests') {
        return `Lé ŋku ɖe agbledɔlele kple vɔ̃wo ŋu le wò ${activeCrop} dzi. Zã Neem amine.`;
      }
      if (category === 'stage') {
        if (cropObj && cropObj.hasPlantingDate) {
          return `Wò ${activeCrop} le ${stage} dzi.`;
        }
        return `Nye megba nyã ŋkeke si dzi èdo wò ${activeCrop} o. Da ŋkeke ma ɖe wò agble nutowomewomewo me.`;
      }
      return `Le wò agble dzi le ${location} (${activeCrop}): Xexeme le ${temp}, tsidza le ${rainProb}.`;
    }

    if (lang === 'gaa' || lang === 'ga') {
      if (category === 'greeting') {
        return `Blema baa! 👋 Mi ji Cropie. Mɛni mafe ma-ye obua o-ŋmɔɔ ŋmɛnɛ?`;
      }
      if (category === 'casual') {
        return `Miyɛ kpakpa, eye míasiesie mihe ne maye mbua o-ŋmɔɔ! 🌱 Mɛni wodi be okwɛ?`;
      }
      if (category === 'acknowledgement') {
        return `Oyiwaladon! 🌱 Kedji o-di be o-kwɛ o-ŋmɔɔ nibii alo je ŋmɛnɛ la, mi yɛ bi.`;
      }
      if (category === 'frustration') {
        return `Kɛji minuu o-gbee emli yie o, ha biam nɔ ni o-di yɛ o-ŋmɔɔ he ni mate bio.`;
      }
      if (category === 'weather' || category === 'fertilizer') {
        return `Je ŋmɛnɛ le ${location}: Je yɛ ${temp}, nu tɔɔ yɛ ${rainProb}. Kaafã nsoo amrɔ nɛɛ ne nu ematɔ.`;
      }
      if (category === 'stage') {
        if (cropObj && cropObj.hasPlantingDate) {
          return `O-ŋmɔɔ ${activeCrop} yɛ ${stage} nɔ.`;
        }
        return `Milee be ni odu o-ŋmɔɔ ${activeCrop} lɔ. Ha be ni odu kɛ yaa o-ŋmɔɔ nibii le mli.`;
      }
      return `Yɛ o-ŋmɔɔ nɔ le ${location} (${activeCrop}): Je ŋmɛnɛ yɛ ${temp}, nu tɔɔ yɛ ${rainProb}.`;
    }

    if (lang === 'hau' || lang === 'hausa') {
      if (category === 'greeting') {
        return `Sannu! 👋 Ni ne Cropie. Ta yaya zan iya taimaka maka da gonarku a yau?`;
      }
      if (category === 'casual') {
        return `Lafiya ta lau, kuma a shirye nake in taimaka da gonarku! 🌱 Me kuke son bincikawa?`;
      }
      if (category === 'acknowledgement') {
        return `Bayan haka! 🌱 Ina nan a duk lokacin da kuke son bincika shukarku ko yanayi.`;
      }
      if (category === 'frustration') {
        return `Wataƙila Ban fahimce ku da kyau ba. Fada min abin da kuke son bincikawa game da gonarku kuma zan sake gwadawa.`;
      }
      if (category === 'weather' || category === 'fertilizer') {
        return `Yanayin ${location}: Yanayi ${temp}, yiwuwar ruwa ${rainProb}. A dakata da saka taki idan ana saurin ruwa.`;
      }
      if (category === 'stage') {
        if (cropObj && cropObj.hasPlantingDate) {
          return `Shuka ${activeCrop} tana matakin ${stage}.`;
        }
        return `Ba ni da ranar shukarku ba tukuna don ${activeCrop}. Da fatan za a ƙara ranar shuka a saitunan gonarku.`;
      }
      return `A gonar ku a ${location} (${activeCrop}): Yanayin ${temp}, yiwuwar ruwa ${rainProb}.`;
    }

    return responseText;
  }

  // Generate suggested quick prompts based on farm context
  async getSuggestedPrompts() {
    const context = await this.buildFarmContext();
    const mainCrop = context.primaryCrop;

    return [
      `🌧️ Will rain affect my ${mainCrop} field today?`,
      `🌱 How is my ${mainCrop} doing in its growth stage?`,
      `🌾 What should I do for my farm today?`,
      `☔ Should I apply fertilizer to my farm today?`
    ];
  }
}
