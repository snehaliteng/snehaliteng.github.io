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
let selectedTaskIds = new Set();
let selectedPermTaskIds = new Set();
let expandedPermTaskIds = new Set();

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
    if (view === 'permanent') loadPermanentTasks();
    if (view === 'contacts') loadContacts();
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
      (id ? '' : '<button class="btn btn-sm btn-secondary" style="margin-top:8px;font-size:12px;" onclick="loadJobSearchSchedule()">Load Job Search Routine</button>') +
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

function loadJobSearchSchedule() {
  const nameInput = document.getElementById('mt-name');
  if (nameInput && !nameInput.value) nameInput.value = 'Job Search Daily Routine';
  const schedule = [
    { start: '08:00', end: '08:30', title: 'Quick exercise or walk' },
    { start: '08:30', end: '09:00', title: 'Review job boards (LinkedIn, Indeed, Glassdoor)' },
    { start: '09:00', end: '10:30', title: 'Apply to 2-3 targeted jobs (customize resume + cover letter)' },
    { start: '10:30', end: '11:00', title: 'Track applications in spreadsheet (role, company, date, status)' },
    { start: '11:00', end: '12:00', title: 'Networking outreach (connect with recruiters, LinkedIn messages)' },
    { start: '12:00', end: '13:00', title: 'Lunch + short break' },
    { start: '13:00', end: '14:00', title: 'Study system design concepts (draw diagrams, review handbook)' },
    { start: '14:00', end: '15:00', title: 'Practice DSA/LeetCode (FAANG-style questions)' },
    { start: '15:00', end: '16:00', title: 'Work on portfolio (personal website, projects)' },
    { start: '16:00', end: '17:00', title: 'Mock interview practice (system design or behavioral)' },
    { start: '17:00', end: '18:00', title: 'Skill refresh (ML/NLP, cloud architecture, or LLM serving)' },
    { start: '18:00', end: '19:00', title: 'Review industry news & trends (AI, cloud, DevOps)' },
    { start: '19:00', end: '20:00', title: 'Write LinkedIn post or blog (share insights, boost visibility)' },
    { start: '20:00', end: '21:00', title: 'Relaxation or family time' },
    { start: '21:00', end: '21:30', title: 'Quick recap: What did you achieve today?' },
    { start: '21:30', end: '22:30', title: 'Light reading (tech blogs, interview experiences, architecture books)' },
  ];
  const container = document.getElementById('task-rows');
  container.innerHTML = '';
  schedule.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'ttask-row';
    div.dataset.idx = i;
    div.innerHTML = '<input type="time" class="tt-start" value="' + s.start + '">' +
      '<input type="time" class="tt-end" value="' + s.end + '">' +
      '<input type="text" class="tt-title" value="' + escHtml(s.title) + '" placeholder="Task description">' +
      '<button class="btn btn-sm btn-danger" onclick="removeTaskRow(this)">X</button>';
    container.appendChild(div);
  });
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
    loadDailyPermanentTasks();
    return;
  }

  // Merge tasks from all schedules for this date, deduplicate by title+time
  var allTasks = [];
  var seen = {};
  for (var si = 0; si < schedules.length; si++) {
    var { data: stasks } = await sb.from('todo_task_instances').select('*').eq('schedule_id', schedules[si].id);
    if (stasks) {
      for (var ti = 0; ti < stasks.length; ti++) {
        var key = stasks[ti].start_time + '|' + stasks[ti].end_time + '|' + stasks[ti].title;
        if (!seen[key]) {
          seen[key] = true;
          allTasks.push(stasks[ti]);
        }
      }
    }
  }
  allTasks.sort(function(a,b) { return (a.order_index || 0) - (b.order_index || 0) || a.start_time.localeCompare(b.start_time); });

  // Clean up duplicate schedules (keep first, delete rest)
  if (schedules.length > 1) {
    for (var si = 1; si < schedules.length; si++) {
      sb.from('todo_task_instances').delete().eq('schedule_id', schedules[si].id).then(function(){});
      sb.from('todo_daily_schedules').delete().eq('id', schedules[si].id).then(function(){});
    }
  }

  const schedule = schedules[0];
  let templateName = '';
  if (schedule.template_id) {
    const { data: template } = await sb.from('todo_templates').select('name').eq('id', schedule.template_id).single();
    if (template) templateName = template.name;
  }
  let html = '<div style="font-size:13px;color:#666;margin-bottom:12px;">' +
    (templateName ? 'Template: <strong>' + escHtml(templateName) + '</strong>' : '<em>Custom schedule</em>') + '</div>';
  if (allTasks.length) {
    selectedTaskIds.clear();
    document.getElementById('delete-selected-btn').style.display = 'none';
    var nowTime = new Date().toTimeString().substring(0, 5);
    html += allTasks.map(function(t) {
      var isCurrent = !t.is_completed && nowTime >= t.start_time && nowTime < t.end_time;
      return '<div class="task-item' + (isCurrent ? ' current-task' : '') + '" ' +
        'data-id="' + t.id + '" data-schedule="' + t.schedule_id + '" draggable="true">' +
        '<span class="drag-handle">&#x2630;</span>' +
        '<input type="checkbox" class="task-select" onchange="toggleSelect(' + t.id + ', this.checked)" style="width:16px;height:16px;accent-color:#d93025;cursor:pointer;">' +
        '<input type="checkbox" class="task-check" ' + (t.is_completed ? 'checked' : '') + ' onchange="toggleTask(' + t.id + ', this.checked)">' +
        '<span class="task-time">' + t.start_time + ' - ' + t.end_time + '</span>' +
        '<span class="task-title' + (t.is_completed ? ' done' : '') + '">' + escHtml(t.title) + '</span>' +
        '<span class="task-status-dot ' + (t.is_completed ? 'done' : 'pending') + '"></span>' +
        '<button class="btn btn-sm btn-danger" onclick="deleteTaskInstance(' + t.id + ')" title="Remove task" style="font-size:11px;padding:2px 6px;">X</button></div>';
    }).join('');
  } else {
    html += '<p style="color:#999;font-size:13px;">No tasks yet.</p>';
  }
  html += '<button class="btn btn-sm btn-secondary" onclick="showAddTaskModal(' + schedule.id + ')" style="margin-top:8px;">+ Add Custom Task</button>';
  container.innerHTML = html;
  loadDailyPermanentTasks();
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
  const { data: maxOrder } = await sb.from('todo_task_instances').select('order_index').eq('schedule_id', scheduleId).order('order_index', { ascending: false }).limit(1);
  var nextOrder = (maxOrder && maxOrder.length) ? maxOrder[0].order_index + 1 : 0;
  const { error } = await sb.from('todo_task_instances').insert({
    id: newId, schedule_id: scheduleId, template_task_id: null,
    title, start_time: start, end_time: end,
    is_completed: 0, order_index: nextOrder, user_id: currentUser.id
  });
  if (error) return alert('Error: ' + error.message);
  closeModal();
  loadDailySchedule();
  loadSummaryTabs();
}

function toggleSelect(taskId, checked) {
  if (checked) selectedTaskIds.add(taskId);
  else selectedTaskIds.delete(taskId);
  document.getElementById('delete-selected-btn').style.display = selectedTaskIds.size ? 'inline-block' : 'none';
}

async function deleteSelectedTasks() {
  if (!selectedTaskIds.size) return;
  const count = selectedTaskIds.size;
  if (!confirm('Delete ' + count + ' selected task' + (count > 1 ? 's' : '') + '?')) return;
  const ids = Array.from(selectedTaskIds);
  selectedTaskIds.clear();
  document.getElementById('delete-selected-btn').style.display = 'none';
  await sb.from('todo_task_instances').delete().in('id', ids);
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

  let { data: existing } = await sb.from('todo_daily_schedules').select('*').eq('user_id', currentUser.id).eq('schedule_date', date);
  if (existing && existing.length) {
    const { count } = await sb.from('todo_task_instances').select('*', { count: 'exact', head: true }).eq('schedule_id', existing[0].id);
    if (count === 0) {
      await sb.from('todo_daily_schedules').delete().eq('id', existing[0].id);
      existing = null;
    } else {
      return alert('Schedule already exists for this date. Clear it first.');
    }
  }

  const { data: tasks } = await sb.from('todo_template_tasks').select('*').eq('template_id', templateId).order('order_index');
  if (!tasks || !tasks.length) return alert('Template has no tasks');

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const { data: sExist } = await sb.from('todo_daily_schedules').select('id').order('id', { ascending: false }).limit(1);
  const sId = (sExist && sExist.length) ? sExist[0].id + 1 : 1;
  const { error: e1 } = await sb.from('todo_daily_schedules').insert({
    id: sId, template_id: templateId, schedule_date: date, user_id: currentUser.id, created_at: now
  });
  if (e1) return alert('Error: ' + e1.message);

  for (let ti = 0; ti < tasks.length; ti++) {
    const t = tasks[ti];
    const { data: iExist } = await sb.from('todo_task_instances').select('id').order('id', { ascending: false }).limit(1);
    const iId = (iExist && iExist.length) ? iExist[0].id + 1 : 1;
    await sb.from('todo_task_instances').insert({
      id: iId, schedule_id: sId, template_task_id: t.id,
      title: t.title, start_time: t.start_time, end_time: t.end_time,
      is_completed: 0, order_index: t.order_index || ti, user_id: currentUser.id
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

// ======= Contact Management =======
var contactsSortState = 'name';
var contactFilter = 'active';
var contactPage = 1;
var contactPageSize = 20;
var contactSearch = '';

function setContactFilter(filter) {
  contactFilter = filter;
  document.querySelectorAll('.contact-filter-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.filter === filter);
  });
  loadContacts();
}

async function loadContacts() {
  if (!currentUser) return;
  var tf = document.getElementById('contact-timeframe');
  var timeframe = tf ? parseInt(tf.value) : 30;
  var cutDate = timeframe ? new Date(Date.now() - timeframe * 86400000).toISOString().substring(0, 19) : '1970-01-01';
  if (timeframe === 'all' || isNaN(timeframe)) cutDate = '1970-01-01';

  var { data: contacts } = await sb.from('todo_contacts').select('*').eq('user_id', currentUser.id).order('order_index');
  var container = document.getElementById('contacts-container');
  if (!contacts || !contacts.length) {
    container.innerHTML = '<p style="color:#666;text-align:center;padding:30px;">No contacts yet. Add one to get started.</p>';
    return;
  }

  // Filter by visibility
  if (contactFilter === 'active') contacts = contacts.filter(function(c) { return !c.hidden; });
  else if (contactFilter === 'hidden') contacts = contacts.filter(function(c) { return c.hidden; });

  // Search filter
  if (contactSearch) {
    var q = contactSearch.toLowerCase();
    contacts = contacts.filter(function(c) { return (c.name || '').toLowerCase().includes(q) || (c.number || '').toLowerCase().includes(q); });
  }

  if (!contacts.length) {
    container.innerHTML = '<p style="color:#666;text-align:center;padding:30px;">No ' + contactFilter + ' contacts' + (contactSearch ? ' matching "' + escHtml(contactSearch) + '"' : '') + '.</p>';
    return;
  }

  // Gather call counts
  var contactIds = contacts.map(function(c) { return c.id; });
  var { data: allCalls } = await sb.from('todo_contact_calls').select('contact_id').in('contact_id', contactIds).gte('called_at', cutDate);
  var callCounts = {};
  if (allCalls) { allCalls.forEach(function(c) { callCounts[c.contact_id] = (callCounts[c.contact_id] || 0) + 1; }); }

  // Append count to each contact for sorting
  contacts.forEach(function(c) { c._callCount = callCounts[c.id] || 0; });

  if (contactsSortState === 'least-called') {
    contacts.sort(function(a,b) { return (a._callCount || 999) - (b._callCount || 999); });
  } else if (contactsSortState === 'most-called') {
    contacts.sort(function(a,b) { return (b._callCount || 0) - (a._callCount || 0); });
  }

  // Paginate
  var totalPages = Math.ceil(contacts.length / contactPageSize);
  if (contactPage > totalPages) contactPage = totalPages;
  var startIdx = (contactPage - 1) * contactPageSize;
  var pageContacts = contacts.slice(startIdx, startIdx + contactPageSize);

  var html = '<div class="contact-page-info">Page ' + contactPage + ' of ' + totalPages + ' (' + contacts.length + ' contacts)</div>';
  for (var ci = 0; ci < pageContacts.length; ci++) {
    var c = pageContacts[ci];
    var rowNum = startIdx + ci + 1;
    var count = c._callCount || 0;
    var badgeClass = count === 0 ? 'background:#fef2f2;color:#d93025;' : 'background:#e8f4fd;color:#1a73e8;';
    html += '<div class="contact-item" draggable="true" data-id="' + c.id + '" data-idx="' + (startIdx + ci) + '" ' +
      'ondragstart="contactDragStart(event)" ondragover="contactDragOver(event)" ondrop="contactDrop(event)" ondragend="contactDragEnd(event)" ' +
      'onclick="toggleContactPanel(' + c.id + ', event)"' + (c.hidden ? ' style="opacity:0.5;"' : '') + '>' +
      '<input type="checkbox" class="contact-select-cb" onclick="event.stopPropagation();updateBulkSendBtn()" data-id="' + c.id + '">' +
      '<span class="contact-row-num">' + rowNum + '</span>' +
      '<span class="contact-handle" onclick="event.stopPropagation();">&#x2630;</span>' +
      '<span class="contact-name">' + escHtml(c.name) + (c.number ? ' <span style="color:#999;font-size:12px;font-weight:400;">' + escHtml(c.number) + '</span>' : '') + (c.hidden ? ' <span style="color:#999;font-size:10px;">(hidden)</span>' : '') + '</span>' +
      '<span class="contact-call-badge" style="' + badgeClass + '">' + count + ' calls</span>' +
      (c.number ? '<span class="contact-wa-icon" onclick="event.stopPropagation();sendWhatsApp(\'' + escHtml(c.number) + '\')" title="Send WhatsApp">&#x1F4AC;</span>' : '') +
      '<span class="contact-expand-icon" id="expand-icon-' + c.id + '">&#x25B6;</span>' +
      '<span class="contact-delete-icon" onclick="event.stopPropagation();if(confirm(\'Delete this contact?\'))deleteContact(' + c.id + ')" title="Delete contact">&#x2716;</span></div>' +
      '<div class="contact-panel" id="contact-panel-' + c.id + '" style="display:none;"></div>';
  }
  // Pagination controls
  html += '<div class="contact-pagination">';
  if (contactPage > 1) html += '<button class="btn btn-sm btn-secondary" onclick="contactPage--;loadContacts()">&#x25C0; Prev</button> ';
  html += '<span class="contact-page-num">' + contactPage + ' / ' + totalPages + '</span>';
  if (contactPage < totalPages) html += ' <button class="btn btn-sm btn-secondary" onclick="contactPage++;loadContacts()">Next &#x25B6;</button>';
  html += '</div>';

  container.innerHTML = html;
}

function contactDragStart(e) {
  e.dataTransfer.setData('text/plain', e.currentTarget.dataset.id);
  e.currentTarget.classList.add('dragging');
}
function contactDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}
function contactDragEnd(e) {
  document.querySelectorAll('.contact-item').forEach(function(el) { el.classList.remove('dragging', 'drag-over'); });
}
function contactDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  var draggedId = parseInt(e.dataTransfer.getData('text/plain'));
  var targetEl = e.currentTarget;
  var items = Array.from(document.querySelectorAll('.contact-item'));
  var draggedIdx = items.findIndex(function(el) { return parseInt(el.dataset.id) === draggedId; });
  var targetIdx = items.indexOf(targetEl);
  if (draggedIdx === -1 || draggedIdx === targetIdx) return;

  if (draggedIdx < targetIdx) { targetEl.parentNode.insertBefore(items[draggedIdx], targetEl.nextSibling); }
  else { targetEl.parentNode.insertBefore(items[draggedIdx], targetEl); }

  // Re-save order using global indices
  var newItems = document.querySelectorAll('.contact-item');
  var updates = [];
  newItems.forEach(function(el, idx) {
    var id = parseInt(el.dataset.id);
    var globalIdx = parseInt(el.dataset.idx);
    updates.push(sb.from('todo_contacts').update({ order_index: globalIdx }).eq('id', id));
  });
  Promise.all(updates).catch(function(){});
}

function toggleContactPanel(contactId, event) {
  if (event) {
    var handle = event.target.closest('.contact-handle');
    if (handle) return;
  }
  var panel = document.getElementById('contact-panel-' + contactId);
  var icon = document.getElementById('expand-icon-' + contactId);
  if (!panel) return;
  if (panel.style.display !== 'block') {
    panel.style.display = 'block';
    if (icon) icon.classList.add('open');
    loadContactPanel(contactId);
  } else {
    panel.style.display = 'none';
    if (icon) icon.classList.remove('open');
  }
}

async function loadContactPanel(contactId) {
  var panel = document.getElementById('contact-panel-' + contactId);
  if (!panel) return;

  // Load contact data
  var { data: contactData } = await sb.from('todo_contacts').select('hidden, number').eq('id', contactId).single();
  var isHidden = contactData ? contactData.hidden : false;

  // Load notes
  var { data: notes } = await sb.from('todo_contact_notes').select('*').eq('contact_id', contactId).order('created_at', { ascending: false });
  // Load calls
  var { data: calls } = await sb.from('todo_contact_calls').select('*').eq('contact_id', contactId).order('called_at', { ascending: false });

  var html = '<div style="display:flex;gap:16px;flex-wrap:wrap;">';

  // Notes section
  html += '<div style="flex:1;min-width:200px;"><h4>Notes</h4>';
  if (notes && notes.length) {
    notes.forEach(function(n) {
      html += '<div class="entry-row"><span class="entry-text">' + escHtml(n.text) + '</span>' +
        '<button class="btn btn-sm btn-danger" onclick="deleteContactNote(' + n.id + ',' + contactId + ')">X</button></div>';
    });
  } else { html += '<p style="font-size:12px;color:#999;">No notes yet.</p>'; }
  html += '<div class="add-row"><input type="text" id="new-note-' + contactId + '" placeholder="Add note..." onkeydown="if(event.key===\'Enter\')addContactNote(' + contactId + ')">' +
    '<button class="btn btn-sm btn-primary" onclick="addContactNote(' + contactId + ')">Add</button></div></div>';

  // Calls section
  html += '<div style="flex:1;min-width:200px;"><h4>Call History</h4>';
  if (calls && calls.length) {
    calls.forEach(function(cl) {
      var dt = cl.called_at.substring(0, 16).replace('T', ' ');
      html += '<div class="entry-row"><span class="entry-time">' + escHtml(dt) + '</span>' +
        '<button class="btn btn-sm btn-danger" onclick="deleteContactCall(' + cl.id + ',' + contactId + ')">X</button></div>';
    });
  } else { html += '<p style="font-size:12px;color:#999;">No calls logged yet.</p>'; }
  html += '<div class="add-row"><input type="datetime-local" id="new-call-' + contactId + '" value="' + new Date().toISOString().substring(0, 16) + '">' +
    '<button class="btn btn-sm btn-primary" onclick="addContactCall(' + contactId + ')">Log</button></div></div>';

  html += '</div>';

  // Hide/Unhide, WhatsApp and Delete buttons
  html += '<div style="margin-top:12px;text-align:right;display:flex;gap:8px;justify-content:flex-end;">' +
    (contactData && contactData.number ? '<button class="btn btn-sm btn-primary" onclick="sendWhatsApp(\'' + escHtml(contactData.number) + '\')" style="background:#25D366;border-color:#25D366;">&#x1F4AC; WhatsApp</button>' : '') +
    '<button class="btn btn-sm btn-secondary" id="hide-btn-' + contactId + '" onclick="toggleContactVisibility(' + contactId + ')"></button>' +
    '<button class="btn btn-sm btn-danger" onclick="deleteContact(' + contactId + ')">Delete Contact</button></div>';

  panel.innerHTML = html;

  // Set hide/unhide button text
  var hideBtn = document.getElementById('hide-btn-' + contactId);
  if (hideBtn) hideBtn.textContent = isHidden ? 'Unhide' : 'Hide';
}

function showAddContactModal() {
  var html = '<h3>Add Contact</h3>' +
    '<label>Name</label><input id="new-contact-name" placeholder="Contact name" onkeydown="if(event.key===\'Enter\')document.getElementById(\'new-contact-number\').focus()">' +
    '<label>Phone (optional)</label><input id="new-contact-number" placeholder="Phone number" onkeydown="if(event.key===\'Enter\')saveContact()">' +
    '<div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button class="btn btn-primary" onclick="saveContact()">Add</button></div>';
  showModal(html);
  setTimeout(function() { var inp = document.getElementById('new-contact-name'); if (inp) inp.focus(); }, 100);
}

async function saveContact() {
  var name = document.getElementById('new-contact-name').value.trim();
  if (!name) return alert('Name is required');
  var number = document.getElementById('new-contact-number') ? document.getElementById('new-contact-number').value.trim() : '';
  closeModal();

  var { data: existing } = await sb.from('todo_contacts').select('order_index').eq('user_id', currentUser.id).order('order_index', { ascending: false }).limit(1);
  var nextOrder = (existing && existing.length) ? existing[0].order_index + 1 : 0;
  var { data: idExist } = await sb.from('todo_contacts').select('id').order('id', { ascending: false }).limit(1);
  var newId = (idExist && idExist.length) ? idExist[0].id + 1 : 1;
  var now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  var payload = { id: newId, name: name, order_index: nextOrder, user_id: currentUser.id, created_at: now };
  if (number) payload.number = number;
  var { error } = await sb.from('todo_contacts').insert(payload);
  if (error) {
    // Retry without number if column doesn't exist
    if (number) { delete payload.number; var { error: e2 } = await sb.from('todo_contacts').insert(payload); if (e2) return alert('Error: ' + e2.message); }
    else return alert('Error: ' + error.message);
  }
  loadContacts();
}

async function deleteContact(contactId) {
  if (!confirm('Delete this contact and all associated notes & calls?')) return;
  await sb.from('todo_contact_notes').delete().eq('contact_id', contactId);
  await sb.from('todo_contact_calls').delete().eq('contact_id', contactId);
  await sb.from('todo_contacts').delete().eq('id', contactId);
  loadContacts();
}

async function toggleContactVisibility(contactId) {
  var { data: c } = await sb.from('todo_contacts').select('hidden').eq('id', contactId).single();
  if (!c) return;
  var newVal = !c.hidden;
  await sb.from('todo_contacts').update({ hidden: newVal }).eq('id', contactId);
  loadContacts();
}

function sendWhatsApp(number) {
  var cleaned = number.replace(/[^\d+]/g, '');
  window.open('https://wa.me/' + encodeURIComponent(cleaned), '_blank');
}

function updateBulkSendBtn() {
  var btn = document.getElementById('bulk-send-btn');
  if (!btn) return;
  var checked = document.querySelectorAll('.contact-select-cb:checked').length;
  btn.style.display = checked ? 'inline-flex' : 'none';
  btn.textContent = '\u{1F4AC} Send to Selected (' + checked + ')';
}

function getSelectedContactIds() {
  var ids = [];
  document.querySelectorAll('.contact-select-cb:checked').forEach(function(cb) {
    ids.push(parseInt(cb.dataset.id));
  });
  return ids;
}

async function sendBulkWhatsApp() {
  var ids = getSelectedContactIds();
  if (!ids.length) return;
  var msg = prompt('Enter message to send to ' + ids.length + ' contact(s):');
  if (!msg) return;
  var { data: contacts } = await sb.from('todo_contacts').select('number').in('id', ids);
  if (!contacts || !contacts.length) return;
  var encoded = encodeURIComponent(msg);
  contacts.forEach(function(c) {
    if (c.number) {
      var cleaned = c.number.replace(/[^\d+]/g, '');
      window.open('https://wa.me/' + encodeURIComponent(cleaned) + '?text=' + encoded, '_blank');
    }
  });
  // Uncheck all
  document.querySelectorAll('.contact-select-cb:checked').forEach(function(cb) { cb.checked = false; });
  updateBulkSendBtn();
}

async function addContactNote(contactId) {
  var input = document.getElementById('new-note-' + contactId);
  var text = input.value.trim();
  if (!text) return;
  input.value = '';
  var { data: idExist } = await sb.from('todo_contact_notes').select('id').order('id', { ascending: false }).limit(1);
  var newId = (idExist && idExist.length) ? idExist[0].id + 1 : 1;
  var now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  await sb.from('todo_contact_notes').insert({ id: newId, contact_id: contactId, text: text, created_at: now });
  loadContactPanel(contactId);
}

async function deleteContactNote(noteId, contactId) {
  if (!confirm('Delete this note?')) return;
  await sb.from('todo_contact_notes').delete().eq('id', noteId);
  loadContactPanel(contactId);
}

async function addContactCall(contactId) {
  var input = document.getElementById('new-call-' + contactId);
  var datetime = input.value;
  if (!datetime) return;
  var calledAt = datetime.replace('T', ' ') + ':00';
  var { data: idExist } = await sb.from('todo_contact_calls').select('id').order('id', { ascending: false }).limit(1);
  var newId = (idExist && idExist.length) ? idExist[0].id + 1 : 1;
  var now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  await sb.from('todo_contact_calls').insert({ id: newId, contact_id: contactId, called_at: calledAt, created_at: now });
  loadContactPanel(contactId);
  loadContacts();
}

async function deleteContactCall(callId, contactId) {
  if (!confirm('Delete this call entry?')) return;
  await sb.from('todo_contact_calls').delete().eq('id', callId);
  loadContactPanel(contactId);
  loadContacts();
}

async function importLocationHistoryContacts() {
  var btn = document.getElementById('import-lh-btn');
  if (btn) btn.disabled = true;
  try {
    var lhPhone = currentUser ? currentUser.email : null;

    var { data: existing } = await sb.from('todo_contacts').select('name, number').eq('user_id', currentUser.id);
    var existingNames = {};
    var existingNumbers = {};
    var hasNumberCol = true;
    if (existing) {
      existing.forEach(function(c) {
        existingNames[c.name.toLowerCase().trim()] = true;
        if (c.number) existingNumbers[c.number.replace(/[^\d]/g, '')] = true;
      });
      // Check if number column exists
      if (existing.length && existing[0].number === undefined) hasNumberCol = false;
    }

    var { data: lhContacts, error } = await sb.from('phone_contacts').select('name, number').eq('phone', lhPhone);
    if (error) { alert('Error fetching from Location History: ' + error.message); return; }
    if (!lhContacts || !lhContacts.length) { alert('No contacts found in Location History.'); return; }

    var inserted = 0, skipped = 0, lhSeen = {};
    var { data: idExist } = await sb.from('todo_contacts').select('id').order('id', { ascending: false }).limit(1);
    var nextId = (idExist && idExist.length) ? idExist[0].id + 1 : 1;
    var { data: orderExist } = await sb.from('todo_contacts').select('order_index').eq('user_id', currentUser.id).order('order_index', { ascending: false }).limit(1);
    var nextOrder = (orderExist && orderExist.length) ? orderExist[0].order_index + 1 : 0;
    var now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    for (var i = 0; i < lhContacts.length; i++) {
      var c = lhContacts[i];
      var nameKey = c.name.toLowerCase().trim();
      var numKey = c.number ? c.number.replace(/[^\d]/g, '') : '';
      // Skip if name or number already exists in todo_contacts
      if (existingNames[nameKey]) { skipped++; continue; }
      if (numKey && existingNumbers[numKey]) { skipped++; continue; }
      // Skip if same name already imported from LH this batch
      if (lhSeen[nameKey]) { skipped++; continue; }
      if (numKey && lhSeen[numKey]) { skipped++; continue; }
      lhSeen[nameKey] = true;
      if (numKey) lhSeen[numKey] = true;
      var payload = { id: nextId++, name: c.name, order_index: nextOrder++, user_id: currentUser.id, created_at: now };
      if (hasNumberCol) payload.number = c.number || '';
      await sb.from('todo_contacts').insert(payload);
      inserted++;
    }
    alert('Imported ' + inserted + ' contacts' + (skipped ? ', skipped ' + skipped + ' duplicates' : '') + '.');
    loadContacts();
  } finally {
    if (btn) btn.disabled = false;
  }
}

function sortLeastCalled() {
  if (contactsSortState === 'name') contactsSortState = 'least-called';
  else if (contactsSortState === 'least-called') contactsSortState = 'most-called';
  else contactsSortState = 'name';
  var labels = { 'name': 'Sort: Name', 'least-called': 'Sort: Least Called', 'most-called': 'Sort: Most Called' };
  var btn = document.getElementById('sort-least-called');
  if (btn) btn.textContent = labels[contactsSortState] || 'Sort: Name';
  loadContacts();
}

async function mergeDuplicateContacts() {
  var { data: contacts } = await sb.from('todo_contacts').select('*').eq('user_id', currentUser.id);
  if (!contacts || contacts.length < 2) { alert('Not enough contacts to merge.'); return; }

  // Group duplicates by normalized name
  var groups = [];
  var seen = {};
  contacts.forEach(function(c) {
    var key = (c.name || '').toLowerCase().trim();
    if (!key) return;
    if (seen[key] !== undefined) { groups[seen[key]].push(c); }
    else { seen[key] = groups.length; groups.push([c]); }
  });

  // Also group by number (across different names)
  var numGroups = {};
  contacts.forEach(function(c) {
    if (!c.number) return;
    var numKey = c.number.replace(/[^\d]/g, '');
    if (!numKey) return;
    if (!numGroups[numKey]) numGroups[numKey] = [];
    numGroups[numKey].push(c);
  });
  Object.keys(numGroups).forEach(function(num) {
    var g = numGroups[num];
    if (g.length < 2) return;
    // Check if this group is already covered by a name group
    var alreadyCovered = groups.some(function(grp) {
      return grp.length > 1 && g.every(function(c) { return grp.some(function(x) { return x.id === c.id; }); });
    });
    if (!alreadyCovered) groups.push(g);
  });

  var toMerge = groups.filter(function(g) { return g.length > 1; });
  if (!toMerge.length) { alert('No duplicate contacts found.'); return; }

  // Build summary HTML
  var summary = '<h3>Merge Duplicate Contacts</h3><p style="font-size:13px;color:#666;margin-bottom:12px;">' + toMerge.length + ' duplicate group(s) found. Keep will retain notes & calls.</p>';
  toMerge.forEach(function(g, gi) {
    // Pick the best contact to keep: has number > has notes > first
    var keep = g[0];
    g.forEach(function(c) {
      if (c.number && !keep.number) keep = c;
      else if (c.number && keep.number && c.created_at < keep.created_at) keep = c;
    });
    summary += '<div style="border:1px solid #ddd;border-radius:6px;padding:10px;margin-bottom:8px;font-size:13px;">';
    summary += '<div style="font-weight:600;margin-bottom:4px;">Group ' + (gi + 1) + '</div>';
    g.forEach(function(c) {
      var isKeep = c.id === keep.id;
      summary += '<div style="padding:3px 6px;' + (isKeep ? 'background:#e8f4fd;border-radius:4px;' : '') + '">' +
        escHtml(c.name) + (c.number ? ' - ' + escHtml(c.number) : '') + (isKeep ? ' <strong>(keep)</strong>' : '') + '</div>';
    });
    summary += '</div>';
  });
  summary += '<div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal();window._mergeData=null">Cancel</button>' +
    '<button class="btn btn-primary" onclick="closeModal();executeMerge(window._mergeData)">Merge ' + toMerge.length + ' Group(s)</button></div>';
  window._mergeData = toMerge;

  showModal(summary);
}

async function executeMerge(groups) {
  var merged = 0, deleted = 0;
  for (var gi = 0; gi < groups.length; gi++) {
    var g = groups[gi];
    // Pick keep: has number > has notes > first
    var keep = g[0];
    for (var ci = 0; ci < g.length; ci++) {
      if (g[ci].number && !keep.number) keep = g[ci];
      else if (g[ci].number && keep.number && g[ci].created_at < keep.created_at) keep = g[ci];
    }
    var toDelete = g.filter(function(c) { return c.id !== keep.id; });
    for (var di = 0; di < toDelete.length; di++) {
      var del = toDelete[di];
      // Transfer notes
      await sb.from('todo_contact_notes').update({ contact_id: keep.id }).eq('contact_id', del.id);
      // Transfer calls
      await sb.from('todo_contact_calls').update({ contact_id: keep.id }).eq('contact_id', del.id);
      // Delete
      await sb.from('todo_contacts').delete().eq('id', del.id);
      deleted++;
    }
    merged++;
  }
  alert('Merged ' + merged + ' group(s), deleted ' + deleted + ' duplicate(s).');
  loadContacts();
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

// ======= Permament Tasks =======

async function loadPermanentTasks() {
  const { data } = await sb.from('todo_permanent_tasks').select('*').eq('user_id', currentUser.id).order('order_index');
  const container = document.getElementById('permanent-task-list');
  if (!data || !data.length) {
    container.innerHTML = '<div class="card"><p style="color:#666;text-align:center;padding:20px;">No todos yet. Add your first task above.</p></div>';
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const taskIds = data.map(t => t.id);
  const { data: logs } = await sb.from('todo_permanent_task_logs').select('*')
    .eq('user_id', currentUser.id).eq('log_date', today).in('task_id', taskIds);
  const logMap = {};
  if (logs) logs.forEach(l => { logMap[l.task_id] = l; });

  selectedPermTaskIds.clear();
  document.getElementById('delete-selected-perm-btn').style.display = 'none';

  const parents = data.filter(t => !t.parent_id);
  const children = {};
  data.filter(t => t.parent_id).forEach(t => {
    if (!children[t.parent_id]) children[t.parent_id] = [];
    children[t.parent_id].push(t);
  });

  function renderTask(t, depth) {
    const log = logMap[t.id];
    const completed = log ? log.is_completed : 0;
    const hasChildren = children[t.id] && children[t.id].length;
    const indent = depth * 24;
    const isExpanded = expandedPermTaskIds.has(t.id);
    return '<div class="card perm-task-card" style="margin-left:' + indent + 'px;border-left:' + (depth ? '2px solid #e8e8e8' : 'none') + '">' +
      '<div class="task-item" data-id="' + t.id + '" data-parent="' + (t.parent_id || '') + '" draggable="true">' +
      '<span class="drag-handle">&#x2630;</span>' +
      (hasChildren ? '<span class="perm-expand-icon ' + (isExpanded ? 'open' : '') + '" onclick="event.stopPropagation();togglePermChildren(' + t.id + ');loadPermanentTasks()">&#x25B6;</span>' : '<span class="perm-expand-placeholder"></span>') +
      '<input type="checkbox" class="task-select" onchange="togglePermSelect(' + t.id + ', this.checked)" style="width:16px;height:16px;accent-color:#d93025;cursor:pointer;">' +
      '<input type="checkbox" class="task-check" ' + (completed ? 'checked' : '') + ' onchange="togglePermanentTask(' + t.id + ', this.checked, loadPermanentTasks)">' +
      '<span class="task-title' + (completed ? ' done' : '') + '">' + escHtml(t.title) + '</span>' +
      '<span class="task-status-dot ' + (completed ? 'done' : 'pending') + '"></span>' +
      (depth === 0 ? '<button class="btn btn-sm btn-ghost" onclick="showPermanentTaskModal(null,' + t.id + ')" title="Add subtask">+ Sub</button>' : '') +
      '<button class="btn btn-sm btn-secondary" onclick="showPermanentTaskModal(' + t.id + ')">Edit</button>' +
      '<button class="btn btn-sm btn-danger" onclick="deletePermanentTask(' + t.id + ')">Del</button></div></div>';
  }

  function renderSubtree(parentId, depth) {
    const subs = children[parentId] || [];
    if (!subs.length) return '';
    let html = '<div class="perm-children" id="perm-children-' + parentId + '" style="display:' + (expandedPermTaskIds.has(parentId) ? 'block' : 'none') + '">';
    for (const t of subs) {
      html += renderTask(t, depth);
      html += renderSubtree(t.id, depth + 1);
    }
    html += '</div>';
    return html;
  }

  let html = '';
  for (const p of parents) {
    html += renderTask(p, 0);
    html += renderSubtree(p.id, 1);
  }
  container.innerHTML = html;
}

function togglePermChildren(taskId) {
  if (expandedPermTaskIds.has(taskId)) {
    expandedPermTaskIds.delete(taskId);
  } else {
    expandedPermTaskIds.add(taskId);
  }
}

var dragFromHandle = false;
document.addEventListener('mousedown', function(e) {
  dragFromHandle = !!e.target.closest('.drag-handle');
});

// Daily tasks — event delegation on #daily-tasks
(function() {
  var c = document.getElementById('daily-tasks');
  if (!c) return;
  c.addEventListener('dragstart', function(e) {
    if (!dragFromHandle) { e.preventDefault(); return; }
    dragFromHandle = false;
    var item = e.target.closest('.task-item');
    if (!item) { e.preventDefault(); return; }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: parseInt(item.dataset.id), schedule: parseInt(item.dataset.schedule) }));
    item.classList.add('dragging');
  });
  c.addEventListener('dragenter', function(e) {
    var item = e.target.closest('.task-item');
    if (!item) return;
    e.preventDefault();
    item.classList.add('drag-over');
  });
  c.addEventListener('dragover', function(e) {
    var item = e.target.closest('.task-item');
    if (!item) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    item.classList.add('drag-over');
  });
  c.addEventListener('drop', async function(e) {
    var targetEl = e.target.closest('.task-item');
    if (!targetEl) return;
    e.preventDefault();
    targetEl.classList.remove('drag-over');
    var data = JSON.parse(e.dataTransfer.getData('text/plain'));
    var draggedId = data.id;
    var items = Array.from(c.querySelectorAll('.task-item'));
    var draggedIdx = items.findIndex(function(el) { return parseInt(el.dataset.id) === draggedId; });
    var targetIdx = items.indexOf(targetEl);
    if (draggedIdx === -1 || draggedIdx === targetIdx) return;
    if (draggedIdx < targetIdx) targetEl.parentNode.insertBefore(items[draggedIdx], targetEl.nextSibling);
    else targetEl.parentNode.insertBefore(items[draggedIdx], targetEl);
    items = Array.from(c.querySelectorAll('.task-item'));
    var updates = items.map(function(el, idx) {
      return sb.from('todo_task_instances').update({ order_index: idx }).eq('id', parseInt(el.dataset.id));
    });
    await Promise.all(updates);
  });
  c.addEventListener('dragend', function(e) {
    c.querySelectorAll('.task-item').forEach(function(el) { el.classList.remove('dragging', 'drag-over'); });
  });
})();

(function() {
  var c = document.getElementById('permanent-task-list');
  if (!c) return;
  c.addEventListener('dragstart', function(e) {
    if (!dragFromHandle) { e.preventDefault(); return; }
    dragFromHandle = false;
    var item = e.target.closest('.task-item');
    if (!item) { e.preventDefault(); return; }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: parseInt(item.dataset.id), parent: item.dataset.parent }));
    item.closest('.perm-task-card').classList.add('dragging');
  });
  c.addEventListener('dragenter', function(e) {
    var item = e.target.closest('.task-item');
    if (!item) return;
    e.preventDefault();
    item.closest('.perm-task-card').classList.add('drag-over');
  });
  c.addEventListener('dragover', function(e) {
    var item = e.target.closest('.task-item');
    if (!item) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    item.closest('.perm-task-card').classList.add('drag-over');
  });
  c.addEventListener('drop', async function(e) {
    var targetItem = e.target.closest('.task-item');
    if (!targetItem) return;
    e.preventDefault();
    var targetCard = targetItem.closest('.perm-task-card');
    targetCard.classList.remove('drag-over');
    var data = JSON.parse(e.dataTransfer.getData('text/plain'));
    var draggedId = data.id;
    var draggedParent = data.parent;
    var targetId = parseInt(targetItem.dataset.id);
    var targetParent = targetItem.dataset.parent;
    if (draggedId === targetId || draggedParent !== targetParent) return;
    var cards = Array.from(c.querySelectorAll('.perm-task-card')).filter(function(el) {
      return el.querySelector('.task-item').dataset.parent === draggedParent;
    });
    if (cards.length < 2) return;
    var newOrder = cards.map(function(el) { return parseInt(el.querySelector('.task-item').dataset.id); });
    var updates = newOrder.map(function(id, idx) {
      return sb.from('todo_permanent_tasks').update({ order_index: idx }).eq('id', id);
    });
    await Promise.all(updates);
    loadPermanentTasks();
  });
  c.addEventListener('dragend', function(e) {
    c.querySelectorAll('.perm-task-card').forEach(function(el) { el.classList.remove('dragging', 'drag-over'); });
  });
})();

function togglePermSelect(taskId, checked) {
  if (checked) selectedPermTaskIds.add(taskId);
  else selectedPermTaskIds.delete(taskId);
  document.getElementById('delete-selected-perm-btn').style.display = selectedPermTaskIds.size ? 'inline-block' : 'none';
}

async function deleteSelectedPermTasks() {
  if (!selectedPermTaskIds.size) return;
  const count = selectedPermTaskIds.size;
  if (!confirm('Delete ' + count + ' todo' + (count > 1 ? 's' : '') + '?')) return;
  const ids = Array.from(selectedPermTaskIds);
  selectedPermTaskIds.clear();
  document.getElementById('delete-selected-perm-btn').style.display = 'none';
  await sb.from('todo_permanent_task_logs').delete().in('task_id', ids);
  await sb.from('todo_permanent_tasks').delete().in('id', ids);
  loadPermanentTasks();
}

function showPermanentTaskModal(id, parentId) {
  (async () => {
    let task = null;
    if (id) {
      const { data: t } = await sb.from('todo_permanent_tasks').select('*').eq('id', id).single();
      if (t) task = t;
    }
    const title = id ? 'Edit Todo' : 'New Todo';
    const action = id ? ('savePermanentTask(' + id + ')') : (parentId ? 'savePermanentTask(null,' + parentId + ')' : 'savePermanentTask(null)');

    const { data: allTasks } = await sb.from('todo_permanent_tasks').select('*').eq('user_id', currentUser.id).order('order_index');
    let parentOptions = '';
    if (allTasks && allTasks.length) {
      parentOptions = '<label>Parent Task</label><select id="pt-parent"><option value="">(top-level)</option>';
      for (const t of allTasks) {
        if (id && t.id === id) continue;
        const selected = (task && task.parent_id === t.id) || (parentId && parentId === t.id) ? 'selected' : '';
        parentOptions += '<option value="' + t.id + '" ' + selected + '>' + escHtml(t.title) + '</option>';
      }
      parentOptions += '</select>';
    }

    const html = '<h3>' + title + '</h3>' +
      parentOptions +
      '<label>Task Description</label><input id="pt-title" value="' + (task ? escHtml(task.title) : '') + '" placeholder="e.g. Morning exercise">' +
      '<div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-primary" onclick="' + action + '">Save</button></div>';
    showModal(html);
  })();
}

async function savePermanentTask(id, parentId) {
  const title = document.getElementById('pt-title').value.trim();
  if (!title) return alert('Task description is required');
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const parentSelect = document.getElementById('pt-parent');
  const actualParentId = parentId || (parentSelect ? (parentSelect.value || null) : null);

  if (id) {
    const updateData = { title };
    if (parentSelect !== null) updateData.parent_id = actualParentId;
    if (parentId) updateData.parent_id = parentId;
    const { error } = await sb.from('todo_permanent_tasks').update(updateData).eq('id', id);
    if (error) return alert('Error: ' + error.message);
  } else {
    const { data: existing } = await sb.from('todo_permanent_tasks').select('id').order('id', { ascending: false }).limit(1);
    const newId = (existing && existing.length) ? existing[0].id + 1 : 1;
    const { data: lastOrder } = await sb.from('todo_permanent_tasks').select('order_index').eq('user_id', currentUser.id).order('order_index', { ascending: false }).limit(1);
    const nextOrder = (lastOrder && lastOrder.length) ? lastOrder[0].order_index + 1 : 0;
    const { error } = await sb.from('todo_permanent_tasks').insert({
      id: newId, title, parent_id: actualParentId,
      user_id: currentUser.id, created_at: now, order_index: nextOrder
    });
    if (error) return alert('Error: ' + error.message);
  }
  closeModal();
  loadPermanentTasks();
}

async function deletePermanentTask(id) {
  if (!confirm('Delete this task and all its subtasks?')) return;
  const { data: children } = await sb.from('todo_permanent_tasks').select('id').eq('parent_id', id);
  const ids = [id];
  if (children) {
    for (const c of children) ids.push(c.id);
    const { data: grandchildren } = await sb.from('todo_permanent_tasks').select('id').in('parent_id', ids);
    if (grandchildren) for (const g of grandchildren) ids.push(g.id);
  }
  await sb.from('todo_permanent_task_logs').delete().in('task_id', ids);
  await sb.from('todo_permanent_tasks').delete().in('id', ids);
  loadPermanentTasks();
}

async function loadDailyPermanentTasks() {
  const date = document.getElementById('daily-date').value;
  const container = document.getElementById('daily-permanent');
  if (!date) { container.innerHTML = ''; return; }

  const { data: tasks } = await sb.from('todo_permanent_tasks').select('*').eq('user_id', currentUser.id).order('order_index');
  if (!tasks || !tasks.length) { container.innerHTML = ''; return; }

  const taskIds = tasks.map(t => t.id);
  const { data: logs } = await sb.from('todo_permanent_task_logs').select('*')
    .eq('user_id', currentUser.id).eq('log_date', date).in('task_id', taskIds);

  const logMap = {};
  if (logs) logs.forEach(l => { logMap[l.task_id] = l; });

  const parents = tasks.filter(t => !t.parent_id);
  const children = {};
  tasks.filter(t => t.parent_id).forEach(t => {
    if (!children[t.parent_id]) children[t.parent_id] = [];
    children[t.parent_id].push(t);
  });

  function renderTask(t, depth) {
    const log = logMap[t.id];
    const completed = log ? log.is_completed : 0;
    const hasChildren = children[t.id] && children[t.id].length;
    const indent = depth * 20;
    const isExpanded = expandedPermTaskIds.has(t.id);
    return '<div class="task-item" style="padding-left:' + indent + 'px;border-left:' + (depth ? '2px solid #e8e8e8' : 'none') + '">' +
      (hasChildren ? '<span class="perm-expand-icon ' + (isExpanded ? 'open' : '') + '" onclick="event.stopPropagation();togglePermChildren(' + t.id + ');loadDailyPermanentTasks()">&#x25B6;</span>' : '<span class="perm-expand-placeholder"></span>') +
      '<input type="checkbox" class="task-check" ' + (completed ? 'checked' : '') + ' onchange="togglePermanentTask(' + t.id + ', this.checked, loadDailyPermanentTasks)">' +
      '<span class="task-title' + (completed ? ' done' : '') + '">' + escHtml(t.title) + '</span>' +
      '<span class="task-status-dot ' + (completed ? 'done' : 'pending') + '"></span></div>';
  }

  function renderSubtree(parentId, depth) {
    const subs = children[parentId] || [];
    if (!subs.length) return '';
    let html = '<div class="perm-children" id="dperm-children-' + parentId + '" style="display:' + (expandedPermTaskIds.has(parentId) ? 'block' : 'none') + '">';
    for (const t of subs) {
      html += renderTask(t, depth);
      html += renderSubtree(t.id, depth + 1);
    }
    html += '</div>';
    return html;
  }

  let html = '<div style="font-size:13px;font-weight:600;color:#7c3aed;margin-bottom:8px;">&#128204; Todo</div>';
  for (const p of parents) {
    html += renderTask(p, 0);
    html += renderSubtree(p.id, 1);
  }
  container.innerHTML = html;
}

async function togglePermanentTask(taskId, completed, cb) {
  const date = document.getElementById('daily-date').value;
  if (!date) return;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // Toggle children too
  const { data: children } = await sb.from('todo_permanent_tasks').select('id').eq('parent_id', taskId);
  const allIds = [taskId];
  if (children) for (const c of children) allIds.push(c.id);

  for (const id of allIds) {
    const { data: existing } = await sb.from('todo_permanent_task_logs').select('*')
      .eq('task_id', id).eq('user_id', currentUser.id).eq('log_date', date);

    if (existing && existing.length) {
      await sb.from('todo_permanent_task_logs').update({
        is_completed: completed ? 1 : 0,
        completed_at: completed ? now : null
      }).eq('id', existing[0].id);
    } else {
      const { data: last } = await sb.from('todo_permanent_task_logs').select('id').order('id', { ascending: false }).limit(1);
      const newId = (last && last.length) ? last[0].id + 1 : 1;
      await sb.from('todo_permanent_task_logs').insert({
        id: newId, task_id: id, user_id: currentUser.id,
        log_date: date, is_completed: completed ? 1 : 0,
        completed_at: completed ? now : null
      });
    }
  }
  loadDailyPermanentTasks();
  if (cb) cb();
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

// Auto-refresh daily schedule every 60s to keep current-task highlight updated
setInterval(function() {
  if (!currentUser) return;
  if (currentView === 'daily') loadDailySchedule();
  if (currentView === 'contacts') loadContacts();
}, 60000);

// Init
checkAuth();
