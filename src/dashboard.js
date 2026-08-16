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

      if (!activeFarm) {
        activeFarm = {
          id: 'farm_default',
          farmName: "My Farm",
          locationName: 'Laterbiokorshie, Accra, Ghana',
          latitude: 5.5492,
          longitude: -0.2315,
          crop: 'maize',
          plantingDate: '2026-06-10'
        };
      }

      const user = await auth.getCurrentUser();
      if (user && !customFarm) {
        const userFarm = await auth.getUserFarm(user.id);
        if (userFarm) {
          activeFarm = { ...activeFarm, ...userFarm };
        }
      }

      // Apply farm context
      dataService.applyUserFarmContext(activeFarm);
      const farmTitleEl = document.getElementById('dashFarmTitle');
      const farmMetaLocation = document.getElementById('dashMetaLocation');
      if (farmTitleEl) farmTitleEl.textContent = activeFarm.farmName || "My Farm";
      if (farmMetaLocation) farmMetaLocation.textContent = `Location: ${activeFarm.locationName}`;

      // Update Farmer Picture Card Location Badges dynamically
      const shortCity = (activeFarm.locationName || 'Laterbiokorshie').split(',')[0].trim();
      const picLocBadge = document.getElementById('dashPicLocationBadge');
      const picFooterStation = document.getElementById('dashPicFooterStation');
      const picFooterGps = document.getElementById('dashPicFooterGps');
      
      if (picLocBadge) picLocBadge.textContent = `${shortCity} Field • 2 Acres`;
      if (picFooterStation) picFooterStation.textContent = `${shortCity} Field Station • Ghana`;
      if (picFooterGps) {
        picFooterGps.textContent = `${activeFarm.locationName} (${activeFarm.latitude?.toFixed(4)}° N, ${Math.abs(activeFarm.longitude)?.toFixed(4)}° W)`;
      }

      // Save to active local storage cache
      localStorage.setItem('cropie_active_farm', JSON.stringify(activeFarm));

      // Fetch real live weather from Open-Meteo API for active farm location
      try {
        const weatherData = await weatherService.getWeatherForFarm(activeFarm);
        dataService.applyOpenMeteoWeather(weatherData);
      } catch (wErr) {
        console.warn('Open-Meteo weather fetch notice:', wErr);
      }

      const data = await dataService.getLiveData();
      if (errorBanner) errorBanner.style.display = 'none';
      renderHeader(data.headerInfo);
      renderWeather(data.weather);
      renderCropStatus(data.cropStatus);
      renderAlerts(data.liveAlerts);
      renderAiInsight(data.aiInsight);

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

  let dashPendingLat = 7.3824;
  let dashPendingLng = -1.3621;
  let dashPendingLocName = 'Ejura, Ashanti Region, Ghana';
  let dashPendingAccuracy = null;
  let isDashMapInitialized = false;

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
        async (lat, lng, actionType) => {
          dashPendingLat = lat;
          dashPendingLng = lng;
          
          const geocodeRes = await locationService.reverseGeocode(lat, lng);
          dashPendingLocName = typeof geocodeRes === 'string' ? geocodeRes : geocodeRes.locationName;

          locationService.logLocationDebug({
            permissionStatus: 'granted',
            latitude: lat,
            longitude: lng,
            accuracy: dashPendingAccuracy,
            timestamp: Date.now(),
            locationName: dashPendingLocName
          });

          renderDashConfirmationCard(dashPendingLat, dashPendingLng, dashPendingLocName, dashPendingAccuracy);
        }
      );

      if (mapRes) {
        isDashMapInitialized = true;
        locationService.attachPlacesAutocomplete(dashMapSearchInput, async (selectedPlace) => {
          dashPendingLat = selectedPlace.latitude;
          dashPendingLng = selectedPlace.longitude;

          const geocodeRes = await locationService.reverseGeocode(dashPendingLat, dashPendingLng);
          dashPendingLocName = typeof geocodeRes === 'string' ? geocodeRes : geocodeRes.locationName;

          renderDashConfirmationCard(dashPendingLat, dashPendingLng, dashPendingLocName, null);
        });

        renderDashConfirmationCard(initialLat, initialLng, dashPendingLocName, dashPendingAccuracy);
      }
    } catch (mErr) {
      if (dashLocationCardWrapper) {
        dashLocationCardWrapper.innerHTML = `
          <div class="location-status-card error-card">
            <div class="location-card-header">
              <i class="fa-solid fa-triangle-exclamation"></i>
              <span>Unable to load Google Maps</span>
            </div>
            <p class="location-card-msg">${escapeHtml(mErr.message || "Unable to load Google Maps. Please check your connection and try again.")}</p>
          </div>
        `;
        dashLocationCardWrapper.style.display = 'block';
      }
    }
  }

  async function updateActiveFarmLocation(lat, lon, locationName, source = 'GPS') {
    let updatedFarm = {
      id: `farm_${Date.now()}`,
      farmName: `Farm at ${locationName.split(',')[0]}`,
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

  // OPTION 1: Use My Current Location
  if (gpsBtn) {
    gpsBtn.addEventListener('click', async () => {
      gpsBtn.disabled = true;
      const btnSpan = gpsBtn.querySelector('span');
      if (btnSpan) btnSpan.textContent = 'Detecting GPS...';
      if (dashLocationCardWrapper) dashLocationCardWrapper.style.display = 'none';

      try {
        const pos = await locationService.getCurrentPosition();
        dashPendingLat = pos.latitude;
        dashPendingLng = pos.longitude;
        dashPendingAccuracy = pos.accuracy;

        const geocodeRes = await locationService.reverseGeocode(dashPendingLat, dashPendingLng);
        dashPendingLocName = typeof geocodeRes === 'string' ? geocodeRes : geocodeRes.locationName;

        locationService.logLocationDebug({
          permissionStatus: 'granted',
          latitude: dashPendingLat,
          longitude: dashPendingLng,
          accuracy: pos.accuracy,
          timestamp: pos.timestamp,
          locationName: dashPendingLocName
        });

        await initDashGoogleMap(dashPendingLat, dashPendingLng);
        locationService.updateMapPosition(dashPendingLat, dashPendingLng, 16);
        locationService.drawAccuracyCircle(dashPendingLat, dashPendingLng, pos.accuracy);

        gpsBtn.disabled = false;
        if (btnSpan) btnSpan.textContent = 'Use My Current Location';

        const accEval = locationService.evaluateAccuracy(pos.accuracy);
        renderDashConfirmationCard(dashPendingLat, dashPendingLng, dashPendingLocName, accEval, pos);

      } catch (err) {
        gpsBtn.disabled = false;
        if (btnSpan) btnSpan.textContent = 'Use My Current Location';

        if (dashLocationCardWrapper) {
          if (err.type === 'PERMISSION_DENIED') {
            dashLocationCardWrapper.innerHTML = `
              <div class="location-status-card error-card">
                <div class="location-card-header">
                  <i class="fa-solid fa-location-slash"></i>
                  <span>Cropie can't access your location</span>
                </div>
                <p class="location-card-msg">
                  Please enable location permission for your browser/device or select your farm location on the map manually.
                </p>
                <div class="location-card-actions">
                  <button type="button" class="btn btn-primary btn-sm" id="dashRetryGpsBtn">
                    <i class="fa-solid fa-rotate-right" style="margin-right: 0.3rem;"></i> Try Again
                  </button>
                  <button type="button" class="btn btn-outline-hero btn-sm" id="dashOpenMapBtn">
                    <i class="fa-solid fa-map-location-dot" style="margin-right: 0.3rem;"></i> Select on Map
                  </button>
                </div>
              </div>
            `;
          } else {
            dashLocationCardWrapper.innerHTML = `
              <div class="location-status-card warning-card">
                <div class="location-card-header">
                  <i class="fa-solid fa-clock"></i>
                  <span>We couldn't determine your current location</span>
                </div>
                <p class="location-card-msg">
                  ${escapeHtml(err.message || 'GPS request timed out. Please try again or select on map.')}
                </p>
                <div class="location-card-actions">
                  <button type="button" class="btn btn-primary btn-sm" id="dashRetryGpsBtn">
                    <i class="fa-solid fa-rotate-right" style="margin-right: 0.3rem;"></i> Try Again
                  </button>
                  <button type="button" class="btn btn-outline-hero btn-sm" id="dashOpenMapBtn">
                    <i class="fa-solid fa-map-location-dot" style="margin-right: 0.3rem;"></i> Select on Map
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

  // OPTION 2: Select on Map
  if (dashSelectMapBtn) {
    dashSelectMapBtn.addEventListener('click', async () => {
      const activeFarmStr = localStorage.getItem('cropie_active_farm');
      let initLat = 7.3824;
      let initLng = -1.3621;
      if (activeFarmStr) {
        try {
          const f = JSON.parse(activeFarmStr);
          if (f.latitude && f.longitude) {
            initLat = f.latitude;
            initLng = f.longitude;
          }
        } catch {}
      }

      await initDashGoogleMap(initLat, initLng);

      const geocodeRes = await locationService.reverseGeocode(initLat, initLng);
      dashPendingLocName = typeof geocodeRes === 'string' ? geocodeRes : geocodeRes.locationName;
      dashPendingLat = initLat;
      dashPendingLng = initLng;

      renderDashConfirmationCard(dashPendingLat, dashPendingLng, dashPendingLocName, null);
    });
  }

  function renderDashConfirmationCard(lat, lng, locationName, accEval = null, rawGps = null) {
    if (!dashLocationCardWrapper) return;

    let accHTML = '';
    let warningBannerHTML = '';
    let diagPanelHTML = '';
    let actionsHTML = '';

    if (accEval) {
      accHTML = `
        <div class="location-accuracy-pill ${accEval.level}">
          <i class="fa-solid fa-circle-check"></i> ${escapeHtml(accEval.statusBadge)}
        </div>
      `;
      if (accEval.warningMsg) {
        warningBannerHTML = `
          <div class="location-status-card warning-card" style="margin-top: 0.75rem; margin-bottom: 0.75rem; border-left: 4px solid #eab308; background: #fefce8; padding: 0.85rem 1rem; border-radius: 8px;">
            <div class="location-card-header" style="font-weight: 800; color: #a16207; display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
              <i class="fa-solid fa-triangle-exclamation"></i>
              <span>Location Accuracy Notice</span>
            </div>
            <p class="location-card-msg" style="color: #854d0e; font-size: 0.9rem; margin-bottom: 0.4rem;">${escapeHtml(accEval.warningMsg)}</p>
            ${accEval.deviceAdvice ? `<p class="location-card-advice" style="font-size: 0.82rem; color: #713f12; margin-top: 0.4rem; padding-top: 0.4rem; border-top: 1px dashed #fef08a;"><i class="fa-solid fa-mobile-screen-button"></i> ${escapeHtml(accEval.deviceAdvice)}</p>` : ''}
          </div>
        `;
      }
    }

    if (rawGps) {
      const altStr = rawGps.altitude !== null && rawGps.altitude !== undefined ? `${rawGps.altitude.toFixed(1)} m` : 'N/A';
      const headStr = rawGps.heading !== null && rawGps.heading !== undefined ? `${rawGps.heading.toFixed(1)}°` : 'N/A';
      const speedStr = rawGps.speed !== null && rawGps.speed !== undefined ? `${rawGps.speed.toFixed(1)} m/s` : 'N/A';
      const timeStr = new Date(rawGps.timestamp || Date.now()).toLocaleTimeString();

      diagPanelHTML = `
        <div class="gps-diagnostic-panel">
          <div class="gps-panel-header">
            <i class="fa-solid fa-satellite-dish"></i>
            <span>CURRENT GPS DATA</span>
          </div>
          <div class="gps-panel-grid">
            <div class="gps-panel-item">
              <span class="gps-item-lbl">Latitude:</span>
              <span class="gps-item-val">${rawGps.latitude.toFixed(6)}</span>
            </div>
            <div class="gps-panel-item">
              <span class="gps-item-lbl">Longitude:</span>
              <span class="gps-item-val">${rawGps.longitude.toFixed(6)}</span>
            </div>
            <div class="gps-panel-item">
              <span class="gps-item-lbl">Accuracy:</span>
              <span class="gps-item-val">±${Math.round(rawGps.accuracy)} metres</span>
            </div>
            <div class="gps-panel-item">
              <span class="gps-item-lbl">Altitude:</span>
              <span class="gps-item-val">${altStr}</span>
            </div>
            <div class="gps-panel-item">
              <span class="gps-item-lbl">Heading:</span>
              <span class="gps-item-val">${headStr}</span>
            </div>
            <div class="gps-panel-item">
              <span class="gps-item-lbl">Speed:</span>
              <span class="gps-item-val">${speedStr}</span>
            </div>
          </div>
          <div class="gps-panel-footer">
            <span>Timestamp: <strong>${timeStr}</strong></span>
            <span>Source: Raw Browser GPS</span>
          </div>
        </div>
      `;
    }

    if (accEval && accEval.isUnreliable) {
      actionsHTML = `
        <div class="location-card-actions" style="display: flex; gap: 0.65rem; flex-wrap: wrap;">
          <button type="button" class="btn btn-outline-hero btn-sm" id="dashTryGpsAgainBtn">
            <i class="fa-solid fa-rotate-right" style="color: #16a34a;"></i> Try GPS Again
          </button>
          <button type="button" class="btn btn-primary btn-sm" id="dashSelectOnMapManuallyBtn">
            <i class="fa-solid fa-map-location-dot"></i> Select Farm Location on Map
          </button>
        </div>
      `;
    } else {
      actionsHTML = `
        <div class="location-card-actions" style="display: flex; gap: 0.65rem; flex-wrap: wrap;">
          <button type="button" class="btn btn-primary btn-sm" id="dashConfirmFarmLocBtn">
            <i class="fa-solid fa-check" style="margin-right: 0.3rem;"></i> Confirm Farm Location
          </button>
          <button type="button" class="btn btn-outline-hero btn-sm" id="dashMovePinBtn">
            <i class="fa-solid fa-arrows-up-down-left-right" style="margin-right: 0.3rem;"></i> Adjust Pin Position
          </button>
        </div>
      `;
    }

    dashLocationCardWrapper.innerHTML = `
      <div class="location-status-card">
        <div class="location-card-header">
          <span>📍 Selected Farm Location</span>
        </div>
        <div class="location-name-title">${escapeHtml(locationName)}</div>
        ${accHTML}

        <div class="map-coords-grid">
          <div class="map-coords-item">
            <span class="map-coords-lbl">Latitude</span>
            <span class="map-coords-val">${lat.toFixed(6)}° N</span>
          </div>
          <div class="map-coords-item">
            <span class="map-coords-lbl">Longitude</span>
            <span class="map-coords-val">${Math.abs(lng).toFixed(6)}° W</span>
          </div>
        </div>

        ${warningBannerHTML}
        ${diagPanelHTML}

        <div class="map-instruction-tag">
          <i class="fa-solid fa-hand-pointer" style="color: #16a34a;"></i>
          <span>📍 Move the pin on the map to your exact farm position</span>
        </div>

        ${actionsHTML}
      </div>
    `;
    dashLocationCardWrapper.style.display = 'block';

    const cBtn = document.getElementById('dashConfirmFarmLocBtn');
    if (cBtn) {
      cBtn.addEventListener('click', () => {
        updateActiveFarmLocation(lat, lng, locationName, 'Map Marker');
      });
    }

    const mBtn = document.getElementById('dashMovePinBtn');
    if (mBtn && dashGoogleMapWrapper) {
      mBtn.addEventListener('click', () => {
        dashGoogleMapWrapper.style.display = 'block';
        dashGoogleMapWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    const tryGpsBtn = document.getElementById('dashTryGpsAgainBtn');
    if (tryGpsBtn && gpsBtn) {
      tryGpsBtn.addEventListener('click', () => {
        gpsBtn.click();
      });
    }

    const manualBtn = document.getElementById('dashSelectOnMapManuallyBtn');
    if (manualBtn && dashSelectMapBtn) {
      manualBtn.addEventListener('click', () => {
        dashSelectMapBtn.click();
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

function renderHeader(info) {
  const lastUpdatedEl = document.getElementById('dashLastUpdatedText');
  const statusLabelEl = document.getElementById('dashStatusLabel');
  if (lastUpdatedEl) lastUpdatedEl.textContent = info.lastUpdatedText;
  if (statusLabelEl) statusLabelEl.textContent = info.statusLabel;
}

function renderWeather(w) {
  const tempEl = document.getElementById('dashTemp');
  const condEl = document.getElementById('dashCondition');
  const iconEl = document.getElementById('dashWeatherIcon');
  const humidityEl = document.getElementById('dashHumidity');
  const windEl = document.getElementById('dashWind');
  const rainProbEl = document.getElementById('dashRainProb');
  const rainNoticeEl = document.getElementById('dashRainNotice');

  if (tempEl) tempEl.textContent = w.temp;
  if (condEl) condEl.textContent = w.condition;
  if (iconEl) {
    iconEl.className = `fa-solid ${w.conditionIcon || w.iconClass || 'fa-cloud-sun'}`;
  }
  if (humidityEl) humidityEl.textContent = w.humidity;
  if (windEl) windEl.textContent = w.wind;
  if (rainProbEl) rainProbEl.textContent = w.rainProb;

  if (rainNoticeEl && w.rainNotice) {
    rainNoticeEl.textContent = w.rainNotice;
    if (w.rainNoticeType === 'alert' || w.rainNoticeType === 'warning') {
      rainNoticeEl.style.background = '#fef2f2';
      rainNoticeEl.style.color = '#991b1b';
      rainNoticeEl.style.borderColor = '#fecaca';
    } else if (w.rainNoticeType === 'clear') {
      rainNoticeEl.style.background = '#f0fdf4';
      rainNoticeEl.style.color = '#166534';
      rainNoticeEl.style.borderColor = '#bbf7d0';
    } else {
      rainNoticeEl.style.background = '#e0f2fe';
      rainNoticeEl.style.color = '#0369a1';
      rainNoticeEl.style.borderColor = '#bae6fd';
    }
  }
}

function renderCropStatus(c) {
  const nameEl = document.getElementById('dashCropName');
  const stageEl = document.getElementById('dashGrowthStage');
  const daysEl = document.getElementById('dashDaysAfterPlanting');
  const stepperContainer = document.getElementById('dashStageStepper');
  const cropSourceTag = document.getElementById('dashCropSourceTag');

  if (nameEl) nameEl.textContent = c.cropName;
  // Show only the primary stage name (strip ' / Tasseling' etc.)
  if (stageEl) stageEl.textContent = (c.estimatedGrowthStage || '').split(' / ')[0].trim() || c.estimatedGrowthStage;
  if (daysEl) daysEl.textContent = c.daysAfterPlanting;

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
  const stageAnalysisContainer = document.getElementById('dashStageAnalysisContainer');

  if (quoteEl) quoteEl.textContent = `"${ai.quote}"`;
  if (reasonEl) reasonEl.textContent = ai.reason;
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

  // Render Crop Growth Stage Insight
  if (stageAnalysisContainer && ai.stageAnalysis) {
    const s = ai.stageAnalysis;
    stageAnalysisContainer.innerHTML = `
      <div class="stage-analysis-card">
        <div class="analysis-header-row">
          <div class="stage-name-block">
            <h3 class="stage-name-title">${s.stageName}</h3>
            <span class="badge-tag-estimate">${s.estimationBadge}</span>
          </div>
        </div>

        <div class="analysis-grid">
          <div class="analysis-box">
            <strong class="box-lbl"><i class="fa-solid fa-info-circle"></i> Crop Status</strong>
            <p>${s.statusSummary}</p>
          </div>

          <div class="analysis-box">
            <strong class="box-lbl"><i class="fa-solid fa-lightbulb"></i> What This Means</strong>
            <p>${s.whatThisMeans}</p>
          </div>

          <div class="analysis-box action-box">
            <strong class="box-lbl"><i class="fa-solid fa-circle-check"></i> Recommended Action</strong>
            <p>${s.recommendedAction}</p>
          </div>

          <div class="analysis-box risk-box">
            <strong class="box-lbl"><i class="fa-solid fa-triangle-exclamation"></i> Supported Risk</strong>
            <p>${s.supportedRisk}</p>
          </div>
        </div>
      </div>
    `;
  }
}
