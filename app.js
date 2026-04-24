// ── Storage ──────────────────────────────────────────────────────────
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
  screen: 'log',         // 'log' | 'history'
  selectedLocations: new Set(),
  severity: 0,
  tookAllergyPill: false,
  medications: new Set(),
  otherMed: '',
  notes: '',
  saveFlash: false
};

// ── DOM helpers ───────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const qs = sel => document.querySelector(sel);

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
  const slider = $('severity');
  const display = $('severityDisplay');
  const fill = $('sliderFill');

  function update() {
    const v = parseInt(slider.value);
    state.severity = v;
    display.textContent = v;

    // hue: 145 (green) → 50 (yellow) → 0 (red)
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

// ── Chip / checkbox toggles ────────────────────────────────────────────
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
  const toggle = $('allergyToggle');
  toggle.addEventListener('change', () => {
    state.tookAllergyPill = toggle.checked;
  });
}

// ── Save ──────────────────────────────────────────────────────────────
function saveEntry() {
  const meds = [...state.medications];
  const other = $('otherMed').value.trim();
  if (other) meds.push(other);

  const entry = {
    painLocations: [...state.selectedLocations],
    severity: state.severity,
    tookAllergyPill: state.tookAllergyPill,
    medications: meds,
    notes: $('notes').value.trim()
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
  state.severity = 0;
  state.tookAllergyPill = false;

  document.querySelectorAll('.loc-chip').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.med-check').forEach(c => c.checked = false);
  $('allergyToggle').checked = false;
  $('otherMed').value = '';
  $('notes').value = '';
  $('severity').value = 0;
  initSlider();
}

// ── History rendering ─────────────────────────────────────────────────
function severityLabel(n) {
  if (n === 0) return { text: 'None', cls: 'sev-none' };
  if (n <= 3)  return { text: `Mild — ${n}/10`, cls: 'sev-mild' };
  if (n <= 6)  return { text: `Moderate — ${n}/10`, cls: 'sev-moderate' };
  if (n <= 9)  return { text: `Severe — ${n}/10`, cls: 'sev-severe' };
  return { text: `Worst — 10/10`, cls: 'sev-severe' };
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
    const sev = severityLabel(e.severity);
    const locs = e.painLocations.length
      ? e.painLocations.join(' · ')
      : 'No location recorded';

    const medList = [];
    if (e.tookAllergyPill) medList.push('Allergy pill ✓');
    medList.push(...(e.medications || []));
    const medsText = medList.length ? medList.join(', ') : 'No medications';

    return `
      <div class="entry-card" data-id="${e.id}">
        <div class="entry-header">
          <span class="entry-date">${formatDate(e.timestamp)}</span>
          <button class="delete-btn" onclick="confirmDelete('${e.id}')" aria-label="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
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
        ${e.notes ? `
        <div class="entry-row entry-notes-row">
          <span class="entry-label">Notes</span>
          <span class="entry-val entry-notes">${e.notes}</span>
        </div>` : ''}
      </div>`;
  }).join('');
}

function confirmDelete(id) {
  const entries = loadEntries();
  const e = entries.find(x => x.id === id);
  if (!e) return;

  const modal = $('deleteModal');
  $('deleteModalDate').textContent = formatDate(e.timestamp);
  modal.style.display = 'flex';
  modal.dataset.pendingId = id;

  requestAnimationFrame(() => modal.classList.add('visible'));
}

function closeModal() {
  const modal = $('deleteModal');
  modal.classList.remove('visible');
  setTimeout(() => modal.style.display = 'none', 200);
}

function confirmDeleteAction() {
  const id = $('deleteModal').dataset.pendingId;
  deleteEntry(id);
  closeModal();
  renderHistory();
}

// ── Export ────────────────────────────────────────────────────────────
function exportCSV() {
  const entries = loadEntries();
  if (!entries.length) { alert('No entries to export yet.'); return; }

  const rows = [
    ['Date', 'Severity', 'Pain Locations', 'Allergy Pill', 'Medications', 'Notes']
  ];
  entries.forEach(e => {
    rows.push([
      formatDate(e.timestamp),
      e.severity,
      (e.painLocations || []).join('; '),
      e.tookAllergyPill ? 'Yes' : 'No',
      (e.medications || []).join('; '),
      (e.notes || '').replace(/"/g, '""')
    ]);
  });

  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
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

  $('saveBtn').addEventListener('click', saveEntry);
  $('exportBtn').addEventListener('click', exportCSV);
  $('deleteConfirmBtn').addEventListener('click', confirmDeleteAction);
  $('deleteCancelBtn').addEventListener('click', closeModal);
  $('deleteModal').addEventListener('click', e => {
    if (e.target === $('deleteModal')) closeModal();
  });

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.target));
  });

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});
