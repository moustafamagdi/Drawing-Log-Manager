import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.DLM_CONFIG;
if (cfg) {
  const supabase = createClient(cfg.url, cfg.key);
  const $ = id => document.getElementById(id);
  const SCHEMA_VERSION = 'TIDP-SCHEDULE-1';
  const CLEAR_TOKEN = '[CLEAR]';
  const IMPORT_ROLES = new Set(['document_controller', 'admin']);
  const REQUIRED_HEADERS = [
    'schema_version', 'deliverable_id', 'plan_code', 'document_number',
    'responsible_organization', 'milestone', 'planned_start_date',
    'baseline_due_date', 'current_due_date', 'reschedule_reason', 'notes',
    'last_updated_at'
  ];
  const EXPORT_HEADERS = [
    'schema_version', 'deliverable_id', 'plan_code', 'midp_code',
    'document_number', 'deliverable_title', 'discipline', 'document_type',
    'responsible_organization', 'milestone', 'planned_start_date',
    'baseline_due_date', 'current_due_date', 'reschedule_reason', 'notes',
    'tracking_status', 'plan_variance_days', 'actual_delivery_date',
    'delivered_revision', 'approval_status', 'last_updated_at'
  ];

  let role = 'viewer';
  let validation = [];
  let loadedRows = [];
  let organizations = new Set();

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const norm = value => String(value ?? '').trim().toUpperCase();
  const q = value => `"${String(value ?? '').replaceAll('"', '""')}"`;

  function toast(message, error = false) {
    const t = $('toast');
    if (!t) return;
    t.textContent = message;
    t.className = `toast show ${error ? 'error' : 'success'}`;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.className = 'toast'; }, 4500);
  }

  function download(name, text) {
    const blob = new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function parseCsv(text) {
    text = String(text ?? '').replace(/^\uFEFF/, '');
    const out = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else {
        if (ch === '"') quoted = true;
        else if (ch === ',') { row.push(cell); cell = ''; }
        else if (ch === '\n') { row.push(cell); out.push(row); row = []; cell = ''; }
        else if (ch !== '\r') cell += ch;
      }
    }
    if (cell.length || row.length) { row.push(cell); out.push(row); }
    return out.filter(r => r.some(v => String(v).trim() !== ''));
  }

  function csvToObjects(text) {
    const parsed = parseCsv(text);
    if (!parsed.length) throw new Error('CSV file is empty.');
    const headers = parsed[0].map(h => String(h).trim().toLowerCase());
    const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h));
    if (missing.length) throw new Error(`Missing columns: ${missing.join(', ')}`);
    return parsed.slice(1).map((cells, index) => {
      const row = {};
      headers.forEach((h, i) => { row[h] = String(cells[i] ?? '').trim(); });
      row.__row = index + 2;
      return row;
    });
  }

  function isIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }

  function sameInstant(a, b) {
    const ta = new Date(a).getTime();
    const tb = new Date(b).getTime();
    return Number.isFinite(ta) && Number.isFinite(tb) && ta === tb;
  }

  function resolveOptionalText(raw, current) {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) return current ?? null;
    if (norm(trimmed) === CLEAR_TOKEN) return null;
    return trimmed;
  }

  function resolveOptionalCode(raw, current) {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) return current ?? null;
    if (norm(trimmed) === CLEAR_TOKEN) return null;
    return norm(trimmed);
  }

  function resolveOptionalDate(raw, current, issues, label) {
    const value = String(raw ?? '').trim();
    if (!value) return current ?? null;
    if (norm(value) === CLEAR_TOKEN) return null;
    if (!isIsoDate(value)) {
      issues.push(`${label} must be YYYY-MM-DD, blank, or ${CLEAR_TOKEN}`);
      return current ?? null;
    }
    return value;
  }

  async function fetchAllTidpRows(planId = '') {
    const all = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      let query = supabase
        .from('information_delivery_register_v')
        .select('id,plan_id,plan_type,plan_code,midp_code,document_number,deliverable_title,discipline_code,document_type_code,responsible_organization_code,milestone_name,planned_start_date,baseline_due_date,current_due_date,actual_delivery_date,delivered_revision,notes,tracking_status,plan_variance_days,approval_status,updated_at')
        .eq('plan_type', 'TIDP')
        .order('plan_code', { ascending: true })
        .order('document_number', { ascending: true, nullsFirst: false })
        .range(from, from + pageSize - 1);
      if (planId) query = query.eq('plan_id', planId);
      const { data, error } = await query;
      if (error) throw error;
      all.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
    return all;
  }

  async function fetchRowsByIds(ids) {
    const unique = [...new Set(ids.filter(Boolean))];
    const all = [];
    for (let i = 0; i < unique.length; i += 100) {
      const chunk = unique.slice(i, i + 100);
      const { data, error } = await supabase
        .from('information_delivery_register_v')
        .select('id,plan_id,plan_type,plan_code,document_number,deliverable_title,discipline_code,document_type_code,responsible_organization_code,milestone_name,planned_start_date,baseline_due_date,current_due_date,actual_delivery_date,delivered_revision,notes,updated_at')
        .in('id', chunk);
      if (error) throw error;
      all.push(...(data || []));
    }
    return all;
  }

  async function loadOrganizations() {
    const { data, error } = await supabase
      .from('organizations')
      .select('code')
      .eq('is_active', true)
      .order('code');
    if (error) throw error;
    organizations = new Set((data || []).map(x => norm(x.code)));
  }

  async function loadPlanOptions() {
    const { data, error } = await supabase
      .from('information_delivery_plans')
      .select('id,plan_code,plan_name,status')
      .eq('plan_type', 'TIDP')
      .order('plan_code');
    if (error) throw error;
    const select = $('tidpCsvPlan');
    if (!select) return;
    select.innerHTML = '<option value="">All TIDPs</option>' + (data || [])
      .map(p => `<option value="${esc(p.id)}">${esc(p.plan_code)} — ${esc(p.plan_name)}${p.status ? ` (${esc(p.status)})` : ''}</option>`)
      .join('');
  }

  async function exportSchedule() {
    const btn = $('tidpCsvExport');
    btn.disabled = true;
    btn.textContent = 'Exporting…';
    try {
      const planId = $('tidpCsvPlan')?.value || '';
      const rows = await fetchAllTidpRows(planId);
      if (!rows.length) throw new Error('No TIDP deliverables found for this selection.');
      const lines = [EXPORT_HEADERS.join(',')];
      for (const r of rows) {
        const values = [
          SCHEMA_VERSION,
          r.id,
          r.plan_code,
          r.midp_code || '',
          r.document_number || '',
          r.deliverable_title || '',
          r.discipline_code || '',
          r.document_type_code || '',
          r.responsible_organization_code || '',
          r.milestone_name || '',
          r.planned_start_date || '',
          r.baseline_due_date || '',
          r.current_due_date || '',
          '',
          r.notes || '',
          r.tracking_status || '',
          r.plan_variance_days ?? '',
          r.actual_delivery_date || '',
          r.delivered_revision || '',
          r.approval_status || '',
          r.updated_at || ''
        ];
        lines.push(values.map(q).join(','));
      }
      const selected = $('tidpCsvPlan')?.selectedOptions?.[0]?.textContent?.split(' — ')[0] || 'all-tidps';
      const safe = selected.replace(/[^A-Za-z0-9_-]+/g, '-');
      download(`${safe}-delivery-schedule-${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\r\n'));
      toast(`${rows.length} TIDP deliverables exported.`);
    } catch (e) {
      toast(e.message || 'Could not export TIDP schedule', true);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Export Schedule CSV';
    }
  }

  function addChange(changes, label, oldValue, newValue) {
    const a = oldValue ?? '—';
    const b = newValue ?? '—';
    if (String(a) !== String(b)) changes.push(`${label}: ${a} → ${b}`);
  }

  async function validateCsvRows() {
    const ids = loadedRows.map(r => r.deliverable_id).filter(Boolean);
    const [dbRows] = await Promise.all([fetchRowsByIds(ids), loadOrganizations()]);
    const byId = new Map(dbRows.map(r => [r.id, r]));

    validation = loadedRows.map(row => {
      const issues = [];
      const changes = [];
      const db = byId.get(row.deliverable_id);

      if (norm(row.schema_version) !== SCHEMA_VERSION) {
        issues.push(`schema_version must be ${SCHEMA_VERSION}`);
      }
      if (!row.deliverable_id) issues.push('deliverable_id is required');
      if (!db) {
        issues.push('Deliverable not found or no longer accessible');
        return { ...row, __db: null, __issues: issues, __changes: changes, __status: 'error' };
      }
      if (norm(db.plan_type) !== 'TIDP') issues.push('Deliverable is not assigned to a TIDP');
      if (norm(row.plan_code) !== norm(db.plan_code)) issues.push(`plan_code mismatch; current value is ${db.plan_code}`);
      if (norm(row.document_number) !== norm(db.document_number || '')) issues.push('document_number mismatch; this row may have been shifted or edited');
      if (row.baseline_due_date !== db.baseline_due_date) issues.push(`baseline_due_date is controlled; current value is ${db.baseline_due_date}`);
      if (!row.last_updated_at || !sameInstant(row.last_updated_at, db.updated_at)) issues.push('Row is stale. Export the latest schedule before applying changes.');

      let proposedDue = db.current_due_date;
      const dueRaw = String(row.current_due_date || '').trim();
      if (dueRaw) {
        if (norm(dueRaw) === CLEAR_TOKEN || !isIsoDate(dueRaw)) issues.push('current_due_date must be YYYY-MM-DD; it cannot be cleared');
        else proposedDue = dueRaw;
      }
      const dueChanged = proposedDue !== db.current_due_date;
      if (dueChanged) {
        if (db.actual_delivery_date) issues.push('Delivered items cannot be rescheduled');
        if (!String(row.reschedule_reason || '').trim()) issues.push('reschedule_reason is required when current_due_date changes');
        addChange(changes, 'Current due', db.current_due_date, proposedDue);
      }

      const proposedStart = resolveOptionalDate(row.planned_start_date, db.planned_start_date, issues, 'planned_start_date');
      if (proposedStart && proposedDue && proposedStart > proposedDue) issues.push('planned_start_date cannot be after current_due_date');
      if (proposedStart !== (db.planned_start_date || null)) addChange(changes, 'Planned start', db.planned_start_date, proposedStart);

      const proposedOrg = resolveOptionalCode(row.responsible_organization, db.responsible_organization_code);
      if (proposedOrg && !organizations.has(proposedOrg)) issues.push(`Unknown or inactive responsible_organization: ${proposedOrg}`);
      if (proposedOrg !== (db.responsible_organization_code || null)) addChange(changes, 'Responsible org', db.responsible_organization_code, proposedOrg);

      const proposedMilestone = resolveOptionalText(row.milestone, db.milestone_name);
      if (proposedMilestone !== (db.milestone_name || null)) addChange(changes, 'Milestone', db.milestone_name, proposedMilestone);

      const proposedNotes = resolveOptionalText(row.notes, db.notes);
      if (proposedNotes !== (db.notes || null)) addChange(changes, 'Notes', db.notes ? '[existing]' : null, proposedNotes ? '[updated]' : null);

      const status = issues.length ? 'error' : (changes.length ? 'update' : 'unchanged');
      return {
        ...row,
        __db: db,
        __issues: issues,
        __changes: changes,
        __status: status,
        __payload: {
          schema_version: SCHEMA_VERSION,
          deliverable_id: row.deliverable_id,
          plan_code: row.plan_code,
          document_number: row.document_number,
          baseline_due_date: row.baseline_due_date,
          current_due_date: row.current_due_date,
          reschedule_reason: row.reschedule_reason,
          responsible_organization: row.responsible_organization,
          milestone: row.milestone,
          planned_start_date: row.planned_start_date,
          notes: row.notes,
          last_updated_at: row.last_updated_at
        }
      };
    });

    renderPreview();
  }

  function renderPreview() {
    const total = validation.length;
    const updates = validation.filter(r => r.__status === 'update').length;
    const unchanged = validation.filter(r => r.__status === 'unchanged').length;
    const errors = validation.filter(r => r.__status === 'error').length;
    const dateChanges = validation.filter(r => r.__status === 'update' && r.__changes.some(c => c.startsWith('Current due:'))).length;

    $('tidpCsvSummary').innerHTML = `<strong>${total}</strong> rows · <strong>${updates}</strong> updates · <strong>${dateChanges}</strong> delivery-date changes · <strong>${unchanged}</strong> unchanged · <strong>${errors}</strong> errors`;
    $('tidpCsvApply').disabled = !IMPORT_ROLES.has(role) || !updates;
    $('tidpCsvErrorReport').disabled = !errors;
    $('tidpCsvPreviewWrap').classList.toggle('hidden', !total);
    $('tidpCsvPreviewBody').innerHTML = validation.map(r => {
      const statusHtml = r.__status === 'update'
        ? '<span class="tidp-csv-chip update">Update</span>'
        : r.__status === 'unchanged'
          ? '<span class="tidp-csv-chip unchanged">Unchanged</span>'
          : '<span class="tidp-csv-chip error">Error</span>';
      const detail = r.__issues.length
        ? `<div class="tiny tidp-csv-errors">${esc(r.__issues.join(' · '))}</div>`
        : r.__changes.length
          ? `<div class="tiny muted">${esc(r.__changes.join(' · '))}</div>`
          : '<div class="tiny muted">No changes detected</div>';
      return `<tr><td>${r.__row}</td><td>${esc(r.plan_code || '—')}</td><td class="doc-number">${esc(r.document_number || r.__db?.deliverable_title || 'Planned item')}</td><td>${detail}</td><td>${statusHtml}</td></tr>`;
    }).join('');
  }

  async function applyUpdates() {
    if (!IMPORT_ROLES.has(role)) return toast('Document Controller or Admin role required', true);
    const updates = validation.filter(r => r.__status === 'update');
    if (!updates.length) return;
    const btn = $('tidpCsvApply');
    btn.disabled = true;
    btn.textContent = `Applying ${updates.length}…`;
    try {
      const { data, error } = await supabase.rpc('import_tidp_schedule_csv', {
        p_rows: updates.map(r => r.__payload)
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      toast(`${result?.updated ?? updates.length} updated · ${result?.due_date_changes ?? 0} delivery dates · ${result?.metadata_changes ?? 0} planning metadata changes`);
      validation = [];
      loadedRows = [];
      $('tidpCsvFile').value = '';
      $('tidpCsvSummary').textContent = 'Updates applied. Re-export before making another round of edits.';
      $('tidpCsvPreviewBody').innerHTML = '';
      $('tidpCsvPreviewWrap').classList.add('hidden');
      $('tidpCsvApply').disabled = true;
      $('tidpCsvErrorReport').disabled = true;
      document.getElementById('pRefresh')?.click();
    } catch (e) {
      toast(e.message || 'Could not apply TIDP CSV updates', true);
    } finally {
      btn.textContent = 'Apply Valid Updates';
      if (validation.some(r => r.__status === 'update')) btn.disabled = false;
    }
  }

  function downloadErrorReport() {
    const bad = validation.filter(r => r.__status === 'error');
    if (!bad.length) return;
    const headers = ['row', 'deliverable_id', 'plan_code', 'document_number', 'errors'];
    const lines = [headers.join(',')];
    for (const r of bad) lines.push([r.__row, r.deliverable_id, r.plan_code, r.document_number, r.__issues.join(' | ')].map(q).join(','));
    download(`tidp-schedule-import-errors-${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\r\n'));
  }

  function injectStyles() {
    if ($('tidpCsvStyles')) return;
    const style = document.createElement('style');
    style.id = 'tidpCsvStyles';
    style.textContent = `
      .tidp-csv-panel{margin-bottom:14px}.tidp-csv-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.tidp-csv-toolbar select{min-width:240px}.tidp-csv-help{margin-top:10px;padding:10px 12px;border:1px solid #e5e9ef;border-radius:9px;background:#fafbfd;line-height:1.55}.tidp-csv-help code{font-size:11px}.tidp-csv-chip{display:inline-flex;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:700}.tidp-csv-chip.update{background:#e8f2ff;color:#1d56a8}.tidp-csv-chip.unchanged{background:#eef2f5;color:#5f6874}.tidp-csv-chip.error{background:#fdecec;color:#982a2a}.tidp-csv-errors{color:#a42b2b;max-width:680px}.tidp-csv-preview{max-height:420px;overflow:auto;margin-top:12px}.tidp-csv-summary{margin-top:10px}.tidp-csv-file{max-width:260px}@media(max-width:800px){.tidp-csv-toolbar>*{width:100%}.tidp-csv-toolbar select{min-width:0}}
    `;
    document.head.appendChild(style);
  }

  function injectPanel() {
    if ($('tidpCsvPanel')) return true;
    const pane = $('planDeliverables');
    if (!pane) return false;
    injectStyles();
    const panel = document.createElement('div');
    panel.id = 'tidpCsvPanel';
    panel.className = 'panel tidp-csv-panel';
    panel.innerHTML = `
      <div class="panel-head">
        <div>
          <h3>TIDP Schedule CSV — Excel Round-trip</h3>
          <p class="muted">Export the schedule, edit delivery planning in Excel, validate the changes, then apply them safely.</p>
        </div>
      </div>
      <div class="tidp-csv-toolbar">
        <select id="tidpCsvPlan"><option value="">All TIDPs</option></select>
        <button id="tidpCsvExport" class="btn secondary" type="button">Export Schedule CSV</button>
        <input id="tidpCsvFile" class="tidp-csv-file" type="file" accept=".csv,text/csv" />
        <button id="tidpCsvValidate" class="btn primary" type="button" disabled>Validate CSV</button>
        <button id="tidpCsvApply" class="btn primary" type="button" disabled>Apply Valid Updates</button>
        <button id="tidpCsvErrorReport" class="btn secondary" type="button" disabled>Download Error Report</button>
      </div>
      <div class="tidp-csv-help tiny muted">
        <strong>Editable in Excel:</strong> current_due_date, planned_start_date, milestone, responsible_organization, notes. <strong>When current_due_date changes, reschedule_reason is mandatory.</strong><br>
        Baseline date, IDs and document identity are protected. Blank editable cells mean <em>leave unchanged</em>; use <code>${CLEAR_TOKEN}</code> to clear optional fields. Dates must be <code>YYYY-MM-DD</code>. The file also carries last_updated_at to stop stale Excel files overwriting newer changes.
      </div>
      <div id="tidpCsvSummary" class="tidp-csv-summary muted small-text">Export a schedule or choose an edited CSV file.</div>
      <div id="tidpCsvPreviewWrap" class="table-wrap tidp-csv-preview hidden">
        <table><thead><tr><th>Row</th><th>TIDP</th><th>Document</th><th>Detected Changes / Errors</th><th>Status</th></tr></thead><tbody id="tidpCsvPreviewBody"></tbody></table>
      </div>
    `;
    pane.prepend(panel);

    $('tidpCsvExport').onclick = exportSchedule;
    $('tidpCsvValidate').onclick = () => validateCsvRows().catch(e => toast(e.message || 'Could not validate CSV', true));
    $('tidpCsvApply').onclick = applyUpdates;
    $('tidpCsvErrorReport').onclick = downloadErrorReport;
    $('tidpCsvFile').onchange = async event => {
      validation = [];
      loadedRows = [];
      $('tidpCsvPreviewBody').innerHTML = '';
      $('tidpCsvPreviewWrap').classList.add('hidden');
      $('tidpCsvApply').disabled = true;
      $('tidpCsvErrorReport').disabled = true;
      const file = event.target.files?.[0];
      if (!file) {
        $('tidpCsvValidate').disabled = true;
        $('tidpCsvSummary').textContent = 'Export a schedule or choose an edited CSV file.';
        return;
      }
      try {
        loadedRows = csvToObjects(await file.text());
        if (!loadedRows.length) throw new Error('CSV contains headers but no data rows.');
        $('tidpCsvValidate').disabled = false;
        $('tidpCsvSummary').textContent = `${loadedRows.length} rows loaded. Click Validate CSV before applying anything.`;
      } catch (e) {
        $('tidpCsvValidate').disabled = true;
        toast(e.message || 'Could not read CSV', true);
      }
    };

    if (!IMPORT_ROLES.has(role)) {
      $('tidpCsvFile').disabled = true;
      $('tidpCsvValidate').disabled = true;
      $('tidpCsvApply').disabled = true;
      $('tidpCsvErrorReport').disabled = true;
      $('tidpCsvSummary').textContent = 'Export is available. CSV import requires Document Controller or Admin access.';
    }

    loadPlanOptions().catch(e => toast(e.message || 'Could not load TIDPs', true));
    return true;
  }

  async function waitAndInject() {
    if (injectPanel()) return;
    await new Promise(resolve => {
      const observer = new MutationObserver(() => {
        if (injectPanel()) { observer.disconnect(); resolve(); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(); }, 10000);
    });
  }

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data, error } = await supabase.rpc('current_user_role');
    if (error) throw error;
    role = data || 'viewer';
    await waitAndInject();
  }

  setTimeout(() => init().catch(e => toast(e.message || 'Could not initialize TIDP CSV tools', true)), 350);
}
