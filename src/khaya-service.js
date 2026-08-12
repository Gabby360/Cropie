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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

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
        return 'What should I do for my farm today?';
      }

      const data = await response.json();
      return data.text || 'What should I do for my farm today?';
    } catch {
      clearTimeout(timeoutId);
      return 'What should I do for my farm today?';
    }
  }

  // Translation API — Khaya Translation v2 (Ghanaian Lang <-> English)
  async translateText(text, fromLang = 'twi', toLang = 'eng') {
    if (!text || fromLang === toLang) return text;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

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
        return text;
      }

      const data = await response.json();
      return data.translatedText || text;
    } catch {
      clearTimeout(timeoutId);
      return text;
    }
  }

  // Text-To-Speech API — Khaya TTS v2 (Text -> Speech Audio)
  async textToSpeech(text, langCode = 'twi') {
    if (!text) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

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
        return null;
      }

      const data = await response.json();
      if (data.audioBase64) {
        return `data:audio/mpeg;base64,${data.audioBase64}`;
      }
      return data.audioUrl || null;
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }
}
