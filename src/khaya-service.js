// CROPIE — GhanaNLP / Khaya AI Client Integration Service

export const CROPIE_LANGUAGES = {
  eng: { code: 'eng', name: 'English', apiLangCode: 'eng', speechRecognition: true, translation: true, textToSpeech: true, isDefault: true },
  twi: { code: 'twi', name: 'Twi', apiLangCode: 'twi', speechRecognition: true, translation: true, textToSpeech: true },
  ewe: { code: 'ewe', name: 'Ewe', apiLangCode: 'ewe', speechRecognition: true, translation: true, textToSpeech: true },
  gaa: { code: 'gaa', name: 'Ga', apiLangCode: 'gaa', speechRecognition: false, translation: true, textToSpeech: false, voiceNote: 'Text support active. Voice in development.' },
  hau: { code: 'hau', name: 'Hausa', apiLangCode: 'hau', speechRecognition: true, translation: true, textToSpeech: true }
};

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

    // Default fallback capability configuration using centralized matrix
    this.languagesCache = Object.values(CROPIE_LANGUAGES);
    return this.languagesCache;
  }

  // Automatic Speech Recognition — Khaya ASR v3 (Voice Audio -> Text)
  async speechToText(audioBlob, langCode = 'twi') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
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
        signal: controller.signal,
        body: JSON.stringify({
          audioBase64: base64Audio,
          language: langCode
        })
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`Khaya ASR HTTP error status: ${response.status}`);
        return '';
      }

      const data = await response.json();
      return (data.text || '').trim();
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('Khaya ASR processing notice:', err.message);
      return '';
    }
  }

  // Translation API — Khaya Translation v2 (Ghanaian Lang <-> English)
  async translateText(text, fromLang = 'twi', toLang = 'eng') {
    if (!text || fromLang === toLang) return text;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    try {
      const pair = `${fromLang}-${toLang}`;
      const response = await fetch(`${this.API_ENDPOINT}?action=translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          text: text,
          pair: pair,
          in_lang: fromLang,
          out_lang: toLang
        })
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`Khaya Translation HTTP error: ${response.status}`);
        return text;
      }

      const data = await response.json();
      return data.translatedText || text;
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('Khaya Translation notice:', err.message);
      return text;
    }
  }

  // Text-To-Speech API — Khaya TTS v2 (Text -> Speech Audio)
  async textToSpeech(text, langCode = 'twi') {
    if (!text) return null;

    // Verify TTS support according to matrix
    const langInfo = CROPIE_LANGUAGES[langCode];
    if (langInfo && langInfo.textToSpeech === false) {
      console.warn(`TTS not supported for language: ${langCode}`);
      return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(`${this.API_ENDPOINT}?action=tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          text: text,
          language: langCode
        })
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`Khaya TTS HTTP error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      if (data.audioBase64) {
        return `data:audio/mpeg;base64,${data.audioBase64}`;
      }
      return data.audioUrl || null;
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('Khaya TTS notice:', err.message);
      return null;
    }
  }
}

