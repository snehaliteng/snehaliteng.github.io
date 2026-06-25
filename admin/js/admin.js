const SUPABASE_URL = 'https://vgipghqejzbcoighktij.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnaXBnaHFlanpiY29pZ2hrdGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjQ2MjIsImV4cCI6MjA5NTMwMDYyMn0.KoDwAZarGWOLwKXOwycA8wuIiIrksvZy7dyaO0-ehUo';
const _admin = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const ADMIN_EMAIL = 'snehaliteng@gmail.com';

async function requireAdmin() {
  const { data: { user }, error } = await _admin.auth.getUser();
  if (error || !user || user.email !== ADMIN_EMAIL) {
    window.location.href = '../';
    return null;
  }
  return user;
}

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

async function signOut() {
  await _admin.auth.signOut();
  window.location.href = '../';
}
