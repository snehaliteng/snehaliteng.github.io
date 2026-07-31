/* Job applications local SQLite archive.
   Stores downloaded CVs + parsed application details in a browser-side
   SQLite database (sql.js / WebAssembly) persisted to IndexedDB. */

var JOB_DB_NAME = 'siteng_job_archive';
var JOB_DB_STORE = 'files';
var JOB_DB_KEY = 'db';

var jobSQL = null;
var jobSQLReady = null;

function jobIDBOpen() {
  return new Promise(function (resolve, reject) {
    var req = indexedDB.open(JOB_DB_NAME, 1);
    req.onupgradeneeded = function (e) {
      if (!e.target.result.objectStoreNames.contains(JOB_DB_STORE)) {
        e.target.result.createObjectStore(JOB_DB_STORE);
      }
    };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error); };
  });
}

function jobIDBGet(db, key) {
  return new Promise(function (resolve, reject) {
    var req = db.transaction(JOB_DB_STORE, 'readonly').objectStore(JOB_DB_STORE).get(key);
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error); };
  });
}

function jobIDBPut(db, key, val) {
  return new Promise(function (resolve, reject) {
    var tx = db.transaction(JOB_DB_STORE, 'readwrite');
    tx.objectStore(JOB_DB_STORE).put(val, key);
    tx.oncomplete = function () { resolve(); };
    tx.onerror = function () { reject(tx.error); };
  });
}

function initJobSql() {
  if (jobSQLReady) return jobSQLReady;
  jobSQLReady = (async function () {
    if (typeof initSqlJs === 'undefined') throw new Error('sql.js library failed to load');
    var SQL = await initSqlJs({ locateFile: function (f) { return 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/' + f; } });
    var idb = await jobIDBOpen();
    var saved = await jobIDBGet(idb, JOB_DB_KEY);
    jobSQL = saved ? new SQL.Database(new Uint8Array(saved)) : new SQL.Database();
    jobSQL.run(
      'CREATE TABLE IF NOT EXISTS cv_archive (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
      'contact_id INTEGER UNIQUE, ' +
      'name TEXT, email TEXT, phone TEXT, linkedin TEXT, position TEXT, ' +
      'experience TEXT, current_ctc TEXT, expected_ctc TEXT, location TEXT, ' +
      'cover_letter TEXT, cv_file_name TEXT, cv_mime TEXT, cv_data TEXT, ' +
      'status TEXT, created_at TEXT, saved_at TEXT DEFAULT CURRENT_TIMESTAMP)'
    );
    await jobSaveSql();
    return jobSQL;
  })();
  return jobSQLReady;
}

async function jobSaveSql() {
  var data = jobSQL.export();
  var idb = await jobIDBOpen();
  await jobIDBPut(idb, JOB_DB_KEY, data);
}

function jobMsgField(msg, field) {
  var re = new RegExp(field + ':\\s*(.+?)(?:\\n|$)');
  var x = msg.match(re);
  return x ? x[1].trim() : '';
}

function jobPositionFromService(service) {
  if (!service) return '-';
  return service.replace('Career Application - ', '').replace(' - Shortlisted', '').replace(' - Rejected', '');
}

function jobStatusFromService(service) {
  if (!service) return 'Pending';
  if (service.indexOf('Shortlisted') !== -1) return 'Shortlisted';
  if (service.indexOf('Rejected') !== -1) return 'Rejected';
  return 'Pending';
}

function jobParseDetail(row) {
  var msg = row.message || '';
  var fields = {};
  ['Name', 'Email', 'Phone', 'LinkedIn', 'Experience', 'Current CTC', 'Expected CTC', 'Location'].forEach(function (f) {
    fields[f] = jobMsgField(msg, f);
  });

  var cover = msg.replace(/--- CV Data ---[\s\S]*/, '').replace(/--- CV ---[\s\S]*/, '');
  var idx = cover.indexOf('--- Cover Letter ---');
  cover = idx !== -1 ? cover.substring(idx + '--- Cover Letter ---'.length).trim() : cover.trim();

  var cvFile = '', cvMime = 'application/pdf', cvBase64 = '';
  var cvInfo = msg.match(/--- CV ---\n(.+?)(?:\n|$)/);
  if (cvInfo) cvFile = cvInfo[1].trim();
  var cvData = msg.match(/--- CV Data ---\n(data:([^,]+);base64,([\s\S]+))/);
  if (cvData) { cvMime = cvData[2].trim(); cvBase64 = cvData[3].trim(); }

  return { fields: fields, coverLetter: cover, cvFile: cvFile, cvMime: cvMime, cvBase64: cvBase64, hasCv: !!cvBase64 };
}

function downloadJobDetailJson(detail) {
  var blob = new Blob([JSON.stringify(detail, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = (detail.name || 'applicant').replace(/\s+/g, '_') + '_application.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function saveApplicationLocal(contactId) {
  var db = await initJobSql();
  var { data: row, error } = await _admin.from('contact').select('*').eq('id', contactId).single();
  if (error) throw error;

  var detail = jobParseDetail(row);
  var fileName = detail.cvFile || ('CV_' + (row.name || 'applicant').replace(/\s+/g, '_') + '.pdf');

  if (detail.hasCv) {
    var a = document.createElement('a');
    a.href = 'data:' + detail.cvMime + ';base64,' + detail.cvBase64;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  downloadJobDetailJson({
    contactId: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    position: jobPositionFromService(row.service),
    experience: detail.fields['Experience'],
    currentCtc: detail.fields['Current CTC'],
    expectedCtc: detail.fields['Expected CTC'],
    location: detail.fields['Location'],
    linkedin: detail.fields['LinkedIn'],
    coverLetter: detail.coverLetter,
    cvFile: fileName,
    status: jobStatusFromService(row.service),
    appliedAt: row.created_at
  });

  var stmt = db.prepare(
    'INSERT OR REPLACE INTO cv_archive ' +
    '(contact_id, name, email, phone, linkedin, position, experience, current_ctc, expected_ctc, location, cover_letter, cv_file_name, cv_mime, cv_data, status, created_at) ' +
    'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  );
  stmt.run([
    row.id, row.name, row.email, row.phone, detail.fields['LinkedIn'],
    jobPositionFromService(row.service), detail.fields['Experience'],
    detail.fields['Current CTC'], detail.fields['Expected CTC'], detail.fields['Location'],
    detail.coverLetter, fileName, detail.cvMime, detail.cvBase64,
    jobStatusFromService(row.service), row.created_at
  ]);
  stmt.free();
  await jobSaveSql();
  return fileName;
}

function listLocalArchive() {
  if (!jobSQL) return [];
  var rows = [];
  var stmt = jobSQL.prepare('SELECT * FROM cv_archive ORDER BY saved_at DESC, id DESC');
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function downloadLocalCV(id) {
  if (!jobSQL) { alert('Local archive not initialized.'); return; }
  var stmt = jobSQL.prepare('SELECT name, cv_file_name, cv_mime, cv_data FROM cv_archive WHERE id = ?');
  stmt.bind([id]);
  if (!stmt.step()) { stmt.free(); alert('Record not found in local archive.'); return; }
  var r = stmt.getAsObject();
  stmt.free();
  if (!r.cv_data) { alert('No CV stored for this record.'); return; }
  var a = document.createElement('a');
  a.href = 'data:' + (r.cv_mime || 'application/pdf') + ';base64,' + r.cv_data;
  a.download = r.cv_file_name || ('CV_' + (r.name || 'applicant').replace(/\s+/g, '_') + '.pdf');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function deleteLocalRecord(id) {
  if (!jobSQL) return;
  jobSQL.run('DELETE FROM cv_archive WHERE id = ?', [id]);
  await jobSaveSql();
}

async function clearLocalArchive() {
  if (!jobSQL) return;
  jobSQL.run('DELETE FROM cv_archive');
  await jobSaveSql();
}
