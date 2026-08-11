// CROPIE — GhanaNLP / Khaya AI Client Integration Service

export class KhayaService {
  constructor() {
    this.API_ENDPOINT = '/api/khaya';
    this.languagesCache = null;
  }

  // Query GET /languages to dynamically build language capability matrix
  async getLanguages() {
    if (this.languagesCache) return this.languagesCache;

    try {
      const response = await fetch(`${this.API_ENDPOINT}?action=languages`);
      if (response.ok) {
        const data = await response.json();
        if (data.languages && Array.isArray(data.languages)) {
          this.languagesCache = data.languages;
          return data.languages;
        }
      }
    } catch (err) {
      console.warn('Khaya API /languages fetch notice:', err.message);
    }

    // Default fallback capability configuration
    this.languagesCache = [
      { code: 'eng', name: 'English', speechRecognition: true, translation: true, textToSpeech: true, isDefault: true },
      { code: 'twi', name: 'Twi', speechRecognition: true, translation: true, textToSpeech: true },
      { code: 'ewe', name: 'Ewe', speechRecognition: true, translation: true, textToSpeech: true },
      { code: 'gaa', name: 'Ga', speechRecognition: false, translation: true, textToSpeech: false, voiceNote: 'Text support active. Voice in development.' },
      { code: 'hau', name: 'Hausa', speechRecognition: true, translation: true, textToSpeech: true }
    ];

    return this.languagesCache;
  }

  // Automatic Speech Recognition — Khaya ASR v3 (Voice Audio -> Text)
  async speechToText(audioBlob, langCode = 'twi') {
    const reader = new FileReader();
    const base64Audio = await new Promise((resolve, reject) => {
      reader.onloadend = () => {
        const result = reader.result;
        const base64Str = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64Str);
      };
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });

    const response = await fetch(`${this.API_ENDPOINT}?action=asr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64: base64Audio,
        language: langCode
      })
    });

    if (!response.ok) {
      throw new Error(`Speech recognition request failed (${response.status})`);
    }

    const data = await response.json();
    return data.text || '';
  }

  // Translation API — Khaya Translation v2 (Ghanaian Lang <-> English)
  async translateText(text, fromLang = 'twi', toLang = 'eng') {
    if (!text || fromLang === toLang) return text;

    const pair = `${fromLang}-${toLang}`;
    const response = await fetch(`${this.API_ENDPOINT}?action=translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        pair: pair,
        in_lang: fromLang,
        out_lang: toLang
      })
    });

    if (!response.ok) {
      throw new Error(`Translation request failed (${response.status})`);
    }

    const data = await response.json();
    return data.translatedText || text;
  }

  // Text-To-Speech API — Khaya TTS v2 (Text -> Speech Audio)
  async textToSpeech(text, langCode = 'twi') {
    if (!text) return null;

    const response = await fetch(`${this.API_ENDPOINT}?action=tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        language: langCode
      })
    });

    if (!response.ok) {
      throw new Error(`Text-to-speech request failed (${response.status})`);
    }

    const data = await response.json();
    if (data.audioBase64) {
      return `data:audio/mpeg;base64,${data.audioBase64}`;
    }
    return data.audioUrl || null;
  }
}
