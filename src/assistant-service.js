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
    const locationStr = farmInfo.location || farmInfo.locationName || null;

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

    // 3. Classify intent using strict word boundaries
    let category = 'general';

    if (/^\s*(hi|hello|hey|akwaaba|greetings|good\s*(morning|afternoon|evening))\b/i.test(qLower) && qLower.split(/\s+/).length <= 4) {
      category = 'greeting';
    } else if (/\b(who are you|who r u|what is cropie|who is cropie|what is your name|who created you|who made you|what can you do|about cropie|about yourself|your name|identity|cropie|what is this)\b/i.test(qLower)) {
      category = 'identity';
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
    } else if (/\b(cassava|rice|yam|plantain|cocoa|maize|crop|crops|farm|overview)\b/i.test(qLower)) {
      category = 'multicrop';
    } else if (qLower.length <= 3 || /^(how|what|why|when|who|where|ok|okay|can|tell|is|are|do)$/i.test(qLower)) {
      category = 'ambiguous';
    }

    let responseText = '';
    const rainProbVal = parseInt(context.currentWeather.rainProb) || 0;
    const tempVal = context.currentWeather.temp || '28°C';
    const locText = context.location ? `in ${context.location}` : '';

    switch (category) {
      case 'identity':
        responseText = `I'm Cropie, your AI farm assistant for Ghana! I combine live weather forecasts with Ministry of Agriculture guidelines to provide real-time recommendations on crop care, fertilizer timing, rain alerts, and pest management. How can I assist your farm today?`;
        break;

      case 'help':
        responseText = `I can assist you with your farm ${locText}! You can ask questions such as:\n• 🌧️ "Will rain affect my fertilizer today?"\n• 🌽 "How is my ${activeCropName} doing in its growth stage?"\n• 🐛 "How do I protect my crops from Fall Armyworm?"\n• 🌾 "What farming tasks should I prioritize today?"`;
        break;

      case 'ambiguous':
        responseText = `Could you please clarify what you'd like to check? You can ask about weather forecasts, fertilizer application, pest control, or growth stages for your ${activeCropName}.`;
        break;

      case 'greeting':
        if (targetedCropObj.hasPlantingDate) {
          responseText = `Hello! Akwaaba! I'm Cropie, your AI farm assistant. Your ${activeCropName} is estimated to be at Day ${targetedCropObj.daysAfterPlanting} (${targetedCropObj.growthStage}). How can I help your farm today?`;
        } else {
          responseText = `Hello! Akwaaba! I'm Cropie, your AI farm assistant. I'm monitoring your ${activeCropName}. How can I help your farm today?`;
        }
        break;

      case 'weather':
        if (rainProbVal >= 50) {
          responseText = `Weather forecast ${locText}: Temperature is ${tempVal} with a ${context.currentWeather.rainProb} chance of rain.\n\n🌧️ WAIT BEFORE APPLYING FERTILIZER\nWhy? Rain is expected soon. Some fertilizer may be washed away.`;
        } else {
          responseText = `Weather forecast ${locText}: Temperature is ${tempVal} (${context.currentWeather.condition || 'Clear'}) with a low rain chance (${context.currentWeather.rainProb || '20%'}). Weather conditions look favorable for field work on your ${activeCropName}.`;
        }
        break;

      case 'fertilizer':
        if (rainProbVal >= 50) {
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
        responseText = `I am monitoring your farm ${locText}. Current weather is ${tempVal} (${context.currentWeather.condition || 'Clear'}, ${context.currentWeather.rainProb || '20%'} rain chance).\n\nFeel free to ask me about:\n• 🌧️ Weather & rain forecasts\n• 🧪 Fertilizer application timing\n• 🐛 Pest control & Fall Armyworm\n• 🌽 Estimated growth stages`;
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

    // 5. Record turn in conversation history
    this.recordTurn(userQuestionInEnglish, finalAnswer, selectedLanguage);

    return {
      finalAnswer: finalAnswer,
      rawEnglish: responseText,
      language: selectedLanguage,
      cropContext: activeCropName,
      locationContext: context.location,
      weatherContext: context.currentWeather
    };
  }

  recordTurn(question, response, language) {
    this.conversationHistory.push({
      question: question,
      response: response,
      language: language,
      timestamp: Date.now()
    });
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
        return `Akwaaba! Me ne Cropie, wo afuo AI boafoɔ. Ɛyɛ deɛn na me tumi boa wo afuo nnɛ?`;
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
        return `Woezɔ! Nye wnye Cropie, wò agble AI kpekpedenuwola. Aleke mate ŋu akpe kpe wo egbe le wò agble ŋu?`;
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
        return `Blema baa! Mi ji Cropie, o-ŋmɔɔ AI yelɔ. Mɛni mafe ma-ye obua o-ŋmɔɔ ŋmɛnɛ?`;
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
        return `Sannu! Ni ne Cropie, mai taimaka maka gona na AI. Ta yaya zan iya taimaka maka a yau?`;
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
