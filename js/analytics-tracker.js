/**
 * SnehalITEng Analytics Tracker — lightweight, drop-in script.
 * Usage: <script src="/js/analytics-tracker.js" defer></script>
 * Detects logged-in user, IP, and country automatically.
 */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://vgipghqejzbcoighktij.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnaXBnaHFlanpiY29pZ2hrdGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjQ2MjIsImV4cCI6MjA5NTMwMDYyMn0.KoDwAZarGWOLwKXOwycA8wuIiIrksvZy7dyaO0-ehUo';
  var ENDPOINT = SUPABASE_URL + '/rest/v1/site_analytics';
  var HEADERS = { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Prefer': 'resolution=merge-duplicates' };
  var USER_KEY = '_siteng_user';

  window.sitengSetUser = function (email, id) {
    if (email) {
      localStorage.setItem(USER_KEY, JSON.stringify({ email: email, id: id || null }));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  };

  function getSid() {
    var s = sessionStorage.getItem('_sid');
    if (!s) { s = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); sessionStorage.setItem('_sid', s); }
    return s;
  }

  function detectBrowser() {
    var u = navigator.userAgent;
    if (u.includes('Firefox')) return 'Firefox';
    if (u.includes('Edg')) return 'Edge';
    if (u.includes('Chrome')) return 'Chrome';
    if (u.includes('Safari') && !u.includes('Chrome')) return 'Safari';
    if (u.includes('Opera') || u.includes('OPR')) return 'Opera';
    return 'Other';
  }

  function detectOS() {
    var u = navigator.userAgent;
    if (u.includes('Win')) return 'Windows';
    if (u.includes('Mac')) return 'MacOS';
    if (u.includes('Linux') && !u.includes('Android')) return 'Linux';
    if (u.includes('Android')) return 'Android';
    if (u.includes('iPhone') || u.includes('iPad')) return 'iOS';
    return 'Other';
  }

  function detectDevice() {
    var w = window.innerWidth;
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'mobile';
    if (w <= 768) return 'mobile';
    if (w <= 1024) return 'tablet';
    return 'desktop';
  }

  function getCachedGeo() {
    try {
      var cached = sessionStorage.getItem('_geo');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return null;
  }

  function fetchGeo() {
    var cached = getCachedGeo();
    if (cached && cached._ts && Date.now() - cached._ts < 3600000) {
      return Promise.resolve(cached);
    }
    return fetch('https://ipapi.co/json/')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var geo = { ip: d.ip || null, country: d.country_name || null, city: d.city || null, region: d.region || null, _ts: Date.now() };
        try { sessionStorage.setItem('_geo', JSON.stringify(geo)); } catch (e) {}
        return geo;
      })
      .catch(function () { return { ip: null, country: null, city: null, region: null }; });
  }

  function getLoggedUser() {
    try {
      var saved = localStorage.getItem(USER_KEY);
      if (saved) {
        var u = JSON.parse(saved);
        if (u && u.email) return { email: u.email, id: u.id || null };
      }
    } catch (e) {}
    try {
      var projectRef = SUPABASE_URL.split('//')[1].split('.')[0];
      var raw = localStorage.getItem('sb-' + projectRef + '-auth-token');
      if (raw) {
        var parsed = JSON.parse(raw);
        var user = (parsed && parsed.currentSession && parsed.currentSession.user) ||
                   (parsed && parsed.session && parsed.session.user) ||
                   (parsed && parsed.user);
        if (user && user.email) {
          window.sitengSetUser(user.email, user.id);
          return { email: user.email, id: user.id };
        }
      }
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('auth-token') !== -1) {
          try {
            var s = JSON.parse(localStorage.getItem(k));
            var u2 = (s && s.currentSession && s.currentSession.user) ||
                     (s && s.session && s.session.user) ||
                     (s && s.user);
            if (u2 && u2.email) {
              window.sitengSetUser(u2.email, u2.id);
              return { email: u2.email, id: u2.id };
            }
          } catch (e2) {}
        }
      }
    } catch (e) {}
    return null;
  }

  var EXCLUDED_EMAILS = ['snehaliteng@gmail.com'];

  function buildPayload(geo, user, eventType) {
    return {
      session_id: getSid(),
      page_path: location.pathname + location.search,
      page_title: document.title,
      referrer: eventType === 'pageview' ? (document.referrer || null) : null,
      device_type: detectDevice(),
      browser: detectBrowser(),
      os: detectOS(),
      screen_width: window.innerWidth,
      event_type: eventType,
      user_email: user ? user.email : null,
      user_id: user ? user.id : null,
      ip_address: geo ? geo.ip : null,
      country: geo ? geo.country : null
    };
  }

  function send(data) {
    if (data.user_email && EXCLUDED_EMAILS.indexOf(data.user_email) !== -1) return;
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(data),
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  }

  function doTrack(user, eventType) {
    fetchGeo().then(function (geo) {
      send(buildPayload(geo, user, eventType));
    });
  }

  var EXCLUDED_PAGES = ['/admin/analytics.html'];

  var LOGIN_PAGES = [
    '/blog/login.html', '/blog/signup.html',
    '/shop/login.html', '/shop/signup.html',
    '/admin/index.html',
    '/allinone/app/index.html'
  ];

  var NO_AUTH_PAGES = [
    '/', '/index.html', '/about.html', '/contact.html', '/careers.html',
    '/portfolio.html', '/apps.html', '/services.html',
    '/pomodoro/'
  ];

  var LOGIN_MAP = {
    '/qna/': '/qna/index.html',
    '/todo/': '/todo/index.html',
    '/blog/': '/blog/login.html',
    '/shop/': '/shop/login.html',
    '/ecommerce/': '/ecommerce/index.html',
    '/eduErp/': '/eduErp/index.html',
    '/allinone/app/': '/allinone/app/index.html',
    '/society management/': '/society management/index.html',
    '/ZippyRide/web/': '/ZippyRide/web/index.html'
  };

  function shouldShowLoginPrompt() {
    var p = location.pathname;
    if (LOGIN_PAGES.indexOf(p) !== -1) return false;
    for (var i = 0; i < NO_AUTH_PAGES.length; i++) {
      if (p === NO_AUTH_PAGES[i]) return false;
    }
    return true;
  }

  var BASE_PATH = (function () {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].getAttribute('src') || '';
      if (src.indexOf('analytics-tracker.js') !== -1) {
        return src.replace(/js\/analytics-tracker\.js.*/, '');
      }
    }
    return '/';
  })();

  function getLoginUrl() {
    var p = location.pathname;
    var keys = Object.keys(LOGIN_MAP);
    for (var i = 0; i < keys.length; i++) {
      if (p.indexOf(keys[i]) === 0) return BASE_PATH + LOGIN_MAP[keys[i]].replace(/^\//, '');
    }
    return BASE_PATH + 'blog/login.html';
  }

  function showLoginBanner() {
    if (document.getElementById('siteng-login-banner')) return;
    if (!document.body) { setTimeout(showLoginBanner, 50); return; }
    var banner = document.createElement('div');
    banner.id = 'siteng-login-banner';
    banner.style.cssText = 'position:fixed !important;top:0 !important;left:0 !important;right:0 !important;z-index:2147483647 !important;background:#1e293b !important;color:#fff !important;padding:12px 20px !important;display:flex !important;align-items:center !important;justify-content:center !important;gap:12px !important;font-family:Inter,system-ui,sans-serif !important;font-size:14px !important;box-shadow:0 2px 8px rgba(0,0,0,.2) !important;margin:0 !important;border:none !important;';
    banner.innerHTML = '<span>Log in to access all features</span>' +
      '<a href="' + getLoginUrl() + '" style="background:#3b82f6;color:#fff;padding:6px 16px;border-radius:6px;text-decoration:none;font-weight:600;font-size:13px;">Login</a>';
    document.body.appendChild(banner);
    document.body.style.paddingTop = '50px';
  }

  function tryShowBanner() {
    if (EXCLUDED_PAGES.indexOf(location.pathname) !== -1) return;
    var user = getLoggedUser();
    doTrack(user, 'pageview');
    if (!user && shouldShowLoginPrompt()) {
      showLoginBanner();
    }
  }

  if (document.body) {
    tryShowBanner();
  } else {
    document.addEventListener('DOMContentLoaded', tryShowBanner);
  }

  window.addEventListener('beforeunload', function () {
    if (EXCLUDED_PAGES.indexOf(location.pathname) !== -1) return;
    var user = getLoggedUser();
    send(buildPayload(getCachedGeo(), user, 'exit'));
  });
})();
