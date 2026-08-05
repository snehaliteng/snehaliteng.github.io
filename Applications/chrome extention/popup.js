let currentPageInfo = null;
let allApplications = [];

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${name}"]`).classList.add('active');
  document.getElementById(`panel-${name}`).classList.add('active');

  if (name === 'history') loadHistory();
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function sendMessage(msg, timeoutMs = 15000) {
  return new Promise(resolve => {
    let settled = false;
    const finish = value => { if (!settled) { settled = true; resolve(value); } };
    chrome.runtime.sendMessage(msg, response => {
      if (chrome.runtime.lastError) { finish(undefined); return; }
      finish(response);
    });
    setTimeout(() => finish(undefined), timeoutMs);
  });
}

function getInitials(str) {
  if (!str) return '?';
  return str.split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

async function loadCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      document.getElementById('page-loading').style.display = 'none';
      document.getElementById('page-no-job').style.display = 'block';
      return;
    }

    let pageInfo;
    try {
      pageInfo = await sendMessage({ action: 'getPageInfo' });
    } catch (e) {
      pageInfo = {
        company: new URL(tab.url).hostname.replace('www.', ''),
        jobTitle: tab.title,
        hasForm: false,
        url: tab.url
      };
    }

    if (!pageInfo) pageInfo = {};
    pageInfo.url = pageInfo.url || tab.url;

    currentPageInfo = pageInfo;

    const statusResult = await sendMessage({ action: 'getStatus', url: tab.url });
    const jobData = statusResult && statusResult.found ? statusResult.data : null;

    document.getElementById('page-loading').style.display = 'none';

    const isJobPage = jobData || pageInfo.hasForm ||
      /job|career|apply|hiring|position|vacancy/i.test(tab.title + ' ' + tab.url);

    if (isJobPage) {
      document.getElementById('page-info').style.display = 'block';
      document.getElementById('company-name').textContent = pageInfo.company || jobData?.company_name || '-';
      document.getElementById('job-title').textContent = pageInfo.jobTitle || jobData?.job_title || '-';
      document.getElementById('job-location').textContent = pageInfo.location || jobData?.location || '-';
      document.getElementById('job-salary').textContent = pageInfo.salary || jobData?.salary_expected || '-';

      const alertEl = document.getElementById('company-alert');
      if (alertEl) alertEl.style.display = 'none';
      const company = pageInfo.company || jobData?.company_name || '';
      if (company && alertEl) {
        const check = await sendMessage({ action: 'checkCompanyApplied', company });
        if (check && check.found) {
          const prev = (check.data && check.data[0]) || null;
          const when = prev && prev.visited_at
            ? ' on ' + new Date(prev.visited_at).toLocaleDateString() : '';
          alertEl.textContent = `You already applied to ${company} within the last month${when}.`;
          alertEl.style.display = 'block';
        }
      }

      const details = {
        company: pageInfo.company || jobData?.company_name || '',
        jobTitle: pageInfo.jobTitle || jobData?.job_title || '',
        location: pageInfo.location || jobData?.location || '',
        salary: pageInfo.salary || jobData?.salary_expected || '',
        jobType: pageInfo.jobType || jobData?.job_type || '',
        notes: jobData?.notes || ''
      };
      populateDetailsForm(details);
      document.getElementById('btn-edit-details').style.display = 'block';

      const statusEl = document.getElementById('app-status');
      if (jobData) {
        if (jobData.applied) {
          statusEl.innerHTML = '<span class="badge badge-applied">Applied</span>';
          document.getElementById('btn-mark-applied').style.display = 'none';
        } else {
          statusEl.innerHTML = '<span class="badge badge-visited">Visited</span>';
          document.getElementById('btn-mark-applied').style.display = 'block';
        }
      } else {
        statusEl.innerHTML = '<span class="badge badge-error">Not Tracked</span>';
        document.getElementById('btn-add-manual').style.display = 'block';
        document.getElementById('btn-mark-applied').style.display = 'none';
      }

      document.getElementById('form-detected').textContent = pageInfo.hasForm ? 'Yes' : 'No';

      if (pageInfo.hasForm || jobData) {
        document.getElementById('btn-fill').style.display = 'block';
        document.getElementById('btn-highlight').style.display = 'block';
      }
    } else {
      document.getElementById('page-no-job').style.display = 'block';
    }
  } catch (err) {
    document.getElementById('page-loading').innerHTML =
      `<p style="color:#991b1b;">Error: ${err.message}</p>`;
  }
}

async function markApplied() {
  if (!currentPageInfo) return;
  if (!(await requireLogin())) return;
  const btn = document.getElementById('btn-mark-applied');
  btn.disabled = true;
  btn.textContent = 'Marking...';
  try {
    const result = await sendMessage({ action: 'markApplied', url: currentPageInfo.url });
    if (result && result.status === 'ok') {
      if (result.data) {
        showToast('Marked as applied!');
      } else {
        showToast('Job not found in tracker — track it first');
      }
      await loadCurrentPage();
    } else {
      showToast('Error marking as applied: ' + ((result && result.message) || 'no response'));
    }
  } catch (err) {
    showToast('Error marking as applied: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Mark as Applied';
  }
}

async function fillForm() {
  if (!(await requireLogin())) return;
  const profile = await getStoredProfile();
  if (!profile) {
    showToast('Please save your profile first');
    switchTab('profile');
    return;
  }

  const mapProfile = {
    firstName: profile.fullName ? profile.fullName.split(' ')[0] : '',
    lastName: profile.fullName ? profile.fullName.split(' ').slice(1).join(' ') : '',
    fullName: profile.fullName || '',
    email: profile.email || '',
    phone: profile.phone || '',
    linkedIn: profile.linkedIn || '',
    resumeUrl: profile.resumeUrl || '',
    coverLetter: profile.coverLetter || '',
    website: profile.website || ''
  };

  const result = await sendMessage({ action: 'fillForm', profile: mapProfile });
  if (result && result.success) {
    showToast(`Filled ${result.filledCount} fields`);
  } else {
    showToast('No matching fields found on this page');
  }
}

async function highlightFields() {
  const result = await sendMessage({ action: 'highlight' });
  if (result && result.success) {
    showToast(`Found ${result.fieldCount} fillable fields`);
  } else {
    showToast('No matching fields found');
  }
}

async function addManualEntry() {
  if (!currentPageInfo) return;
  if (!(await requireLogin())) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const result = await sendMessage({
    action: 'trackJob',
    url: currentPageInfo.url,
    title: currentPageInfo.jobTitle || tab.title
  });

  if (result && (result.status === 'tracked' || result.status === 'already_tracked')) {
    showToast('Page added to tracking');
    loadCurrentPage();
  } else {
    showToast('Error adding page');
  }
}

async function loadHistory() {
  document.getElementById('history-loading').style.display = 'block';
  const auth = await sendMessage({ action: 'getAuthStatus' });
  document.getElementById('history-loading').style.display = 'none';

  if (!auth || auth.status !== 'logged_in') {
    document.getElementById('history-list').innerHTML =
      '<div class="empty-state"><p>Login to view your tracked applications.</p></div>';
    return;
  }

  const result = await sendMessage({ action: 'getAllApplications' });
  allApplications = (result && result.data) || [];
  document.getElementById('history-count').textContent = allApplications.length;

  const list = document.getElementById('history-list');
  if (allApplications.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No tracked applications yet.</p></div>';
    return;
  }

  list.innerHTML = allApplications.map(app => {
    const badge = app.applied ?
      '<span class="badge badge-applied list-badge">Applied</span>' :
      '<span class="badge badge-visited list-badge">Visited</span>';
    const initials = getInitials(app.company_name);
    const date = new Date(app.visited_at).toLocaleDateString();
    const title = app.job_title || '';
    return `<div class="list-item" data-url="${escapeAttr(app.job_url)}" data-id="${app.id}">
      <div class="list-icon">${escapeHtml(initials)}</div>
      <div class="list-info">
        <div class="list-company">${escapeHtml(app.company_name)}</div>
        <div class="list-url">${escapeHtml(title)} - ${date}</div>
      </div>
      ${badge}
      <button class="btn-delete" data-id="${app.id}" title="Delete entry">&times;</button>
    </div>`;
  }).join('');
}

function openUrl(url) {
  chrome.tabs.create({ url });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function escapeAttr(str) {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function getStoredProfile() {
  return new Promise(resolve => {
    chrome.storage.local.get('jobProfile', data => {
      resolve(data.jobProfile || null);
    });
  });
}

function setStoredProfile(profile) {
  return new Promise(resolve => {
    chrome.storage.local.set({ jobProfile: profile }, resolve);
  });
}

async function loadProfile() {
  const profile = await getStoredProfile();
  if (profile) {
    document.getElementById('pf-fullName').value = profile.fullName || '';
    document.getElementById('pf-email').value = profile.email || '';
    document.getElementById('pf-phone').value = profile.phone || '';
    document.getElementById('pf-linkedIn').value = profile.linkedIn || '';
    document.getElementById('pf-resumeUrl').value = profile.resumeUrl || '';
    document.getElementById('pf-website').value = profile.website || '';
    document.getElementById('pf-coverLetter').value = profile.coverLetter || '';
  }
}

async function saveProfile() {
  if (!(await requireLogin())) return;
  const profile = {
    fullName: document.getElementById('pf-fullName').value.trim(),
    email: document.getElementById('pf-email').value.trim(),
    phone: document.getElementById('pf-phone').value.trim(),
    linkedIn: document.getElementById('pf-linkedIn').value.trim(),
    resumeUrl: document.getElementById('pf-resumeUrl').value.trim(),
    website: document.getElementById('pf-website').value.trim(),
    coverLetter: document.getElementById('pf-coverLetter').value.trim()
  };

  await setStoredProfile(profile);
  await sendMessage({ action: 'saveProfile', profile });

  const status = document.getElementById('profile-status');
  status.textContent = 'Profile saved!';
  status.className = 'show success';
  setTimeout(() => status.className = '', 3000);
  showToast('Profile saved');
}

async function testAutofill() {
  await fillForm();
}

function populateDetailsForm(details) {
  document.getElementById('df-company').value = details.company || '';
  document.getElementById('df-title').value = details.jobTitle || '';
  document.getElementById('df-location').value = details.location || '';
  document.getElementById('df-salary').value = details.salary || '';
  document.getElementById('df-type').value = details.jobType || '';
  document.getElementById('df-notes').value = details.notes || '';
}

function toggleDetailsForm() {
  const form = document.getElementById('details-form');
  const show = form.style.display === 'none';
  form.style.display = show ? 'block' : 'none';
}

async function saveJobDetails() {
  if (!currentPageInfo) return;
  if (!(await requireLogin())) return;
  const fields = {
    company_name: document.getElementById('df-company').value.trim(),
    job_title: document.getElementById('df-title').value.trim(),
    location: document.getElementById('df-location').value.trim(),
    salary_expected: document.getElementById('df-salary').value.trim(),
    job_type: document.getElementById('df-type').value.trim(),
    notes: document.getElementById('df-notes').value.trim()
  };

  const result = await sendMessage({ action: 'updateJob', url: currentPageInfo.url, fields });
  if (result && (result.status === 'updated' || result.status === 'saved')) {
    showToast('Job details saved');
    document.getElementById('company-name').textContent = fields.company_name || '-';
    document.getElementById('job-title').textContent = fields.job_title || '-';
    document.getElementById('job-location').textContent = fields.location || '-';
    document.getElementById('job-salary').textContent = fields.salary_expected || '-';
    document.getElementById('details-form').style.display = 'none';
    loadCurrentPage();
  } else {
    showToast('Error saving details: ' + ((result && result.message) || 'unknown'));
  }
}

async function requireLogin() {
  const result = await sendMessage({ action: 'getAuthStatus' });
  if (result && result.status === 'logged_in') return true;
  showToast('Please login first');
  return false;
}

async function updateAuthUI() {
  const result = await sendMessage({ action: 'getAuthStatus' });
  const loggedIn = !!(result && result.status === 'logged_in');
  const user = result && result.user;
  const displayName = user ? (user.email || (user.user_metadata && user.user_metadata.full_name) || 'Signed in') : '';
  document.getElementById('auth-user').textContent = displayName;
  document.getElementById('auth-user').style.display = loggedIn ? 'block' : 'none';
  document.getElementById('login-form').classList.toggle('show', !loggedIn);
  document.getElementById('btn-logout').style.display = loggedIn ? 'block' : 'none';
  if (!loggedIn) {
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
  }
  return loggedIn;
}

async function loginWithPassword() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) {
    showToast('Enter email and password');
    return;
  }
  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.textContent = 'Signing in...';
  const rememberEl = document.getElementById('remember-me');
  const remember = rememberEl ? rememberEl.checked : true;
  const result = await sendMessage({ action: 'login', email, password, remember });
  btn.disabled = false;
  btn.textContent = 'Sign in';
  if (result && result.status === 'ok') {
    showToast('Logged in');
    await updateAuthUI();
    loadCurrentPage();
    loadProfile();
  } else {
    showToast('Login failed: ' + (result ? result.message : 'Please enable email auth in Supabase'));
  }
}

async function logout() {
  await sendMessage({ action: 'logout' });
  await updateAuthUI();
  loadCurrentPage();
}

function setupEvents() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  document.getElementById('btn-mark-applied').addEventListener('click', markApplied);
  document.getElementById('btn-fill').addEventListener('click', fillForm);
  document.getElementById('btn-highlight').addEventListener('click', highlightFields);
  document.getElementById('btn-add-manual').addEventListener('click', addManualEntry);
  document.getElementById('btn-edit-details').addEventListener('click', toggleDetailsForm);
  document.getElementById('btn-save-details').addEventListener('click', saveJobDetails);
  document.getElementById('btn-save-profile').addEventListener('click', saveProfile);
  document.getElementById('btn-test-autofill').addEventListener('click', testAutofill);
  document.getElementById('btn-track-manual').addEventListener('click', addManualEntry);
  document.getElementById('btn-login').addEventListener('click', loginWithPassword);
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') loginWithPassword();
  });
  document.getElementById('login-email').addEventListener('keydown', e => {
    if (e.key === 'Enter') loginWithPassword();
  });
  document.getElementById('btn-logout').addEventListener('click', logout);

  const openPanelBtn = document.getElementById('btn-open-panel');
  if (openPanelBtn) {
    openPanelBtn.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id && chrome.sidePanel) {
        await chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
        window.close();
      }
    });
  }

  document.getElementById('history-list').addEventListener('click', async (e) => {
    const delBtn = e.target.closest('.btn-delete');
    if (delBtn) {
      e.stopPropagation();
      e.preventDefault();
      const id = delBtn.getAttribute('data-id');
      if (!id) return;
      if (!confirm('Delete this entry?')) return;
      const result = await sendMessage({ action: 'deleteJob', id: Number(id) });
      if (result && result.status === 'deleted') {
        showToast('Entry deleted');
        loadHistory();
      } else {
        showToast('Error deleting entry');
      }
      return;
    }
    const item = e.target.closest('.list-item');
    if (item && item.dataset.url) openUrl(item.dataset.url);
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.action === 'pageInfo') loadCurrentPage();
});

document.addEventListener('DOMContentLoaded', () => {
  setupEvents();
  loadCurrentPage();
  loadProfile();
  updateAuthUI();
});
