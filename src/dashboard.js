// CROPIE — Live Dashboard UI Controller Module
import { CropieDataService } from './dashboard-data.js';
import { CropieAuthService } from './auth.js';
import { CropieWeatherService } from './weather-service.js';

document.addEventListener('DOMContentLoaded', async () => {
  const auth = new CropieAuthService();
  const dataService = new CropieDataService();
  const weatherService = new CropieWeatherService();
  initDashboardApp(dataService, auth, weatherService);
  await initUserSessionNav(auth);
  await initMobileDrawer(auth);
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

window.toggleMobileDrawer = function(forceOpen = null) {
  const drawerOverlay = document.getElementById('mobileDrawerOverlay');
  if (!drawerOverlay) return;

  const isOpen = drawerOverlay.classList.contains('open');
  const shouldOpen = forceOpen !== null ? forceOpen : !isOpen;

  if (shouldOpen) {
    drawerOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  } else {
    drawerOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }
};

function initMobileDrawer(auth) {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const drawerOverlay = document.getElementById('mobileDrawerOverlay');
  const drawerClose = document.getElementById('mobileDrawerClose');
  const mobileDrawerUser = document.getElementById('mobileDrawerUser');

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.toggleMobileDrawer(true);
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
      link.addEventListener('click', () => {
        window.toggleMobileDrawer(false);
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

function initDashboardApp(dataService, auth, weatherService) {
  const currentUser = auth.getCurrentUser();
  const dashNavActions = document.getElementById('dashNavActions');

  if (dashNavActions && currentUser) {
    dashNavActions.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <span class="badge-tag-mini" style="background: #f0fdf4; color: #166534; border-color: #bbf7d0;">
          <i class="fa-solid fa-circle-user" style="margin-right: 0.25rem;"></i> ${currentUser.fullName}
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

  loadAndRenderData();

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

  // Location Search Handler
  if (locationForm && locationInput) {
    locationForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const query = locationInput.value.trim();
      if (!query) return;

      const btn = locationForm.querySelector('button');
      if (btn) btn.disabled = true;
      try {
        const geo = await weatherService.geocodeLocation(query);
        if (geo) {
          const newFarm = {
            id: `farm_${Date.now()}`,
            farmName: `Farm at ${geo.name.split(',')[0]}`,
            locationName: geo.name,
            latitude: geo.lat,
            longitude: geo.lon,
            crop: 'maize',
            plantingDate: '2026-06-10'
          };
          await loadAndRenderData(newFarm);
        }
      } catch (gErr) {
        console.warn('Search location error:', gErr);
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  // GPS Auto-Detect Handler
  if (gpsBtn) {
    gpsBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
      }

      gpsBtn.disabled = true;
      gpsBtn.querySelector('span').textContent = 'Detecting GPS...';

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          
          let locName = `Laterbiokorshie, Accra, Ghana`;
          try {
            const revUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
            const res = await fetch(revUrl);
            if (res.ok) {
              const rData = await res.json();
              const addr = rData.address || {};
              const suburb = addr.suburb || addr.neighbourhood || addr.quarter || addr.residential || '';
              const city = addr.city || addr.town || addr.village || addr.county || 'Accra';
              const country = addr.country || 'Ghana';
              locName = suburb ? `${suburb}, ${city}, ${country}` : `${city}, ${country}`;
            }
          } catch {
            const geo = await weatherService.geocodeLocation(`${lat.toFixed(4)},${lon.toFixed(4)}`);
            if (geo && geo.name) locName = geo.name;
          }

          const gpsFarm = {
            id: `farm_gps_${Date.now()}`,
            farmName: `My Local Farm`,
            locationName: locName,
            latitude: lat,
            longitude: lon,
            crop: 'maize',
            plantingDate: '2026-06-10'
          };

          await loadAndRenderData(gpsFarm);
          gpsBtn.disabled = false;
          gpsBtn.querySelector('span').textContent = 'Use My Current Location';
        },
        (error) => {
          console.warn('GPS detection error:', error);
          alert('Could not detect location. Please type your city in the search box.');
          gpsBtn.disabled = false;
          gpsBtn.querySelector('span').textContent = 'Use My Current Location';
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
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
  const weatherSourceTag = document.getElementById('dashWeatherSourceTag');

  if (tempEl) tempEl.textContent = w.temp;
  if (condEl) condEl.textContent = w.condition;
  if (iconEl) {
    iconEl.className = `fa-solid ${w.iconClass}`;
    iconEl.style.color = w.iconColor;
  }
  if (humidityEl) humidityEl.textContent = w.humidity;
  if (windEl) windEl.textContent = w.windSpeed;
  if (rainProbEl) rainProbEl.textContent = w.rainProb;
  if (rainNoticeEl) rainNoticeEl.textContent = w.rainNotice;
  if (weatherSourceTag) weatherSourceTag.textContent = `Source: ${w.source}`;
}

function renderCropStatus(c) {
  const nameEl = document.getElementById('dashCropName');
  const stageEl = document.getElementById('dashGrowthStage');
  const daysEl = document.getElementById('dashDaysAfterPlanting');
  const stepperContainer = document.getElementById('dashStageStepper');
  const cropSourceTag = document.getElementById('dashCropSourceTag');

  if (nameEl) nameEl.textContent = c.cropName;
  if (stageEl) stageEl.textContent = c.estimatedGrowthStage;
  if (daysEl) daysEl.textContent = c.daysAfterPlanting;
  if (cropSourceTag) cropSourceTag.textContent = `Source: ${c.source}`;

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
