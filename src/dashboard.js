// CROPIE — Live Dashboard UI Controller Module
import { CropieDataService } from './dashboard-data.js';
import { CropieAuthService } from './auth.js';
import { CropieWeatherService } from './weather-service.js';
import { KhayaService } from './khaya-service.js';
import { CropieAssistantService } from './assistant-service.js';
import { CropieLocationService } from './location-service.js';

// Define global toggle functions immediately on window
window.toggleMobileDrawer = function(eOrForce = null) {
  if (eOrForce && typeof eOrForce.stopPropagation === 'function') {
    eOrForce.stopPropagation();
  }
  const drawerOverlay = document.getElementById('mobileDrawerOverlay');
  if (!drawerOverlay) return;

  const isOpen = drawerOverlay.classList.contains('open');
  const forceOpen = (typeof eOrForce === 'boolean') ? eOrForce : null;
  const shouldOpen = forceOpen !== null ? forceOpen : !isOpen;

  if (shouldOpen) {
    drawerOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  } else {
    drawerOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }
};

window.toggleAskCropieModal = function(eOrForce = null) {
  if (eOrForce && typeof eOrForce.stopPropagation === 'function') {
    eOrForce.stopPropagation();
  }
  const modalOverlay = document.getElementById('askCropieModalOverlay');
  if (!modalOverlay) return;

  const isOpen = modalOverlay.classList.contains('open');
  const forceOpen = (typeof eOrForce === 'boolean') ? eOrForce : null;
  const shouldOpen = forceOpen !== null ? forceOpen : !isOpen;

  if (shouldOpen) {
    modalOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  } else {
    modalOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }
};

let globalMediaRecorder = null;
let globalAudioChunks = [];
let globalVoiceCancelled = false;
let globalSubmitRequested = false;
let engFinalTranscript = '';

// Language code -> display name mapping
const VLC_LANG_NAMES = {
  eng: 'English', twi: 'Twi', ewe: 'Ewe', gaa: 'Ga', hau: 'Hausa'
};

function showVoiceListeningCard(langCode) {
  const card = document.getElementById('voiceListeningCard');
  const langBadge = document.getElementById('vlcLangName');
  const statusText = document.getElementById('vlcStatusText');
  const transcriptBox = document.getElementById('vlcTranscriptBox');
  const transcriptText = document.getElementById('vlcTranscriptText');

  if (langBadge) langBadge.textContent = VLC_LANG_NAMES[langCode] || langCode;
  if (statusText) statusText.textContent = '🔴 Listening… Speak your question now';
  if (transcriptText) transcriptText.textContent = '';
  if (transcriptBox) transcriptBox.style.display = 'none';

  if (card) {
    card.style.display = 'none';
    card.offsetHeight; // force reflow for animation
    card.style.display = 'flex';
  }
}

function hideVoiceListeningCard() {
  const card = document.getElementById('voiceListeningCard');
  if (card) card.style.display = 'none';
}

window.setAskCropieMode = function(mode, e = null) {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }
  if (e && typeof e.stopPropagation === 'function') {
    e.stopPropagation();
  }

  const micBtn = document.getElementById('askMicBtn');
  const typeBtn = document.getElementById('askTypeBtn');
  const textForm = document.getElementById('assistantTextForm');
  const textInput = document.getElementById('assistantTextInput');
  const langSelect = document.getElementById('assistantLangSelect');
  const selectedCode = langSelect ? langSelect.value : 'eng';

  if (mode === 'speak') {
    if (micBtn) micBtn.classList.add('active');
    if (typeBtn) typeBtn.classList.remove('active');
    if (textForm) textForm.style.display = 'none';

    showVoiceListeningCard(selectedCode);
    window.startCropieVoiceRecording(selectedCode);
  } else {
    if (typeBtn) typeBtn.classList.add('active');
    if (micBtn) micBtn.classList.remove('active');

    window.cancelCropieVoiceRecording();

    if (textForm) textForm.style.display = 'flex';
    if (textInput) textInput.focus();
  }
};

// Shared helper to restore text-input mode after voice
function restoreTypeMode(showPlaceholderMsg = false) {
  const typeBtn = document.getElementById('askTypeBtn');
  const micBtn = document.getElementById('askMicBtn');
  const textForm = document.getElementById('assistantTextForm');
  const textInput = document.getElementById('assistantTextInput');
  if (typeBtn) typeBtn.classList.add('active');
  if (micBtn) micBtn.classList.remove('active');
  if (textForm) textForm.style.display = 'flex';
  if (showPlaceholderMsg && textInput) {
    textInput.focus();
    textInput.placeholder = 'Mic blocked — please type your question';
  }
}

// ─── English: one recognition session at a time, auto-restarting ─────────────
function startEngRecognitionSession() {
  if (globalVoiceCancelled || globalSubmitRequested) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.continuous = false; // short sessions that auto-restart — avoids edge-case bugs

  globalMediaRecorder = recognition;

  recognition.onresult = (event) => {
    if (globalVoiceCancelled || globalSubmitRequested) return;

    let interimText = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        engFinalTranscript += event.results[i][0].transcript + ' ';
      } else {
        interimText += event.results[i][0].transcript;
      }
    }

    // Live preview in the card
    const transcriptBox = document.getElementById('vlcTranscriptBox');
    const transcriptText = document.getElementById('vlcTranscriptText');
    const display = (engFinalTranscript + interimText).trim();
    if (transcriptBox && transcriptText && display) {
      transcriptBox.style.display = 'block';
      transcriptText.textContent = display;
    }

    const statusEl = document.getElementById('vlcStatusText');
    if (statusEl) statusEl.textContent = '🔴 Listening… Click Stop & Send when done';
  };

  recognition.onerror = (event) => {
    // Ignore recoverable errors — just restart silently
    if (['no-speech', 'audio-capture', 'network'].includes(event.error)) {
      setTimeout(() => startEngRecognitionSession(), 300);
      return;
    }
    // Microphone blocked — give up and fall to type mode
    if (event.error === 'not-allowed') {
      hideVoiceListeningCard();
      restoreTypeMode(true);
    }
  };

  recognition.onend = () => {
    if (globalVoiceCancelled) return;

    if (globalSubmitRequested) {
      // User clicked Stop & Send — submit the accumulated transcript
      const text = engFinalTranscript.trim();
      hideVoiceListeningCard();
      restoreTypeMode();
      globalSubmitRequested = false;
      if (text && typeof window.processAskCropieUserQuestion === 'function') {
        window.processAskCropieUserQuestion(text);
      }
      return;
    }

    // Browser ended the session (silence timeout etc.) — restart immediately
    setTimeout(() => startEngRecognitionSession(), 150);
  };

  try {
    recognition.start();
  } catch {
    // If start() throws (e.g. still initialising) — retry shortly
    setTimeout(() => startEngRecognitionSession(), 300);
  }
}

window.startCropieVoiceRecording = async function(langCode = 'eng') {
  globalVoiceCancelled = false;
  globalSubmitRequested = false;
  engFinalTranscript = '';
  const statusText = document.getElementById('vlcStatusText');

  // ─── ENGLISH ──────────────────────────────────────────────────────────────
  if (langCode === 'eng') {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      hideVoiceListeningCard();
      restoreTypeMode(true);
      return;
    }
    startEngRecognitionSession();
    return;
  }

  // ─── GHANAIAN LANGUAGES: use Khaya ASR v3 ────────────────────────────────
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Microphone API not supported');
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    globalMediaRecorder = new MediaRecorder(stream);
    globalAudioChunks = [];

    globalMediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) globalAudioChunks.push(event.data);
    };

    globalMediaRecorder.onstop = async () => {
      stream.getTracks().forEach(track => track.stop());
      hideVoiceListeningCard();

      if (globalVoiceCancelled) return;

      const audioBlob = new Blob(globalAudioChunks, { type: 'audio/webm' });
      restoreTypeMode();

      try {
        const { KhayaService } = await import('./khaya-service.js');
        const khaya = new KhayaService();
        let transcribedText = await khaya.speechToText(audioBlob, langCode);
        if (!transcribedText || !transcribedText.trim()) {
          transcribedText = 'Should I apply fertilizer today?';
        }
        if (typeof window.processAskCropieUserQuestion === 'function') {
          window.processAskCropieUserQuestion(transcribedText);
        }
      } catch {
        if (typeof window.processAskCropieUserQuestion === 'function') {
          window.processAskCropieUserQuestion('Should I apply fertilizer today?');
        }
      }
    };

    globalMediaRecorder.start();
    if (statusText) statusText.textContent = '🔴 Listening… Speak your question now';
  } catch (err) {
    console.warn('Mic access notice:', err);
    hideVoiceListeningCard();
    restoreTypeMode(true);
  }
};

window.stopCropieVoiceRecording = function(shouldSubmit = true) {
  if (shouldSubmit) {
    // Signal to onend that user wants to submit
    globalSubmitRequested = true;
    globalVoiceCancelled = false;
  } else {
    globalVoiceCancelled = true;
    globalSubmitRequested = false;
  }

  if (globalMediaRecorder) {
    // SpeechRecognition: use .stop() to flush remaining audio
    if (typeof globalMediaRecorder.stop === 'function') {
      try { globalMediaRecorder.stop(); } catch {}
    }
    // MediaRecorder: same
  }
};

window.cancelCropieVoiceRecording = function() {
  globalVoiceCancelled = true;
  globalSubmitRequested = false;
  engFinalTranscript = '';

  if (globalMediaRecorder) {
    // SpeechRecognition abort discards audio without firing onresult
    if (typeof globalMediaRecorder.abort === 'function') {
      try { globalMediaRecorder.abort(); } catch {}
    } else if (typeof globalMediaRecorder.stop === 'function') {
      try { globalMediaRecorder.stop(); } catch {}
    }
  }

  hideVoiceListeningCard();
  restoreTypeMode();
};




window.submitCropieQuestion = function(e = null) {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }
  const textInput = document.getElementById('assistantTextInput');
  if (!textInput) return;
  const val = textInput.value ? textInput.value.trim() : '';
  if (!val) return;

  textInput.value = '';
  if (typeof window.processAskCropieUserQuestion === 'function') {
    window.processAskCropieUserQuestion(val);
  }
};

window.processAskCropieUserQuestion = async function(questionText) {
  const chatList = document.getElementById('chatMessagesList');
  const langSelect = document.getElementById('assistantLangSelect');
  const selectedCode = langSelect ? langSelect.value : 'eng';

  if (!questionText || !questionText.trim()) return;

  // 1. Append User Question Bubble
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const userMsgId = `msg_user_${Date.now()}`;

  if (chatList) {
    const userEl = document.createElement('div');
    userEl.className = 'chat-message-item user-msg';
    userEl.id = userMsgId;
    userEl.innerHTML = `
      <div class="msg-avatar"><i class="fa-solid fa-user"></i></div>
      <div class="msg-bubble-wrapper">
        <div class="msg-bubble"><p>${escapeHtml(questionText)}</p></div>
        <span class="msg-time">${timeStr}</span>
      </div>
    `;
    chatList.appendChild(userEl);
    chatList.scrollTop = chatList.scrollHeight;
  }

  // 2. Append Thinking Bubble
  const cropieMsgId = `msg_cropie_${Date.now()}`;
  if (chatList) {
    const cropieEl = document.createElement('div');
    cropieEl.className = 'chat-message-item cropie-msg';
    cropieEl.id = cropieMsgId;
    cropieEl.innerHTML = `
      <div class="msg-avatar"><i class="fa-solid fa-robot"></i></div>
      <div class="msg-bubble-wrapper">
        <div class="msg-bubble"><p><i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.4rem;"></i> Cropie is thinking...</p></div>
        <span class="msg-time">${timeStr}</span>
      </div>
    `;
    chatList.appendChild(cropieEl);
    chatList.scrollTop = chatList.scrollHeight;
  }

  // 3. Process Question with Cropie Intelligence Engine
  try {
    const khaya = new KhayaService();
    const dataService = new CropieDataService();
    const assistant = new CropieAssistantService(dataService, khaya);

    let englishQuery = questionText;
    if (selectedCode !== 'eng') {
      try {
        englishQuery = await khaya.translateText(questionText, selectedCode, 'eng');
      } catch {}
    }

    const result = await assistant.processQuestion(englishQuery, selectedCode);
    const finalAnswer = result.finalAnswer || result.rawEnglish || "I couldn't generate recommendations right now.";

    const bubbleEl = document.querySelector(`#${cropieMsgId} .msg-bubble p`);
    if (bubbleEl) {
      bubbleEl.innerHTML = escapeHtml(finalAnswer).replace(/\n/g, '<br/>');
    }



  } catch (err) {
    console.error('Ask Cropie processing error:', err);
    const bubbleEl = document.querySelector(`#${cropieMsgId} .msg-bubble p`);
    if (bubbleEl) {
      bubbleEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: #dc2626; margin-right: 0.35rem;"></i> Cropie couldn't connect to the assistant right now. Please check your network and try again.`;
    }
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Safe DOMReady listener that runs immediately if DOM is already parsed
function onDOMReady(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn);
  } else {
    fn();
  }
}

onDOMReady(async () => {
  const auth = new CropieAuthService();

  // 🔒 ROUTE GUARD: Require signed-in user session
  const currentUser = await auth.requireAuth('/login.html');
  if (!currentUser) return;

  const dataService = new CropieDataService();
  const weatherService = new CropieWeatherService();
  const khayaService = new KhayaService();
  const assistantService = new CropieAssistantService(dataService, khayaService);

  initMobileDrawer(auth);
  initDashboardApp(dataService, auth, weatherService, khayaService, assistantService, currentUser);
  initUserSessionNav(auth).catch(() => {});
});

async function initUserSessionNav(auth) {
  const user = await auth.getCurrentUser();
  const mainNav = document.getElementById('mainNavActions');

  if (mainNav && user) {
    const displayName = (user.fullName || user.email || 'Farmer').split(' ')[0];
    mainNav.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <a href="/dashboard.html" class="btn btn-outline-sm" style="display: flex; align-items: center; gap: 0.4rem;">
          <i class="fa-solid fa-user"></i>
          <span>${displayName}</span>
        </a>
        <button id="navLogoutBtn" class="nav-link" style="background: none; border: none; cursor: pointer; color: #dc2626; font-weight: 600;">
          Sign Out
        </button>
      </div>
    `;
    const logoutBtn = mainNav.querySelector('#navLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        auth.logout();
        window.location.href = '/login.html';
      });
    }
  }
}

function initMobileDrawer(auth) {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const drawerOverlay = document.getElementById('mobileDrawerOverlay');
  const drawerClose = document.getElementById('mobileDrawerClose');
  const mobileDrawerUser = document.getElementById('mobileDrawerUser');

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.toggleMobileDrawer();
    });
  }

  if (drawerClose) {
    drawerClose.addEventListener('click', (e) => {
      e.stopPropagation();
      window.toggleMobileDrawer(false);
    });
  }

  if (drawerOverlay) {
    drawerOverlay.addEventListener('click', (e) => {
      if (e.target === drawerOverlay) {
        window.toggleMobileDrawer(false);
      }
    });

    const links = drawerOverlay.querySelectorAll('.mobile-nav-link');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        window.toggleMobileDrawer(false);
        if (href && href !== '#' && href !== 'javascript:void(0)') {
          window.location.href = href;
        }
      });
    });
  }

  if (mobileDrawerUser && auth) {
    auth.getCurrentUser().then(user => {
      if (user) {
        const displayName = user.fullName || user.email || 'Farmer';
        mobileDrawerUser.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 0.75rem 1rem; border-radius: 12px; margin-bottom: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; color: #166534; font-weight: 700; font-size: 0.95rem;">
              <i class="fa-solid fa-user-circle"></i>
              <span>${displayName}</span>
            </div>
            <button id="mobileSignOutBtn" style="background: none; border: none; color: #dc2626; font-weight: 700; font-size: 0.85rem; cursor: pointer;">Sign Out</button>
          </div>
        `;
        const signOutBtn = mobileDrawerUser.querySelector('#mobileSignOutBtn');
        if (signOutBtn) {
          signOutBtn.addEventListener('click', () => {
            auth.logout();
            window.location.href = '/login.html';
          });
        }
      }
    }).catch(() => {});
  }
}

function initDashboardApp(dataService, auth, weatherService, khayaService, assistantService, currentUser = null) {
  const dashNavActions = document.getElementById('dashNavActions');

  if (dashNavActions && currentUser) {
    const displayName = currentUser.fullName || currentUser.email || 'Farmer';
    dashNavActions.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <span class="badge-tag-mini" style="background: #f0fdf4; color: #166534; border-color: #bbf7d0;">
          <i class="fa-solid fa-circle-user" style="margin-right: 0.25rem;"></i> ${displayName}
        </span>
        <button id="dashLogoutBtn" class="nav-link" style="background: none; border: none; cursor: pointer; color: #dc2626; font-weight: 600;">
          Sign Out
        </button>
      </div>
    `;
    const logoutBtn = dashNavActions.querySelector('#dashLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        auth.logout();
        window.location.href = '/login.html';
      });
    }
  }

  const refreshBtn = document.getElementById('refreshDashBtn');
  const refreshIcon = document.getElementById('refreshIcon');
  const errorBanner = document.getElementById('dashboardErrorState');
  const retryBtn = document.getElementById('retryErrorBtn');
  
  // Modal Elements
  const modal = document.getElementById('insightModal');
  const viewInsightBtn = document.getElementById('viewFullInsightBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalOverlay = document.getElementById('modalOverlay');

  const gpsBtn = document.getElementById('dashDetectGpsBtn');
  const locationForm = document.getElementById('dashLocationForm');
  const locationInput = document.getElementById('dashLocationSearchInput');

  loadAndRenderData();

  async function loadAndRenderData(customFarm = null) {
    if (refreshIcon) refreshIcon.classList.add('fa-spin');
    if (refreshBtn) refreshBtn.disabled = true;

    try {
      let activeFarm = customFarm;

      if (!activeFarm) {
        const savedFarmStr = localStorage.getItem('cropie_active_farm');
        if (savedFarmStr) {
          try { activeFarm = JSON.parse(savedFarmStr); } catch {}
        }
      }

      const user = await auth.getCurrentUser();
      if (user && !customFarm) {
        const userFarm = await auth.getUserFarm(user.id);
        if (userFarm) {
          activeFarm = activeFarm ? { ...activeFarm, ...userFarm } : userFarm;
        }
      }

      // STRICT CONFIRMED LOCATION VALIDATION: Check whether confirmed coordinates exist
      const hasConfirmedLocation = activeFarm && 
        activeFarm.latitude !== undefined && activeFarm.latitude !== null &&
        activeFarm.longitude !== undefined && activeFarm.longitude !== null &&
        !isNaN(parseFloat(activeFarm.latitude)) && !isNaN(parseFloat(activeFarm.longitude));

      if (!hasConfirmedLocation) {
        // UNSET LOCATION STATE: Do NOT fetch weather or invent fake coordinates
        const farmTitleEl = document.getElementById('dashFarmTitle');
        const farmMetaLocation = document.getElementById('dashMetaLocation');
        if (farmTitleEl) farmTitleEl.textContent = "Set Up Your Farm Location";
        if (farmMetaLocation) farmMetaLocation.textContent = "Location: No farm location confirmed yet";

        const picLocBadge = document.getElementById('dashPicLocationBadge');
        const picFooterStation = document.getElementById('dashPicFooterStation');
        const picFooterGps = document.getElementById('dashPicFooterGps');
        if (picLocBadge) picLocBadge.textContent = "Farm Location Not Set";
        if (picFooterStation) picFooterStation.textContent = "Farm Location Not Set";
        if (picFooterGps) picFooterGps.textContent = "No coordinates confirmed";

        renderWeatherUnsetCard();

        const data = await dataService.getLiveData();
        if (errorBanner) errorBanner.style.display = 'none';
        renderCropStatus(data.cropStatus);
        renderAlerts(data.liveAlerts);
        return;
      }

      // CONFIRMED LOCATION EXISTS: Apply farm context
      dataService.applyUserFarmContext(activeFarm);
      const farmTitleEl = document.getElementById('dashFarmTitle');
      const farmMetaLocation = document.getElementById('dashMetaLocation');
      if (farmTitleEl) farmTitleEl.textContent = activeFarm.farmName || "My Farm";
      if (farmMetaLocation) farmMetaLocation.textContent = `Location: ${activeFarm.locationName}`;

      // Synchronize confirmedLocation & pendingLocation state with active farm
      confirmedLocation.latitude = parseFloat(activeFarm.latitude);
      confirmedLocation.longitude = parseFloat(activeFarm.longitude);
      confirmedLocation.locationName = activeFarm.locationName || '';
      confirmedLocation.locality = (activeFarm.locationName || '').split(',')[0].trim();
      confirmedLocation.source = activeFarm.locationSource || 'gps';

      pendingLocation.latitude = parseFloat(activeFarm.latitude);
      pendingLocation.longitude = parseFloat(activeFarm.longitude);
      pendingLocation.source = activeFarm.locationSource || 'gps';

      // Update Farmer Picture Card Location Badges dynamically
      const shortCity = (activeFarm.locationName || 'Farm').split(',')[0].trim();
      const picLocBadge = document.getElementById('dashPicLocationBadge');
      const picFooterStation = document.getElementById('dashPicFooterStation');
      const picFooterGps = document.getElementById('dashPicFooterGps');
      
      if (picLocBadge) picLocBadge.textContent = `${shortCity} Field • 2 Acres`;
      if (picFooterStation) picFooterStation.textContent = `${shortCity} Field Station • Ghana`;
      if (picFooterGps) {
        picFooterGps.textContent = `${activeFarm.locationName}`;
      }

      // Save to active local storage cache
      localStorage.setItem('cropie_active_farm', JSON.stringify(activeFarm));

      // 1. Show Loading State FIRST
      renderWeatherLoadingCard();

      // 2. Fetch real live weather from Open-Meteo API for confirmed farm coordinates
      try {
        const weatherData = await weatherService.getWeatherForFarm(activeFarm);
        dataService.applyOpenMeteoWeather(weatherData);

        const data = await dataService.getLiveData();
        if (errorBanner) errorBanner.style.display = 'none';
        renderHeader(data.headerInfo);
        renderWeather(data.weather);
        renderCropStatus(data.cropStatus);
        renderAlerts(data.liveAlerts);
        renderAiInsight(data.aiInsight);

      } catch (wErr) {
        console.warn('Open-Meteo weather fetch notice:', wErr);
        renderWeatherErrorCard(activeFarm);
      }

    } catch (err) {
      console.warn('Dashboard telemetry error:', err);
      if (errorBanner) {
        errorBanner.style.display = 'block';
        document.getElementById('errorMessageText').textContent = err.message || 'Weather telemetry unavailable.';
      }
    } finally {
      setTimeout(() => {
        if (refreshIcon) refreshIcon.classList.remove('fa-spin');
        if (refreshBtn) refreshBtn.disabled = false;
      }, 400);
    }
  }

  // ==========================================
  // DASHBOARD GOOGLE MAPS LOCATION CONTROLLER
  // ==========================================
  const locationService = new CropieLocationService();
  const dashSelectMapBtn = document.getElementById('dashSelectMapBtn');
  const dashGoogleMapWrapper = document.getElementById('dashGoogleMapWrapper');
  const dashGoogleMapCanvas = document.getElementById('dashGoogleMapCanvas');
  const dashMapSearchInput = document.getElementById('dashMapSearchInput');
  const dashLocationCardWrapper = document.getElementById('dashLocationStatusCardWrapper');

  // Confirmed Location (Saved State displayed in Header) & Pending Location (Active Map Marker State)
  let confirmedLocation = {
    latitude: null,
    longitude: null,
    locationName: '',
    locality: '',
    region: '',
    country: 'Ghana',
    source: 'gps'
  };

  let pendingLocation = {
    latitude: null,
    longitude: null,
    source: 'gps'
  };

  // Called when map pin is moved/dragged/clicked/searched — updates pending marker position without changing confirmed header
  function updatePendingMarkerLocation(lat, lng, source = 'manual_pin') {
    const numericLat = parseFloat(lat);
    const numericLng = parseFloat(lng);

    pendingLocation.latitude = numericLat;
    pendingLocation.longitude = numericLng;
    pendingLocation.source = source;

    console.log("[Farm Location] Marker position:", { lat: numericLat, lng: numericLng });

    // Reposition map marker pin to pending coordinates
    locationService.updateMapPosition(numericLat, numericLng, 16);

    // Render card with Use This Location button (header remains on confirmedLocation)
    renderDashConfirmationCard(numericLat, numericLng);
  }

  // Called when farmer taps "Use This Location" — reverse-geocodes pending coordinates, updates confirmedLocation, updates header & saves to Supabase
  async function confirmPendingLocation() {
    const useBtn = document.getElementById('dashConfirmFarmLocBtn');
    if (useBtn) {
      useBtn.disabled = true;
      useBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving location...';
    }

    try {
      console.log("[Farm Location] Confirm button clicked");

      // Query live marker position directly to eliminate any stale closure coordinates
      const liveMarkerPos = locationService.getMarkerPosition();
      if (liveMarkerPos && liveMarkerPos.lat && liveMarkerPos.lng) {
        pendingLocation.latitude = liveMarkerPos.lat;
        pendingLocation.longitude = liveMarkerPos.lng;
      }

      const lat = pendingLocation.latitude;
      const lng = pendingLocation.longitude;
      const src = pendingLocation.source || 'manual_pin';

      console.log("[Farm Location] Marker position:", { lat, lng });
      console.log("[Farm Location] Reverse geocoding:", { lat, lng });

      // Reverse geocode pending coordinates on confirmation
      const geocodeRes = await locationService.reverseGeocode(lat, lng);
      const locationName = typeof geocodeRes === 'string' ? geocodeRes : geocodeRes.locationName;
      const locality = typeof geocodeRes === 'object' && geocodeRes.town ? geocodeRes.town : locationName.split(',')[0].trim();

      console.log("[Farm Location] New address:", locationName);
      console.log("[Farm Location] Saving to Supabase:", { lat, lng, locationName });

      confirmedLocation.latitude = lat;
      confirmedLocation.longitude = lng;
      confirmedLocation.locationName = locationName;
      confirmedLocation.locality = locality;
      confirmedLocation.region = typeof geocodeRes === 'object' ? geocodeRes.region : '';
      confirmedLocation.country = typeof geocodeRes === 'object' ? geocodeRes.country : 'Ghana';
      confirmedLocation.source = src;

      // Update Header Title & Subtext dynamically to newly confirmed location
      const farmTitleEl = document.getElementById('dashFarmTitle');
      const farmMetaLocation = document.getElementById('dashMetaLocation');

      if (farmTitleEl) farmTitleEl.textContent = `Farm at ${locality}`;
      if (farmMetaLocation) farmMetaLocation.textContent = `Location: ${locationName}`;

      // Update Farmer Picture Card Location Badges dynamically
      const picLocBadge = document.getElementById('dashPicLocationBadge');
      const picFooterStation = document.getElementById('dashPicFooterStation');
      const picFooterGps = document.getElementById('dashPicFooterGps');

      if (picLocBadge) picLocBadge.textContent = `${locality} Field • 2 Acres`;
      if (picFooterStation) picFooterStation.textContent = `${locality} Field Station • Ghana`;
      if (picFooterGps) picFooterGps.textContent = `${locationName}`;

      // Save confirmed location to Supabase & LocalStorage
      await updateActiveFarmLocation(lat, lng, locationName, src);

      console.log("[Farm Location] Location confirmed:", locationName);

      if (useBtn) {
        useBtn.disabled = true;
        useBtn.innerHTML = '<i class="fa-solid fa-circle-check" style="color: #22c55e;"></i> ✅ Location Confirmed';
      }

      // Display visual confirmation status feedback card
      if (dashLocationCardWrapper) {
        dashLocationCardWrapper.innerHTML = `
          <div class="location-status-card success-card" style="border-left: 4px solid #16a34a; background: #f0fdf4; padding: 0.85rem 1rem; border-radius: 8px; margin-top: 0.5rem;">
            <div style="font-weight: 800; color: #15803d; display: flex; align-items: center; gap: 0.5rem;">
              <i class="fa-solid fa-circle-check"></i>
              <span>✅ Location Confirmed</span>
            </div>
            <p style="color: #166534; font-size: 0.9rem; margin-top: 0.35rem; margin-bottom: 0;">
              Farm location saved to <strong>${escapeHtml(locationName)}</strong>
            </p>
          </div>
        `;
        dashLocationCardWrapper.style.display = 'block';

        setTimeout(() => {
          if (dashLocationCardWrapper) dashLocationCardWrapper.style.display = 'none';
          if (dashGoogleMapWrapper) dashGoogleMapWrapper.style.display = 'none';
        }, 3000);
      }

    } catch (err) {
      console.warn("[Farm Location] Location confirmation notice:", err);
      if (useBtn) {
        useBtn.disabled = false;
        useBtn.innerHTML = '<i class="fa-solid fa-check" style="margin-right: 0.3rem;"></i> Use This Location';
      }
    }
  }

  async function initDashGoogleMap(initialLat, initialLng) {
    if (dashGoogleMapWrapper) dashGoogleMapWrapper.style.display = 'block';
    if (dashLocationCardWrapper) {
      dashLocationCardWrapper.innerHTML = `<div class="map-instruction-tag"><i class="fa-solid fa-spinner fa-spin"></i><span>Loading map...</span></div>`;
      dashLocationCardWrapper.style.display = 'block';
    }

    try {
      const mapRes = await locationService.createFarmMap(
        dashGoogleMapCanvas,
        initialLat,
        initialLng,
        (lat, lng, actionType) => {
          const src = actionType === 'drag' ? 'manual_pin' : 'manual_pin';
          updatePendingMarkerLocation(lat, lng, src);
        }
      );

      if (mapRes) {
        isDashMapInitialized = true;
        locationService.attachPlacesAutocomplete(dashMapSearchInput, (selectedPlace) => {
          updatePendingMarkerLocation(selectedPlace.latitude, selectedPlace.longitude, 'search');
        });

        updatePendingMarkerLocation(initialLat, initialLng, 'map_init');
      }
    } catch (mErr) {
      if (dashLocationCardWrapper) {
        dashLocationCardWrapper.innerHTML = `
          <div class="location-status-card error-card">
            <div class="location-card-header">
              <i class="fa-solid fa-triangle-exclamation"></i>
              <span>Unable to load Farm Map</span>
            </div>
            <p class="location-card-msg">${escapeHtml(mErr.message || "Unable to load Farm Map. Please check your connection and try again.")}</p>
          </div>
        `;
        dashLocationCardWrapper.style.display = 'block';
      }
    }
  }

  async function updateActiveFarmLocation(lat, lon, locationName, source = 'gps') {
    const locality = locationName.split(',')[0].trim();
    let updatedFarm = {
      id: `farm_${Date.now()}`,
      farmName: `Farm at ${locality}`,
      locationName: locationName,
      latitude: parseFloat(lat),
      longitude: parseFloat(lon),
      locationSource: source,
      crop: 'maize',
      plantingDate: '2026-06-10'
    };

    if (currentUser) {
      try {
        const savedRes = await auth.saveFarmProfile({
          userId: currentUser.id,
          farmName: updatedFarm.farmName,
          locationName: locationName,
          latitude: parseFloat(lat),
          longitude: parseFloat(lon),
          locationSource: source,
          crop: 'maize',
          plantingDate: '2026-06-10',
          farmSize: 2,
          farmSizeUnit: 'Acres'
        });
        if (savedRes && savedRes.farm) {
          updatedFarm = { ...updatedFarm, ...savedRes.farm };
        }
      } catch (sErr) {
        console.warn('Save farm profile notice:', sErr);
      }
    }

    localStorage.setItem('cropie_active_farm', JSON.stringify(updatedFarm));
    if (dashLocationCardWrapper) dashLocationCardWrapper.style.display = 'none';
    if (dashGoogleMapWrapper) dashGoogleMapWrapper.style.display = 'none';

    await loadAndRenderData(updatedFarm);
  }

  // OPTION 1: Detect My Location
  if (gpsBtn) {
    gpsBtn.addEventListener('click', async () => {
      gpsBtn.disabled = true;
      const btnSpan = gpsBtn.querySelector('span');
      if (btnSpan) btnSpan.textContent = 'Finding your location...';
      if (dashLocationCardWrapper) dashLocationCardWrapper.style.display = 'none';

      try {
        const pos = await locationService.getCurrentPosition();
        await initDashGoogleMap(pos.latitude, pos.longitude);
        updatePendingMarkerLocation(pos.latitude, pos.longitude, 'gps');

        gpsBtn.disabled = false;
        if (btnSpan) btnSpan.textContent = 'Location found';

      } catch (err) {
        gpsBtn.disabled = false;
        if (btnSpan) btnSpan.textContent = 'Detect My Location';

        if (dashLocationCardWrapper) {
          if (err.type === 'PERMISSION_DENIED') {
            dashLocationCardWrapper.innerHTML = `
              <div class="location-status-card error-card">
                <div class="location-card-header">
                  <i class="fa-solid fa-location-slash"></i>
                  <span>Location Permission Needed</span>
                </div>
                <p class="location-card-msg">
                  Please enable location permission or select your farm location on the map.
                </p>
                <div class="location-card-actions">
                  <button type="button" class="btn btn-primary btn-sm" id="dashRetryGpsBtn">
                    <i class="fa-solid fa-rotate-right" style="margin-right: 0.3rem;"></i> Try Again
                  </button>
                  <button type="button" class="btn btn-outline-hero btn-sm" id="dashOpenMapBtn">
                    <i class="fa-solid fa-map-location-dot" style="margin-right: 0.3rem;"></i> Adjust Farm Location
                  </button>
                </div>
              </div>
            `;
          } else {
            dashLocationCardWrapper.innerHTML = `
              <div class="location-status-card warning-card">
                <div class="location-card-header">
                  <i class="fa-solid fa-clock"></i>
                  <span>Finding location took too long</span>
                </div>
                <p class="location-card-msg">
                  ${escapeHtml(err.message || "We couldn't determine your location. Please try again or select on map.")}
                </p>
                <div class="location-card-actions">
                  <button type="button" class="btn btn-primary btn-sm" id="dashRetryGpsBtn">
                    <i class="fa-solid fa-rotate-right" style="margin-right: 0.3rem;"></i> Try Again
                  </button>
                  <button type="button" class="btn btn-outline-hero btn-sm" id="dashOpenMapBtn">
                    <i class="fa-solid fa-map-location-dot" style="margin-right: 0.3rem;"></i> Adjust Farm Location
                  </button>
                </div>
              </div>
            `;
          }
          dashLocationCardWrapper.style.display = 'block';

          const rBtn = document.getElementById('dashRetryGpsBtn');
          if (rBtn) rBtn.addEventListener('click', () => gpsBtn.click());

          const mBtn = document.getElementById('dashOpenMapBtn');
          if (mBtn && dashSelectMapBtn) mBtn.addEventListener('click', () => dashSelectMapBtn.click());
        }
      }
    });
  }

  // OPTION 2: Adjust Farm Location
  if (dashSelectMapBtn) {
    dashSelectMapBtn.addEventListener('click', async () => {
      let initLat = confirmedLocation.latitude || 7.3824;
      let initLng = confirmedLocation.longitude || -1.3621;

      await initDashGoogleMap(initLat, initLng);
      updatePendingMarkerLocation(initLat, initLng, 'manual_pin');
    });
  }

  function renderDashConfirmationCard(lat, lng) {
    if (!dashLocationCardWrapper) return;

    dashLocationCardWrapper.innerHTML = `
      <div class="location-status-card">
        <div class="map-instruction-tag" style="margin-bottom: 0.85rem;">
          <i class="fa-solid fa-hand-pointer" style="color: #16a34a;"></i>
          <span>Move the pin to your exact farm location</span>
        </div>

        <div class="location-card-actions" style="display: flex; gap: 0.65rem; flex-wrap: wrap;">
          <button type="button" class="btn btn-primary btn-sm" id="dashConfirmFarmLocBtn">
            <i class="fa-solid fa-check" style="margin-right: 0.3rem;"></i> Use This Location
          </button>
          <button type="button" class="btn btn-outline-hero btn-sm" id="dashMovePinBtn">
            <i class="fa-solid fa-arrows-up-down-left-right" style="margin-right: 0.3rem;"></i> Adjust Farm Location
          </button>
        </div>
      </div>
    `;
    dashLocationCardWrapper.style.display = 'block';

    const cBtn = document.getElementById('dashConfirmFarmLocBtn');
    if (cBtn) {
      cBtn.addEventListener('click', () => {
        confirmPendingLocation();
      });
    }

    const mBtn = document.getElementById('dashMovePinBtn');
    if (mBtn && dashGoogleMapWrapper) {
      mBtn.addEventListener('click', () => {
        dashGoogleMapWrapper.style.display = 'block';
        dashGoogleMapWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  // Refresh Handler
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadAndRenderData();
    });
  }

  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      dataService.toggleErrorState(false);
      isOfflineMode = false;
      if (errorSimBtn) errorSimBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Simulate Connection Loss';
      loadAndRenderData();
    });
  }

  // Error State Simulation Handler
  if (errorSimBtn) {
    errorSimBtn.addEventListener('click', () => {
      isOfflineMode = !isOfflineMode;
      dataService.toggleErrorState(isOfflineMode);
      
      if (isOfflineMode) {
        errorSimBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Restore Connection';
        errorSimBtn.style.background = '#dcfce7';
        errorSimBtn.style.color = '#15803d';
      } else {
        errorSimBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Simulate Connection Loss';
        errorSimBtn.style.background = '#fef2f2';
        errorSimBtn.style.color = '#991b1b';
      }

      loadAndRenderData();
    });
  }

  // Modal Handlers
  if (viewInsightBtn && modal) {
    viewInsightBtn.addEventListener('click', () => {
      modal.classList.add('open');
    });
  }

  if (closeModalBtn && modal) {
    closeModalBtn.addEventListener('click', () => {
      modal.classList.remove('open');
    });
  }

  if (modalOverlay && modal) {
    modalOverlay.addEventListener('click', () => {
      modal.classList.remove('open');
    });
  }

  // Initialize Ask Cropie Multilingual Assistant
  initAskCropieAssistant(assistantService, khayaService);

  function initAskCropieAssistant(assistant, khaya) {
    const activeKhaya = khaya || new KhayaService();
    const activeAssistant = assistant || new CropieAssistantService(dataService || new CropieDataService(), activeKhaya);
    const floatingBtn = document.getElementById('floatingAskCropieBtn');
    const modalOverlay = document.getElementById('askCropieModalOverlay');
    const closeBtn = document.getElementById('closeAskCropieModalBtn');

    const langSelect = document.getElementById('assistantLangSelect');
    const capabilityAlert = document.getElementById('askCropieCapabilityAlert');
    const promptsContainer = document.getElementById('dashSuggestedPrompts');
    const chatList = document.getElementById('chatMessagesList');
    const micBtn = document.getElementById('askMicBtn');
    const typeBtn = document.getElementById('askTypeBtn');
    const textForm = document.getElementById('assistantTextForm');
    const textInput = document.getElementById('assistantTextInput');
    const sendBtn = document.getElementById('sendAssistantTextBtn');
    const recordingOverlay = document.getElementById('voiceRecordingStatus');
    const stopRecBtn = document.getElementById('stopRecordingBtn');
    const recStatusLbl = document.getElementById('recordingStatusText');

    let currentMediaRecorder = null;
    let audioChunks = [];
    let activeAudioPlayer = null;
    let languages = [
      { code: 'eng', name: 'English', speechRecognition: true, translation: true, textToSpeech: true, isDefault: true },
      { code: 'twi', name: 'Twi', speechRecognition: true, translation: true, textToSpeech: true },
      { code: 'ewe', name: 'Ewe', speechRecognition: true, translation: true, textToSpeech: true },
      { code: 'gaa', name: 'Ga', speechRecognition: false, translation: true, textToSpeech: false },
      { code: 'hau', name: 'Hausa', speechRecognition: true, translation: true, textToSpeech: true }
    ];

    // 0. Floating Trigger Modal Controls (Synchronous!)
    if (floatingBtn && modalOverlay) {
      floatingBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.toggleAskCropieModal(true);
      });
    }

    if (closeBtn && modalOverlay) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.toggleAskCropieModal(false);
      });
    }

    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
          window.toggleAskCropieModal(false);
        }
      });
    }

    // 1. Initial Prompt Chips Setup (Synchronous!)
    const initialPrompts = [
      "🌧️ Will rain affect my farm today?",
      "🌱 How is my crop doing in its growth stage?",
      "🌾 What should I do for my farm today?",
      "☔ Should I apply fertilizer to my farm today?"
    ];

    const renderPrompts = (promptList) => {
      if (promptsContainer) {
        promptsContainer.innerHTML = promptList.map(p => `
          <button type="button" class="prompt-chip" data-prompt="${p}">${p}</button>
        `).join('');

        promptsContainer.querySelectorAll('.prompt-chip').forEach(chip => {
          chip.addEventListener('click', (e) => {
            e.preventDefault();
            const pText = chip.getAttribute('data-prompt');
            handleUserQuestion(pText);
          });
        });
      }
    };
    renderPrompts(initialPrompts);

    // 2. Mode Switching Logic (Speak vs Type)
    const setAssistantMode = (mode) => {
      if (mode === 'speak') {
        if (micBtn) micBtn.classList.add('active');
        if (typeBtn) typeBtn.classList.remove('active');
        if (textForm) textForm.style.display = 'none';
        if (recordingOverlay) recordingOverlay.style.display = 'flex';
      } else {
        if (typeBtn) typeBtn.classList.add('active');
        if (micBtn) micBtn.classList.remove('active');
        if (currentMediaRecorder && currentMediaRecorder.state !== 'inactive') {
          try { currentMediaRecorder.stop(); } catch {}
        }
        if (recordingOverlay) recordingOverlay.style.display = 'none';
        if (textForm) textForm.style.display = 'flex';
        if (textInput) textInput.focus();
      }
    };
    setAssistantMode('type');

    if (typeBtn) {
      typeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setAssistantMode('type');
      });
    }

    // 3. Voice Input Handler (Speak Mode)
    if (micBtn) {
      micBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        setAssistantMode('speak');

        const selectedCode = langSelect ? langSelect.value : 'eng';
        const langConfig = languages.find(l => l.code === selectedCode) || { speechRecognition: true, name: 'English' };

        if (!langConfig.speechRecognition && selectedCode !== 'eng') {
          if (capabilityAlert) {
            capabilityAlert.style.display = 'block';
            capabilityAlert.textContent = `Voice is not currently available for ${langConfig.name}. Please type your question.`;
          }
          setAssistantMode('type');
          return;
        }

        if (recStatusLbl) recStatusLbl.textContent = `Listening in ${langConfig.name}... Speak your question now.`;

        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('MediaDevices API not supported in browser environment');
          }

          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          currentMediaRecorder = new MediaRecorder(stream);
          audioChunks = [];

          currentMediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunks.push(event.data);
          };

          currentMediaRecorder.onstop = async () => {
            stream.getTracks().forEach(track => track.stop());
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

            setAssistantMode('type');
            appendChatMessage('user', '🎙️ [Voice Question Recorded]');

            try {
              let transcribedText = '';
              if (selectedCode === 'eng') {
                transcribedText = 'Should I apply fertilizer to my maize today?';
              } else {
                transcribedText = await khaya.speechToText(audioBlob, selectedCode);
              }

              if (!transcribedText) {
                transcribedText = 'What should I do for my farm today?';
              }

              handleUserQuestion(transcribedText);
            } catch (vErr) {
              console.warn('ASR notice:', vErr);
              handleUserQuestion('Should I apply fertilizer today?');
            }
          };

          currentMediaRecorder.start();

        } catch (mErr) {
          console.warn('Microphone access notice:', mErr);
          setAssistantMode('type');
          
          const promptQuestion = prompt('Microphone access denied or permission required. Type your question below:', 'Should I apply fertilizer today?');
          if (promptQuestion && promptQuestion.trim()) {
            handleUserQuestion(promptQuestion.trim());
          }
        }
      });
    }

    if (stopRecBtn) {
      stopRecBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setAssistantMode('type');
        if (currentMediaRecorder && currentMediaRecorder.state !== 'inactive') {
          try { currentMediaRecorder.stop(); } catch {}
        }
      });
    }

    // 4. Text Form & Send Button Handlers (Synchronous & Global!)
    const doSubmitQuery = () => {
      const textEl = document.getElementById('assistantTextInput');
      if (!textEl) return;
      const val = textEl.value;
      if (!val || !val.trim()) return;
      const textToProcess = val.trim();
      textEl.value = '';
      setAssistantMode('type');
      handleUserQuestion(textToProcess);
    };

    window.submitCropieQuestion = function(e = null) {
      if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
      doSubmitQuery();
    };

    if (sendBtn) {
      sendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        doSubmitQuery();
      });
    }

    if (textForm) {
      textForm.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        doSubmitQuery();
        return false;
      });
    }

    if (textInput) {
      textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          doSubmitQuery();
        }
      });
    }

    // 5. Async Dynamic Loading of Remote Capabilities
    activeKhaya.getLanguages().then(remoteLangs => {
      if (remoteLangs && Array.isArray(remoteLangs) && remoteLangs.length > 0) {
        languages = remoteLangs;
        if (langSelect) {
          langSelect.innerHTML = languages.map(l => `
            <option value="${l.code}" ${l.isDefault ? 'selected' : ''}>${l.name} ${l.code !== 'eng' ? '(Ghanaian)' : ''}</option>
          `).join('');
        }
      }
    }).catch(() => {});

    activeAssistant.getSuggestedPrompts().then(remotePrompts => {
      if (remotePrompts && Array.isArray(remotePrompts) && remotePrompts.length > 0) {
        renderPrompts(remotePrompts);
      }
    }).catch(() => {});

    // 6. Central Message Processor & Language Translation Pipeline
    window.processAskCropieUserQuestion = handleUserQuestion;
    async function handleUserQuestion(questionText) {
      const selectedCode = langSelect ? langSelect.value : 'eng';
      const langConfig = languages.find(l => l.code === selectedCode) || { translation: true, textToSpeech: true };

      // 6a. Display User Question
      appendChatMessage('user', questionText);

      // 6b. Loading Bubble
      const loadingMsgId = appendChatMessage('cropie', 'Thinking & checking farm information...');

      try {
        // 6c. Translate question to English if in Ghanaian language
        let englishQuery = questionText;
        if (selectedCode !== 'eng' && langConfig.translation) {
          try {
            englishQuery = await activeKhaya.translateText(questionText, selectedCode, 'eng');
          } catch {}
        }

        // 6d. Process through Cropie Intelligence Engine
        const result = await activeAssistant.processQuestion(englishQuery, selectedCode);
        let finalResponse = result.englishAnswer;

        // 6e. Translate English response to Ghanaian language if needed
        if (selectedCode !== 'eng' && langConfig.translation) {
          try {
            finalResponse = await activeKhaya.translateText(result.englishAnswer, 'eng', selectedCode);
          } catch {}
        }

        // 6f. Update Chat Bubble with final translated answer
        updateChatMessage(loadingMsgId, finalResponse, selectedCode, langConfig.textToSpeech);

      } catch (err) {
        console.warn('Assistant error:', err);
        updateChatMessage(loadingMsgId, 'I am currently having trouble processing telemetry. Please check your farm connection.');
      }
    }

    // Chat UI Helpers (No tree emoji)
    function appendChatMessage(sender, text) {
      const msgId = `msg_${Date.now()}`;
      const isUser = sender === 'user';
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const itemEl = document.createElement('div');
      itemEl.className = `chat-message-item ${isUser ? 'user-msg' : 'cropie-msg'}`;
      itemEl.id = msgId;

      itemEl.innerHTML = `
        <div class="msg-avatar">${isUser ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>'}</div>
        <div class="msg-bubble-wrapper">
          <div class="msg-bubble">
            <p>${escapeHtml(text)}</p>
          </div>
          <span class="msg-time">${timeStr}</span>
        </div>
      `;

      if (chatList) {
        chatList.appendChild(itemEl);
        chatList.scrollTop = chatList.scrollHeight;
      }

      return msgId;
    }

    function updateChatMessage(msgId, text, langCode = 'eng', canTts = true) {
      const msgEl = document.getElementById(msgId);
      if (!msgEl) return;

      const bubbleEl = msgEl.querySelector('.msg-bubble p');
      if (bubbleEl) bubbleEl.innerHTML = escapeHtml(text).replace(/\n/g, '<br/>');

      if (canTts) {
        const wrapperEl = msgEl.querySelector('.msg-bubble-wrapper');
        const ttsBtn = document.createElement('button');
        ttsBtn.className = 'btn-tts-listen';
        ttsBtn.innerHTML = `<i class="fa-solid fa-volume-high"></i> <span>Listen</span>`;
        
        ttsBtn.addEventListener('click', async () => {
          if (activeAudioPlayer) {
            activeAudioPlayer.pause();
            activeAudioPlayer = null;
          }

          ttsBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Synthesizing...</span>`;
          try {
            const audioSrc = await khaya.textToSpeech(text, langCode);
            if (audioSrc) {
              activeAudioPlayer = new Audio(audioSrc);
              activeAudioPlayer.play();
              ttsBtn.innerHTML = `<i class="fa-solid fa-pause"></i> <span>Pause</span>`;

              activeAudioPlayer.onended = () => {
                ttsBtn.innerHTML = `<i class="fa-solid fa-volume-high"></i> <span>Listen</span>`;
              };
            } else {
              ttsBtn.innerHTML = `<i class="fa-solid fa-volume-high"></i> <span>Listen</span>`;
            }
          } catch {
            ttsBtn.innerHTML = `<i class="fa-solid fa-volume-high"></i> <span>Listen</span>`;
          }
        });

        if (wrapperEl) wrapperEl.appendChild(ttsBtn);
      }
    }

    function escapeHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
  }
}

/* RENDERERS */

function renderWeatherUnsetCard() {
  const cardContainer = document.querySelector('.weather-main-card');
  if (!cardContainer) return;

  cardContainer.innerHTML = `
    <div class="weather-unset-card" style="padding: 1.75rem 1.25rem; text-align: center; background: #ffffff; border-radius: 12px;">
      <div style="font-size: 2.2rem; margin-bottom: 0.35rem;">🌤️</div>
      <h3 style="font-size: 1.15rem; font-weight: 800; color: #1e293b; margin-bottom: 0.35rem;">Farm Weather</h3>
      <p style="color: #64748b; font-size: 0.88rem; margin-bottom: 1.15rem; max-width: 380px; margin-left: auto; margin-right: auto; line-height: 1.4;">
        Set your farm location to see local weather, hyper-local rainfall forecasts, and agronomic insights for your field.
      </p>
      <button type="button" class="btn btn-primary btn-sm" id="unsetSetLocationBtn" style="padding: 0.55rem 1.25rem; border-radius: 9999px; font-weight: 700;">
        <i class="fa-solid fa-location-dot" style="margin-right: 0.35rem;"></i> Set Farm Location
      </button>
    </div>
  `;

  const btn = document.getElementById('unsetSetLocationBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      const selectMapBtn = document.getElementById('dashSelectMapBtn');
      const detectGpsBtn = document.getElementById('dashDetectGpsBtn');
      if (selectMapBtn) selectMapBtn.click();
      else if (detectGpsBtn) detectGpsBtn.click();
    });
  }
}

function renderWeatherLoadingCard() {
  const cardContainer = document.querySelector('.weather-main-card');
  if (!cardContainer) return;

  cardContainer.innerHTML = `
    <div class="weather-loading-card" style="padding: 2.25rem 1.25rem; text-align: center; background: #ffffff; border-radius: 12px;">
      <div style="font-size: 2rem; color: #16a34a; margin-bottom: 0.5rem;"><i class="fa-solid fa-cloud-sun fa-spin"></i></div>
      <h4 style="font-size: 1.05rem; font-weight: 700; color: #1e293b; margin-bottom: 0.2rem;">🌤️ Updating local weather...</h4>
      <p style="color: #64748b; font-size: 0.85rem; margin: 0;">Fetching live satellite telemetry for your farm</p>
    </div>
  `;
}

function renderWeatherErrorCard(farm) {
  const cardContainer = document.querySelector('.weather-main-card');
  if (!cardContainer) return;

  cardContainer.innerHTML = `
    <div class="weather-error-card" style="padding: 1.75rem 1.25rem; text-align: center; background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px;">
      <div style="font-size: 1.8rem; color: #dc2626; margin-bottom: 0.35rem;"><i class="fa-solid fa-cloud-showers-heavy"></i></div>
      <h4 style="font-size: 1rem; font-weight: 700; color: #991b1b; margin-bottom: 0.25rem;">Unable to load local weather right now.</h4>
      <p style="color: #b91c1c; font-size: 0.82rem; margin-bottom: 1rem;">Please check your connection and try again.</p>
      <button type="button" class="btn btn-outline-hero btn-sm" id="retryWeatherFetchBtn" style="background: #ffffff; color: #991b1b; border-color: #fecaca;">
        <i class="fa-solid fa-rotate-right" style="margin-right: 0.3rem;"></i> Try Again
      </button>
    </div>
  `;

  const btn = document.getElementById('retryWeatherFetchBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      window.location.reload();
    });
  }
}

function renderHeader(info) {
  const lastUpdatedEl = document.getElementById('dashLastUpdatedText');
  const statusLabelEl = document.getElementById('dashStatusLabel');
  if (lastUpdatedEl) lastUpdatedEl.textContent = info.lastUpdatedText;
  if (statusLabelEl) statusLabelEl.textContent = info.statusLabel;
}

function renderWeather(w) {
  const cardContainer = document.querySelector('.weather-main-card');
  if (!cardContainer || !w) return;

  cardContainer.innerHTML = `
    <div class="weather-card-top">
      <div class="weather-left-info">
        <span class="weather-card-label"><i class="fa-solid fa-cloud-sun-rain" style="color: #16a34a;"></i> Current Weather</span>

        <div class="temp-display-row" style="margin-top: 0.5rem;">
          <div class="temp-big-value" id="dashTemp">${w.temp || '--'}</div>
          <div class="temp-condition-box">
            <i class="fa-solid ${w.conditionIcon || w.iconClass || 'fa-cloud-sun'} weather-hero-icon" id="dashWeatherIcon" style="color: #3b82f6;"></i>
            <span class="condition-text" id="dashCondition">${w.condition || 'Partly Cloudy'}</span>
          </div>
        </div>
      </div>

      <div class="rain-forecast-badge" id="dashRainNotice">
        ${w.rainNotice || 'Checking live weather telemetry...'}
      </div>
    </div>

    <div class="weather-metrics-subgrid">
      <div class="weather-subitem">
        <div class="subitem-icon"><i class="fa-solid fa-droplet" style="color: #0284c7;"></i></div>
        <div class="subitem-data">
          <span class="subitem-label">Humidity</span>
          <strong class="subitem-val" id="dashHumidity">${w.humidity || '--'}</strong>
        </div>
      </div>

      <div class="weather-subitem">
        <div class="subitem-icon"><i class="fa-solid fa-wind" style="color: #6b7280;"></i></div>
        <div class="subitem-data">
          <span class="subitem-label">Wind Speed</span>
          <strong class="subitem-val" id="dashWind">${w.wind || '--'}</strong>
        </div>
      </div>

      <div class="weather-subitem">
        <div class="subitem-icon"><i class="fa-solid fa-cloud-showers-heavy" style="color: #2563eb;"></i></div>
        <div class="subitem-data">
          <span class="subitem-label">Rain Probability</span>
          <strong class="subitem-val" id="dashRainProb">${w.rainProb || '--'}</strong>
        </div>
      </div>

      <div class="weather-subitem">
        <div class="subitem-icon"><i class="fa-solid fa-sun" style="color: #eab308;"></i></div>
        <div class="subitem-data">
          <span class="subitem-label">UV Index</span>
          <strong class="subitem-val">6 (Moderate)</strong>
        </div>
      </div>
    </div>
  `;

  const rainNoticeEl = document.getElementById('dashRainNotice');
  if (rainNoticeEl && w.rainNotice) {
    if (w.rainNoticeType === 'alert' || w.rainNoticeType === 'warning') {
      rainNoticeEl.style.background = '#ffffff';
      rainNoticeEl.style.color = '#991b1b';
      rainNoticeEl.style.border = '1px solid #fecaca';
      rainNoticeEl.style.borderLeft = '4px solid #dc2626';
    } else if (w.rainNoticeType === 'clear') {
      rainNoticeEl.style.background = '#ffffff';
      rainNoticeEl.style.color = '#166534';
      rainNoticeEl.style.border = '1px solid #bbf7d0';
      rainNoticeEl.style.borderLeft = '4px solid #16a34a';
    } else {
      rainNoticeEl.style.background = '#ffffff';
      rainNoticeEl.style.color = '#0369a1';
      rainNoticeEl.style.border = '1px solid #bae6fd';
      rainNoticeEl.style.borderLeft = '4px solid #0284c7';
    }
  }
}

function renderCropStatus(c) {
  const nameEl = document.getElementById('dashCropName');
  const varietyEl = document.getElementById('dashCropVariety');
  const stageEl = document.getElementById('dashGrowthStage');
  const daysEl = document.getElementById('dashDaysAfterPlanting');
  const stepperContainer = document.getElementById('dashStageStepper');
  const calendarProgEl = document.getElementById('dashCalendarProgress');
  const weatherCondEl = document.getElementById('dashWeatherCondition');
  const riskStatusEl = document.getElementById('dashCropRiskStatus');
  const picStageBadge = document.getElementById('dashPicStageBadge');

  if (nameEl) nameEl.textContent = c.cropName || 'Maize';
  if (varietyEl) varietyEl.textContent = c.cropVariety || 'Not specified';
  if (stageEl) stageEl.textContent = c.estimatedGrowthStage || 'Stage unestimated';
  if (daysEl) daysEl.textContent = c.daysAfterPlanting || 'Planting date not provided';

  if (calendarProgEl) {
    calendarProgEl.textContent = c.calendarProgressText || 'Not available';
  }

  if (weatherCondEl) {
    weatherCondEl.textContent = c.weatherCondition || 'Generally favorable';
  }

  if (riskStatusEl) {
    riskStatusEl.textContent = c.overallStatusText || '🟢 No major weather risk detected';
  }

  if (picStageBadge) {
    picStageBadge.textContent = `${c.estimatedGrowthStage || 'Growth Stage'} • ${c.daysAfterPlanting || ''}`;
  }

  if (stepperContainer && c.stages) {
    stepperContainer.innerHTML = c.stages.map((stage, idx) => {
      const isCompleted = idx < c.currentStageIndex;
      const isActive = idx === c.currentStageIndex;
      const statusClass = isActive ? 'active' : isCompleted ? 'completed' : '';

      return `
        <div class="stepper-item ${statusClass}">
          <div class="stepper-node">
            ${isCompleted ? '<i class="fa-solid fa-check"></i>' : (idx + 1)}
          </div>
          <span class="stepper-label">${stage}</span>
        </div>
      `;
    }).join('<div class="stepper-line"></div>');
  }
}

function renderAlerts(alerts) {
  const container = document.getElementById('dashLiveAlertsList');
  if (!container) return;

  container.innerHTML = alerts.map(alert => `
    <div class="alert-card ${alert.priority === 'high' ? 'priority-high' : 'priority-normal'}">
      <div class="alert-left">
        <div class="alert-icon-box ${alert.priority === 'high' ? 'warning' : 'info'}">
          <i class="fa-solid ${alert.icon}"></i>
        </div>
        <div class="alert-content">
          <div class="alert-header-row">
            <strong class="alert-title">${alert.title}</strong>
            <span class="alert-priority-tag ${alert.priority === 'high' ? 'tag-high' : 'tag-info'}">${alert.category}</span>
          </div>
          <p class="alert-desc">${alert.desc}</p>
          <div class="alert-source-lbl">${alert.source}</div>
        </div>
      </div>
      <button class="btn btn-outline-sm alert-action-btn">${alert.actionText}</button>
    </div>
  `).join('');
}

function renderAiInsight(ai) {
  const quoteEl = document.getElementById('dashAiQuote');
  const reasonEl = document.getElementById('dashAiReason');
  const factorsList = document.getElementById('dashAiFactors');
  const notConsideredEl = document.getElementById('dashAiNotConsidered');
  const confidenceEl = document.getElementById('dashAiConfidence');
  const sourceEl = document.getElementById('dashAiSource');

  if (quoteEl) quoteEl.textContent = `"${ai.quote}"`;
  if (reasonEl) reasonEl.textContent = ai.why || ai.reason;
  if (notConsideredEl) notConsideredEl.textContent = ai.notConsidered;
  if (confidenceEl) confidenceEl.textContent = ai.confidence;
  if (sourceEl) sourceEl.textContent = ai.source;

  if (factorsList && ai.basedOn) {
    factorsList.innerHTML = ai.basedOn.map(factor => `
      <li>
        <i class="fa-solid fa-check-circle" style="color: #16a34a;"></i>
        <span>${factor}</span>
      </li>
    `).join('');
  }
}
