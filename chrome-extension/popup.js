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

function sendMessage(msg) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(msg, response => resolve(response));
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
  const btn = document.getElementById('btn-mark-applied');
  btn.disabled = true;
  btn.textContent = 'Marking...';

  const result = await sendMessage({ action: 'markApplied', url: currentPageInfo.url });
  if (result && result.status === 'ok') {
    showToast('Marked as applied!');
    document.getElementById('app-status').innerHTML = '<span class="badge badge-applied">Applied</span>';
    btn.style.display = 'none';
  } else {
    showToast('Error marking as applied');
    btn.disabled = false;
    btn.textContent = 'Mark as Applied';
  }
}

async function fillForm() {
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
  const result = await sendMessage({ action: 'getAllApplications' });
  document.getElementById('history-loading').style.display = 'none';

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
    return `<div class="list-item" onclick="openUrl('${escapeAttr(app.job_url)}')">
      <div class="list-icon">${escapeHtml(initials)}</div>
      <div class="list-info">
        <div class="list-company">${escapeHtml(app.company_name)}</div>
        <div class="list-url">${escapeHtml(title)} - ${date}</div>
      </div>
      ${badge}
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

document.addEventListener('DOMContentLoaded', () => {
  loadCurrentPage();
  loadProfile();
});
