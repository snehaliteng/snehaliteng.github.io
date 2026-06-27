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

const SITE_URL = 'https://snehaliteng.github.io';

async function socialLogin(provider) {
  const { data, error } = await _admin.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${SITE_URL}/admin/` }
  });
  if (error) throw error;
}

function showAlert(msg, type) {
  const el = document.getElementById('alert');
  if (!el) return;
  el.innerHTML = '<div class="bg-' + (type==='error' ? 'red' : 'green') + '-100 text-' + (type==='error' ? 'red' : 'green') + '-700 p-3 rounded text-sm">' + msg + '</div>';
  setTimeout(() => el.innerHTML = '', 5000);
}

async function signOut() {
  await _admin.auth.signOut();
  window.location.href = '../';
}

// Blog admin helpers
async function getAllArticles() {
  const { data, error } = await _admin.from('blog_articles').select('*, blog_topics(name)').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function updateArticle(id, fields) {
  const { error } = await _admin.from('blog_articles').update(fields).eq('id', id);
  if (error) throw error;
}

async function deleteArticle(id) {
  const { error } = await _admin.from('blog_articles').delete().eq('id', id);
  if (error) throw error;
}

async function getBlogTopics() {
  const { data, error } = await _admin.from('blog_topics').select('*').order('name');
  if (error) throw error;
  return data;
}
