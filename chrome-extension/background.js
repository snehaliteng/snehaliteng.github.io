const SUPABASE_URL = 'https://vgipghqejzbcoighktij.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnaXBnaHFlanpiY29pZ2hrdGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjQ2MjIsImV4cCI6MjA5NTMwMDYyMn0.KoDwAZarGWOLwKXOwycA8wuIiIrksvZy7dyaO0-ehUo';

function supabaseHeaders() {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

async function supabaseGet(table, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const resp = await fetch(url, { headers: supabaseHeaders() });
  if (!resp.ok) throw new Error(`Supabase GET error: ${resp.status}`);
  return resp.json();
}

async function supabasePost(table, body) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify(body)
  });
  if (!resp.ok) throw new Error(`Supabase POST error: ${resp.status}`);
  return resp.json();
}

async function supabaseUpsert(table, body) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(),
      'Prefer': 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) throw new Error(`Supabase UPSERT error: ${resp.status}`);
  return resp.json();
}

async function supabaseUpdate(table, body, filter) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${filter}`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: supabaseHeaders(),
    body: JSON.stringify(body)
  });
  if (!resp.ok) throw new Error(`Supabase PATCH error: ${resp.status}`);
  return resp.json();
}

async function supabaseDelete(table, filter) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${filter}`;
  const resp = await fetch(url, {
    method: 'DELETE',
    headers: supabaseHeaders()
  });
  if (!resp.ok) throw new Error(`Supabase DELETE error: ${resp.status}`);
  return resp.json();
}

function extractCompanyFromUrl(url) {
  const hostname = new URL(url).hostname.replace('www.', '');
  const domainMap = {
    'linkedin.com': 'LinkedIn',
    'indeed.com': 'Indeed',
    'glassdoor.com': 'Glassdoor',
    'naukri.com': 'Naukri',
    'wellfound.com': 'Wellfound',
    'angel.co': 'AngelList',
    'dice.com': 'Dice',
    'ziprecruiter.com': 'ZipRecruiter',
    'monster.com': 'Monster',
    'careerbuilder.com': 'CareerBuilder',
    'greenhouse.io': 'Greenhouse',
    'lever.co': 'Lever',
    'workday.com': 'Workday',
    'icims.com': 'iCIMS',
    'smartrecruiters.com': 'SmartRecruiters',
    'ashbyhq.com': 'Ashby',
    'bamboohr.com': 'BambooHR',
    'jazz.co': 'JazzHR',
    'successfactors.com': 'SuccessFactors',
    'myworkdayjobs.com': 'Workday'
  };
  for (const [domain, name] of Object.entries(domainMap)) {
    if (hostname.includes(domain)) return name;
  }
  const parts = hostname.split('.');
  return parts.length > 2 ? parts[parts.length - 2] : parts[0];
}

async function trackJobApplication(tabId, url, title) {
  try {
    const company = extractCompanyFromUrl(url);
    const jobTitle = title || '';

    const existing = await supabaseGet('job_tracker', `url=eq.${encodeURIComponent(url)}&limit=1`);

    if (existing && existing.length > 0) {
      return { status: 'already_tracked', data: existing[0] };
    }

    const result = await supabasePost('job_tracker', {
      company_name: company,
      job_title: jobTitle,
      job_url: url,
      applied: false,
      status: 'visited',
      visited_at: new Date().toISOString()
    });

    return { status: 'tracked', data: result[0] };
  } catch (err) {
    console.error('Track job error:', err);
    return { status: 'error', message: err.message };
  }
}

async function markApplied(url) {
  try {
    const result = await supabaseUpdate('job_tracker',
      { applied: true, status: 'applied', applied_at: new Date().toISOString() },
      `url=eq.${encodeURIComponent(url)}`
    );
    return { status: 'ok', data: result[0] };
  } catch (err) {
    console.error('Mark applied error:', err);
    return { status: 'error', message: err.message };
  }
}

async function getJobStatus(url) {
  try {
    const data = await supabaseGet('job_tracker', `url=eq.${encodeURIComponent(url)}&limit=1`);
    if (data && data.length > 0) {
      return { found: true, data: data[0] };
    }
    return { found: false };
  } catch (err) {
    return { found: false, error: err.message };
  }
}

async function getAllApplications() {
  try {
    const data = await supabaseGet('job_tracker', 'order=visited_at.desc&limit=500');
    return data || [];
  } catch (err) {
    console.error('Get all applications error:', err);
    return [];
  }
}

async function getProfileData() {
  try {
    const data = await supabaseGet('job_profile', 'limit=1');
    return data && data.length > 0 ? data[0] : null;
  } catch (err) {
    return null;
  }
}

async function saveProfileData(profile) {
  try {
    const existing = await getProfileData();
    if (existing) {
      return await supabaseUpdate('job_profile', profile, `id=eq.${existing.id}`);
    }
    return await supabasePost('job_profile', profile);
  } catch (err) {
    return { error: err.message };
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'trackJob') {
    trackJobApplication(request.tabId, request.url, request.title)
      .then(result => sendResponse(result));
    return true;
  }

  if (request.action === 'markApplied') {
    markApplied(request.url)
      .then(result => sendResponse(result));
    return true;
  }

  if (request.action === 'getStatus') {
    getJobStatus(request.url)
      .then(result => sendResponse(result));
    return true;
  }

  if (request.action === 'getAllApplications') {
    getAllApplications()
      .then(data => sendResponse({ data }));
    return true;
  }

  if (request.action === 'getProfile') {
    getProfileData()
      .then(profile => sendResponse({ profile }));
    return true;
  }

  if (request.action === 'saveProfile') {
    saveProfileData(request.profile)
      .then(result => sendResponse({ result }));
    return true;
  }

  if (request.action === 'fillForm') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'autofill',
          profile: request.profile
        }, response => sendResponse(response));
      }
    });
    return true;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const trackingSites = [
      'linkedin.com/jobs', 'indeed.com', 'glassdoor.com',
      'greenhouse.io', 'lever.co', 'workday.com', 'naukri.com',
      'ashbyhq.com', 'smartrecruiters.com', 'icims.com',
      'bamboohr.com', 'myworkdayjobs.com'
    ];

    if (trackingSites.some(site => tab.url.includes(site))) {
      trackJobApplication(tabId, tab.url, tab.title);
    }
  }
});
