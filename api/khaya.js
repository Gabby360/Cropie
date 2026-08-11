// CROPIE — GhanaNLP / Khaya AI Serverless API Proxy
// Ensures GHANANLP_API_KEY is handled strictly server-side

export default async function handler(req, res) {
  // Enable CORS headers for internal app routes
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiKey = process.env.GHANANLP_API_KEY || process.env.OCP_APIM_SUBSCRIPTION_KEY || '';
  const action = req.query?.action || req.body?.action || 'languages';
  const BASE_URL = 'https://translation.ghananlp.org';

  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'Ocp-Apim-Subscription-Key': apiKey } : {})
  };

  try {
    // 1. GET /languages (Language Capability Matrix)
    if (action === 'languages' || req.method === 'GET') {
      let remoteLanguages = null;
      if (apiKey) {
        try {
          const resp = await fetch(`${BASE_URL}/languages`, {
            method: 'GET',
            headers: defaultHeaders
          });
          if (resp.ok) {
            remoteLanguages = await resp.json();
          }
        } catch (err) {
          console.warn('GhanaNLP remote /languages fetch notice:', err.message);
        }
      }

      // Default verified matrix based on GhanaNLP v2/v3 capability specifications
      const fallbackCapabilities = [
        { code: 'eng', name: 'English', speechRecognition: true, translation: true, textToSpeech: true, isDefault: true },
        { code: 'twi', name: 'Twi', speechRecognition: true, translation: true, textToSpeech: true },
        { code: 'ewe', name: 'Ewe', speechRecognition: true, translation: true, textToSpeech: true },
        { code: 'gaa', name: 'Ga', speechRecognition: false, translation: true, textToSpeech: false, voiceNote: 'Text support active. Voice in development.' },
        { code: 'hau', name: 'Hausa', speechRecognition: true, translation: true, textToSpeech: true }
      ];

      return res.status(200).json({
        success: true,
        source: remoteLanguages ? 'GhanaNLP Live API' : 'Verified Khaya Matrix',
        languages: fallbackCapabilities,
        rawRemote: remoteLanguages
      });
    }

    // 2. POST /translate (Translation API v2)
    if (action === 'translate') {
      const { text, in_lang, out_lang, pair } = req.body || {};
      if (!text) {
        return res.status(400).json({ error: 'Text parameter is required.' });
      }

      const langPair = pair || `${in_lang || 'twi'}-${out_lang || 'eng'}`;

      if (!apiKey) {
        // Safe development echo if API key is pending
        return res.status(200).json({
          translatedText: text,
          note: 'Development mode fallback. Add GHANANLP_API_KEY to .env for live API translation.'
        });
      }

      const resp = await fetch(`${BASE_URL}/v2/translate`, {
        method: 'POST',
        headers: defaultHeaders,
        body: JSON.stringify({
          in_text: text,
          lang_pair: langPair
        })
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return res.status(resp.status).json({ error: `GhanaNLP Translation error: ${errText}` });
      }

      const data = await resp.json();
      return res.status(200).json({
        translatedText: data.translated_text || data.text || data,
        pair: langPair
      });
    }

    // 3. POST /asr (Automatic Speech Recognition v3)
    if (action === 'asr') {
      const { audioBase64, language } = req.body || {};
      if (!audioBase64) {
        return res.status(400).json({ error: 'audioBase64 payload is required.' });
      }

      if (!apiKey) {
        return res.status(200).json({
          text: 'Mewɔ semina ne afuo ho nsɛmmisa bi fa mfuturo biara ho.',
          note: 'Development mode ASR simulation. Add GHANANLP_API_KEY to .env for live audio transcription.'
        });
      }

      const resp = await fetch(`${BASE_URL}/v3/asr`, {
        method: 'POST',
        headers: defaultHeaders,
        body: JSON.stringify({
          audio: audioBase64,
          language: language || 'twi'
        })
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return res.status(resp.status).json({ error: `GhanaNLP ASR error: ${errText}` });
      }

      const data = await resp.json();
      return res.status(200).json({
        text: data.text || data.transcription || '',
        language: language || 'twi'
      });
    }

    // 4. POST /tts (Text-to-Speech v2)
    if (action === 'tts') {
      const { text, language } = req.body || {};
      if (!text) {
        return res.status(400).json({ error: 'Text parameter is required for TTS.' });
      }

      if (!apiKey) {
        return res.status(200).json({
          audioUrl: null,
          note: 'Development mode TTS simulation. Add GHANANLP_API_KEY for audio synthesis.'
        });
      }

      const resp = await fetch(`${BASE_URL}/v2/tts`, {
        method: 'POST',
        headers: defaultHeaders,
        body: JSON.stringify({
          text: text,
          language: language || 'twi'
        })
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return res.status(resp.status).json({ error: `GhanaNLP TTS error: ${errText}` });
      }

      const arrayBuf = await resp.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuf).toString('base64');
      return res.status(200).json({
        audioBase64: base64Audio,
        contentType: 'audio/mpeg'
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (err) {
    console.error('GhanaNLP Serverless Proxy Error:', err);
    return res.status(500).json({ error: err.message || 'Internal proxy error.' });
  }
}
