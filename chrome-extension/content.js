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

  function detectCompany() {
    const hostname = window.location.hostname.replace('www.', '');
    const meta = document.querySelector('meta[property="og:site_name"]');
    if (meta) return meta.getAttribute('content');

    const title = document.title;
    const parts = hostname.split('.');
    if (parts.length > 2) return parts[parts.length - 2];
    return parts[0];
  }

  function detectJobTitle() {
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) return ogTitle.getAttribute('content');

    const h1 = document.querySelector('h1');
    if (h1) return h1.textContent.trim();

    return document.title;
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

  function sendMessage(msg) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, response => resolve(response));
    });
  }

  async function initTracking() {
    const company = detectCompany();
    const jobTitle = detectJobTitle();
    const url = window.location.href;
    const hasForm = detectApplicationForm();

    const result = await sendMessage({
      action: 'trackJob',
      url: url,
      title: jobTitle
    });

    chrome.runtime.sendMessage({
      action: 'pageInfo',
      company: company,
      jobTitle: jobTitle,
      hasForm: hasForm,
      url: url,
      status: result
    });
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
      const company = detectCompany();
      const jobTitle = detectJobTitle();
      const hasForm = detectApplicationForm();
      sendResponse({
        company: company,
        jobTitle: jobTitle,
        hasForm: hasForm,
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
