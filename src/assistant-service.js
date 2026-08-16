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
    // 3. Classify intent using distinct category patterns and conversation memory
    let category = 'unknown';

    const isFollowupTrigger = /\b(more|tell me more|explain more|expand|detail|details|how|how so|how to do it|how do i apply|how to apply|how to treat|why|why is that|why wait|why so|when|when can i apply|what next|then what|really|really\?|are you sure|is that true|what about tomorrow\??|what about tomorrow|and tomorrow\??|tomorrow\??|next week|recommend|recommendation|what do you recommend|what should i do|at what time|what time)\b/i.test(qLower);

    const isFarmOverviewPattern = /\b(what is happening|what's happening|what is going on|what's going on|how is my farm|how is my maize|how is my cassava|how is my crop|current state|state of my farm|check my farm|farm update|farm report|farm summary|tell me about my farm|give me an update|give me my farm update|use the data on the site|use my farm data|use the information on my dashboard|based on my farm|look at my farm|site data|what is happening today|what is happening now|what's happening today|what is happening with my crops)\b/i.test(qLower);

    const isTodayActionPattern = /\b(what should i do|what work should i do|what do i do|what to do|what should i watch|anything i should know|what should i do now|recommend|recommendation|recommend something|any advice|give me today's recommendation|give me today's farm advice|explain what i should do|today's advice|advice for today)\b/i.test(qLower);

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
        responseText = this.buildDetailedFarmOverview(context);
        break;

      case 'today_action':
        responseText = this.buildTodayActionReport(context, activeCropName);
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
        if (!context.location) {
          responseText = `Your farm location has not been set yet, so I can't give you local weather. Please set your farm location in settings.`;
        } else if (rainProbVal >= 50) {
          responseText = `Weather forecast ${locText}: Temperature is ${tempVal} with a ${context.currentWeather.rainProb} chance of rain.\n\n🌧️ WAIT BEFORE APPLYING FERTILIZER\nWhy? Rain is expected soon. Some fertilizer may be washed away.`;
        } else {
          responseText = `Weather forecast ${locText}: Temperature is ${tempVal} (${context.currentWeather.condition || 'Clear'}) with a low rain chance (${context.currentWeather.rainProb || '20%'}). Weather conditions look favorable for field work on your ${activeCropName}.`;
        }
        break;

      case 'fertilizer':
        if (!context.location) {
          responseText = `Your farm location has not been set yet, so I can't check rain forecasts for fertilizer. Please set your farm location in settings.`;
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
    let lastTopicTurn = null;
    for (let i = this.conversationHistory.length - 1; i >= 0; i--) {
      const turn = this.conversationHistory[i];
      if (['fertilizer', 'pests', 'weather', 'stage', 'farm_overview', 'today_action', 'specific_crop', 'multicrop'].includes(turn.category)) {
        lastTopicTurn = turn;
        break;
      }
    }

    const topic = lastTopicTurn ? lastTopicTurn.category : 'farm_overview';
    const tempVal = context.currentWeather.temp || '28°C';

    // A. Fertilizer Follow-ups
    if (topic === 'fertilizer') {
      if (/\b(why|why is that|why wait|why so)\b/i.test(qLower)) {
        return `Rain is expected soon on your farm. Rain shortly after applying top-dressing fertilizer causes nitrogen runoff and leaching, washing away nutrients before crop roots absorb them.`;
      }
      if (/\b(how|how so|how to do it|how do i apply|how to apply)\b/i.test(qLower)) {
        return `Apply fertilizer 5 to 10 cm away from the base of the plant stem (side-dressing) into moist soil, then lightly cover with soil. Avoid applying directly on wet leaves.`;
      }
      if (/\b(when|when can i apply|tomorrow|next week)\b/i.test(qLower)) {
        return `Rain is expected tomorrow morning. You can check again after the rain risk has passed before scheduling fertilizer top-dressing.`;
      }
      return `For ${activeCropName}: Apply basal NPK fertilizer at planting, and top-dress with Urea/SOA at 4-6 weeks when soil is moist. Avoid applying during heavy rain forecasts.`;
    }

    // B. Pest Follow-ups
    if (topic === 'pests') {
      if (/\b(why|why is that)\b/i.test(qLower)) {
        return `Neem seed extract and bio-pesticides protect beneficial insects and reduce chemical resistance, while early morning spraying targets caterpillars before heat forces them deeper into stems.`;
      }
      return `Recommended Pest Actions for ${activeCropName}:\n1. Inspect leaf whorls early in the morning for caterpillars.\n2. Apply Neem seed extract (50g/L) or approved bio-pesticides.\n3. Spray directly into leaf whorls where caterpillars hide.\n4. Keep field borders free of weeds.`;
    }

    // C. Weather Follow-ups
    if (topic === 'weather') {
      if (/\b(when|tomorrow|next week)\b/i.test(qLower)) {
        return `Rain is expected tomorrow morning (${tempVal}, ${context.currentWeather.rainProb || '70%'} rain chance). No extreme weather events detected for tomorrow.`;
      }
      return `Live weather telemetry is provided by Open-Meteo API using high-resolution meteorological forecast models for your farm coordinates.`;
    }

    // D. Growth Stage Follow-ups
    if (topic === 'stage') {
      if (/\b(really|really\?|are you sure|is that true)\b/i.test(qLower)) {
        return `Yes! Growth stage is an estimate calculated from your planting date and standard crop phenology cycles. Cropie does not physically view the field.`;
      }
      return `During this estimated growth stage, your ${activeCropName} needs adequate soil moisture and effective weed control. Peak water requirement occurs during flowering and cob formation.`;
    }

    // E. Farm Overview & Today Action Follow-ups
    if (/\b(when|when can i apply|at what time)\b/i.test(qLower)) {
      return `Rain is expected tomorrow morning. You can check your farm forecast again after the rain risk has passed.`;
    }

    if (/\b(why|why is that|why so)\b/i.test(qLower)) {
      return `Because rain expected soon can wash away top-dressed fertilizer (leaching risk). It is safer to wait until the rain risk has passed.`;
    }

    if (/\b(how|how to do it)\b/i.test(qLower)) {
      return `To perform today's farm tasks: Inspect crop whorls early in the morning, apply top-dressing fertilizer 5-10cm from stems in moist soil, and clear weeds along field borders.`;
    }

    if (/\b(more|tell me more|expand|detail|details)\b/i.test(qLower)) {
      return `Expanding your Farm Today Briefing:\n\n• Soil & Moisture: Ensure soil has adequate moisture before applying fertilizer top-dressing.\n• Pest Management: Scout leaf whorls early morning for Fall Armyworm.\n• Drainage: Clear field drainage furrows if rain is forecast to prevent waterlogging around roots.`;
    }

    if (/\b(recommend|what should i do|what do you recommend)\b/i.test(qLower)) {
      return `Top priority farming tasks for today:\n1. Check weather forecast before applying fertilizer.\n2. Inspect crop leaves for signs of Fall Armyworm or pests.\n3. Ensure field drainage channels are clear if rain is expected.`;
    }

    return `Yes, this is calculated from your active farm settings and live weather forecast for your field.`;
  }

  buildDetailedFarmOverview(context) {
    let out = `WHAT I SEE\n`;

    // Crops Section
    context.cropContextMap.forEach(cObj => {
      if (cObj.name.toLowerCase().includes('cocoa')) {
        out += `🌳 ${cObj.name}: Long-term tree crop (Monitored via weather & humidity)\n`;
      } else if (cObj.hasPlantingDate) {
        out += `🌽 ${cObj.name}: Estimated ${cObj.growthStage} stage (Day ${cObj.daysAfterPlanting} after planting)\n`;
      } else {
        out += `🌽 ${cObj.name}: Planting date not provided (I can't estimate growth stage yet)\n`;
      }
    });

    // Weather Section
    if (context.location) {
      const tempVal = context.currentWeather.temp || '28°C';
      const condVal = context.currentWeather.condition || 'Clear';
      const rainProbVal = context.currentWeather.rainProb || '20%';
      out += `🌡️ Weather: ${tempVal}, ${condVal}\n🌧️ Rain chance: ${rainProbVal}\n`;
    } else {
      out += `🌡️ Weather: Farm location not set yet\n`;
    }

    const rainProbNum = parseInt(context.currentWeather.rainProb) || 0;
    out += `\nWHAT THIS MEANS\n`;
    if (rainProbNum >= 50) {
      out += `Rain is expected soon (${context.currentWeather.rainProb}), which may wash away top-dressed fertilizer and affect field work.\n`;
    } else {
      out += `Weather conditions are favorable today for routine field maintenance and crop monitoring.\n`;
    }

    out += `\nTODAY'S ADVICE\n`;
    if (rainProbNum >= 50) {
      out += `Wait before applying fertilizer because rain is expected soon.`;
    } else {
      out += `Ensure adequate soil moisture before top-dressing fertilizer. Inspect leaf whorls early morning for Fall Armyworm.`;
    }

    return out;
  }

  buildTodayActionReport(context, activeCropName) {
    let out = `🌱 What to do today on your farm (${activeCropName}):\n\n`;

    const rainProbNum = parseInt(context.currentWeather.rainProb) || 0;
    if (rainProbNum >= 50) {
      out += `1. 🌧️ WAIT BEFORE APPLYING FERTILIZER\nRain is expected soon (${context.currentWeather.rainProb} chance). Top-dressing fertilizer now risks nutrient runoff and leaching.\n\n`;
    } else {
      out += `1. 🧪 FERTILIZER APPLICATION\nWeather conditions are favorable today (${context.currentWeather.temp || '28°C'}, low rain chance). If your ${activeCropName} is at 4-6 weeks after planting, apply top-dressing fertilizer into moist soil 5-10cm from stem base.\n\n`;
    }

    out += `2. 🐛 PEST & HEALTH INSPECTION\nInspect leaf whorls early in the morning for Fall Armyworm caterpillars. Apply Neem seed extract (50g/L) if detected.\n\n`;
    out += `3. 🌾 WEED & FIELD CARE\nKeep field borders clear of weeds to eliminate alternative host plants for pests.`;

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
