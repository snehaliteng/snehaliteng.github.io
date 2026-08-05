(function () {
  'use strict';

  const FIELD_MAP = {
    firstName: ['first.?name', 'fname', 'given.?name', 'prenom'],
    lastName: ['last.?name', 'lname', 'surname', 'family.?name', 'nom'],
    fullName: ['full.?name', 'your.?name', 'applicant.?name', 'name', 'candidate.?name'],
    email: ['email', 'e-mail', 'mail'],
    phone: ['phone', 'mobile', 'telephone', 'tel', 'contact.?number', 'cell'],
    linkedIn: ['linkedin', 'linked.?in', 'profile.?url', 'social.?profile'],
    resumeUrl: ['resume', 'cv', 'portfolio.?url', 'resume.?url', 'cv.?url', 'cover.?letter'],
    coverLetter: ['cover.?letter', 'message', 'additional.?info', 'notes', 'description'],
    address: ['address', 'street', 'city', 'location'],
    website: ['website', 'personal.?url', 'portfolio', 'github']
  };

  const PERSONAL_FIELDS = {
    firstName: 'Snehal',
    lastName: 'IT Eng',
    fullName: 'Snehal IT Eng',
    email: 'snehaliteng@gmail.com',
    phone: '',
    linkedIn: 'https://linkedin.com/in/snehaliteng',
    resumeUrl: '',
    coverLetter: '',
    website: 'https://snehaliteng.github.io'
  };

  function matchField(input) {
    const label = (input.getAttribute('aria-label') || '').toLowerCase();
    const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
    const name = (input.getAttribute('name') || '').toLowerCase();
    const id = (input.getAttribute('id') || '').toLowerCase();
    const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase();

    const all = [label, placeholder, name, id, autocomplete].join(' ');

    if (autocomplete) {
      if (autocomplete === 'given-name' || autocomplete === 'first-name') return 'firstName';
      if (autocomplete === 'family-name' || autocomplete === 'last-name') return 'lastName';
      if (autocomplete === 'name') return 'fullName';
      if (autocomplete === 'email') return 'email';
      if (autocomplete === 'tel') return 'phone';
      if (autocomplete === 'url') return 'website';
    }

    for (const [key, patterns] of Object.entries(FIELD_MAP)) {
      for (const pat of patterns) {
        if (new RegExp(pat, 'i').test(all)) return key;
      }
    }

    const prevSibling = input.previousElementSibling;
    if (prevSibling) {
      const prevText = (prevSibling.textContent || '').toLowerCase();
      for (const [key, patterns] of Object.entries(FIELD_MAP)) {
        for (const pat of patterns) {
          if (new RegExp(pat, 'i').test(prevText)) return key;
        }
      }
    }

    const parent = input.closest('label');
    if (parent) {
      const labelText = (parent.textContent || '').toLowerCase();
      for (const [key, patterns] of Object.entries(FIELD_MAP)) {
        for (const pat of patterns) {
          if (new RegExp(pat, 'i').test(labelText)) return key;
        }
      }
    }

    return null;
  }

  function fillInput(input, value) {
    if (!value) return false;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;
    const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    ).set;

    if (input.tagName === 'TEXTAREA') {
      nativeTextareaValueSetter.call(input, value);
    } else {
      nativeInputValueSetter.call(input, value);
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }

  function fillSelect(select, value) {
    if (!value) return false;
    const options = Array.from(select.options);
    const match = options.find(opt =>
      opt.value.toLowerCase() === value.toLowerCase() ||
      opt.textContent.toLowerCase() === value.toLowerCase()
    );
    if (match) {
      select.value = match.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }

  function autofillProfile(profile) {
    let filled = 0;
    const fields = document.querySelectorAll('input, textarea, select');

    fields.forEach(field => {
      const key = matchField(field);
      if (!key) return;

      const value = profile[key];
      if (!value) return;

      if (field.tagName === 'SELECT') {
        if (fillSelect(field, value)) filled++;
      } else if (field.type === 'file') {
        return;
      } else {
        if (fillInput(field, value)) filled++;
      }
    });

    return filled;
  }

  function highlightFillableFields() {
    const fields = document.querySelectorAll('input, textarea, select');
    let count = 0;

    fields.forEach(field => {
      const key = matchField(field);
      if (key && PERSONAL_FIELDS[key]) {
        field.style.outline = '2px solid #3b82f6';
        field.style.outlineOffset = '1px';
        field.setAttribute('data-jt-fillable', key);
        count++;
      }
    });

    return count;
  }

  function clearHighlights() {
    document.querySelectorAll('[data-jt-fillable]').forEach(el => {
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.removeAttribute('data-jt-fillable');
    });
  }

  const JOB_SITES = new Set([
    'naukri', 'linkedin', 'indeed', 'glassdoor', 'wellfound', 'angellist',
    'dice', 'ziprecruiter', 'monster', 'careerbuilder', 'greenhouse',
    'lever', 'workday', 'icims', 'smartrecruiters', 'ashby', 'bamboohr',
    'jazzhr', 'successfactors'
  ]);

  function cleanText(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function findJobPostingJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      let data;
      try {
        data = JSON.parse(script.textContent);
      } catch (e) {
        continue;
      }
      const items = Array.isArray(data) ? data : (data && data['@graph'] ? data['@graph'] : [data]);
      for (const item of items) {
        if (item && item['@type'] === 'JobPosting') return item;
      }
    }
    return null;
  }

  function firstText(selectors, skipSites) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const text = cleanText(el.textContent);
      if (!text) continue;
      if (skipSites && JOB_SITES.has(text.toLowerCase())) continue;
      return text;
    }
    return null;
  }

  function detectCompany() {
    const ld = findJobPostingJsonLd();
    if (ld && ld.hiringOrganization && ld.hiringOrganization.name) {
      return cleanText(ld.hiringOrganization.name);
    }
    const fromDom = firstText([
      'a[href*="-company-jobs"]',
      'a[href*="/companies/"]',
      'a[href*="/company-"]',
      '[class*="company-link"]',
      '[class*="company-name"]',
      '[class*="comp-name"]',
      '[class*="job-header-comp"]',
      '[class*="jd_company"]',
      '[data-qa*="company"]',
      '[class*="header-comp"]'
    ], true);
    if (fromDom) return fromDom;

    const meta = document.querySelector('meta[property="og:site_name"]');
    const siteName = meta ? cleanText(meta.getAttribute('content')) : '';
    if (siteName && !JOB_SITES.has(siteName.toLowerCase())) return siteName;
    return null;
  }

  function findLabelValue(label) {
    const nodes = [];
    document.querySelectorAll('span, div, p, li, dt, h2, h3').forEach(el => {
      const t = cleanText(el.textContent);
      if (t && t.toLowerCase() === label.toLowerCase() && el.children.length === 0) {
        nodes.push(el);
      }
    });
    for (const el of nodes) {
      const sibling = el.nextElementSibling;
      if (sibling) {
        const v = cleanText(sibling.textContent);
        if (v) return v;
      }
      const parent = el.parentElement;
      if (parent) {
        const parentText = cleanText(parent.textContent);
        const value = cleanText(parentText.slice(label.length));
        if (value && value !== label) return value;
      }
    }
    return null;
  }

  function cleanTitle(value) {
    let text = cleanText(value);
    text = text.split('|')[0].trim();
    text = text.replace(/\s*[-|\u2013]\s*$/, '').trim();
    if (/404|not found|could not be found/i.test(text) && text.length < 40) return '';
    return text;
  }

  function detectJobTitle() {
    const ld = findJobPostingJsonLd();
    if (ld && ld.title) return cleanText(ld.title);

    const h1 = document.querySelector('h1');
    if (h1) {
      const text = cleanText(h1.textContent);
      if (text && !/404|not found/i.test(text)) return text;
    }

    const og = document.querySelector('meta[property="og:title"]');
    if (og) {
      const title = cleanTitle(og.getAttribute('content'));
      if (title) return title;
    }

    return cleanTitle(document.title);
  }

  function detectSalaryFromLd(ld) {
    if (!ld || !ld.baseSalary) return null;
    const bs = ld.baseSalary;
    if (typeof bs === 'string') return cleanText(bs);
    const v = bs.value;
    if (v == null) return null;
    if (typeof v === 'string') return cleanText(v);
    if (typeof v === 'number') return String(v);
    if (typeof v === 'object') {
      if (v.value != null) return String(v.value);
      if (v.minValue != null && v.maxValue != null) return `${v.minValue} - ${v.maxValue}`;
      if (v.minValue != null) return `${v.minValue}+`;
    }
    return null;
  }

  function detectJobDetails() {
    const ld = findJobPostingJsonLd();
    const location = ld && ld.jobLocation && ld.jobLocation.address
      ? cleanText(ld.jobLocation.address.addressLocality) : null;
    const jobType = ld && ld.employmentType
      ? (Array.isArray(ld.employmentType) ? ld.employmentType : [ld.employmentType])
          .map(t => cleanText(t).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()))
          .join(', ')
      : null;

    const urlInfo = parseJobUrl(window.location.pathname);

    return {
      company: detectCompany() || (urlInfo && urlInfo.company) || null,
      jobTitle: detectJobTitle() || (urlInfo && urlInfo.jobTitle) || null,
      location: location || firstText([
        '[class*="location"]',
        '[class*="loc-place"]',
        '[class*="jd__location"]',
        '[data-qa*="location"]',
        '[class*="loc-details"]',
        '[class*="loc-new"]'
      ]) || findLabelValue('Location') || (urlInfo && urlInfo.location) || null,
      salary: detectSalaryFromLd(ld) || firstText([
        '[class*="salary"]',
        '[class*="ctc"]',
        '[data-qa*="salary"]',
        '[class*="jd__salary"]',
        '[class*="sal-"]'
      ]) || findLabelValue('Salary') || findLabelValue('Annual Salary') || null,
      jobType: jobType || firstText([
        '[class*="job-type"]',
        '[class*="employment-type"]',
        '[data-qa*="job-type"]',
        '[class*="emp-type"]'
      ]) || findLabelValue('Employment Type') || null
    };
  }

  function parseJobUrl(path) {
    try {
      const m = path.match(/^\/job-listings-([a-z0-9-]+)-(\d{12})$/);
      if (!m) return null;
      const slug = m[1];
      const parts = slug.split('-');

      let expIdx = -1;
      for (let i = 0; i < parts.length - 2; i++) {
        if (/^\d+$/.test(parts[i]) && parts[i + 1] === 'to' && /^\d+$/.test(parts[i + 2])) {
          expIdx = i;
          break;
        }
      }

      const head = expIdx > 0 ? parts.slice(0, expIdx) : parts;
      const LOCATIONS = new Set([
        'pune', 'chennai', 'bengaluru', 'bangalore', 'mumbai', 'delhi', 'new-delhi',
        'gurgaon', 'gurugram', 'noida', 'hyderabad', 'kolkata', 'ahmedabad', 'remote',
        'india', 'coimbatore', 'thiruvananthapuram', 'trivandrum', 'indore', 'jaipur',
        'kerala', 'ncr', 'anywhere', 'karnataka', 'maharashtra', 'tamil-nadu', 'goa'
      ]);

      let locStart = head.length;
      for (let i = 0; i < head.length; i++) {
        if (LOCATIONS.has(head[i])) { locStart = i; break; }
      }
      const location = head.slice(locStart).join(', ').replace(/\b\w/g, c => c.toUpperCase());

      let company = null;
      let jobTitle = null;
      const beforeLoc = head.slice(0, locStart);
      if (beforeLoc.length >= 2) {
        jobTitle = beforeLoc.slice(0, -2).join(' ').replace(/\b\w/g, c => c.toUpperCase());
        company = beforeLoc.slice(-2).join(' ').replace(/\b\w/g, c => c.toUpperCase());
      } else if (beforeLoc.length === 1) {
        jobTitle = beforeLoc[0].replace(/\b\w/g, c => c.toUpperCase());
      }

      return { company, jobTitle, location: location || null };
    } catch (e) {
      return null;
    }
  }

  function isJobLikePage() {
    if (findJobPostingJsonLd()) return true;
    if (detectApplicationForm()) return true;
    const path = window.location.pathname.toLowerCase();
    const title = document.title.toLowerCase();
    const url = window.location.href.toLowerCase();
    const titleHints = /job|career|apply|hiring|vacancy|position|recruit/.test(title + ' ' + url);
    const pathHints = /\/job\/|job-listings|job-detail|jd\/|career|jobs/.test(path);
    return titleHints && pathHints;
  }

  function detectApplicationForm() {
    const forms = document.querySelectorAll('form');
    for (const form of forms) {
      const html = form.innerHTML.toLowerCase();
      if (html.includes('resume') || html.includes('cover letter') ||
          html.includes('apply') || html.includes('application')) {
        return true;
      }
    }
    return false;
  }

  function publishDetails() {
    const details = detectJobDetails();
    const url = window.location.href;
    const hasForm = detectApplicationForm();
    chrome.runtime.sendMessage({
      action: 'pageInfo',
      company: details.company,
      jobTitle: details.jobTitle,
      location: details.location,
      salary: details.salary,
      jobType: details.jobType,
      hasForm: hasForm,
      url: url
    });

    if (isJobLikePage() && (details.jobTitle || details.company)) {
      chrome.runtime.sendMessage({
        action: 'trackJob',
        url: url,
        title: details.jobTitle || document.title,
        company: details.company,
        location: details.location,
        salary: details.salary,
        jobType: details.jobType
      });
    }
  }

  function currentSignature() {
    const d = detectJobDetails();
    return JSON.stringify([d.jobTitle, d.company, d.location, d.salary, d.jobType]);
  }

  let lastSignature = '';
  let broadcastTimer = null;

  function scheduleBroadcast() {
    const sig = currentSignature();
    if (sig === lastSignature) return;
    clearTimeout(broadcastTimer);
    broadcastTimer = setTimeout(() => {
      const sig2 = currentSignature();
      if (sig2 !== lastSignature) {
        lastSignature = sig2;
        publishDetails();
      }
    }, 900);
  }

  function initTracking() {
    scheduleBroadcast();
    let runs = 0;
    const observer = new MutationObserver(() => {
      scheduleBroadcast();
      runs++;
      if (runs > 25) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'autofill') {
      const count = autofillProfile(request.profile);
      sendResponse({ success: count > 0, filledCount: count });
      return true;
    }

    if (request.action === 'highlight') {
      const count = highlightFillableFields();
      sendResponse({ success: count > 0, fieldCount: count });
      return true;
    }

    if (request.action === 'clearHighlights') {
      clearHighlights();
      sendResponse({ success: true });
      return true;
    }

    if (request.action === 'getPageInfo') {
      const details = detectJobDetails();
      sendResponse({
        company: details.company,
        jobTitle: details.jobTitle,
        location: details.location,
        salary: details.salary,
        jobType: details.jobType,
        hasForm: detectApplicationForm(),
        url: window.location.href
      });
      return true;
    }

    if (request.action === 'getFillableFields') {
      const fields = [];
      document.querySelectorAll('input, textarea, select').forEach(el => {
        const key = matchField(el);
        if (key && PERSONAL_FIELDS[key]) {
          fields.push({
            type: el.tagName.toLowerCase(),
            name: el.getAttribute('name') || el.getAttribute('id') || '',
            fieldType: el.type || 'text',
            profileKey: key,
            label: el.getAttribute('aria-label') || el.getAttribute('placeholder') || key
          });
        }
      });
      sendResponse({ fields });
      return true;
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTracking);
  } else {
    initTracking();
  }
})();
