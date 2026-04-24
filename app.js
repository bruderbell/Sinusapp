// ── Storage ───────────────────────────────────────────────────────────
const DB_KEY = 'sinusEntries';

function loadEntries() {
  try { return JSON.parse(localStorage.getItem(DB_KEY)) || []; }
  catch { return []; }
}

function saveEntries(entries) {
  localStorage.setItem(DB_KEY, JSON.stringify(entries));
}

function addEntry(entry) {
  const entries = loadEntries();
  entry.id = Date.now().toString();
  entry.timestamp = Date.now();
  entries.unshift(entry);
  saveEntries(entries);
  return entry;
}

function deleteEntry(id) {
  saveEntries(loadEntries().filter(e => e.id !== id));
}

// ── State ─────────────────────────────────────────────────────────────
const state = {
  screen: 'log',
  selectedLocations: new Set(),
  severity: 0,
  tookAllergyPill: false,
  medications: new Set(),
  gps: null,        // { lat, lng, accuracy }
  envData: null,    // fetched from Open-Meteo
  envStatus: 'idle' // 'idle' | 'fetching' | 'done' | 'done-gps-only' | 'error'
};

// ── DOM helpers ───────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Navigation ────────────────────────────────────────────────────────
function showScreen(name) {
  state.screen = name;
  document.querySelectorAll('.screen').forEach(s =>
    s.classList.toggle('active', s.dataset.screen === name));
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.target === name));
  if (name === 'history') renderHistory();
}

// ── Severity slider ───────────────────────────────────────────────────
function initSlider() {
  const slider  = $('severity');
  const display = $('severityDisplay');
  const fill    = $('sliderFill');

  function update() {
    const v = parseInt(slider.value);
    state.severity = v;
    display.textContent = v;
    const hue = v === 0 ? 145 : Math.round(145 - v * 14.5);
    const color = `hsl(${hue}, 80%, 55%)`;
    display.style.color = color;
    fill.style.width = `${v * 10}%`;
    fill.style.background = `linear-gradient(90deg, hsl(145,70%,45%), ${color})`;
    slider.style.setProperty('--thumb-color', color);
  }

  slider.addEventListener('input', update);
  update();
}

// ── Chips / checkboxes / toggle ───────────────────────────────────────
function initLocationChips() {
  document.querySelectorAll('.loc-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const loc = chip.dataset.loc;
      if (state.selectedLocations.has(loc)) {
        state.selectedLocations.delete(loc);
        chip.classList.remove('selected');
      } else {
        state.selectedLocations.add(loc);
        chip.classList.add('selected');
      }
    });
  });
}

function initMedCheckboxes() {
  document.querySelectorAll('.med-check').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) state.medications.add(cb.value);
      else state.medications.delete(cb.value);
    });
  });
}

function initAllergyToggle() {
  $('allergyToggle').addEventListener('change', e => {
    state.tookAllergyPill = e.target.checked;
  });
}

// ── GPS + Environment capture ─────────────────────────────────────────

function aqiInfo(aqi) {
  if (aqi == null) return { label: '—', cls: '' };
  if (aqi <= 50)  return { label: `${aqi} — Good`,                  cls: 'env-good' };
  if (aqi <= 100) return { label: `${aqi} — Moderate`,              cls: 'env-moderate' };
  if (aqi <= 150) return { label: `${aqi} — Unhealthy (Sensitive)`, cls: 'env-poor' };
  if (aqi <= 200) return { label: `${aqi} — Unhealthy`,             cls: 'env-bad' };
  return                 { label: `${aqi} — Very Unhealthy`,        cls: 'env-bad' };
}

function pollenLabel(val, type) {
  if (val == null) return '—';
  const v = Math.round(val);
  const t = { grass: [1,5,20,200], tree: [1,15,90,1500], ragweed: [1,10,50,500] }[type] || [1,5,20,200];
  if (v < t[0]) return `None (${v})`;
  if (v < t[1]) return `Low (${v})`;
  if (v < t[2]) return `Moderate (${v})`;
  if (v < t[3]) return `High (${v})`;
  return `Very High (${v})`;
}

function pollenClass(val, type) {
  if (!val || val < 1) return 'env-good';
  const t = { grass: [5,20,200], tree: [15,90,1500], ragweed: [10,50,500] }[type] || [5,20,200];
  if (val < t[0]) return 'env-good';
  if (val < t[1]) return 'env-moderate';
  if (val < t[2]) return 'env-poor';
  return 'env-bad';
}

async function captureEnvironment() {
  if (!navigator.geolocation) {
    setEnvStatus('error', 'Geolocation not supported by this browser.');
    return;
  }

  setEnvStatus('fetching');

  // Step 1: GPS
  let position;
  try {
    position = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      })
    );
  } catch (err) {
    const msg = err.code === 1
      ? 'Location permission denied. Tap the lock icon in Chrome\'s address bar to allow.'
      : 'Could not get a GPS fix. Try near a window or outside.';
    setEnvStatus('error', msg);
    return;
  }

  const { latitude: lat, longitude: lng, accuracy } = position.coords;
  state.gps = { lat, lng, accuracy: Math.round(accuracy) };

  // Step 2: Open-Meteo Air Quality + Pollen (free, no API key)
  const params = new URLSearchParams({
    latitude:  lat.toFixed(4),
    longitude: lng.toFixed(4),
    current:   'us_aqi,pm2_5,pm10,grass_pollen,birch_pollen,ragweed_pollen'
  });

  try {
    const res  = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const c    = data.current;

    state.envData = {
      usAqi:         c.us_aqi         ?? null,
      pm25:          c.pm2_5          ?? null,
      pm10:          c.pm10           ?? null,
      grassPollen:   c.grass_pollen   ?? null,
      treePollen:    c.birch_pollen   ?? null,
      ragweedPollen: c.ragweed_pollen ?? null
    };

    setEnvStatus('done');
  } catch {
    // GPS worked but air data failed (probably offline)
    state.envData = null;
    setEnvStatus('done-gps-only');
  }
}

function setEnvStatus(status, errorMsg) {
  state.envStatus = status;
  const btn     = $('captureEnvBtn');
  const preview = $('envPreview');
  const errEl   = $('envError');

  errEl.style.display   = 'none';
  preview.style.display = 'none';

  if (status === 'fetching') {
    btn.disabled    = true;
    btn.textContent = '⏳ Fetching…';
    btn.className   = 'env-btn fetching';
    return;
  }

  if (status === 'error') {
    btn.disabled    = false;
    btn.textContent = '📍 Capture Location & Conditions';
    btn.className   = 'env-btn';
    errEl.style.display = 'block';
    errEl.textContent   = errorMsg || 'Unknown error.';
    state.gps     = null;
    state.envData = null;
    return;
  }

  // done or done-gps-only
  btn.disabled    = false;
  btn.textContent = '✓ Captured — tap to refresh';
  btn.className   = 'env-btn captured';

  const gps = state.gps;
  const d   = state.envData;
  const aqi = d ? aqiInfo(d.usAqi) : null;

  preview.style.display = 'grid';
  preview.innerHTML = `
    <div class="env-stat">
      <span class="env-label">📍 GPS</span>
      <span class="env-val">${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}</span>
      <span class="env-sub">±${gps.accuracy}m accuracy</span>
    </div>
    ${d ? `
    <div class="env-stat">
      <span class="env-label">🌬️ US AQI</span>
      <span class="env-val ${aqi.cls}">${aqi.label}</span>
      <span class="env-sub">PM2.5: ${d.pm25 != null ? d.pm25.toFixed(1) : '—'} · PM10: ${d.pm10 != null ? d.pm10.toFixed(1) : '—'} µg/m³</span>
    </div>
    <div class="env-stat">
      <span class="env-label">🌿 Grass</span>
      <span class="env-val ${pollenClass(d.grassPollen,'grass')}">${pollenLabel(d.grassPollen,'grass')}</span>
      <span class="env-sub">grains/m³</span>
    </div>
    <div class="env-stat">
      <span class="env-label">🌲 Tree</span>
      <span class="env-val ${pollenClass(d.treePollen,'tree')}">${pollenLabel(d.treePollen,'tree')}</span>
      <span class="env-sub">grains/m³</span>
    </div>
    <div class="env-stat">
      <span class="env-label">🌾 Ragweed</span>
      <span class="env-val ${pollenClass(d.ragweedPollen,'ragweed')}">${pollenLabel(d.ragweedPollen,'ragweed')}</span>
      <span class="env-sub">grains/m³</span>
    </div>` : `
    <div class="env-stat">
      <span class="env-label">⚠️ Air Data</span>
      <span class="env-val env-moderate">Offline — GPS saved only</span>
      <span class="env-sub">Connect to internet for air quality</span>
    </div>`}
  `;
}

// ── Save ──────────────────────────────────────────────────────────────
function saveEntry() {
  const meds  = [...state.medications];
  const other = $('otherMed').value.trim();
  if (other) meds.push(other);

  const entry = {
    painLocations:   [...state.selectedLocations],
    severity:        state.severity,
    tookAllergyPill: state.tookAllergyPill,
    medications:     meds,
    notes:           $('notes').value.trim(),
    gps:             state.gps     ? { ...state.gps }     : null,
    envData:         state.envData ? { ...state.envData } : null
  };

  addEntry(entry);
  showSaveFlash();
  resetForm();
}

function showSaveFlash() {
  const btn = $('saveBtn');
  btn.textContent = '✓ Saved!';
  btn.classList.add('saved');
  setTimeout(() => {
    btn.textContent = 'Save Entry';
    btn.classList.remove('saved');
  }, 1800);
}

function resetForm() {
  state.selectedLocations.clear();
  state.medications.clear();
  state.severity        = 0;
  state.tookAllergyPill = false;
  state.gps             = null;
  state.envData         = null;
  state.envStatus       = 'idle';

  document.querySelectorAll('.loc-chip').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.med-check').forEach(c => c.checked = false);
  $('allergyToggle').checked = false;
  $('otherMed').value = '';
  $('notes').value    = '';
  $('severity').value = 0;

  const btn = $('captureEnvBtn');
  btn.disabled    = false;
  btn.textContent = '📍 Capture Location & Conditions';
  btn.className   = 'env-btn';
  $('envPreview').style.display = 'none';
  $('envError').style.display   = 'none';

  initSlider();
}

// ── History rendering ─────────────────────────────────────────────────
function severityLabel(n) {
  if (n === 0) return { text: 'None',               cls: 'sev-none' };
  if (n <= 3)  return { text: `Mild — ${n}/10`,     cls: 'sev-mild' };
  if (n <= 6)  return { text: `Moderate — ${n}/10`, cls: 'sev-moderate' };
  if (n <= 9)  return { text: `Severe — ${n}/10`,   cls: 'sev-severe' };
  return              { text: 'Worst — 10/10',      cls: 'sev-severe' };
}

function formatDate(ts) {
  return new Date(ts).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
}

function renderHistory() {
  const container = $('historyList');
  const empty     = $('historyEmpty');
  const entries   = loadEntries();

  if (entries.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  container.innerHTML = entries.map(e => {
    const sev  = severityLabel(e.severity);
    const locs = e.painLocations?.length
      ? e.painLocations.join(' · ')
      : 'No location recorded';

    const medList = [];
    if (e.tookAllergyPill) medList.push('Allergy pill ✓');
    medList.push(...(e.medications || []));
    const medsText = medList.length ? medList.join(', ') : 'No medications';

    // Environment rows
    let envHtml = '';
    if (e.gps) {
      const mapsUrl = `https://maps.google.com/?q=${e.gps.lat},${e.gps.lng}`;
      const d = e.envData;
      const aqiStr = d?.usAqi != null
        ? `AQI ${d.usAqi} · PM2.5 ${d.pm25?.toFixed(1) ?? '—'} · PM10 ${d.pm10?.toFixed(1) ?? '—'}`
        : 'Air data unavailable';
      const pollenStr = d
        ? `Grass: ${pollenLabel(d.grassPollen,'grass')} · Tree: ${pollenLabel(d.treePollen,'tree')} · Ragweed: ${pollenLabel(d.ragweedPollen,'ragweed')}`
        : '';

      envHtml = `
        <div class="entry-row">
          <span class="entry-label">🌍 GPS</span>
          <a class="maps-link" href="${mapsUrl}" target="_blank" rel="noopener">
            ${e.gps.lat.toFixed(4)}, ${e.gps.lng.toFixed(4)}
          </a>
        </div>
        <div class="entry-row">
          <span class="entry-label">🌬️ Air</span>
          <span class="entry-val">${aqiStr}</span>
        </div>
        ${pollenStr ? `<div class="entry-row">
          <span class="entry-label">🌿 Pollen</span>
          <span class="entry-val">${pollenStr}</span>
        </div>` : ''}`;
    }

    return `
      <div class="entry-card" data-id="${e.id}">
        <div class="entry-header">
          <span class="entry-date">${formatDate(e.timestamp)}</span>
          <button class="delete-btn" onclick="confirmDelete('${e.id}')" aria-label="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
        <div class="entry-divider"></div>
        <div class="entry-row">
          <span class="entry-label">Severity</span>
          <span class="entry-sev ${sev.cls}">${sev.text}</span>
        </div>
        <div class="entry-row">
          <span class="entry-label">Location</span>
          <span class="entry-val">${locs}</span>
        </div>
        <div class="entry-row">
          <span class="entry-label">Medications</span>
          <span class="entry-val">${medsText}</span>
        </div>
        ${envHtml}
        ${e.notes ? `
        <div class="entry-row">
          <span class="entry-label">Notes</span>
          <span class="entry-val entry-notes">${e.notes}</span>
        </div>` : ''}
      </div>`;
  }).join('');
}

// ── Delete modal ──────────────────────────────────────────────────────
function confirmDelete(id) {
  const e = loadEntries().find(x => x.id === id);
  if (!e) return;
  const modal = $('deleteModal');
  $('deleteModalDate').textContent = formatDate(e.timestamp);
  modal.style.display     = 'flex';
  modal.dataset.pendingId = id;
  requestAnimationFrame(() => modal.classList.add('visible'));
}

function closeModal() {
  const modal = $('deleteModal');
  modal.classList.remove('visible');
  setTimeout(() => modal.style.display = 'none', 200);
}

function confirmDeleteAction() {
  deleteEntry($('deleteModal').dataset.pendingId);
  closeModal();
  renderHistory();
}

// ── CSV Export ────────────────────────────────────────────────────────
function exportCSV() {
  const entries = loadEntries();
  if (!entries.length) { alert('No entries to export yet.'); return; }

  const rows = [[
    'Date', 'Severity', 'Pain Locations', 'Allergy Pill', 'Medications', 'Notes',
    'Latitude', 'Longitude', 'GPS Accuracy (m)',
    'US AQI', 'PM2.5 (µg/m³)', 'PM10 (µg/m³)',
    'Grass Pollen (gr/m³)', 'Tree Pollen (gr/m³)', 'Ragweed Pollen (gr/m³)',
    'Google Maps Link'
  ]];

  entries.forEach(e => {
    const g = e.gps     || {};
    const d = e.envData || {};
    const mapsUrl = g.lat ? `https://maps.google.com/?q=${g.lat},${g.lng}` : '';

    rows.push([
      formatDate(e.timestamp),
      e.severity,
      (e.painLocations || []).join('; '),
      e.tookAllergyPill ? 'Yes' : 'No',
      (e.medications   || []).join('; '),
      (e.notes || '').replace(/"/g, '""'),
      g.lat           ?? '',
      g.lng           ?? '',
      g.accuracy      ?? '',
      d.usAqi         ?? '',
      d.pm25          ?? '',
      d.pm10          ?? '',
      d.grassPollen   ?? '',
      d.treePollen    ?? '',
      d.ragweedPollen ?? '',
      mapsUrl
    ]);
  });

  const csv  = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `sinus-log-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Init ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSlider();
  initLocationChips();
  initMedCheckboxes();
  initAllergyToggle();

  $('captureEnvBtn').addEventListener('click', captureEnvironment);
  $('saveBtn').addEventListener('click', saveEntry);
  $('exportBtn').addEventListener('click', exportCSV);
  $('deleteConfirmBtn').addEventListener('click', confirmDeleteAction);
  $('deleteCancelBtn').addEventListener('click', closeModal);
  $('deleteModal').addEventListener('click', ev => {
    if (ev.target === $('deleteModal')) closeModal();
  });

  document.querySelectorAll('.nav-btn').forEach(btn =>
    btn.addEventListener('click', () => showScreen(btn.dataset.target))
  );

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});
