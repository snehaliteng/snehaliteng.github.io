const SUPABASE_URL = 'https://vgipghqejzbcoighktij.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnaXBnaHFlanpiY29pZ2hrdGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjQ2MjIsImV4cCI6MjA5NTMwMDYyMn0.KoDwAZarGWOLwKXOwycA8wuIiIrksvZy7dyaO0-ehUo'

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

let currentPhone = null
let allLocations = []
let map = null
let markers = []
let polyline = null
let currentView = 'hour'
let selectionMode = false
let selectedIds = new Set()
let lastSelectedIndex = -1

const STORAGE_KEY = 'lh_phone'

function login() {
  const el = document.getElementById('login-identifier')
  const val = el.value.trim()
  if (!val) { document.getElementById('login-error').textContent = 'Enter phone or email'; return }
  document.getElementById('login-error').textContent = ''
  currentPhone = val
  localStorage.setItem(STORAGE_KEY, val)
  document.getElementById('login-overlay').style.display = 'none'
  document.getElementById('app').style.display = 'block'
  document.getElementById('display-identifier').textContent = val
  initMap()
  loadHistory()
}

function logout() {
  currentPhone = null
  localStorage.removeItem(STORAGE_KEY)
  document.getElementById('app').style.display = 'none'
  document.getElementById('login-overlay').style.display = 'flex'
  document.getElementById('login-identifier').value = ''
}

function toggleBulkDelete() {
  selectionMode = !selectionMode
  selectedIds.clear()
  lastSelectedIndex = -1
  document.getElementById('bulk-toggle').textContent = selectionMode ? 'Cancel' : 'Bulk Delete'
  document.getElementById('bulk-bar').style.display = selectionMode ? 'flex' : 'none'
  updateBulkUI()
  renderHistory()
}

function updateBulkUI() {
  const count = selectedIds.size
  document.getElementById('bulk-count').textContent = count + ' selected'
  document.getElementById('bulk-delete-btn').disabled = count === 0
}

function toggleSelect(id, cb, event) {
  const currentIndex = allLocations.findIndex(l => l.id === id)

  if (event && event.shiftKey && lastSelectedIndex >= 0 && currentIndex >= 0) {
    const start = Math.min(lastSelectedIndex, currentIndex)
    const end = Math.max(lastSelectedIndex, currentIndex)
    for (let i = start; i <= end; i++) {
      selectedIds.add(allLocations[i].id)
    }
    renderHistory()
    updateBulkUI()
    return
  }

  const row = cb.closest('.location-row')
  if (cb.checked) {
    selectedIds.add(id)
    row.classList.add('selected')
  } else {
    selectedIds.delete(id)
    row.classList.remove('selected')
  }
  updateBulkUI()
  lastSelectedIndex = currentIndex
}

function selectAll() {
  allLocations.forEach(l => selectedIds.add(l.id))
  updateBulkUI()
  renderHistory()
}

function deselectAll() {
  selectedIds.clear()
  updateBulkUI()
  renderHistory()
}

async function deleteSelected() {
  if (selectedIds.size === 0) return
  if (!confirm('Delete ' + selectedIds.size + ' location point' + (selectedIds.size > 1 ? 's' : '') + '?')) return

  const ids = Array.from(selectedIds)
  const debug = document.getElementById('debug-result')
  debug.style.display = 'block'
  debug.innerHTML = 'Deleting...'

  try {
    const res = await fetch(SUPABASE_URL + '/functions/v1/delete-locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_KEY },
      body: JSON.stringify({ ids })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status)

    const deletedCount = data.deleted || 0
    if (deletedCount === 0) {
      throw new Error('No rows deleted — deploy the delete-locations Edge Function in Supabase')
    }

    selectionMode = false
    selectedIds.clear()
    lastSelectedIndex = -1
    document.getElementById('bulk-toggle').textContent = 'Bulk Delete'
    document.getElementById('bulk-bar').style.display = 'none'
    debug.innerHTML = 'Deleted ' + deletedCount + ' point' + (deletedCount > 1 ? 's' : '')
    await loadHistory()
  } catch (e) {
    debug.innerHTML = 'Delete error: ' + e.message
  }
}

function wrapLocationRow(l, innerHtml) {
  const checked = selectedIds.has(l.id) ? ' checked' : ''
  const cb = selectionMode ? '<input type="checkbox" class="select-cb" onchange="toggleSelect(' + l.id + ', this, event)"' + checked + '>' : ''
  const selClass = selectionMode && selectedIds.has(l.id) ? ' selected' : ''
  return '<div class="location-row' + selClass + '">' + cb + innerHtml + '</div>'
}

;(function() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    currentPhone = saved
    document.getElementById('login-overlay').style.display = 'none'
    document.getElementById('app').style.display = 'block'
    document.getElementById('display-identifier').textContent = saved
  }
})()

const FUNCTION_URL = SUPABASE_URL + '/functions/v1/push-location'

async function testPush() {
  const el = document.getElementById('debug-result')
  el.style.display = 'block'
  el.innerHTML = 'Testing...'
  const lines = []

  // Test 1: Direct table insert (tests if table exists and RLS allows)
  try {
    const testLat = 19.0760 + (Math.random() - 0.5) * 0.01
    const testLng = 72.8777 + (Math.random() - 0.5) * 0.01
    const { data: insertData, error: insertError } = await sb.from('location_history').insert({
      phone: currentPhone || 'test@debug.com',
      latitude: testLat,
      longitude: testLng,
      accuracy: 10,
      battery_level: 80,
      recorded_at: new Date().toISOString(),
    }).select('id').single()

    if (insertError) {
      lines.push('❌ Direct INSERT failed: ' + insertError.message)
    } else {
      lines.push('✅ Direct INSERT succeeded (id=' + insertData.id + ')')
    }
  } catch (e) {
    lines.push('❌ Direct INSERT exception: ' + e.message)
  }

  // Test 2: Edge Function call (tests if function is deployed)
  try {
    const testLat2 = 19.0760 + (Math.random() - 0.5) * 0.01
    const testLng2 = 72.8777 + (Math.random() - 0.5) * 0.01
    const funcRes = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_KEY },
      body: JSON.stringify({
        phone: currentPhone || 'test@debug.com',
        latitude: testLat2,
        longitude: testLng2,
        accuracy: 10,
        battery_level: 80,
        recorded_at: new Date().toISOString(),
      }),
    })
    const funcData = await funcRes.json()
    if (funcRes.ok) {
      lines.push('✅ Function call succeeded: ' + JSON.stringify(funcData))
    } else {
      lines.push('❌ Function call failed (' + funcRes.status + '): ' + JSON.stringify(funcData))
    }
  } catch (e) {
    lines.push('❌ Function call exception: ' + e.message)
  }

  // Check how many records exist for this phone
  try {
    const { count, error: countError } = await sb.from('location_history')
      .select('id, latitude, longitude, recorded_at', { count: 'exact', head: true })
      .eq('phone', currentPhone || 'test@debug.com')
    if (countError) {
      lines.push('📊 Count query error: ' + countError.message)
    } else {
      lines.push('📊 Records for phone "' + (currentPhone || 'test@debug.com') + '": ' + count)
    }
  } catch (e) {
    lines.push('📊 Count exception: ' + e.message)
  }

  // Try raw REST API fetch (bypasses supabase-js client)
  try {
    const rawRes = await fetch(SUPABASE_URL + '/rest/v1/location_history?select=id,phone,latitude,longitude,recorded_at&order=recorded_at.desc&limit=10', {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    })
    const rawData = await rawRes.json()
    if (rawRes.ok) {
      lines.push('📋 RAW REST API (' + rawData.length + ' records):')
      rawData.forEach(r => lines.push('   id=' + r.id + ' phone="' + r.phone + '" lat=' + r.latitude.toFixed(4) + ' lng=' + r.longitude.toFixed(4) + ' time=' + r.recorded_at))
    } else {
      lines.push('📋 RAW REST API error (' + rawRes.status + '): ' + JSON.stringify(rawData))
    }
  } catch (e) {
    lines.push('📋 RAW REST API exception: ' + e.message)
  }

  // Also try supabase-js client query
  try {
    const { data: sbData, error: sbErr } = await sb.from('location_history')
      .select('id, phone, latitude, longitude, recorded_at')
      .order('recorded_at', { ascending: false })
      .limit(10)
    if (sbErr) {
      lines.push('📋 Supabase-js error: ' + sbErr.message)
    } else if (sbData && sbData.length) {
      lines.push('📋 Supabase-js (' + sbData.length + ' records):')
      sbData.forEach(r => lines.push('   id=' + r.id + ' phone="' + r.phone + '" lat=' + r.latitude.toFixed(4) + ' lng=' + r.longitude.toFixed(4) + ' time=' + r.recorded_at))
    } else {
      lines.push('📋 Supabase-js returned 0 records')
    }
  } catch (e) {
    lines.push('📋 Supabase-js exception: ' + e.message)
  }

  el.innerHTML = lines.join('<br>')
  // Reload to show any new data
  setTimeout(loadHistory, 1000)
}

function initMap() {
  map = L.map('map').setView([20, 78], 5)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map)
}

function resetFilters() {
  const today = new Date()
  const monthAgo = new Date(today)
  monthAgo.setDate(monthAgo.getDate() - 30)
  const toDate = new Date(today)
  toDate.setDate(toDate.getDate() + 7)
  document.getElementById('filter-from').value = monthAgo.toISOString().split('T')[0]
  document.getElementById('filter-to').value = toDate.toISOString().split('T')[0]
  loadHistory()
}

function switchView(el) {
  document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'))
  el.classList.add('active')
  currentView = el.dataset.view
  renderHistory()
}

async function loadHistory() {
  if (!currentPhone) return
  const from = document.getElementById('filter-from').value
  const to = document.getElementById('filter-to').value
  if (!from || !to) { resetFilters(); return }

  try {
    const url = SUPABASE_URL + '/rest/v1/location_history?select=id,phone,latitude,longitude,accuracy,battery_level,recorded_at&order=recorded_at.asc'
    document.getElementById('debug-result').style.display = 'block'
    document.getElementById('debug-result').innerHTML = 'Fetching...'
    const res = await fetch(url, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    })
    if (!res.ok) {
      document.getElementById('history-list').innerHTML = '<div class="location-empty">Error: ' + res.status + '</div>'
      document.getElementById('debug-result').innerHTML = 'HTTP ' + res.status
      return
    }
    const raw = await res.text()
    document.getElementById('debug-result').innerHTML = 'Response length: ' + raw.length + ' chars, starts with: ' + raw.substring(0, 80)
    allLocations = JSON.parse(raw) || []
    document.getElementById('debug-result').innerHTML += ' | Parsed ' + allLocations.length + ' records'
  } catch (e) {
    document.getElementById('history-list').innerHTML = '<div class="location-empty">Fetch error: ' + e.message + '</div>'
    document.getElementById('debug-result').innerHTML = 'Exception: ' + e.message
    return
  }

  updateStats()
  updateMap()
  renderHistory()
}

function updateStats() {
  const total = allLocations.length
  document.getElementById('stat-total').textContent = total

  const today = new Date().toISOString().split('T')[0]
  const todayCount = allLocations.filter(l => l.recorded_at && l.recorded_at.substring(0, 10) === today).length
  document.getElementById('stat-today').textContent = todayCount

  const dates = new Set(allLocations.map(l => l.recorded_at ? l.recorded_at.substring(0, 10) : null).filter(Boolean))
  document.getElementById('stat-streak').textContent = dates.size

  let maxDist = 0
  if (total > 1) {
    for (let i = 1; i < total; i++) {
      const d = haversineKm(allLocations[i - 1].latitude, allLocations[i - 1].longitude, allLocations[i].latitude, allLocations[i].longitude)
      if (d > maxDist) maxDist = d
    }
  }
  document.getElementById('stat-range').textContent = maxDist < 1 ? '<1' : Math.round(maxDist)
}

function updateMap() {
  if (!map) return
  markers.forEach(m => map.removeLayer(m))
  markers = []
  if (polyline) { map.removeLayer(polyline); polyline = null }

  if (!allLocations.length) return

  const bounds = []
  const latlngs = []
  allLocations.forEach(l => {
    const ll = [l.latitude, l.longitude]
    latlngs.push(ll)
    bounds.push(ll)
    const marker = L.circleMarker(ll, {
      radius: 5,
      color: '#1a73e8',
      fillColor: '#1a73e8',
      fillOpacity: 0.8
    })
    const time = l.recorded_at ? new Date(l.recorded_at).toLocaleString() : '?'
    marker.bindPopup('<b>' + time + '</b><br>' + l.latitude.toFixed(5) + ', ' + l.longitude.toFixed(5) + (l.accuracy ? '<br>Accuracy: ' + l.accuracy + 'm' : ''))
    markers.push(marker)
    marker.addTo(map)
  })

  if (latlngs.length > 1) {
    polyline = L.polyline(latlngs, { color: '#1a73e8', weight: 2, opacity: 0.5 }).addTo(map)
  }

  map.fitBounds(bounds, { padding: [30, 30] })
}

function renderHistory() {
  const container = document.getElementById('history-list')
  if (!allLocations.length) { container.innerHTML = '<div class="location-empty">No location data found between ' + document.getElementById('filter-from').value + ' and ' + document.getElementById('filter-to').value + '.</div>'; return }

  if (currentView === 'list') {
    renderListView(container)
  } else if (currentView === 'hour') {
    renderHourView(container)
  } else if (currentView === 'day') {
    renderDayView(container)
  } else if (currentView === 'month') {
    renderMonthView(container)
  }
}

function renderListView(container) {
  let html = ''
  allLocations.forEach(l => {
    const time = l.recorded_at ? new Date(l.recorded_at).toLocaleString() : '?'
    const acc = l.accuracy ? (l.accuracy < 50 ? '<span class="badge">' + l.accuracy + 'm</span>' : '<span class="badge low-acc">' + l.accuracy + 'm</span>') : ''
    html += wrapLocationRow(l, '<span class="time">' + time + '</span><span class="coords">' + l.latitude.toFixed(5) + ', ' + l.longitude.toFixed(5) + '</span><span style="font-size:10px;color:#999">' + (l.phone || '') + '</span>' + acc)
  })
  container.innerHTML = html
}

function renderHourView(container) {
  const groups = {}
  allLocations.forEach(l => {
    if (!l.recorded_at) return
    const key = l.recorded_at.substring(0, 13) + ':00'
    if (!groups[key]) groups[key] = []
    groups[key].push(l)
  })

  const sorted = Object.keys(groups).sort()
  let html = ''
  sorted.forEach(key => {
    const pts = groups[key]
    const d = new Date(key)
    html += '<div class="history-group"><div class="history-group-title">' + d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + pts.length + ' pts)</div>'
    pts.forEach(l => {
      const time = l.recorded_at ? new Date(l.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '?'
      html += wrapLocationRow(l, '<span class="time">' + time + '</span><span class="coords">' + l.latitude.toFixed(5) + ', ' + l.longitude.toFixed(5) + '</span>')
    })
    html += '</div>'
  })
  container.innerHTML = html
}

function renderDayView(container) {
  const groups = {}
  allLocations.forEach(l => {
    if (!l.recorded_at) return
    const key = l.recorded_at.substring(0, 10)
    if (!groups[key]) groups[key] = []
    groups[key].push(l)
  })

  const sorted = Object.keys(groups).sort().reverse()
  let html = ''
  sorted.forEach(key => {
    const pts = groups[key]
    const d = new Date(key + 'T00:00:00')
    html += '<div class="history-group"><div class="history-group-title">' + d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ' (' + pts.length + ' pts)</div>'
    pts.forEach(l => {
      const time = l.recorded_at ? new Date(l.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '?'
      html += wrapLocationRow(l, '<span class="time">' + time + '</span><span class="coords">' + l.latitude.toFixed(5) + ', ' + l.longitude.toFixed(5) + '</span>')
    })
    html += '</div>'
  })
  container.innerHTML = html
}

function renderMonthView(container) {
  const groups = {}
  allLocations.forEach(l => {
    if (!l.recorded_at) return
    const key = l.recorded_at.substring(0, 7)
    if (!groups[key]) groups[key] = []
    groups[key].push(l)
  })

  const sorted = Object.keys(groups).sort().reverse()
  let html = ''
  sorted.forEach(key => {
    const pts = groups[key]
    const d = new Date(key + '-01T00:00:00')
    html += '<div class="history-group"><div class="history-group-title">' + d.toLocaleDateString([], { month: 'long', year: 'numeric' }) + ' (' + pts.length + ' pts)</div>'
    pts.forEach(l => {
      const time = l.recorded_at ? new Date(l.recorded_at).toLocaleString() : '?'
      html += wrapLocationRow(l, '<span class="time">' + time + '</span><span class="coords">' + l.latitude.toFixed(5) + ', ' + l.longitude.toFixed(5) + '</span>')
    })
    html += '</div>'
  })
  container.innerHTML = html
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

;(function init() {
  const today = new Date()
  const monthAgo = new Date(today)
  monthAgo.setDate(monthAgo.getDate() - 30)
  const toDate = new Date(today)
  toDate.setDate(toDate.getDate() + 7)
  document.getElementById('filter-from').value = monthAgo.toISOString().split('T')[0]
  document.getElementById('filter-to').value = toDate.toISOString().split('T')[0]

  if (currentPhone) {
    initMap()
    loadHistory()
  }
})()
