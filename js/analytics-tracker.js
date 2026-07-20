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
      var raw = localStorage.getItem('sb-' + SUPABASE_URL.split('//')[1] + '-auth-token');
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      var user = parsed?.currentSession?.user;
      if (user?.email) return { email: user.email, id: user.id };
    } catch (e) {}
    return null;
  }

  function send(data) {
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(data),
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  }

  function track() {
    var user = getLoggedUser();
    fetchGeo().then(function (geo) {
      send({
        session_id: getSid(),
        page_path: location.pathname + location.search,
        page_title: document.title,
        referrer: document.referrer || null,
        device_type: detectDevice(),
        browser: detectBrowser(),
        os: detectOS(),
        screen_width: window.innerWidth,
        event_type: 'pageview',
        user_email: user ? user.email : null,
        user_id: user ? user.id : null,
        ip_address: geo.ip || null,
        country: geo.country || null
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', track);
  } else {
    track();
  }

  window.addEventListener('beforeunload', function () {
    var user = getLoggedUser();
    var geo = getCachedGeo();
    send({
      session_id: getSid(),
      page_path: location.pathname + location.search,
      page_title: document.title,
      device_type: detectDevice(),
      browser: detectBrowser(),
      os: detectOS(),
      screen_width: window.innerWidth,
      event_type: 'exit',
      user_email: user ? user.email : null,
      user_id: user ? user.id : null,
      ip_address: geo ? geo.ip : null,
      country: geo ? geo.country : null
    });
  });
})();
