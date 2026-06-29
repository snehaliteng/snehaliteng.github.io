const sb = supabase.createClient(
  'https://vgipghqejzbcoighktij.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnaXBnaHFlanpiY29pZ2hrdGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjQ2MjIsImV4cCI6MjA5NTMwMDYyMn0.KoDwAZarGWOLwKXOwycA8wuIiIrksvZy7dyaO0-ehUo'
);

const EDGE_FUNCTION_URL = 'https://vgipghqejzbcoighktij.supabase.co/functions/v1';
const RAZORPAY_KEY_ID = 'rzp_live_T69SbFfk53qNmY';

let currentUser = null;
let currentView = 'templates';
let userPlan = null;
let planLimits = { max_templates: 3, max_schedules_per_month: 30 };

// Auth
async function checkAuth() {
  const { data: { user } } = await sb.auth.getUser();
  if (user) {
    currentUser = user;
    await loadPlan();
    document.getElementById('login-overlay').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('user-email').textContent = user.email;
    const badge = document.getElementById('plan-badge');
    if (badge && userPlan) badge.textContent = userPlan.name;
    setDefaultDate();
    loadTemplates();
    loadDailySchedule();
    loadSummaryTabs();
  } else {
    document.getElementById('login-overlay').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
  }
}

function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('daily-date').value = today;
  const month = today.substring(0, 7);
  document.getElementById('summary-month').value = month;
  const yearEl = document.getElementById('yearly-year');
  if (yearEl && !yearEl.value) yearEl.value = today.substring(0, 4);
}

document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const err = document.getElementById('login-error');
  if (!email || !password) { err.textContent = 'Please fill in all fields'; return; }
  err.textContent = '';
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { err.textContent = error.message.includes('Invalid login') ? 'Invalid email or password' : error.message; return; }
  checkAuth();
});

document.getElementById('show-signup').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const err = document.getElementById('login-error');
  if (!email || !password) { err.textContent = 'Enter email and password to sign up'; return; }
  if (password.length < 6) { err.textContent = 'Password must be at least 6 characters'; return; }
  err.textContent = '';
  const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: 'https://snehaliteng.github.io/todo/index.html' } });
  if (error) { err.textContent = error.message; return; }
  err.textContent = 'Check your email for confirmation link!';
  err.style.color = '#188038';
});

document.getElementById('login-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('login-btn').click();
});

document.getElementById('google-login-btn').addEventListener('click', async () => {
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'https://snehaliteng.github.io/todo/index.html' }
  });
  if (error) document.getElementById('login-error').textContent = error.message;
});

document.getElementById('logout-link').addEventListener('click', async () => {
  await sb.auth.signOut();
  currentUser = null;
  checkAuth();
});

document.getElementById('daily-date').addEventListener('change', loadDailySchedule);
document.getElementById('summary-month').addEventListener('change', loadSummaryTabs);
document.getElementById('yearly-year')?.addEventListener('change', loadYearlySummary);

// Navigation
document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const view = el.dataset.view;
    currentView = view;
    document.getElementById('panel-' + view).classList.add('active');
    if (view === 'templates') loadTemplates();
    if (view === 'daily') { setDefaultDate(); loadDailySchedule(); }
    if (view === 'monthly') { setDefaultDate(); loadSummaryTabs(); }
    if (view === 'yearly') { setDefaultDate(); loadYearlySummary(); }
  });
});

// ======= Plan Management =======
async function loadPlan() {
  if (!currentUser) return;
  const { data: up } = await sb.from('todo_user_plans').select('plan_id,status').eq('user_id', currentUser.id).maybeSingle();
  if (up && up.status === 'active') {
    const { data: p } = await sb.from('todo_plans').select('*').eq('id', up.plan_id).maybeSingle();
    if (p && p.active) {
      planLimits = { max_templates: p.max_templates, max_schedules_per_month: p.max_schedules_per_month };
      userPlan = p;
      return;
    }
  }
  userPlan = { id: 0, name: 'Free', max_templates: 3, max_schedules_per_month: 30, price: 0 };
  planLimits = { max_templates: 3, max_schedules_per_month: 30 };
}

async function checkLimit(type) {
  if (!currentUser) return true;
  if (type === 'templates') {
    const { count } = await sb.from('todo_templates').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id);
    if (count < planLimits.max_templates) return true;
    await showUpsell('templates', count);
    return false;
  }
  if (type === 'schedules') {
    const month = new Date().toISOString().substring(0, 7);
    const { count } = await sb.from('todo_daily_schedules').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).gte('schedule_date', month + '-01').lte('schedule_date', month + '-31');
    if (count < planLimits.max_schedules_per_month) return true;
    await showUpsell('schedules', count);
    return false;
  }
  return true;
}

async function showUpsell(type, current) {
  const { data: plans } = await sb.from('todo_plans').select('*').eq('active', true).order('price');
  const limitKey = type === 'templates' ? 'max_templates' : 'max_schedules_per_month';
  const labels = { templates: 'Templates', schedules: 'Daily Schedules' };
  let html = '<h3 style="margin-bottom:12px;">Plan Limit Reached</h3>';
  html += '<p style="font-size:14px;color:#666;margin-bottom:16px;">You\'ve used ' + current + ' of ' + planLimits[limitKey] + ' ' + labels[type] + ' on your current plan. Upgrade to continue adding.</p>';
  html += '<div style="display:flex;flex-direction:column;gap:12px;">';
  if (plans) {
    for (const p of plans) {
      if (p.price === 0) continue;
      const canUpgrade = p[limitKey] > planLimits[limitKey];
      html += '<div style="border:1px solid #e0e0e0;border-radius:8px;padding:14px;' + (canUpgrade ? 'cursor:pointer;' : 'opacity:0.5;') + '"' + (canUpgrade ? ' onclick="purchasePlan(' + p.id + ')"' : '') + '>';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
      html += '<div><strong style="font-size:16px;">' + escHtml(p.name) + '</strong>';
      html += '<div style="font-size:12px;color:#666;margin-top:4px;">';
      html += '<span>' + (p.max_templates >= 999999 ? '&#8734;' : p.max_templates) + ' Templates</span>';
      html += ' &middot; ';
      html += '<span>' + (p.max_schedules_per_month >= 999999 ? '&#8734;' : p.max_schedules_per_month) + ' Schedules/mo</span>';
      html += '</div></div>';
      html += '<div style="font-size:18px;font-weight:700;color:#1a73e8;">&#8377;' + (p.price / 100).toFixed(2) + '</div>';
      html += '</div></div>';
    }
  }
  html += '</div>';
  html += '<div class="modal-actions" style="margin-top:16px;"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button></div>';
  showModal(html);
}

async function purchasePlan(planId) {
  closeModal();
  const { data: sessionData } = await sb.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return alert('Please login again');
  try {
    const res = await fetch(EDGE_FUNCTION_URL + '/todo-create-order', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ plan_id: planId })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Order failed'); }
    const order = await res.json();
    const rzp = new Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency || 'INR',
      name: 'SnehalIT Engineering',
      description: order.plan_name + ' Plan',
      order_id: order.id,
      prefill: { name: order.user_name, email: order.user_email, contact: '919974031480' },
      theme: { color: '#2563eb' },
      handler: async function(response) {
        try {
          const vRes = await fetch(EDGE_FUNCTION_URL + '/todo-verify-purchase', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan_id: planId
            })
          });
          const vData = await vRes.json();
          if (!vRes.ok) throw new Error(vData.error || 'Verification failed');
          alert('Payment successful! ' + vData.plan_name + ' plan activated.');
          await loadPlan();
          const badge = document.getElementById('plan-badge');
          if (badge && userPlan) badge.textContent = userPlan.name;
        } catch (e) { alert('Payment verification failed: ' + e.message); }
      },
      modal: { ondismiss: function() { } }
    });
    rzp.open();
  } catch (e) { alert('Payment failed: ' + e.message); }
}

// ======= Templates =======
async function loadTemplates() {
  const { data } = await sb.from('todo_templates').select('*').eq('user_id', currentUser.id).order('id', { ascending: false });
  const container = document.getElementById('template-list');
  if (!data || !data.length) { container.innerHTML = '<div class="card"><p style="color:#666;text-align:center;padding:20px;">No templates yet. Create one to get started!</p></div>'; return; }
  let html = '';
  for (const t of data) {
    const { count } = await sb.from('todo_template_tasks').select('*', { count: 'exact', head: true }).eq('template_id', t.id);
    html += '<div class="card"><div class="template-item"><span class="template-name" onclick="useTemplate(' + t.id + ')">' + escHtml(t.name) + '</span><span class="template-count">' + (count || 0) + ' tasks</span>' +
      '<button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();useTemplate(' + t.id + ')">Use Today</button>' +
      '<button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();showTemplateModal(' + t.id + ')">Edit</button>' +
      '<button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteTemplate(' + t.id + ')">Del</button></div></div>';
  }
  container.innerHTML = html;
}

function showTemplateModal(id) {
  (async () => {
    let template = null;
    let tasks = [];
    if (id) {
      const { data: t } = await sb.from('todo_templates').select('*').eq('id', id).single();
      if (t) template = t;
      const { data: ts } = await sb.from('todo_template_tasks').select('*').eq('template_id', id).order('order_index');
      if (ts) tasks = ts;
    }
    const title = id ? 'Edit Template' : 'New Template';
    let taskHtml = '';
    if (tasks.length) {
      tasks.forEach((task, i) => {
        taskHtml += '<div class="ttask-row" data-idx="' + i + '">' +
          '<input type="time" class="tt-start" value="' + task.start_time + '">' +
          '<input type="time" class="tt-end" value="' + task.end_time + '">' +
          '<input type="text" class="tt-title" value="' + escHtml(task.title) + '" placeholder="Task description">' +
          '<button class="btn btn-sm btn-danger" onclick="removeTaskRow(this)">X</button></div>';
      });
    } else {
      taskHtml = getEmptyTaskRow();
    }
    const html = '<h3>' + title + '</h3>' +
      '<label>Template Name</label><input id="mt-name" value="' + (template ? escHtml(template.name) : '') + '" placeholder="e.g. Work Day">' +
      '<label style="margin-top:16px;">Tasks (24-hour schedule)</label>' +
      '<div id="task-rows">' + taskHtml + '</div>' +
      '<button class="btn btn-sm btn-secondary" style="margin-top:8px;" onclick="addTaskRow()">+ Add Task</button>' +
      '<div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-primary" onclick="saveTemplate(' + (id || 'null') + ')">Save</button></div>';
    showModal(html);
  })();
}

function getEmptyTaskRow() {
  return '<div class="ttask-row" data-idx="0"><input type="time" class="tt-start" value="09:00"><input type="time" class="tt-end" value="10:00"><input type="text" class="tt-title" placeholder="Task description"><button class="btn btn-sm btn-danger" onclick="removeTaskRow(this)">X</button></div>';
}

function addTaskRow() {
  const container = document.getElementById('task-rows');
  const idx = container.children.length;
  const div = document.createElement('div');
  div.className = 'ttask-row';
  div.dataset.idx = idx;
  div.innerHTML = '<input type="time" class="tt-start" value="09:00"><input type="time" class="tt-end" value="10:00"><input type="text" class="tt-title" placeholder="Task description"><button class="btn btn-sm btn-danger" onclick="removeTaskRow(this)">X</button>';
  container.appendChild(div);
}

function removeTaskRow(btn) {
  const row = btn.closest('.ttask-row');
  row.parentNode.removeChild(row);
}

async function saveTemplate(id) {
  const name = document.getElementById('mt-name').value.trim();
  if (!name) return alert('Template name is required');
  const rows = document.querySelectorAll('#task-rows .ttask-row');
  const tasks = [];
  let valid = true;
  rows.forEach((row, i) => {
    const title = row.querySelector('.tt-title').value.trim();
    const start = row.querySelector('.tt-start').value;
    const end = row.querySelector('.tt-end').value;
    if (!title) { valid = false; return; }
    tasks.push({ title, start_time: start, end_time: end, order_index: i });
  });
  if (!valid) return alert('All tasks must have a description');
  if (!tasks.length) return alert('Add at least one task');
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  if (!id && !(await checkLimit('templates'))) return;

  if (id) {
    const { error: e1 } = await sb.from('todo_templates').update({ name }).eq('id', id);
    if (e1) return alert('Error: ' + e1.message);
    await sb.from('todo_template_tasks').delete().eq('template_id', id);
    for (const t of tasks) {
      const { data: existing } = await sb.from('todo_template_tasks').select('id').order('id', { ascending: false }).limit(1);
      const newId = (existing && existing.length) ? existing[0].id + 1 : 1;
      await sb.from('todo_template_tasks').insert({ ...t, id: newId, template_id: id, user_id: currentUser.id });
    }
  } else {
    const { data: existing } = await sb.from('todo_templates').select('id').order('id', { ascending: false }).limit(1);
    const newId = (existing && existing.length) ? existing[0].id + 1 : 1;
    const { error: e1 } = await sb.from('todo_templates').insert({ id: newId, name, user_id: currentUser.id, created_at: now });
    if (e1) return alert('Error: ' + e1.message);
    for (const t of tasks) {
      const { data: existing } = await sb.from('todo_template_tasks').select('id').order('id', { ascending: false }).limit(1);
      const taskId = (existing && existing.length) ? existing[0].id + 1 : 1;
      await sb.from('todo_template_tasks').insert({ ...t, id: taskId, template_id: newId, user_id: currentUser.id });
    }
  }
  closeModal();
  loadTemplates();
  loadTemplateDropdown();
}

async function deleteTemplate(id) {
  if (!confirm('Delete this template and all its tasks?')) return;
  await sb.from('todo_template_tasks').delete().eq('template_id', id);
  await sb.from('todo_daily_schedules').delete().eq('template_id', id);
  await sb.from('todo_templates').delete().eq('id', id);
  loadTemplates();
  loadTemplateDropdown();
}

function useTemplate(id) {
  document.getElementById('daily-date').value = new Date().toISOString().split('T')[0];
  document.querySelector('[data-view="daily"]').click();
  setTimeout(() => {
    document.getElementById('daily-template').value = id;
    applyTemplate();
  }, 100);
}

// ======= Daily Schedule =======
async function loadTemplateDropdown() {
  const { data } = await sb.from('todo_templates').select('id,name').eq('user_id', currentUser.id).order('name');
  const sel = document.getElementById('daily-template');
  sel.innerHTML = '<option value="">Select template...</option>';
  if (data) data.forEach(t => { sel.innerHTML += '<option value="' + t.id + '">' + escHtml(t.name) + '</option>'; });
}

async function loadDailySchedule() {
  loadTemplateDropdown();
  const date = document.getElementById('daily-date').value;
  const container = document.getElementById('daily-tasks');
  if (!date) { container.innerHTML = '<p style="color:#666;padding:20px;text-align:center;">Select a date to view schedule.</p>'; return; }

  const { data: schedules } = await sb.from('todo_daily_schedules').select('*').eq('user_id', currentUser.id).eq('schedule_date', date);
  if (!schedules || !schedules.length) {
    container.innerHTML = '<p style="color:#666;padding:20px;text-align:center;">No schedule for this date. Select a template and click "Apply Template", or add custom tasks below.</p>' +
      '<button class="btn btn-sm btn-secondary" onclick="createEmptySchedule()" style="margin-top:8px;">+ Create Empty Schedule & Add Tasks</button>';
    return;
  }

  const schedule = schedules[0];
  const { data: tasks } = await sb.from('todo_task_instances').select('*').eq('schedule_id', schedule.id).order('start_time');

  let templateName = '';
  if (schedule.template_id) {
    const { data: template } = await sb.from('todo_templates').select('name').eq('id', schedule.template_id).single();
    if (template) templateName = template.name;
  }
  let html = '<div style="font-size:13px;color:#666;margin-bottom:12px;">' +
    (templateName ? 'Template: <strong>' + escHtml(templateName) + '</strong>' : '<em>Custom schedule</em>') + '</div>';
  if (tasks && tasks.length) {
    html += tasks.map(t => '<div class="task-item"><input type="checkbox" class="task-check" ' + (t.is_completed ? 'checked' : '') + ' onchange="toggleTask(' + t.id + ', this.checked)">' +
      '<span class="task-time">' + t.start_time + ' - ' + t.end_time + '</span>' +
      '<span class="task-title' + (t.is_completed ? ' done' : '') + '">' + escHtml(t.title) + '</span>' +
      '<span class="task-status-dot ' + (t.is_completed ? 'done' : 'pending') + '"></span>' +
      '<button class="btn btn-sm btn-danger" onclick="deleteTaskInstance(' + t.id + ')" title="Remove task" style="font-size:11px;padding:2px 6px;">X</button></div>').join('');
  } else {
    html += '<p style="color:#999;font-size:13px;">No tasks yet.</p>';
  }
  html += '<button class="btn btn-sm btn-secondary" onclick="showAddTaskModal(' + schedule.id + ')" style="margin-top:8px;">+ Add Custom Task</button>';
  container.innerHTML = html;
}

async function createEmptySchedule() {
  const date = document.getElementById('daily-date').value;
  if (!date) return;
  if (!(await checkLimit('schedules'))) return;
  const { data: existing } = await sb.from('todo_daily_schedules').select('id').eq('user_id', currentUser.id).eq('schedule_date', date);
  if (existing && existing.length) return;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const { data: sExist } = await sb.from('todo_daily_schedules').select('id').order('id', { ascending: false }).limit(1);
  const sId = (sExist && sExist.length) ? sExist[0].id + 1 : 1;
  const { error } = await sb.from('todo_daily_schedules').insert({
    id: sId, template_id: null, schedule_date: date, user_id: currentUser.id, created_at: now
  });
  if (error) return alert('Error: ' + error.message);
  loadDailySchedule();
  loadSummaryTabs();
}

function showAddTaskModal(scheduleId) {
  const html = '<h3>Add Custom Task</h3>' +
    '<label>Task</label><input id="ct-title" placeholder="Task description">' +
    '<label>Start Time</label><input id="ct-start" type="time" value="09:00">' +
    '<label>End Time</label><input id="ct-end" type="time" value="10:00">' +
    '<div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button class="btn btn-primary" onclick="saveCustomTask(' + scheduleId + ')">Add</button></div>';
  showModal(html);
}

async function saveCustomTask(scheduleId) {
  const title = document.getElementById('ct-title').value.trim();
  const start = document.getElementById('ct-start').value;
  const end = document.getElementById('ct-end').value;
  if (!title) return alert('Task description is required');
  const { data: existing } = await sb.from('todo_task_instances').select('id').order('id', { ascending: false }).limit(1);
  const newId = (existing && existing.length) ? existing[0].id + 1 : 1;
  const { error } = await sb.from('todo_task_instances').insert({
    id: newId, schedule_id: scheduleId, template_task_id: null,
    title, start_time: start, end_time: end,
    is_completed: 0, user_id: currentUser.id
  });
  if (error) return alert('Error: ' + error.message);
  closeModal();
  loadDailySchedule();
  loadSummaryTabs();
}

async function deleteTaskInstance(taskId) {
  if (!confirm('Remove this task?')) return;
  await sb.from('todo_task_instances').delete().eq('id', taskId);
  loadDailySchedule();
  loadSummaryTabs();
}

async function applyTemplate() {
  const date = document.getElementById('daily-date').value;
  const templateId = parseInt(document.getElementById('daily-template').value);
  if (!date || !templateId) return alert('Select a date and template');

  if (!(await checkLimit('schedules'))) return;

  const { data: existing } = await sb.from('todo_daily_schedules').select('*').eq('user_id', currentUser.id).eq('schedule_date', date);
  if (existing && existing.length) return alert('Schedule already exists for this date. Clear it first.');

  const { data: tasks } = await sb.from('todo_template_tasks').select('*').eq('template_id', templateId).order('order_index');
  if (!tasks || !tasks.length) return alert('Template has no tasks');

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const { data: sExist } = await sb.from('todo_daily_schedules').select('id').order('id', { ascending: false }).limit(1);
  const sId = (sExist && sExist.length) ? sExist[0].id + 1 : 1;
  const { error: e1 } = await sb.from('todo_daily_schedules').insert({
    id: sId, template_id: templateId, schedule_date: date, user_id: currentUser.id, created_at: now
  });
  if (e1) return alert('Error: ' + e1.message);

  for (const t of tasks) {
    const { data: iExist } = await sb.from('todo_task_instances').select('id').order('id', { ascending: false }).limit(1);
    const iId = (iExist && iExist.length) ? iExist[0].id + 1 : 1;
    await sb.from('todo_task_instances').insert({
      id: iId, schedule_id: sId, template_task_id: t.id,
      title: t.title, start_time: t.start_time, end_time: t.end_time,
      is_completed: 0, user_id: currentUser.id
    });
  }
  loadDailySchedule();
  loadSummaryTabs();
}

async function clearDailySchedule() {
  const date = document.getElementById('daily-date').value;
  if (!date) return;
  if (!confirm('Clear schedule for ' + date + '?')) return;
  const { data: schedules } = await sb.from('todo_daily_schedules').select('id').eq('user_id', currentUser.id).eq('schedule_date', date);
  if (schedules && schedules.length) {
    await sb.from('todo_task_instances').delete().eq('schedule_id', schedules[0].id);
    await sb.from('todo_daily_schedules').delete().eq('id', schedules[0].id);
  }
  loadDailySchedule();
  loadSummaryTabs();
}

async function toggleTask(taskId, completed) {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  await sb.from('todo_task_instances').update({
    is_completed: completed ? 1 : 0,
    completed_at: completed ? now : null
  }).eq('id', taskId);
  loadDailySchedule();
  loadSummaryTabs();
}

// ======= Monthly Summary =======
async function loadSummaryTabs() {
  const { data: templates } = await sb.from('todo_templates').select('id,name').eq('user_id', currentUser.id).order('name');
  const container = document.getElementById('summary-tabs');
  container.innerHTML = '<div class="summary-tab active" data-tid="all" onclick="switchSummaryTab(this)">All Tasks</div>' +
    (templates || []).map(t => '<div class="summary-tab" data-tid="' + t.id + '" onclick="switchSummaryTab(this)">' + escHtml(t.name) + '</div>').join('') +
    '<div class="summary-tab" data-tid="custom" onclick="switchSummaryTab(this)">Custom</div>';
  loadMonthlySummary('all');
}

function switchSummaryTab(el) {
  document.querySelectorAll('.summary-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  loadMonthlySummary(el.dataset.tid);
}

async function loadMonthlySummary(templateId) {
  const month = document.getElementById('summary-month').value;
  if (!month) { document.getElementById('summary-content').innerHTML = '<p style="color:#666;text-align:center;padding:20px;">Select a month.</p>'; return; }
  const year = parseInt(month.substring(0, 4));
  const mon = parseInt(month.substring(5, 7));
  const daysInMonth = new Date(year, mon, 0).getDate();
  const monthStr = month + '-';
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = String(d).padStart(2, '0');
    days.push(monthStr + ds);
  }

  let scheduleQuery = sb.from('todo_daily_schedules').select('id,template_id,schedule_date').eq('user_id', currentUser.id).gte('schedule_date', days[0]).lte('schedule_date', days[days.length - 1]).order('schedule_date');
  const { data: schedules } = await scheduleQuery;
  if (!schedules || !schedules.length) {
    document.getElementById('summary-content').innerHTML = '<p style="color:#666;text-align:center;padding:20px;">No schedules found for this month.</p>';
    return;
  }

  const scheduleIds = schedules.map(s => s.id);
  let taskQuery = sb.from('todo_task_instances').select('id,title,start_time,end_time,is_completed,schedule_id').in('schedule_id', scheduleIds).order('start_time');
  const { data: allTasks } = await taskQuery;
  if (!allTasks || !allTasks.length) {
    document.getElementById('summary-content').innerHTML = '<p style="color:#666;text-align:center;padding:20px;">No tasks found.</p>';
    return;
  }

  let filteredTasks = allTasks;
  if (templateId === 'custom') {
    const cScheduleIds = schedules.filter(s => !s.template_id).map(s => s.id);
    filteredTasks = allTasks.filter(t => cScheduleIds.includes(t.schedule_id));
    if (!filteredTasks.length) {
      document.getElementById('summary-content').innerHTML = '<p style="color:#666;text-align:center;padding:20px;">No custom tasks for this month.</p>';
      return;
    }
  } else if (templateId !== 'all') {
    const tId = parseInt(templateId);
    const tScheduleIds = schedules.filter(s => s.template_id === tId).map(s => s.id);
    filteredTasks = allTasks.filter(t => tScheduleIds.includes(t.schedule_id));
    if (!filteredTasks.length) {
      document.getElementById('summary-content').innerHTML = '<p style="color:#666;text-align:center;padding:20px;">No tasks for this template in the selected month.</p>';
      return;
    }
  }

  const scheduleDateMap = {};
  schedules.forEach(s => { scheduleDateMap[s.id] = s.schedule_date; });

  const taskMap = {};
  filteredTasks.forEach(t => {
    const key = t.title + '|' + t.start_time + '|' + t.end_time;
    if (!taskMap[key]) taskMap[key] = { title: t.title, start_time: t.start_time, end_time: t.end_time, days: {} };
    const date = scheduleDateMap[t.schedule_id];
    if (date) taskMap[key].days[date] = t.is_completed;
  });

  const taskKeys = Object.keys(taskMap);
  let html = '<table class="summary-table"><thead><tr><th class="task-row">Task</th>';
  for (const d of days) {
    const dt = new Date(d + 'T00:00:00');
    const dayName = dt.toLocaleDateString('en', { weekday: 'short' });
    const dayNum = dt.getDate();
    html += '<th style="font-size:11px;">' + dayNum + '<br><span style="font-weight:400;">' + dayName + '</span></th>';
  }
  html += '</tr></thead><tbody>';
  for (const key of taskKeys) {
    const t = taskMap[key];
    html += '<tr><td class="task-row"><span style="font-size:12px;color:#666;">' + t.start_time + ' - ' + t.end_time + '</span><br><strong>' + escHtml(t.title) + '</strong></td>';
    for (const d of days) {
      if (t.days[d] === 1) html += '<td class="cell-done">&#10003;</td>';
      else if (t.days[d] === 0) html += '<td class="cell-miss">&#10007;</td>';
      else html += '<td class="cell-none">-</td>';
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  document.getElementById('summary-content').innerHTML = html;
}

// ======= Modal =======
function showModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

// ======= Utility =======
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ======= Yearly Summary =======
async function loadYearlySummary() {
  const year = document.getElementById('yearly-year').value;
  if (!year) { document.getElementById('yearly-content').innerHTML = '<p style="color:#666;text-align:center;padding:20px;">Select a year.</p>'; return; }
  const startDate = year + '-01-01';
  const endDate = year + '-12-31';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const { data: schedules } = await sb.from('todo_daily_schedules').select('id,template_id,schedule_date').eq('user_id', currentUser.id).gte('schedule_date', startDate).lte('schedule_date', endDate).order('schedule_date');
  if (!schedules || !schedules.length) {
    document.getElementById('yearly-content').innerHTML = '<p style="color:#666;text-align:center;padding:20px;">No schedules found for ' + year + '.</p>';
    return;
  }

  const scheduleIds = schedules.map(s => s.id);
  const { data: allTasks } = await sb.from('todo_task_instances').select('id,title,start_time,end_time,is_completed,schedule_id').in('schedule_id', scheduleIds).order('start_time');
  if (!allTasks || !allTasks.length) {
    document.getElementById('yearly-content').innerHTML = '<p style="color:#666;text-align:center;padding:20px;">No tasks found.</p>';
    return;
  }

  const scheduleDateMap = {};
  schedules.forEach(s => { scheduleDateMap[s.id] = s.schedule_date; });

  const taskMap = {};
  const monthCounts = {};
  allTasks.forEach(t => {
    const key = t.title + '|' + t.start_time + '|' + t.end_time;
    if (!taskMap[key]) taskMap[key] = { title: t.title, start_time: t.start_time, end_time: t.end_time, months: {} };
    const date = scheduleDateMap[t.schedule_id];
    if (!date) return;
    const m = parseInt(date.substring(5, 7)) - 1;
    if (!taskMap[key].months[m]) taskMap[key].months[m] = { total: 0, done: 0 };
    taskMap[key].months[m].total++;
    if (t.is_completed) taskMap[key].months[m].done++;
  });

  const taskKeys = Object.keys(taskMap);
  let html = '<table class="summary-table"><thead><tr><th class="task-row">Task</th>';
  for (let m = 0; m < 12; m++) {
    html += '<th style="font-size:12px;">' + months[m] + '</th>';
  }
  html += '</tr></thead><tbody>';
  for (const key of taskKeys) {
    const t = taskMap[key];
    html += '<tr><td class="task-row"><span style="font-size:12px;color:#666;">' + t.start_time + ' - ' + t.end_time + '</span><br><strong>' + escHtml(t.title) + '</strong></td>';
    for (let m = 0; m < 12; m++) {
      if (t.months[m]) {
        const pct = t.months[m].total > 0 ? Math.round(t.months[m].done / t.months[m].total * 100) : 0;
        const color = pct >= 80 ? '#188038' : pct >= 50 ? '#f9ab00' : '#d93025';
        html += '<td class="yearly-cell" style="color:' + color + ';">' + t.months[m].done + '/' + t.months[m].total + '</td>';
      } else {
        html += '<td class="cell-none">-</td>';
      }
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  document.getElementById('yearly-content').innerHTML = html;
}

// Mobile sidebar
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
document.addEventListener('click', function(e) {
  var item = e.target.closest('.nav-item');
  if (item && window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
  }
});

// Init
checkAuth();
