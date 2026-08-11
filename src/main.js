import { CropieAuthService } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
  initHeaderScroll();
  initWhyDrawer();
  initFaqAccordion();
  initOnboardForm();
  initUserSessionNav();
  initMobileDrawer();
});

function initUserSessionNav() {
  // Keep homepage top navbar clean with standard Sign In link
  return;
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

function initMobileDrawer() {
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
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        
        // 1. Immediately close drawer overlay completely
        window.toggleMobileDrawer(false);

        // 2. Smooth scroll to section target if link has hash anchor
        if (href && href.includes('#')) {
          const hashIndex = href.indexOf('#');
          const hash = href.substring(hashIndex);
          const targetEl = document.querySelector(hash);
          if (targetEl) {
            e.preventDefault();
            setTimeout(() => {
              targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 150);
          }
        }
      });
    });
  }

  if (mobileDrawerUser) {
    const auth = new CropieAuthService();
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

/* ==========================================================================
   0. Sticky Header Scroll Transition
   ========================================================================== */
function initHeaderScroll() {
  const header = document.getElementById('header');
  if (!header) return;

  const handleScroll = () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();
}

/* ==========================================================================
   1. "Why am I seeing this?" Interactive Accordion Drawer
   ========================================================================== */
function initWhyDrawer() {
  const whyToggleBtn = document.getElementById('whyToggleBtn');
  const whyDrawer = document.getElementById('whyDrawer');
  const whyChevron = document.getElementById('whyChevron');

  if (!whyToggleBtn || !whyDrawer) return;

  whyToggleBtn.addEventListener('click', () => {
    const isOpen = whyDrawer.classList.contains('open');

    if (isOpen) {
      whyDrawer.classList.remove('open');
      whyChevron.style.transform = 'rotate(0deg)';
      whyToggleBtn.setAttribute('aria-expanded', 'false');
    } else {
      whyDrawer.classList.add('open');
      whyChevron.style.transform = 'rotate(180deg)';
      whyToggleBtn.setAttribute('aria-expanded', 'true');
    }
  });
}

/* ==========================================================================
   2. Personalized Growth Stage Simulator
   ========================================================================== */
const stageData = {
  germination: {
    title: 'Germination Stage (Days 1–14)',
    badge: 'Critical Moisture Monitoring',
    desc: 'Seeds are sprouting below the surface. Uniform soil moisture without waterlogging is critical to prevent seed rot and ensure high germination rate.',
    optWindow: 'Keep soil moist at 4-5cm depth. Inspect for cutworms and birds early morning.',
    riskWarning: 'Crusted dry soil blocks seedling emergence. Irrigate if rain fails 3 days in a row.',
    weather: { temp: '28°C', rain: '45%', humidity: '82%', wind: '8 km/h' },
    priorities: [
      { text: 'Soil moisture check', status: 'recommended', dot: 'green', label: 'Recommended' },
      { text: 'Pre-emergence herbicide', status: 'caution', dot: 'yellow', label: 'Review timing' },
      { text: 'Deep tillage', status: 'check', dot: 'red', label: 'Not advised' }
    ],
    whyRules: [
      '<strong>Soil moisture check (Recommended):</strong> Germination requires consistent 70-80% soil humidity for root radicle expansion.',
      '<strong>Pre-emergence herbicide (Review timing):</strong> 45% rain chance can activate residual herbicide, but heavy downpour risks leaching.',
      '<strong>Deep tillage (Not advised):</strong> Tilling after seeding disturbs germinating seeds and reduces stand density.'
    ]
  },
  vegetative: {
    title: 'Vegetative Growth Stage (Days 15–45)',
    badge: 'High Nitrogen Demand',
    desc: 'Rapid stem and leaf expansion occurs. Water stress or misplaced chemical application now causes permanent canopy and yield loss.',
    optWindow: 'Apply top-dressing N-P-K fertilizer when soil moisture is moderate.',
    riskWarning: 'Fall Armyworm pests actively target young maize leaves during hot humid periods.',
    weather: { temp: '29°C', rain: '72%', humidity: '78%', wind: '14 km/h' },
    priorities: [
      { text: 'Field inspection for pests', status: 'recommended', dot: 'green', label: 'Recommended' },
      { text: 'Fertilizer application', status: 'caution', dot: 'yellow', label: 'Review timing' },
      { text: 'Chemical spraying', status: 'check', dot: 'red', label: 'Check conditions' }
    ],
    whyRules: [
      '<strong>Field Inspection (Recommended):</strong> Rain probability at 72% with 78% humidity during early vegetative stage creates ideal microclimate for Fall Armyworm larva emergence.',
      '<strong>Fertilizer Application (Review Timing):</strong> High 72% rain probability in the afternoon means applied granular N-P-K fertilizer will likely wash away before root absorption.',
      '<strong>Spraying (Check Conditions):</strong> Rain within 3-4 hours of chemical application strips crop protection product, rendering it ineffective.'
    ]
  },
  flowering: {
    title: 'Flowering & Tasseling Stage (Days 46–70)',
    badge: 'Peak Moisture Sensitivity',
    desc: 'Pollen grain shed and silk pollination determine cob size. Water stress during this 2-week window can reduce overall yield by up to 50%.',
    optWindow: 'Ensure adequate irrigation/rain catch. Scout for silk beetles and stem borers.',
    riskWarning: 'High winds over 25 km/h risk lodging (knocking down tall flowering stalks).',
    weather: { temp: '31°C', rain: '30%', humidity: '65%', wind: '11 km/h' },
    priorities: [
      { text: 'Pollen & Silk health check', status: 'recommended', dot: 'green', label: 'Recommended' },
      { text: 'Fungicide spot treatment', status: 'recommended', dot: 'green', label: 'Recommended' },
      { text: 'Heavy weed cultivation', status: 'check', dot: 'red', label: 'Avoid root damage' }
    ],
    whyRules: [
      '<strong>Pollen & Silk Health (Recommended):</strong> 30% rain chance with warm 31°C weather provides ideal conditions for successful pollination.',
      '<strong>Fungicide Spot Treatment (Recommended):</strong> Dry window permits full chemical absorption to protect developing ears from leaf blight.',
      '<strong>Avoid Root Damage:</strong> Deep weeding during flowering damages shallow feeder roots needed for ear grain filling.'
    ]
  },
  harvesting: {
    title: 'Harvesting & Drying Stage (Days 71+)',
    badge: 'Dry Down Phase',
    desc: 'Maize cobs reach physiological maturity. Lower moisture content in grain (<15%) prevents post-harvest aflatoxin mold.',
    optWindow: 'Harvest on clear dry afternoons. Husk cobs and sun-dry on elevated tarps.',
    riskWarning: 'Late rains promote cob mold and ear rot if left unharvested in field.',
    weather: { temp: '32°C', rain: '10%', humidity: '52%', wind: '16 km/h' },
    priorities: [
      { text: 'Grain harvesting & cob picking', status: 'recommended', dot: 'green', label: 'Optimal today' },
      { text: 'Tarpaulin sun-drying setup', status: 'recommended', dot: 'green', label: 'Recommended' },
      { text: 'Field irrigation', status: 'check', dot: 'red', label: 'Stop irrigation' }
    ],
    whyRules: [
      '<strong>Grain Harvesting (Optimal Today):</strong> Low 10% rain chance and sunny 32°C weather ensures rapid field dry-down.',
      '<strong>Sun-Drying Setup (Recommended):</strong> Low humidity speeds up cob drying to reach safe storage moisture levels.',
      '<strong>Stop Irrigation:</strong> Adding water now increases grain moisture and invites mold growth.'
    ]
  }
};

function initStageSimulator() {
  const stageBtns = document.querySelectorAll('.stage-tab-btn');
  const simTitle = document.getElementById('simStageTitle');
  const simBadge = document.getElementById('simStageBadge');
  const simDesc = document.getElementById('simStageDesc');
  const simOpt = document.getElementById('simOptWindow');
  const simRisk = document.getElementById('simRiskWarning');
  const currentStageBadge = document.getElementById('currentStageBadge');

  if (!stageBtns.length) return;

  stageBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      stageBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const stageKey = btn.dataset.stage;
      const data = stageData[stageKey];

      if (!data) return;

      // Update Simulator Display Card
      simTitle.textContent = data.title;
      simBadge.textContent = data.badge;
      simDesc.textContent = data.desc;
      simOpt.textContent = data.optWindow;
      simRisk.textContent = data.riskWarning;

      // Update Dashboard Topbar Badge
      if (currentStageBadge) {
        currentStageBadge.textContent = `🌱 ${data.title.split(' ')[0]} stage`;
      }

      // Update Dashboard Live Metrics & Priorities
      updateDashboardState(data);
    });
  });
}

function updateDashboardState(data) {
  const tempVal = document.getElementById('tempVal');
  const rainVal = document.getElementById('rainVal');
  const humidityVal = document.getElementById('humidityVal');
  const windVal = document.getElementById('windVal');
  const whyRuleList = document.getElementById('whyRuleList');

  if (tempVal) tempVal.textContent = data.weather.temp;
  if (rainVal) rainVal.textContent = data.weather.rain;
  if (humidityVal) humidityVal.textContent = data.weather.humidity;
  if (windVal) windVal.textContent = data.weather.wind;

  // Update Priorities Items
  data.priorities.forEach((prio, index) => {
    const item = document.getElementById(`prioItem${index + 1}`);
    if (item) {
      item.querySelector('.priority-text').textContent = prio.text;
      const dot = item.querySelector('.status-dot');
      dot.className = `status-dot ${prio.dot}`;

      const badge = item.querySelector('.status-badge');
      badge.textContent = prio.label;
      badge.className = `status-badge ${prio.status}`;
    }
  });

  // Update Why Rules
  if (whyRuleList && data.whyRules) {
    whyRuleList.innerHTML = data.whyRules.map(rule => `
      <li>
        <i class="fa-solid fa-circle-info" style="color: #16a34a; margin-top: 0.2rem;"></i>
        <div>${rule}</div>
      </li>
    `).join('');
  }
}

/* ==========================================================================
   3. FAQ Accordion Logic
   ========================================================================== */
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');
  if (!faqItems.length) return;

  let initialScrollY = 0;

  const closeAll = () => {
    faqItems.forEach(item => item.classList.remove('open'));
  };

  const handleScrollAutoClose = () => {
    if (Math.abs(window.scrollY - initialScrollY) > 60) {
      closeAll();
      window.removeEventListener('scroll', handleScrollAutoClose);
    }
  };

  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question');
    if (!questionBtn) return;

    questionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = item.classList.contains('open');

      closeAll();
      window.removeEventListener('scroll', handleScrollAutoClose);

      if (!isOpen) {
        item.classList.add('open');
        initialScrollY = window.scrollY;
        window.addEventListener('scroll', handleScrollAutoClose, { passive: true });
      }
    });
  });
}

/* ==========================================================================
   4. Onboard Form Handler
   ========================================================================== */
function initOnboardForm() {
  const onboardForm = document.getElementById('onboardForm');
  const successMsg = document.getElementById('formSuccessMsg');

  if (!onboardForm) return;

  onboardForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const contactInput = document.getElementById('contactInput');
    if (contactInput.value.trim()) {
      successMsg.style.display = 'block';
      onboardForm.reset();
      setTimeout(() => {
        successMsg.style.display = 'none';
      }, 5000);
    }
  });
}
