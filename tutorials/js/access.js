(function() {
  'use strict';
  var SUPABASE_URL = 'https://vgipghqejzbcoighktij.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnaXBnaHFlanpiY29pZ2hrdGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjQ2MjIsImV4cCI6MjA5NTMwMDYyMn0.KoDwAZarGWOLwKXOwycA8wuIiIrksvZy7dyaO0-ehUo';

  var path = decodeURIComponent(window.location.pathname);
  var parts = path.split('/');
  var slug = parts[2];

  if (!slug) return;

  var PRODUCT_SLUGS = {
    'html': 'html-tutorial','css':'css-tutorial','Javascript':'javascript-tutorial',
    'nodejs':'nodejs-tutorial','pwa':'pwa-tutorial','react':'react-tutorial',
    'angular':'','ai':'ai-tutorial','genai':'genai-tutorial',
    'ai-agentic-track':'ai-agentic-track-tutorial','ai-engineer-core':'ai-engineer-core-tutorial',
    'claude-vibe-course':'claude-vibe-course-tutorial','maf-fundamentals':'maf-fundamentals-tutorial',
    'foundry-fundamentals':'foundry-fundamentals-tutorial','snowflake-tutorial':'snowflake-tutorial',
    'android':'android-tutorial','python':'python-tutorial','c#':'c-tutorial',
    'c%23':'c-tutorial','dotnetcore':'dotnetcore-tutorial',
    'project-management':'project-management-tutorial','interpersonal-skills':'interpersonal-skills-tutorial',
    'ml':'ml-tutorial','dsa':'dsa-tutorial','dsa-leetcode-roadmap':'dsa-leetcode-roadmap-tutorial',
    'ios':'ios-tutorial','fastapi-tutorial':'fastapi-tutorial',
    'playwright-tutorial':'playwright-tutorial','system-design-fundamentals':'system-design-fundamentals-tutorial',
    'ai-system-design':'ai-system-design-tutorial','ml-system-design':'ml-system-design-tutorial'
  };

  var productSlug = PRODUCT_SLUGS[slug];

  if (productSlug === undefined) return;
  if (productSlug === '') return;

  var MAX_FREE = 5;
  var FREE_VIEWS_KEY = 'tut_free_views';
  var PURCHASED_CACHE_KEY = 'tut_purchased';

  function getFreeViews() {
    try { return parseInt(localStorage.getItem(FREE_VIEWS_KEY) || '0', 10); } catch(e) { return 0; }
  }

  function getPurchasedCache() {
    try { return JSON.parse(localStorage.getItem(PURCHASED_CACHE_KEY) || '{}'); } catch(e) { return {}; }
  }

  function setPurchasedCache(slug, val) {
    try { var c = getPurchasedCache(); c[slug] = val; localStorage.setItem(PURCHASED_CACHE_KEY, JSON.stringify(c)); } catch(e) {}
  }

  var isFreePage = (parts[3] || '').replace(/\.html$/,'');

  function isPreviewPage() {
    var pageNum = parseInt(isFreePage.match(/^\d+/)?.[0] || '99', 10);
    return pageNum <= MAX_FREE;
  }

  var paywallActive = false;
  var paywallEl = null;

  function showPaywall() {
    if (paywallActive) return;
    paywallActive = true;
    paywallEl = document.createElement('div');
    paywallEl.id = 'paywall-overlay';
    paywallEl.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;';
    paywallEl.innerHTML = '<div style="background:#fff;border-radius:16px;padding:40px;max-width:420px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3);margin:20px;">' +
      '<div style="font-size:48px;margin-bottom:12px;">📘</div>' +
      '<h2 style="font-size:1.4rem;font-weight:700;margin-bottom:8px;color:#0f172a;">Unlock Full Tutorial</h2>' +
      '<p style="color:#64748b;margin-bottom:20px;line-height:1.6;font-size:.95rem;">You\'ve reached the free preview limit. Purchase the complete guide to access all chapters and the downloadable PDF.</p>' +
      '<a href="/shop/?buy=' + encodeURIComponent(productSlug) + '" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 36px;border-radius:10px;font-weight:600;font-size:1.05rem;text-decoration:none;margin-bottom:10px;">Buy for ₹500</a>' +
      '<p style="font-size:.8rem;color:#94a3b8;">One-time payment &bull; Lifetime access &bull; PDF included</p>' +
      '</div>';
    document.body.appendChild(paywallEl);
  }

  function removePaywall() {
    if (paywallEl && paywallEl.parentNode) {
      paywallEl.parentNode.removeChild(paywallEl);
    }
    paywallActive = false;
    paywallEl = null;
  }

  var freeViews = getFreeViews();
  var purchasedCache = getPurchasedCache();

  if (purchasedCache[slug] === true) return;

  if (purchasedCache[slug] !== false && window.supabase) {
    var _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    _client.auth.getUser().then(function(resp) {
      var user = resp.data && resp.data.user;
      if (!user) {
        setPurchasedCache(slug, false);
        if (freeViews >= MAX_FREE) showPaywall();
        return;
      }
      return _client.rpc('check_tutorial_purchase', { p_product_slug: productSlug }).then(function(r) {
        var purchased = !!r.data;
        setPurchasedCache(slug, purchased);
        if (purchased) {
          removePaywall();
        } else if (freeViews >= MAX_FREE) {
          showPaywall();
        }
      });
    }).catch(function() {
      if (freeViews >= MAX_FREE) showPaywall();
    });
  } else {
    if (freeViews >= MAX_FREE) showPaywall();
  }

  function countPageView() {
    try {
      var visited = JSON.parse(localStorage.getItem('tut_visited_' + slug) || '[]');
      if (!Array.isArray(visited)) visited = [];
      if (visited.indexOf(isFreePage) === -1) {
        visited.push(isFreePage);
        localStorage.setItem('tut_visited_' + slug, JSON.stringify(visited));
        localStorage.setItem(FREE_VIEWS_KEY, String(visited.length));
      }
    } catch(e) {}
  }

  countPageView();
})();
