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
    
    // Sanitize string formatting to avoid 'Day 62 days' or 'Flowering / Tasseling'
    const rawStage = cropStatus.estimatedGrowthStage || "Flowering";
    const cleanStage = rawStage.split('/')[0].trim() || "Flowering";
    const rawDays = (cropStatus.daysAfterPlanting || "62").toString();
    const cleanDays = rawDays.replace(/[^0-9]/g, '') || "62";

    return {
      farmName: farmInfo.farmName || "My Farm",
      location: farmInfo.location || "Laterbiokorshie, Accra, Ghana",
      gps: farmInfo.gps || "5.5492° N, 0.2315° W",
      crops: cropsList,
      primaryCrop: cropsList[0] || 'Maize',
      daysAfterPlanting: cleanDays,
      growthStage: cleanStage,
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
    let qRaw = (userQuestionInEnglish || '').toLowerCase().trim();

    // 0. Auto-correct common typos
    qRaw = qRaw
      .replace(/\brhsi\b|\bthsi\b|\btish\b/gi, 'this')
      .replace(/\bwether\b|\bwather\b|\bweathr\b/gi, 'weather')
      .replace(/\bfertlizer\b|\bfert\b|\bfertilzer\b/gi, 'fertilizer')
      .replace(/\bpeste\b|\bpesticid\b|\bpsts\b/gi, 'pest');

    const qLower = qRaw;

    // 1. Identify crop focus (Farm-level vs Specific Crop)
    let targetedCrop = null;
    context.crops.forEach(c => {
      if (new RegExp(`\\b${c.toLowerCase()}\\b`, 'i').test(qLower)) {
        targetedCrop = c;
      }
    });

    const activeCrop = targetedCrop || context.primaryCrop;
    const isMultiCrop = context.crops.length > 1;

    // 2. Classify intent using strict word boundaries and smart conversational patterns
    let category = 'general';

    if (/^\s*(hi|hello|hey|akwaaba|greetings|good\s*(morning|afternoon|evening))\b/i.test(qLower) && qLower.split(/\s+/).length <= 4) {
      category = 'greeting';
    } else if (/\b(who are you|who r u|what is cropie|who is cropie|what is your name|who created you|who made you|what can you do|about cropie|about yourself|your name|identity|cropie|what is this|what is rhsi)\b/i.test(qLower)) {
      category = 'identity';
    } else if (/\b(help|how to use|commands|features|what to ask|guide|guidance)\b/i.test(qLower)) {
      category = 'help';
    } else if (/\b(pest|pests|pesticide|pesticides|disease|diseases|worm|armyworm|fall armyworm|insect|insects|bug|bugs|weed|weeds|weeding|blight|fungus|rot|caterpillar|yellowing|leaf|leaves|spot|spots|wilt|damage|attack|infestation)\b/i.test(qLower)) {
      category = 'pests';
    } else if (/\b(rain|rainy|precipitation|weather|temperature|temp|storm|cloud|cloudy|sun|sunny|wind|forecast|climate|humidity)\b/i.test(qLower)) {
      category = 'weather';
    } else if (/\b(fertilizer|fertiliser|npk|urea|nitrogen|topdress|topdressing|apply|manure|spray|spraying|chemical|fungicide|nutrient|nutrients|feed|soil)\b/i.test(qLower)) {
      category = 'fertilizer';
    } else if (/\b(stage|stages|growth|days|age|progress|tassel|tasseling|flower|flowering|plant|planted|planting|harvest|harvesting|yield|cob|grain|mature|maturity)\b/i.test(qLower)) {
      category = 'stage';
    } else if (/\b(cassava|rice|yam|plantain|vegetables|crop|crops|farm|overview)\b/i.test(qLower)) {
      category = 'multicrop';
    } else if (qLower.length <= 3 || /^(how|what|why|when|who|where|ok|okay|can|tell|is|are|do)$/i.test(qLower)) {
      category = 'ambiguous';
    }

    let responseText = '';
    const rainProbVal = parseInt(context.currentWeather.rainProb) || 68;

    switch (category) {
      case 'identity':
        responseText = `I'm Cropie, your AI agricultural assistant tailored for farming in Ghana! I combine live satellite weather telemetry with agronomic guidelines to provide real-time recommendations on crop health, fertilizer timing, rain sensitivity, and pest management. How can I assist your farm today?`;
        break;

      case 'help':
        responseText = `I can assist you with your farm in ${context.location}! You can ask questions such as:\n• 🌧️ "Will rain affect my fertilizer today?"\n• 🌽 "How is my ${activeCrop} doing in its growth stage?"\n• 🐛 "How do I protect my crops from Fall Armyworm?"\n• 🌾 "What farming tasks should I prioritize today?"`;
        break;

      case 'ambiguous':
        responseText = `Could you please clarify what you'd like to check? You can ask about weather forecasts, fertilizer application, pest control, or growth stages for your ${activeCrop} in ${context.location}.`;
        break;

      case 'greeting':
        responseText = `Hello! Akwaaba! I'm Cropie, your AI farm assistant for ${context.location}. Your ${activeCrop} is currently at Day ${context.daysAfterPlanting} (${context.growthStage}). How can I help you today?`;
        break;

      case 'weather':
        if (rainProbVal >= 50) {
          responseText = `Live weather for ${context.location}: Temperature is ${context.currentWeather.temp} (${context.currentWeather.condition}) with a high rain probability of ${context.currentWeather.rainProb}. We advise postponing fertilizer top-dressing to prevent nutrient leaching into runoff.`;
        } else {
          responseText = `Live weather for ${context.location}: Temperature is ${context.currentWeather.temp} (${context.currentWeather.condition}) with a low rain chance (${context.currentWeather.rainProb}). Field conditions are clear for farm operations on your ${activeCrop}.`;
        }
        break;

      case 'fertilizer':
        if (rainProbVal >= 50) {
          responseText = `Your ${activeCrop} is at Day ${context.daysAfterPlanting} (${context.growthStage}). Based on live weather telemetry for ${context.location}, rain probability is ${context.currentWeather.rainProb}. Postpone granular nitrogen/NPK top-dressing until heavy rain subsides so nutrients are not washed away.`;
        } else {
          responseText = `Your ${activeCrop} is at Day ${context.daysAfterPlanting} (${context.growthStage}). Weather conditions (${context.currentWeather.temp}, ${context.currentWeather.condition}) are favorable for field fertilizer top-dressing. Ensure soil is moist before application.`;
        }
        break;

      case 'pests':
        responseText = `For ${activeCrop} in the ${context.growthStage} stage (Day ${context.daysAfterPlanting}): Inspect leaf sheaths and cobs for signs of Fall Armyworm or stalk borers. If detected, apply bio-pesticides or Neem seed extract in early morning or late afternoon. Keep field edges clear of weeds.`;
        break;

      case 'stage':
        responseText = `Your ${activeCrop} is estimated to be in the ${context.growthStage} stage (Day ${context.daysAfterPlanting}, planted ${context.plantingDate}) based on farm data for ${context.location}. Cobs are developing and water requirement is critical.`;
        break;

      case 'multicrop':
        if (isMultiCrop) {
          responseText = `Farm Overview for ${context.location}:\n\n` + context.crops.map(c => {
            const cName = c.toLowerCase();
            if (cName === 'maize') return `🌽 Maize (${context.growthStage}): Day ${context.daysAfterPlanting}. Rain probability is ${context.currentWeather.rainProb}.`;
            if (cName === 'cassava') return `🌱 Cassava: Ensure proper field drainage to protect root tubers.`;
            if (cName === 'rice') return `🌾 Rice: Monitor water levels in paddocks.`;
            return `🌳 ${c}: Weather is ${context.currentWeather.temp} (${context.currentWeather.condition}).`;
          }).join('\n\n');
        } else {
          responseText = `For your ${activeCrop} in ${context.location} (${context.growthStage} — Day ${context.daysAfterPlanting}): Weather is ${context.currentWeather.temp} and ${context.currentWeather.condition}. Agricultural guidance recommends regular field monitoring.`;
        }
        break;

      default:
        responseText = `I am monitoring your ${activeCrop} in ${context.location} (${context.growthStage} stage, Day ${context.daysAfterPlanting}). Current weather is ${context.currentWeather.temp} (${context.currentWeather.condition}, ${context.currentWeather.rainProb} rain chance).\n\nFeel free to ask me about:\n• 🌧️ Weather & rain forecasts\n• 🧪 Fertilizer & NPK application\n• 🐛 Pest control & Fall Armyworm\n• 🌽 Growth stages & harvest timing`;
        break;
    }

    // 3. Native Ghanaian Language Translation Engine (if selected)
    let finalAnswer = responseText;
    if (selectedLanguage && selectedLanguage !== 'eng') {
      try {
        const translatedFromKhaya = await this.khayaService.translateText(responseText, 'eng', selectedLanguage);
        if (translatedFromKhaya && translatedFromKhaya !== responseText) {
          finalAnswer = translatedFromKhaya;
        } else {
          finalAnswer = this.translateResponseToLanguage(responseText, selectedLanguage, context, activeCrop, category);
        }
      } catch {
        finalAnswer = this.translateResponseToLanguage(responseText, selectedLanguage, context, activeCrop, category);
      }
    }

    // 4. Record turn in conversation history
    this.conversationHistory.push({
      question: userQuestionInEnglish,
      response: finalAnswer,
      language: selectedLanguage,
      timestamp: Date.now()
    });

    return {
      finalAnswer: finalAnswer,
      rawEnglish: responseText,
      language: selectedLanguage,
      cropContext: activeCrop,
      locationContext: context.location,
      weatherContext: context.currentWeather
    };
  }

  // Localized Ghanaian Language Translation Engine
  translateResponseToLanguage(responseText, selectedLanguage, context, activeCrop, category = 'general') {
    if (selectedLanguage === 'eng' || !selectedLanguage) return responseText;

    const lang = selectedLanguage.toLowerCase();
    const rainProb = context.currentWeather.rainProb || "68%";
    const location = context.location || "Laterbiokorshie, Accra";
    const temp = context.currentWeather.temp || "28°C";
    const days = context.daysAfterPlanting || "62 days";
    const stage = context.growthStage || "Flowering";

    if (lang === 'twi') {
      if (category === 'greeting') {
        return `Akwaaba! Me ne Cropie, wo afuo AI boafoɔ wɔ ${location}. Wo ${activeCrop} wɔ Da ${days} (${stage}). Ɛyɛ deɛn na me tumi boa wo nnɛ?`;
      }
      if (category === 'weather' || category === 'fertilizer') {
        return `Nsuo tɔ nteteeɔ wɔ ${location} mu yɛ ${rainProb} nnɛ (Ewiemu tebea yɛ ${temp}). Wo ${activeCrop} (Da ${days}, ${stage}) hia nsuo hwɛsoɔ. Twɛn fertilizer guo kosi sɛ nsuo no bɛtwa.`;
      }
      if (category === 'pests') {
        return `Hwɛ Fall Armyworm ne aboa fi afuo no so wɔ ${activeCrop} (${stage}) bere mu. Sɛ wohunu aboa bi a, sɔ bio-pesticides anaa Neem nsuo gu so anopa anaa anwummere.`;
      }
      if (category === 'stage') {
        return `Wo ${activeCrop} wɔ ${stage} mpuntuo mu (Da ${days}) wɔ ${location} afuo so.`;
      }
      return `Wɔ wo afuo so wɔ ${location} (${activeCrop}): Ewiemu yɛ ${temp}, nsuo tɔ nteteeɔ yɛ ${rainProb}. Wo ${activeCrop} wɔ ${stage} mpuntuo mu.`;
    }

    if (lang === 'ewe') {
      if (category === 'greeting') {
        return `Woezɔ! Nye wnye Cropie, wò agble AI kpekpedenuwola le ${location}. Wò ${activeCrop} le ŋkeke ${days} dzi (${stage}). Aleke mate ŋu akpe kpe wo egbe?`;
      }
      if (category === 'weather' || category === 'fertilizer') {
        return `Tsidza le ${location} kɔ dzi (${rainProb}, Xexeme le ${temp}). Wò ${activeCrop} (Ŋkeke ${days}, ${stage}) hiã tsidza ŋu dɔwɔwɔ. Megada duu egbe o.`;
      }
      if (category === 'pests') {
        return `Lé ŋku ɖe agbledɔlele kple vɔ̃wo ŋu le wò ${activeCrop} dzi. Zã Neem amine ne èkpɔ nuxatɔwo.`;
      }
      return `Le wò agble dzi le ${location} (${activeCrop}): Xexeme le ${temp}, tsidza le ${rainProb}. Wò ${activeCrop} le ${stage} dzi.`;
    }

    if (lang === 'gaa' || lang === 'ga') {
      if (category === 'greeting') {
        return `Blema baa! Mi ji Cropie, o-ŋmɔɔ AI yelɔ le ${location}. O-ŋmɔɔ ${activeCrop} yɛ gbi ${days} nɔ (${stage}). Mɛni mafe ma-ye obua o ŋmɛnɛ?`;
      }
      if (category === 'weather' || category === 'fertilizer') {
        return `Nshɔ nu tɔɔ le ${location} nɔ yɛ ${rainProb} (Je ŋmɛnɛ yɛ ${temp}). O-ŋmɔɔ ${activeCrop} yɛ ${stage} he miihia nu kwɛmɔ. Kaafã nsoo amrɔ nɛɛ.`;
      }
      return `Yɛ o-ŋmɔɔ nɔ le ${location} (${activeCrop}): Je ŋmɛnɛ yɛ ${temp}, nu tɔɔ yɛ ${rainProb}. O-ŋmɔɔ ${activeCrop} yɛ ${stage} nɔ.`;
    }

    if (lang === 'hau' || lang === 'hausa') {
      if (category === 'greeting') {
        return `Sannu! Ni ne Cropie, mai taimaka maka gona na AI a ${location}. Shuka ${activeCrop} tana Ranar ${days} (${stage}). Ta yaya zan iya taimaka maka a yau?`;
      }
      if (category === 'weather' || category === 'fertilizer') {
        return `Yiwuwar ruwa a ${location} tana da yawa (${rainProb}, yanayi ${temp}). Shuka ${activeCrop} a matakin ${stage} tana buƙatar kula da ruwa. A dakata da saka taki a yau.`;
      }
      return `A gonar ku a ${location} (${activeCrop}): Yanayin ${temp}, yiwuwar ruwa ${rainProb}. Shuka ${activeCrop} tana a matakin ${stage}.`;
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
      `🌾 What should I do for my crops today?`,
      `☔ Should I apply fertilizer to my farm today?`
    ];
  }
}
