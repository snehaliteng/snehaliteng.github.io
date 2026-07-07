/* ============================================================
   EduERP - Main Application
   ============================================================ */

let erpUser = null;
let erpProfile = null;
let erpOrg = null;
let currentPage = 'dashboard';

const NAV = {
  super_admin: {
    sections: [
      { label: 'Main', items: [
        { id: 'dashboard', icon: '📊', label: 'Dashboard' },
        { id: 'schools', icon: '🏫', label: 'Schools' },
        { id: 'plans', icon: '📋', label: 'Plans' },
      ]},
      { label: 'Finance', items: [
        { id: 'revenue', icon: '💰', label: 'Revenue' },
        { id: 'payments', icon: '💳', label: 'Payments' },
      ]},
    ]
  },
  school_admin: {
    sections: [
      { label: 'Main', items: [
        { id: 'dashboard', icon: '📊', label: 'Dashboard' },
        { id: 'students', icon: '👨‍🎓', label: 'Students' },
        { id: 'teachers', icon: '👩‍🏫', label: 'Teachers' },
        { id: 'classes', icon: '📚', label: 'Classes' },
      ]},
      { label: 'Academics', items: [
        { id: 'subjects', icon: '📖', label: 'Subjects' },
        { id: 'syllabus', icon: '📄', label: 'Syllabus' },
        { id: 'attendance', icon: '✅', label: 'Attendance' },
        { id: 'exams', icon: '📝', label: 'Exams' },
      ]},
      { label: 'Finance', items: [
        { id: 'fees', icon: '💵', label: 'Fees' },
        { id: 'donations', icon: '🎁', label: 'Donations' },
        { id: 'expenses', icon: '📉', label: 'Expenses' },
      ]},
      { label: 'Other', items: [
        { id: 'calendar', icon: '📅', label: 'Calendar' },
        { id: 'reports', icon: '📈', label: 'Reports' },
      ]},
    ]
  },
  teacher: {
    sections: [
      { label: 'Main', items: [
        { id: 'dashboard', icon: '📊', label: 'Dashboard' },
        { id: 'my-classes', icon: '📚', label: 'My Classes' },
        { id: 'take-attendance', icon: '✅', label: 'Attendance' },
        { id: 'exams', icon: '📝', label: 'Exams' },
        { id: 'syllabus', icon: '📄', label: 'Syllabus' },
      ]},
    ]
  },
  student: {
    sections: [
      { label: 'Main', items: [
        { id: 'dashboard', icon: '📊', label: 'Dashboard' },
        { id: 'my-attendance', icon: '✅', label: 'Attendance' },
        { id: 'my-exams', icon: '📝', label: 'Exams' },
        { id: 'my-fees', icon: '💵', label: 'Fees' },
        { id: 'calendar', icon: '📅', label: 'Calendar' },
      ]},
    ]
  }
};

/* ============================================================
   INIT
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  setupMobileToggle();
});

async function checkAuth() {
  const { data: { user } } = await erp.auth.getUser();
  if (!user) { showLogin(); return; }
  erpUser = user;
  const { data: profile } = await erp.from('profiles').select('*, organizations(*)').eq('user_id', user.id).single();
  if (!profile) { showLogin(); return; }
  erpProfile = profile;
  erpOrg = profile.organizations;
  if (erpProfile.role === 'super_admin' && !erpOrg) {
    erpOrg = { id: 0, name: 'Super Admin', subscription_plan: 'premium', status: 'active' };
  }
  showApp();
}

/* ============================================================
   AUTH
   ============================================================ */

async function erpLogin(email, password) {
  const { data, error } = await erp.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await checkAuth();
}

async function erpLogout() {
  await erp.auth.signOut();
  erpUser = null; erpProfile = null; erpOrg = null;
  showLogin();
}

async function erpRegister(data) {
  const { data: authData, error: authError } = await erp.auth.signUp({
    email: data.email,
    password: data.password,
    options: { data: { full_name: data.full_name } }
  });
  if (authError) throw authError;
  await erp.from('profiles').update({
    full_name: data.full_name, phone: data.phone || '',
    role: data.role || 'school_admin', org_id: data.org_id || null
  }).eq('user_id', authData.user.id);
  return authData;
}

/* ============================================================
   UI HELPERS
   ============================================================ */

function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function el(id) { return document.getElementById(id); }

function modal(title, contentHtml, onConfirm) {
  el('modal-title').textContent = title;
  el('modal-body').innerHTML = contentHtml;
  el('modal-confirm').onclick = onConfirm || null;
  el('modal-confirm').style.display = onConfirm ? '' : 'none';
  el('modal-overlay').classList.add('open');
}

function closeModal() { el('modal-overlay').classList.remove('open'); }

function openSlideModal(title, contentHtml) {
  el('slide-modal-title').textContent = title;
  el('slide-modal-body').innerHTML = contentHtml;
  el('slide-modal-overlay').classList.add('open');
}

function closeSlideModal() { el('slide-modal-overlay').classList.remove('open'); }

function getFormData(formId) {
  const fd = new FormData(el(formId));
  const data = {};
  for (const [k, v] of fd) data[k] = v;
  return data;
}

function renderTable(headers, rows, actions) {
  if (!rows.length) return '<div class="empty-state"><div class="icon">📭</div><p>No data found.</p></div>';
  let h = headers.map(h => `<th>${h}</th>`).join('');
  if (actions) h += '<th>Actions</th>';
  let r = rows.map(row => {
    let cells = headers.map(h => `<td>${row[h] ?? ''}</td>`).join('');
    if (actions) cells += `<td>${actions(row)}</td>`;
    return `<tr>${cells}</tr>`;
  }).join('');
  return `<div class="table-wrap"><table><thead><tr>${h}</tr></thead><tbody>${r}</tbody></table></div>`;
}

/* ============================================================
   APP SHELL
   ============================================================ */

function showLogin() {
  el('login-page').style.display = 'flex';
  el('app-shell').style.display = 'none';
  el('login-error').style.display = 'none';
}

function showApp() {
  el('login-page').style.display = 'none';
  el('app-shell').style.display = 'flex';
  el('sidebar-user-name').textContent = erpProfile.full_name;
  el('sidebar-user-role').textContent = erpProfile.role.replace('_', ' ').toUpperCase();
  el('sidebar-org-name').textContent = erpOrg ? erpOrg.name : '';
  renderSidebar();
  navigate('dashboard');
}

function renderSidebar() {
  const nav = NAV[erpProfile.role];
  if (!nav) return;
  let html = '';
  for (const section of nav.sections) {
    html += `<div class="nav-section">${section.label}</div>`;
    for (const item of section.items) {
      html += `<a href="#" data-page="${item.id}" onclick="navigate('${item.id}')">${item.icon} ${item.label}</a>`;
    }
  }
  el('sidebar-nav').innerHTML = html;
}

function setupMobileToggle() {
  document.querySelector('.menu-toggle')?.addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('open');
  });
}

/* ============================================================
   NAVIGATION
   ============================================================ */

async function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
  const activeLink = document.querySelector(`.sidebar-nav a[data-page="${page}"]`);
  if (activeLink) activeLink.classList.add('active');
  el('sidebar').classList.remove('open');
  el('page-title').textContent = activeLink ? activeLink.textContent.trim() : page;
  el('content-area').innerHTML = '<div class="loading">Loading...</div>';

  try {
    const pages = {
      'dashboard': renderDashboard,
      'schools': renderSchools,
      'plans': renderPlans,
      'revenue': renderRevenue,
      'payments': () => renderTablePage('payments', 'Payments'),
      'students': renderStudents,
      'teachers': renderTeachers,
      'classes': renderClasses,
      'subjects': renderSubjects,
      'syllabus': renderSyllabus,
      'attendance': () => renderTablePage('attendance', 'Attendance'),
      'exams': renderExams,
      'fees': renderFees,
      'donations': renderDonations,
      'expenses': () => renderTablePage('expenses', 'Expenses'),
      'calendar': renderCalendar,
      'reports': renderReports,
      'my-classes': renderMyClasses,
      'take-attendance': renderTakeAttendance,
      'my-attendance': renderMyAttendance,
      'my-exams': renderMyExams,
      'my-fees': renderMyFees,
    };
    const renderer = pages[page];
    if (renderer) await renderer();
    else el('content-area').innerHTML = '<div class="empty-state"><p>Page under construction.</p></div>';
  } catch (e) {
    el('content-area').innerHTML = `<div class="empty-state"><p class="text-center" style="color:var(--danger)">Error: ${e.message}</p></div>`;
    showToast(e.message, 'error');
  }
}

/* ============================================================
   GENERIC TABLE PAGE
   ============================================================ */

async function renderTablePage(table, label) {
  const { data } = await erp.from(table).select('*').eq('org_id', erpOrg.id).order('created_at', { ascending: false });
  const cols = data && data.length ? Object.keys(data[0]).filter(k => !['org_id','created_at','updated_at'].includes(k)) : [];
  const rows = (data || []).map(r => {
    const row = {};
    cols.forEach(c => { row[c] = r[c] != null ? String(r[c]) : ''; });
    return row;
  });
  el('content-area').innerHTML = `<div class="card"><div class="card-header"><h3>${label}</h3></div><div class="card-body">${
    renderTable(cols.map(c => c.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())), rows)
  }</div></div>`;
}

/* ============================================================
   DASHBOARD
   ============================================================ */

async function renderDashboard() {
  const role = erpProfile.role;
  if (role === 'super_admin') return renderSuperAdminDashboard();
  if (role === 'school_admin') return renderSchoolAdminDashboard();
  if (role === 'teacher') return renderTeacherDashboard();
  if (role === 'student') return renderStudentDashboard();
}

async function renderSuperAdminDashboard() {
  const [orgs, plans, payments] = await Promise.all([
    erp.from('organizations').select('*'),
    erp.from('plans').select('*').eq('is_active', true),
    erp.from('payments').select('*').eq('status', 'completed'),
  ]);
  const totalOrgs = orgs.data?.length || 0;
  const activeOrgs = orgs.data?.filter(o => o.status === 'active').length || 0;
  const pendingOrgs = orgs.data?.filter(o => o.status === 'pending').length || 0;
  const totalRevenue = payments.data?.reduce((s, p) => s + Number(p.amount), 0) || 0;

  el('content-area').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Total Schools</div><div class="value">${totalOrgs}</div></div>
      <div class="stat-card"><div class="label">Active Schools</div><div class="value">${activeOrgs}</div></div>
      <div class="stat-card"><div class="label">Pending Approvals</div><div class="value" style="color:var(--warning)">${pendingOrgs}</div></div>
      <div class="stat-card"><div class="label">Total Revenue</div><div class="value">₹${totalRevenue.toLocaleString()}</div></div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Recent Organizations</h3></div>
      <div class="card-body">${renderTable(
        ['Name','Plan','Status','Created'],
        (orgs.data || []).slice(0,5).map(o => ({'Name': o.name, 'Plan': o.subscription_plan, 'Status': `<span class="badge badge-${o.status === 'active' ? 'success' : o.status === 'pending' ? 'warning' : 'danger'}">${o.status}</span>`, 'Created': new Date(o.created_at).toLocaleDateString()})),
        row => `<button class="btn btn-sm btn-outline" onclick="navigate('schools')">View</button>`
      )}</div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Plans Overview</h3></div>
      <div class="card-body">${renderTable(
        ['Plan','Price','Billing','Max Students','Max Teachers'],
        (plans.data || []).map(p => ({'Plan': p.name, 'Price': `₹${p.price}`, 'Billing': p.billing_cycle, 'Max Students': String(p.max_students), 'Max Teachers': String(p.max_teachers)}))
      )}</div>
    </div>`;
}

async function renderSchoolAdminDashboard() {
  const orgId = erpOrg.id;
  const [students, teachers, classes, fees, exams] = await Promise.all([
    erp.from('students').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'active'),
    erp.from('teachers').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'active'),
    erp.from('classes').select('*', { count: 'exact', head: true }).eq('org_id', orgId),
    erp.from('fees').select('amount').eq('org_id', orgId).eq('status', 'paid'),
    erp.from('exams').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'published'),
  ]);
  const totalFees = fees.data?.reduce((s, f) => s + Number(f.amount), 0) || 0;

  el('content-area').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Active Students</div><div class="value">${students.count || 0}</div></div>
      <div class="stat-card"><div class="label">Active Teachers</div><div class="value">${teachers.count || 0}</div></div>
      <div class="stat-card"><div class="label">Classes</div><div class="value">${classes.count || 0}</div></div>
      <div class="stat-card"><div class="label">Total Fees Collected</div><div class="value">₹${totalFees.toLocaleString()}</div></div>
      <div class="stat-card"><div class="label">Published Exams</div><div class="value">${exams.count || 0}</div></div>
      <div class="stat-card"><div class="label">Plan</div><div class="value" style="font-size:1rem;text-transform:capitalize">${erpOrg.subscription_plan || 'N/A'}</div><div class="sub">
        <span class="badge badge-${erpOrg.status === 'active' ? 'success' : 'warning'}">${erpOrg.status}</span>
      </div></div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Quick Actions</h3></div>
      <div class="card-body flex gap-2" style="flex-wrap:wrap">
        <button class="btn btn-primary" onclick="navigate('students')">Manage Students</button>
        <button class="btn btn-primary" onclick="navigate('teachers')">Manage Teachers</button>
        <button class="btn btn-primary" onclick="navigate('classes')">Manage Classes</button>
        <button class="btn btn-success" onclick="navigate('attendance')">Attendance</button>
        <button class="btn btn-warning" onclick="navigate('exams')">Exams</button>
      </div>
    </div>`;
}

async function renderTeacherDashboard() {
  const profId = erpProfile.id;
  const teacherData = await erp.from('teachers').select('*').eq('profile_id', profId).single();
  if (!teacherData.data) { el('content-area').innerHTML = '<div class="empty-state"><p>Teacher profile not found.</p></div>'; return; }
  const teacher = teacherData.data;
  const [subjects, exams] = await Promise.all([
    erp.from('subjects').select('*, classes(*)').eq('teacher_id', teacher.id),
    erp.from('exams').select('*').eq('created_by', teacher.id),
  ]);
  el('content-area').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="label">My Subjects</div><div class="value">${subjects.data?.length || 0}</div></div>
      <div class="stat-card"><div class="label">My Exams</div><div class="value">${exams.data?.length || 0}</div></div>
    </div>
    <div class="card">
      <div class="card-header"><h3>My Subjects</h3></div>
      <div class="card-body">${renderTable(
        ['Subject','Code','Class'],
        (subjects.data || []).map(s => ({'Subject': s.name, 'Code': s.code || '-', 'Class': s.classes?.name || '-'}))
      )}</div>
    </div>`;
}

async function renderStudentDashboard() {
  const profId = erpProfile.id;
  const studentData = await erp.from('students').select('*').eq('profile_id', profId).single();
  if (!studentData.data) { el('content-area').innerHTML = '<div class="empty-state"><p>Student profile not found.</p></div>'; return; }
  const student = studentData.data;
  const [attendance, results] = await Promise.all([
    erp.from('attendance').select('*').eq('student_id', student.id),
    erp.from('exam_results').select('*, exams(*)').eq('student_id', student.id),
  ]);
  const total = attendance.data?.length || 0;
  const present = attendance.data?.filter(a => a.status === 'present').length || 0;
  const pct = total ? Math.round(present / total * 100) : 0;
  const avgScore = results.data?.length ? Math.round(results.data.reduce((s, r) => s + Number(r.percentage), 0) / results.data.length) : 0;
  el('content-area').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Attendance</div><div class="value">${pct}%</div><div class="sub">${present}/${total} days</div></div>
      <div class="stat-card"><div class="label">Average Score</div><div class="value">${avgScore}%</div></div>
      <div class="stat-card"><div class="label">Exams Taken</div><div class="value">${results.data?.length || 0}</div></div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Recent Exam Results</h3></div>
      <div class="card-body">${renderTable(
        ['Exam','Score','Percentage','Status'],
        (results.data || []).slice(0,5).map(r => ({
          'Exam': r.exams?.title || '-',
          'Score': `${r.marks_obtained}/${r.total_marks}`,
          'Percentage': `${r.percentage}%`,
          'Status': `<span class="badge badge-${r.status === 'passed' ? 'success' : 'danger'}">${r.status}</span>`
        }))
      )}</div>
    </div>`;
}

/* ============================================================
   SUPER ADMIN: SCHOOLS
   ============================================================ */

async function renderSchools() {
  const { data } = await erp.from('organizations').select('*, payments(amount,status)').order('created_at', { ascending: false });
  el('content-area').innerHTML = `
    <div class="card">
      <div class="card-header"><h3>All Schools</h3></div>
      <div class="card-body">${renderTable(
        ['Name','Email','Plan','Status','Students','Teachers'],
        (data || []).map(o => ({
          _id: o.id,
          'Name': o.name,
          'Email': o.email || '-',
          'Plan': `<span class="badge badge-info">${o.subscription_plan}</span>`,
          'Status': `<span class="badge badge-${o.status === 'active' ? 'success' : o.status === 'pending' ? 'warning' : 'danger'}">${o.status}</span>`,
          'Students': `${o.max_students}`,
          'Teachers': `${o.max_teachers}`
        })),
        row => `<button class="btn btn-sm btn-primary" onclick="editOrg(${row._id})">Edit</button>`
      )}</div>
    </div>`;
}

async function editOrg(id) {
  const { data } = await erp.from('organizations').select('*').eq('id', id).single();
  if (!data) return;
  modal('Edit School', `
    <form id="org-form">
      <div class="form-group"><label>Name</label><input name="name" value="${data.name}"></div>
      <div class="form-group"><label>Email</label><input name="email" value="${data.email || ''}"></div>
      <div class="form-row">
        <div class="form-group"><label>Plan</label><select name="subscription_plan">
          <option value="basic" ${data.subscription_plan === 'basic' ? 'selected' : ''}>Basic</option>
          <option value="standard" ${data.subscription_plan === 'standard' ? 'selected' : ''}>Standard</option>
          <option value="premium" ${data.subscription_plan === 'premium' ? 'selected' : ''}>Premium</option>
        </select></div>
        <div class="form-group"><label>Status</label><select name="status">
          <option value="active" ${data.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="pending" ${data.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="suspended" ${data.status === 'suspended' ? 'selected' : ''}>Suspended</option>
          <option value="rejected" ${data.status === 'rejected' ? 'selected' : ''}>Rejected</option>
        </select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Max Students</label><input type="number" name="max_students" value="${data.max_students}"></div>
        <div class="form-group"><label>Max Teachers</label><input type="number" name="max_teachers" value="${data.max_teachers}"></div>
      </div>
    </form>`, async () => {
    const fd = getFormData('org-form');
    await erp.from('organizations').update(fd).eq('id', id);
    showToast('School updated!', 'success');
    closeModal();
    navigate('schools');
  });
}

/* ============================================================
   SUPER ADMIN: PLANS
   ============================================================ */

async function renderPlans() {
  const { data } = await erp.from('plans').select('*').order('price');
  el('content-area').innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Subscription Plans</h3><button class="btn btn-primary btn-sm" onclick="showAddPlan()">+ Add Plan</button></div>
      <div class="card-body">${renderTable(
        ['Name','Price','Billing','Max Students','Status'],
        (data || []).map(p => ({
          _id: p.id,
          'Name': p.name,
          'Price': `₹${p.price}`,
          'Billing': p.billing_cycle,
          'Max Students': String(p.max_students),
          'Status': `<span class="badge badge-${p.is_active ? 'success' : 'danger'}">${p.is_active ? 'Active' : 'Inactive'}</span>`
        })),
        row => `<button class="btn btn-sm btn-outline" onclick="editPlan(${row._id})">Edit</button>`
      )}</div>
    </div>`;
}

function showAddPlan() {
  modal('Add Plan', `
    <form id="plan-form">
      <div class="form-group"><label>Plan Name</label><input name="name" required></div>
      <div class="form-row">
        <div class="form-group"><label>Price (₹)</label><input type="number" name="price" step="0.01" required></div>
        <div class="form-group"><label>Billing Cycle</label><select name="billing_cycle"><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Max Students</label><input type="number" name="max_students" value="100"></div>
        <div class="form-group"><label>Max Teachers</label><input type="number" name="max_teachers" value="20"></div>
      </div>
      <div class="form-group"><label>Description</label><textarea name="description"></textarea></div>
    </form>`, async () => {
    const fd = getFormData('plan-form');
    fd.slug = fd.name.toLowerCase().replace(/\s+/g, '-');
    fd.features = '[]';
    await erp.from('plans').insert(fd);
    showToast('Plan added!', 'success');
    closeModal();
    navigate('plans');
  });
}

async function editPlan(id) { showToast('Edit via Supabase dashboard for full feature control.', 'info'); }

/* ============================================================
   SUPER ADMIN: REVENUE
   ============================================================ */

async function renderRevenue() {
  const [payments, orgs] = await Promise.all([
    erp.from('payments').select('*, organizations(name)').order('created_at', { ascending: false }),
    erp.from('organizations').select('*'),
  ]);
  const totalRevenue = payments.data?.reduce((s, p) => s + Number(p.amount), 0) || 0;
  const subsRevenue = payments.data?.filter(p => p.type === 'subscription').reduce((s, p) => s + Number(p.amount), 0) || 0;
  const completedPayments = payments.data?.filter(p => p.status === 'completed').length || 0;
  el('content-area').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Total Revenue</div><div class="value">₹${totalRevenue.toLocaleString()}</div></div>
      <div class="stat-card"><div class="label">Subscription Revenue</div><div class="value">₹${subsRevenue.toLocaleString()}</div></div>
      <div class="stat-card"><div class="label">Completed Payments</div><div class="value">${completedPayments}</div></div>
    </div>
    <div class="card">
      <div class="card-header"><h3>All Payments</h3></div>
      <div class="card-body">${renderTable(
        ['Organization','Amount','Type','Status','Date'],
        (payments.data || []).map(p => ({
          'Organization': p.organizations?.name || '-',
          'Amount': `₹${p.amount}`,
          'Type': p.type,
          'Status': `<span class="badge badge-${p.status === 'completed' ? 'success' : p.status === 'pending' ? 'warning' : 'danger'}">${p.status}</span>`,
          'Date': new Date(p.created_at).toLocaleDateString()
        }))
      )}</div>
    </div>`;
}

/* ============================================================
   SCHOOL ADMIN: STUDENTS
   ============================================================ */

async function renderStudents() {
  const { data } = await erp.from('students').select('*').eq('org_id', erpOrg.id).order('created_at', { ascending: false });
  el('content-area').innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Students</h3><button class="btn btn-primary btn-sm" onclick="showAddStudent()">+ Add Student</button></div>
      <div class="card-body">${renderTable(
        ['Roll No','Name','Email','Phone','Status'],
        (data || []).map(s => ({
          _id: s.id,
          'Roll No': s.roll_number || '-',
          'Name': `${s.first_name} ${s.last_name}`,
          'Email': s.email || '-',
          'Phone': s.phone || '-',
          'Status': `<span class="badge badge-${s.status === 'active' ? 'success' : 'danger'}">${s.status}</span>`
        })),
        row => `<button class="btn btn-sm btn-outline" onclick="showEditStudent(${row._id})">Edit</button>`
      )}</div>
    </div>`;
}

function showAddStudent() {
  openSlideModal('Add Student', `
    <form id="student-form">
      <div class="form-row">
        <div class="form-group"><label>First Name</label><input name="first_name" required></div>
        <div class="form-group"><label>Last Name</label><input name="last_name" required></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Email</label><input type="email" name="email"></div>
        <div class="form-group"><label>Phone</label><input name="phone"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Roll Number</label><input name="roll_number"></div>
        <div class="form-group"><label>Gender</label><select name="gender"><option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Guardian Name</label><input name="guardian_name"></div>
        <div class="form-group"><label>Guardian Phone</label><input name="guardian_phone"></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeSlideModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>`);
  el('slide-modal-body').querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = getFormData('student-form');
    fd.org_id = erpOrg.id;
    await erp.from('students').insert(fd);
    showToast('Student added!', 'success');
    closeSlideModal();
    navigate('students');
  });
}

async function showEditStudent(id) {
  const { data } = await erp.from('students').select('*').eq('id', id).single();
  if (!data) return;
  openSlideModal('Edit Student', `
    <form id="student-form">
      <div class="form-row">
        <div class="form-group"><label>First Name</label><input name="first_name" value="${data.first_name}"></div>
        <div class="form-group"><label>Last Name</label><input name="last_name" value="${data.last_name}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Email</label><input name="email" value="${data.email || ''}"></div>
        <div class="form-group"><label>Phone</label><input name="phone" value="${data.phone || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Roll Number</label><input name="roll_number" value="${data.roll_number || ''}"></div>
        <div class="form-group"><label>Status</label><select name="status">
          <option value="active" ${data.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="inactive" ${data.status === 'inactive' ? 'selected' : ''}>Inactive</option>
          <option value="graduated" ${data.status === 'graduated' ? 'selected' : ''}>Graduated</option>
        </select></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeSlideModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Update</button>
      </div>
    </form>`);
  el('slide-modal-body').querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = getFormData('student-form');
    await erp.from('students').update(fd).eq('id', id);
    showToast('Student updated!', 'success');
    closeSlideModal();
    navigate('students');
  });
}

/* ============================================================
   SCHOOL ADMIN: TEACHERS
   ============================================================ */

async function renderTeachers() {
  const { data } = await erp.from('teachers').select('*').eq('org_id', erpOrg.id).order('created_at', { ascending: false });
  el('content-area').innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Teachers</h3><button class="btn btn-primary btn-sm" onclick="showAddTeacher()">+ Add Teacher</button></div>
      <div class="card-body">${renderTable(
        ['Employee ID','Name','Email','Qualification','Status'],
        (data || []).map(t => ({
          _id: t.id,
          'Employee ID': t.employee_id || '-',
          'Name': `${t.first_name} ${t.last_name}`,
          'Email': t.email || '-',
          'Qualification': t.qualification || '-',
          'Status': `<span class="badge badge-${t.status === 'active' ? 'success' : 'danger'}">${t.status}</span>`
        })),
        row => `<button class="btn btn-sm btn-outline" onclick="showEditTeacher(${row._id})">Edit</button>`
      )}</div>
    </div>`;
}

function showAddTeacher() {
  openSlideModal('Add Teacher', `
    <form id="teacher-form">
      <div class="form-row">
        <div class="form-group"><label>First Name</label><input name="first_name" required></div>
        <div class="form-group"><label>Last Name</label><input name="last_name" required></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Email</label><input type="email" name="email"></div>
        <div class="form-group"><label>Phone</label><input name="phone"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Employee ID</label><input name="employee_id"></div>
        <div class="form-group"><label>Qualification</label><input name="qualification"></div>
      </div>
      <div class="form-group"><label>Specialization</label><input name="specialization"></div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeSlideModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>`);
  el('slide-modal-body').querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = getFormData('teacher-form');
    fd.org_id = erpOrg.id;
    await erp.from('teachers').insert(fd);
    showToast('Teacher added!', 'success');
    closeSlideModal();
    navigate('teachers');
  });
}

async function showEditTeacher(id) {
  const { data } = await erp.from('teachers').select('*').eq('id', id).single();
  if (!data) return;
  openSlideModal('Edit Teacher', `
    <form id="teacher-form">
      <div class="form-row">
        <div class="form-group"><label>First Name</label><input name="first_name" value="${data.first_name}"></div>
        <div class="form-group"><label>Last Name</label><input name="last_name" value="${data.last_name}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Email</label><input name="email" value="${data.email || ''}"></div>
        <div class="form-group"><label>Phone</label><input name="phone" value="${data.phone || ''}"></div>
      </div>
      <div class="form-group"><label>Qualification</label><input name="qualification" value="${data.qualification || ''}"></div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeSlideModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Update</button>
      </div>
    </form>`);
  el('slide-modal-body').querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = getFormData('teacher-form');
    await erp.from('teachers').update(fd).eq('id', id);
    showToast('Teacher updated!', 'success');
    closeSlideModal();
    navigate('teachers');
  });
}

/* ============================================================
   SCHOOL ADMIN: CLASSES
   ============================================================ */

async function renderClasses() {
  const { data } = await erp.from('classes').select('*, teachers(first_name,last_name)').eq('org_id', erpOrg.id).order('name');
  el('content-area').innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Classes</h3><button class="btn btn-primary btn-sm" onclick="showAddClass()">+ Add Class</button></div>
      <div class="card-body">${renderTable(
        ['Name','Section','Teacher','Room','Academic Year'],
        (data || []).map(c => ({
          _id: c.id,
          'Name': c.name,
          'Section': c.section || '-',
          'Teacher': c.teachers ? `${c.teachers.first_name} ${c.teachers.last_name}` : '-',
          'Room': c.room || '-',
          'Academic Year': c.academic_year || '-'
        })),
        row => `<button class="btn btn-sm btn-outline" onclick="showEditClass(${row._id})">Edit</button>`
      )}</div>
    </div>`;
}

async function showAddClass() {
  const { data: teachers } = await erp.from('teachers').select('*').eq('org_id', erpOrg.id).eq('status', 'active');
  openSlideModal('Add Class', `
    <form id="class-form">
      <div class="form-row">
        <div class="form-group"><label>Class Name</label><input name="name" required placeholder="e.g. Class 10"></div>
        <div class="form-group"><label>Section</label><input name="section" placeholder="e.g. A"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Teacher</label><select name="teacher_id">
          <option value="">Select</option>
          ${(teachers || []).map(t => `<option value="${t.id}">${t.first_name} ${t.last_name}</option>`).join('')}
        </select></div>
        <div class="form-group"><label>Room</label><input name="room"></div>
      </div>
      <div class="form-group"><label>Academic Year</label><input name="academic_year" placeholder="e.g. 2025-26"></div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeSlideModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>`);
  el('slide-modal-body').querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = getFormData('class-form');
    fd.org_id = erpOrg.id;
    await erp.from('classes').insert(fd);
    showToast('Class added!', 'success');
    closeSlideModal();
    navigate('classes');
  });
}

async function showEditClass(id) { showToast('Edit via the edit button in the table.', 'info'); }

/* ============================================================
   SCHOOL ADMIN: SUBJECTS
   ============================================================ */

async function renderSubjects() {
  const { data } = await erp.from('subjects').select('*, classes(name), teachers(first_name,last_name)').eq('org_id', erpOrg.id).order('name');
  el('content-area').innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Subjects</h3><button class="btn btn-primary btn-sm" onclick="showAddSubject()">+ Add Subject</button></div>
      <div class="card-body">${renderTable(
        ['Subject','Code','Class','Teacher'],
        (data || []).map(s => ({
          _id: s.id,
          'Subject': s.name,
          'Code': s.code || '-',
          'Class': s.classes?.name || '-',
          'Teacher': s.teachers ? `${s.teachers.first_name} ${s.teachers.last_name}` : '-'
        })),
        row => `<button class="btn btn-sm btn-outline" onclick="showEditSubject(${row._id})">Edit</button>`
      )}</div>
    </div>`;
}

async function showAddSubject() {
  const [classes, teachers] = await Promise.all([
    erp.from('classes').select('*').eq('org_id', erpOrg.id),
    erp.from('teachers').select('*').eq('org_id', erpOrg.id).eq('status', 'active'),
  ]);
  openSlideModal('Add Subject', `
    <form id="subject-form">
      <div class="form-row">
        <div class="form-group"><label>Subject Name</label><input name="name" required></div>
        <div class="form-group"><label>Code</label><input name="code"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Class</label><select name="class_id">${(classes.data || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
        <div class="form-group"><label>Teacher</label><select name="teacher_id"><option value="">Select</option>${(teachers.data || []).map(t => `<option value="${t.id}">${t.first_name} ${t.last_name}</option>`).join('')}</select></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeSlideModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>`);
  el('slide-modal-body').querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = getFormData('subject-form');
    fd.org_id = erpOrg.id;
    await erp.from('subjects').insert(fd);
    showToast('Subject added!', 'success');
    closeSlideModal();
    navigate('subjects');
  });
}

function showEditSubject(id) { showToast('Feature coming soon.', 'info'); }

/* ============================================================
   SCHOOL ADMIN: SYLLABUS
   ============================================================ */

async function renderSyllabus() {
  const { data } = await erp.from('syllabus').select('*, classes(name), subjects(name)').eq('org_id', erpOrg.id).order('created_at', { ascending: false });
  el('content-area').innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Syllabus</h3><button class="btn btn-primary btn-sm" onclick="showAddSyllabus()">+ Add Syllabus</button></div>
      <div class="card-body">${renderTable(
        ['Title','Class','Subject','Topics'],
        (data || []).map(s => ({
          'Title': s.title,
          'Class': s.classes?.name || '-',
          'Subject': s.subjects?.name || '-',
          'Topics': Array.isArray(s.topics) ? s.topics.join(', ') : '-'
        })),
        row => `<button class="btn btn-sm btn-outline">View</button>`
      )}</div>
    </div>`;
}

async function showAddSyllabus() {
  const [classes, subjects] = await Promise.all([
    erp.from('classes').select('*').eq('org_id', erpOrg.id),
    erp.from('subjects').select('*').eq('org_id', erpOrg.id),
  ]);
  openSlideModal('Add Syllabus', `
    <form id="syllabus-form">
      <div class="form-group"><label>Title</label><input name="title" required></div>
      <div class="form-row">
        <div class="form-group"><label>Class</label><select name="class_id">${(classes.data || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
        <div class="form-group"><label>Subject</label><select name="subject_id">${(subjects.data || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select></div>
      </div>
      <div class="form-group"><label>Description</label><textarea name="description"></textarea></div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeSlideModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>`);
  el('slide-modal-body').querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = getFormData('syllabus-form');
    fd.org_id = erpOrg.id;
    fd.topics = '[]';
    await erp.from('syllabus').insert(fd);
    showToast('Syllabus added!', 'success');
    closeSlideModal();
    navigate('syllabus');
  });
}

/* ============================================================
   SCHOOL ADMIN: EXAMS
   ============================================================ */

async function renderExams() {
  const { data } = await erp.from('exams').select('*, classes(name), subjects(name)').eq('org_id', erpOrg.id).order('created_at', { ascending: false });
  el('content-area').innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Exams</h3><button class="btn btn-primary btn-sm" onclick="showAddExam()">+ Create Exam</button></div>
      <div class="card-body">${renderTable(
        ['Title','Class','Subject','Total Marks','Pass %','Status'],
        (data || []).map(e => ({
          _id: e.id,
          'Title': e.title,
          'Class': e.classes?.name || '-',
          'Subject': e.subjects?.name || '-',
          'Total Marks': String(e.total_marks),
          'Pass %': `${e.pass_percentage}%`,
          'Status': `<span class="badge badge-${e.status === 'published' ? 'success' : e.status === 'completed' ? 'info' : 'warning'}">${e.status}</span>`
        })),
        row => `<button class="btn btn-sm btn-outline" onclick="manageExam(${row._id})">Manage</button>`
      )}</div>
    </div>`;
}

async function showAddExam() {
  const [classes, subjects] = await Promise.all([
    erp.from('classes').select('*').eq('org_id', erpOrg.id),
    erp.from('subjects').select('*').eq('org_id', erpOrg.id),
  ]);
  openSlideModal('Create Exam', `
    <form id="exam-form">
      <div class="form-group"><label>Exam Title</label><input name="title" required></div>
      <div class="form-row">
        <div class="form-group"><label>Class</label><select name="class_id">${(classes.data || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
        <div class="form-group"><label>Subject</label><select name="subject_id"><option value="">All</option>${(subjects.data || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Total Marks</label><input type="number" name="total_marks" value="100"></div>
        <div class="form-group"><label>Pass %</label><input type="number" name="pass_percentage" value="40"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Duration (min)</label><input type="number" name="duration_minutes" value="60"></div>
        <div class="form-group"><label>Status</label><select name="status"><option value="draft">Draft</option><option value="published">Published</option></select></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeSlideModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create</button>
      </div>
    </form>`);
  el('slide-modal-body').querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = getFormData('exam-form');
    fd.org_id = erpOrg.id;
    await erp.from('exams').insert(fd);
    showToast('Exam created!', 'success');
    closeSlideModal();
    navigate('exams');
  });
}

async function manageExam(id) {
  const [exam, questions, results] = await Promise.all([
    erp.from('exams').select('*, classes(name), subjects(name)').eq('id', id).single(),
    erp.from('questions').select('*').eq('exam_id', id).order('order_num'),
    erp.from('exam_results').select('*, students(first_name,last_name)').eq('exam_id', id),
  ]);
  const e = exam.data;
  const qs = questions.data || [];
  const rs = results.data || [];
  let html = `
    <div class="card"><div class="card-header"><h3>${e.title}</h3></div>
    <div class="card-body"><p>Class: ${e.classes?.name} | Subject: ${e.subjects?.name || 'All'} | Marks: ${e.total_marks} | Pass: ${e.pass_percentage}%</p>
    <div class="flex gap-2 mt-2"><button class="btn btn-sm btn-primary" onclick="addQuestion(${id})">+ Add Question</button>
    <button class="btn btn-sm btn-success" onclick="publishExam(${id})">${e.status === 'draft' ? 'Publish' : 'Unpublish'}</button></div></div></div>
    <div class="card mt-2"><div class="card-header"><h3>Questions (${qs.length})</h3></div>
    <div class="card-body">${qs.length ? renderTable(['#','Type','Question','Marks'],[],()=>'') : '<p class="empty-state">No questions yet.</p>'}
    ${qs.map((q,i) => `<div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--gray-100)"><span><strong>${i+1}.</strong> ${q.question_text.substring(0,60)}${q.question_text.length > 60 ? '...' : ''}</span><span>${q.type} | ${q.marks} marks</span></div>`).join('')}
    </div></div>
    <div class="card mt-2"><div class="card-header"><h3>Results (${rs.length})</h3></div>
    <div class="card-body">${rs.length ? renderTable(['Student','Marks','Percentage','Status'], rs.map(r => ({
      'Student': r.students ? `${r.students.first_name} ${r.students.last_name}` : '-',
      'Marks': `${r.marks_obtained}/${r.total_marks}`,
      'Percentage': `${r.percentage}%`,
      'Status': `<span class="badge badge-${r.status === 'passed' ? 'success' : 'danger'}">${r.status}</span>`
    }))) : '<p class="empty-state">No results yet.</p>'}</div></div>`;
  el('content-area').innerHTML = html;
}

async function addQuestion(examId) {
  modal('Add Question', `
    <form id="question-form">
      <div class="form-group"><label>Type</label><select name="type" onchange="document.getElementById('mcq-options').style.display=this.value==='mcq'?'block':'none'">
        <option value="mcq">Multiple Choice</option><option value="descriptive">Descriptive</option><option value="scenario">Scenario</option>
      </select></div>
      <div class="form-group"><label>Question</label><textarea name="question_text" required></textarea></div>
      <div id="mcq-options" style="display:none">
        <div class="form-group"><label>Options (comma separated)</label><input name="options" placeholder="Option A, Option B, Option C, Option D"></div>
        <div class="form-group"><label>Correct Answer</label><input name="correct_answer" placeholder="e.g. Option A"></div>
      </div>
      <div class="form-group"><label>Marks</label><input type="number" name="marks" value="1" step="0.5"></div>
    </form>`, async () => {
    const fd = getFormData('question-form');
    fd.exam_id = examId;
    if (fd.type === 'mcq' && fd.options) fd.options = JSON.stringify(fd.options.split(',').map(s => s.trim()));
    else fd.options = null;
    await erp.from('questions').insert(fd);
    showToast('Question added!', 'success');
    closeModal();
    manageExam(examId);
  });
}

async function publishExam(id) {
  const e = await erp.from('exams').select('status').eq('id', id).single();
  const newStatus = e.data?.status === 'draft' ? 'published' : 'draft';
  await erp.from('exams').update({ status: newStatus }).eq('id', id);
  showToast(`Exam ${newStatus}!`, 'success');
  manageExam(id);
}

/* ============================================================
   SCHOOL ADMIN: FEES
   ============================================================ */

async function renderFees() {
  const { data } = await erp.from('fees').select('*, students(first_name,last_name)').eq('org_id', erpOrg.id).order('created_at', { ascending: false });
  const total = data?.reduce((s, f) => s + Number(f.amount), 0) || 0;
  const collected = data?.filter(f => f.status === 'paid').reduce((s, f) => s + Number(f.amount), 0) || 0;
  el('content-area').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Total Fees</div><div class="value">₹${total.toLocaleString()}</div></div>
      <div class="stat-card"><div class="label">Collected</div><div class="value">₹${collected.toLocaleString()}</div></div>
      <div class="stat-card"><div class="label">Pending</div><div class="value">₹${(total - collected).toLocaleString()}</div></div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Fees Records</h3><button class="btn btn-primary btn-sm" onclick="showAddFee()">+ Add Fee</button></div>
      <div class="card-body">${renderTable(
        ['Student','Amount','Due Date','Status','Type'],
        (data || []).map(f => ({
          _id: f.id,
          'Student': f.students ? `${f.students.first_name} ${f.students.last_name}` : '-',
          'Amount': `₹${f.amount}`,
          'Due Date': new Date(f.due_date).toLocaleDateString(),
          'Status': `<span class="badge badge-${f.status === 'paid' ? 'success' : f.status === 'pending' ? 'warning' : 'danger'}">${f.status}</span>`,
          'Type': f.type
        })),
        row => `<button class="btn btn-sm btn-success" onclick="markFeePaid(${row._id})">Mark Paid</button>`
      )}</div>
    </div>`;
}

async function showAddFee() {
  const { data: students } = await erp.from('students').select('*').eq('org_id', erpOrg.id).eq('status', 'active');
  openSlideModal('Add Fee', `
    <form id="fee-form">
      <div class="form-group"><label>Student</label><select name="student_id">${(students || []).map(s => `<option value="${s.id}">${s.first_name} ${s.last_name}</option>`).join('')}</select></div>
      <div class="form-row">
        <div class="form-group"><label>Amount (₹)</label><input type="number" name="amount" step="0.01" required></div>
        <div class="form-group"><label>Type</label><select name="type"><option value="tuition">Tuition</option><option value="exam">Exam</option><option value="library">Library</option><option value="transport">Transport</option><option value="other">Other</option></select></div>
      </div>
      <div class="form-group"><label>Due Date</label><input type="date" name="due_date" required></div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeSlideModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>`);
  el('slide-modal-body').querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = getFormData('fee-form');
    fd.org_id = erpOrg.id;
    await erp.from('fees').insert(fd);
    showToast('Fee added!', 'success');
    closeSlideModal();
    navigate('fees');
  });
}

async function markFeePaid(id) {
  await erp.from('fees').update({ status: 'paid', paid_date: new Date().toISOString().split('T')[0] }).eq('id', id);
  showToast('Fee marked as paid!', 'success');
  navigate('fees');
}

/* ============================================================
   SCHOOL ADMIN: DONATIONS
   ============================================================ */

async function renderDonations() {
  const { data } = await erp.from('donations').select('*').eq('org_id', erpOrg.id).order('date', { ascending: false });
  const total = data?.reduce((s, d) => s + Number(d.amount), 0) || 0;
  el('content-area').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Total Donations</div><div class="value">₹${total.toLocaleString()}</div></div>
      <div class="stat-card"><div class="label">Donors</div><div class="value">${data?.length || 0}</div></div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Donations</h3><button class="btn btn-primary btn-sm" onclick="showAddDonation()">+ Record Donation</button></div>
      <div class="card-body">${renderTable(
        ['Donor','Amount','Date','Method','Status'],
        (data || []).map(d => ({
          'Donor': d.donor_name,
          'Amount': `₹${d.amount}`,
          'Date': new Date(d.date).toLocaleDateString(),
          'Method': d.payment_method || '-',
          'Status': `<span class="badge badge-${d.status === 'completed' ? 'success' : 'warning'}">${d.status}</span>`
        }))
      )}</div>
    </div>`;
}

function showAddDonation() {
  openSlideModal('Record Donation', `
    <form id="donation-form">
      <div class="form-row">
        <div class="form-group"><label>Donor Name</label><input name="donor_name" required></div>
        <div class="form-group"><label>Amount (₹)</label><input type="number" name="amount" step="0.01" required></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Email</label><input type="email" name="donor_email"></div>
        <div class="form-group"><label>Phone</label><input name="donor_phone"></div>
      </div>
      <div class="form-group"><label>Payment Method</label><select name="payment_method"><option value="cash">Cash</option><option value="bank">Bank Transfer</option><option value="online">Online</option><option value="cheque">Cheque</option></select></div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeSlideModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>`);
  el('slide-modal-body').querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = getFormData('donation-form');
    fd.org_id = erpOrg.id;
    fd.date = new Date().toISOString().split('T')[0];
    await erp.from('donations').insert(fd);
    showToast('Donation recorded!', 'success');
    closeSlideModal();
    navigate('donations');
  });
}

/* ============================================================
   SCHOOL ADMIN: CALENDAR
   ============================================================ */

async function renderCalendar() {
  const { data } = await erp.from('events').select('*').eq('org_id', erpOrg.id).order('event_date');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const grouped = {};
  (data || []).forEach(e => {
    const m = new Date(e.event_date).getMonth();
    if (!grouped[m]) grouped[m] = [];
    grouped[m].push(e);
  });
  let html = `<div class="card"><div class="card-header"><h3>Calendar</h3><button class="btn btn-primary btn-sm" onclick="showAddEvent()">+ Add Event</button></div><div class="card-body">`;
  for (const m of Object.keys(grouped)) {
    html += `<h4 style="margin:16px 0 8px;color:var(--primary)">${months[parseInt(m)]}</h4>`;
    html += renderTable(['Date','Title','Type'], grouped[m].map(e => ({
      'Date': new Date(e.event_date).toLocaleDateString(),
      'Title': e.title,
      'Type': `<span class="badge badge-info">${e.event_type}</span>`
    })));
  }
  html += `</div></div>`;
  el('content-area').innerHTML = html;
}

function showAddEvent() {
  openSlideModal('Add Event', `
    <form id="event-form">
      <div class="form-group"><label>Title</label><input name="title" required></div>
      <div class="form-row">
        <div class="form-group"><label>Date</label><input type="date" name="event_date" required></div>
        <div class="form-group"><label>Type</label><select name="event_type"><option value="general">General</option><option value="exam">Exam</option><option value="holiday">Holiday</option><option value="meeting">Meeting</option><option value="deadline">Deadline</option></select></div>
      </div>
      <div class="form-group"><label>Description</label><textarea name="description"></textarea></div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeSlideModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>`);
  el('slide-modal-body').querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = getFormData('event-form');
    fd.org_id = erpOrg.id;
    await erp.from('events').insert(fd);
    showToast('Event added!', 'success');
    closeSlideModal();
    navigate('calendar');
  });
}

/* ============================================================
   SCHOOL ADMIN: REPORTS (Export to CSV)
   ============================================================ */

async function renderReports() {
  el('content-area').innerHTML = `
    <div class="card"><div class="card-header"><h3>Export Reports</h3></div>
    <div class="card-body">
      <div class="flex gap-2" style="flex-wrap:wrap">
        <button class="btn btn-primary" onclick="exportCSV('students')">📥 Export Students</button>
        <button class="btn btn-primary" onclick="exportCSV('teachers')">📥 Export Teachers</button>
        <button class="btn btn-primary" onclick="exportCSV('attendance')">📥 Export Attendance</button>
        <button class="btn btn-primary" onclick="exportCSV('fees')">📥 Export Fees</button>
        <button class="btn btn-primary" onclick="exportCSV('exams')">📥 Export Exams</button>
        <button class="btn btn-primary" onclick="exportCSV('donations')">📥 Export Donations</button>
      </div>
    </div></div>`;
}

async function exportCSV(table) {
  const { data } = await erp.from(table).select('*').eq('org_id', erpOrg.id);
  if (!data || !data.length) { showToast('No data to export', 'warning'); return; }
  const cols = Object.keys(data[0]).filter(k => !['org_id','updated_at'].includes(k));
  const rows = data.map(r => cols.map(c => {
    const v = r[c];
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  }));
  const csv = [cols.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `${table}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast(`${table} exported!`, 'success');
}

/* ============================================================
   TEACHER: MY CLASSES
   ============================================================ */

async function renderMyClasses() {
  const teacherData = await erp.from('teachers').select('*').eq('profile_id', erpProfile.id).single();
  if (!teacherData.data) { el('content-area').innerHTML = '<div class="empty-state"><p>Teacher profile not linked.</p></div>'; return; }
  const { data: classes } = await erp.from('classes').select('*').eq('teacher_id', teacherData.data.id);
  el('content-area').innerHTML = `
    <div class="card"><div class="card-header"><h3>My Classes</h3></div>
    <div class="card-body">${renderTable(['Name','Section','Room','Academic Year'], (classes || []).map(c => ({
      'Name': c.name, 'Section': c.section || '-', 'Room': c.room || '-', 'Academic Year': c.academic_year || '-'
    })))}</div></div>`;
}

/* ============================================================
   TEACHER: TAKE ATTENDANCE
   ============================================================ */

async function renderTakeAttendance() {
  const teacherData = await erp.from('teachers').select('*').eq('profile_id', erpProfile.id).single();
  if (!teacherData.data) return;
  const { data: classes } = await erp.from('classes').select('*').eq('teacher_id', teacherData.data.id);
  if (!classes || !classes.length) { el('content-area').innerHTML = '<div class="empty-state"><p>No classes assigned.</p></div>'; return; }
  let html = `<div class="card"><div class="card-header"><h3>Take Attendance</h3></div><div class="card-body">
    <div class="form-row">
      <div class="form-group"><label>Class</label><select id="att-class" onchange="loadAttendanceStudents()">
        <option value="">Select Class</option>${classes.map(c => `<option value="${c.id}">${c.name} ${c.section || ''}</option>`).join('')}
      </select></div>
      <div class="form-group"><label>Date</label><input type="date" id="att-date" value="${new Date().toISOString().split('T')[0]}"></div>
    </div>
    <div id="attendance-list" class="mt-2"></div>
    <div id="attendance-actions" style="display:none" class="mt-2">
      <button class="btn btn-success" onclick="submitAttendance()">Save Attendance</button>
    </div></div></div>`;
  el('content-area').innerHTML = html;
}

async function loadAttendanceStudents() {
  const classId = el('att-class').value;
  if (!classId) return;
  const { data: students } = await erp.from('students').select('*').eq('org_id', erpOrg.id).eq('status', 'active');
  if (!students || !students.length) { el('attendance-list').innerHTML = '<p class="empty-state">No students.</p>'; return; }
  let html = '<table><thead><tr><th>Student</th><th>Status</th></tr></thead><tbody>';
  students.forEach(s => {
    html += `<tr><td>${s.first_name} ${s.last_name}</td>
      <td><select class="att-status" data-sid="${s.id}">
        <option value="present">Present</option>
        <option value="absent">Absent</option>
        <option value="late">Late</option>
        <option value="leave">Leave</option>
      </select></td></tr>`;
  });
  html += '</tbody></table>';
  el('attendance-list').innerHTML = html;
  el('attendance-actions').style.display = 'block';
  window._attClassId = classId;
}

async function submitAttendance() {
  const date = el('att-date').value;
  const classId = window._attClassId;
  if (!classId || !date) { showToast('Select class and date', 'warning'); return; }
  const teacherData = await erp.from('teachers').select('*').eq('profile_id', erpProfile.id).single();
  const records = [];
  document.querySelectorAll('.att-status').forEach(sel => {
    records.push({
      org_id: erpOrg.id, student_id: parseInt(sel.dataset.sid),
      class_id: parseInt(classId), date, status: sel.value,
      marked_by: teacherData.data?.id || null
    });
  });
  for (const r of records) {
    await erp.from('attendance').upsert(r, { onConflict: 'student_id, date, class_id' });
  }
  showToast(`Attendance saved for ${records.length} students!`, 'success');
}

/* ============================================================
   STUDENT: MY ATTENDANCE
   ============================================================ */

async function renderMyAttendance() {
  const studentData = await erp.from('students').select('*').eq('profile_id', erpProfile.id).single();
  if (!studentData.data) return;
  const { data } = await erp.from('attendance').select('*').eq('student_id', studentData.data.id).order('date', { ascending: false });
  const total = data?.length || 0;
  const present = data?.filter(a => a.status === 'present').length || 0;
  const absent = data?.filter(a => a.status === 'absent').length || 0;
  const pct = total ? Math.round(present / total * 100) : 0;
  el('content-area').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Attendance %</div><div class="value">${pct}%</div></div>
      <div class="stat-card"><div class="label">Present</div><div class="value" style="color:var(--success)">${present}</div></div>
      <div class="stat-card"><div class="label">Absent</div><div class="value" style="color:var(--danger)">${absent}</div></div>
      <div class="stat-card"><div class="label">Total Days</div><div class="value">${total}</div></div>
    </div>
    <div class="card"><div class="card-header"><h3>Attendance Records</h3></div>
    <div class="card-body">${renderTable(['Date','Status'], (data || []).map(a => ({
      'Date': new Date(a.date).toLocaleDateString(),
      'Status': `<span class="badge badge-${a.status === 'present' ? 'success' : a.status === 'late' ? 'warning' : 'danger'}">${a.status}</span>`
    })))}</div></div>`;
}

/* ============================================================
   STUDENT: MY EXAMS
   ============================================================ */

async function renderMyExams() {
  const studentData = await erp.from('students').select('*').eq('profile_id', erpProfile.id).single();
  if (!studentData.data) return;
  const { data } = await erp.from('exam_results').select('*, exams(title,total_marks,pass_percentage)').eq('student_id', studentData.data.id).order('submitted_at', { ascending: false });
  el('content-area').innerHTML = `
    <div class="card"><div class="card-header"><h3>My Exam Results</h3></div>
    <div class="card-body">${renderTable(['Exam','Marks','Percentage','Status'], (data || []).map(r => ({
      'Exam': r.exams?.title || '-',
      'Marks': `${r.marks_obtained}/${r.total_marks}`,
      'Percentage': `${r.percentage}%`,
      'Status': `<span class="badge badge-${r.status === 'passed' ? 'success' : 'danger'}">${r.status}</span>`
    })))}</div></div>`;
}

/* ============================================================
   STUDENT: MY FEES
   ============================================================ */

async function renderMyFees() {
  const studentData = await erp.from('students').select('*').eq('profile_id', erpProfile.id).single();
  if (!studentData.data) return;
  const { data } = await erp.from('fees').select('*').eq('student_id', studentData.data.id).order('due_date', { ascending: false });
  el('content-area').innerHTML = `
    <div class="card"><div class="card-header"><h3>My Fees</h3></div>
    <div class="card-body">${renderTable(['Amount','Type','Due Date','Status'], (data || []).map(f => ({
      'Amount': `₹${f.amount}`,
      'Type': f.type,
      'Due Date': new Date(f.due_date).toLocaleDateString(),
      'Status': `<span class="badge badge-${f.status === 'paid' ? 'success' : f.status === 'overdue' ? 'danger' : 'warning'}">${f.status}</span>`
    })))}</div></div>`;
}
