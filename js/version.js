fetch('/version.json')
  .then(r => r.json())
  .then(d => {
    const el = document.getElementById('site-version');
    if (el) el.textContent = 'v' + d.version;
  })
  .catch(() => {});
