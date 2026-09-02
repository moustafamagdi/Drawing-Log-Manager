import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.DLM_CONFIG;
if (cfg) {
  const supabase = createClient(cfg.url, cfg.key);
  const $ = id => document.getElementById(id);
  const SCHEMA_VERSION = 'TIDP-SCHEDULE-1';
  const CLEAR_TOKEN = '[CLEAR]';
  const IMPORT_ROLES = new Set(['document_controller', 'admin']);
  const REQUIRED_HEADERS = ['schema_version','deliverable_id','plan_code','document_number','current_due_date'];
  const EXPORT_HEADERS = [
    'schema_version','deliverable_id','plan_code','midp_code','document_number','deliverable_title',
    'discipline','document_type','responsible_organization','milestone','planned_start_date',
    'baseline_due_date','current_due_date','reschedule_reason','notes','tracking_status',
    'plan_variance_days','actual_delivery_date','delivered_revision','approval_status',
    'row_version','last_updated_at'
  ];

  let role = 'viewer';
  let loadedRows = [];
  let validation = [];
  let organizations = new Set();

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = v => String(v ?? '').trim().toUpperCase();
  const quote = v => `"${String(v ?? '').replaceAll('"','""')}"`;
  const iso = (y,m,d) => `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  function toast(message, error=false) {
    const t = $('toast');
    if (!t) return;
    t.textContent = message;
    t.className = `toast show ${error ? 'error' : 'success'}`;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.className = 'toast', 4500);
  }

  function download(name, text) {
    const url = URL.createObjectURL(new Blob(['\uFEFF' + text], {type:'text/csv;charset=utf-8'}));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function detectDelimiter(text) {
    const first = (String(text).replace(/^\uFEFF/,'').split(/\r?\n/)[0] || '');
    const counts = {',':0,';':0,'\t':0};
    let quoted = false;
    for (let i=0;i<first.length;i++) {
      const ch = first[i];
      if (ch === '"') {
        if (quoted && first[i+1] === '"') { i++; continue; }
        quoted = !quoted;
      } else if (!quoted && Object.prototype.hasOwnProperty.call(counts,ch)) counts[ch]++;
    }
    return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] || ',';
  }

  function parseCsv(text) {
    text = String(text ?? '').replace(/^\uFEFF/, '');
    const delimiter = detectDelimiter(text);
    const out = [];
    let row = [], cell = '', quoted = false;
    for (let i=0;i<text.length;i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i+1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else {
        if (ch === '"') quoted = true;
        else if (ch === delimiter) { row.push(cell); cell=''; }
        else if (ch === '\n') { row.push(cell); out.push(row); row=[]; cell=''; }
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
    if (missing.length) throw new Error(`Missing required columns: ${missing.join(', ')}`);
    return parsed.slice(1).map((cells,index) => {
      const r = {};
      headers.forEach((h,i) => r[h] = String(cells[i] ?? '').trim());
      r.__row = index + 2;
      return r;
    });
  }

  function validYmd(y,m,d) {
    const dt = new Date(Date.UTC(y,m-1,d));
    return dt.getUTCFullYear()===y && dt.getUTCMonth()===m-1 && dt.getUTCDate()===d;
  }

  function excelSerialToIso(n) {
    if (!Number.isFinite(n) || n < 1 || n > 100000) return null;
    const dt = new Date(Math.round(n) * 86400000 + Date.UTC(1899,11,30));
    return iso(dt.getUTCFullYear(),dt.getUTCMonth()+1,dt.getUTCDate());
  }

  function dateCandidates(raw) {
    const value = String(raw ?? '').trim();
    if (!value) return [];
    if (norm(value) === CLEAR_TOKEN) return [CLEAR_TOKEN];
    const out = [];
    const push = (y,m,d) => {
      y=Number(y);m=Number(m);d=Number(d);
      if (validYmd(y,m,d)) {
        const s = iso(y,m,d);
        if (!out.includes(s)) out.push(s);
      }
    };
    let match = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s.*)?$/);
    if (match) push(match[1],match[2],match[3]);
    match = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\s.*)?$/);
    if (match) {
      push(match[3],match[2],match[1]);
      push(match[3],match[1],match[2]);
    }
    if (/^\d{4,5}(?:\.\d+)?$/.test(value)) {
      const s = excelSerialToIso(Number(value));
      if (s && !out.includes(s)) out.push(s);
    }
    if (!out.length) {
      const ts = Date.parse(value);
      if (Number.isFinite(ts)) {
        const dt = new Date(ts);
        const s = iso(dt.getUTCFullYear(),dt.getUTCMonth()+1,dt.getUTCDate());
        if (!out.includes(s)) out.push(s);
      }
    }
    return out;
  }

  function resolveDate(raw,current,{allowClear=false,required=false,label='date'}={}) {
    const value = String(raw ?? '').trim();
    if (!value) return {value:current ?? null, issue:required && !current ? `${label} is required` : null, warning:null};
    const candidates = dateCandidates(value);
    if (candidates.includes(CLEAR_TOKEN)) {
      return allowClear ? {value:null,issue:null,warning:null} : {value:current ?? null,issue:`${label} cannot be cleared`,warning:null};
    }
    if (current && candidates.includes(current)) return {value:current,issue:null,warning:null};
    if (!candidates.length) return {value:current ?? null,issue:`${label} is not a recognized Excel date`,warning:null};
    return {value:candidates[0],issue:null,warning:candidates.length>1 ? `${label} interpreted as ${candidates[0]}` : null};
  }

  function resolveText(raw,current) {
    const value = String(raw ?? '').trim();
    if (!value) return current ?? null;
    if (norm(value) === CLEAR_TOKEN) return null;
    return value;
  }

  function resolveCode(raw,current) {
    const value = String(raw ?? '').trim();
    if (!value) return current ?? null;
    if (norm(value) === CLEAR_TOKEN) return null;
    return norm(value);
  }

  function sourceVersion(row) {
    const raw = String(row.row_version ?? '').trim();
    if (raw) {
      const n = Number(raw.replace(/,/g,''));
      if (Number.isFinite(n)) return String(Math.round(n));
    }
    const rawTs = String(row.last_updated_at ?? '').trim();
    const t = Date.parse(rawTs);
    return Number.isFinite(t) ? String(Math.round(t)) : null;
  }

  async function fetchRows(planId='') {
    const all = [], size = 1000;
    for (let from=0;;from+=size) {
      let q = supabase.from('information_delivery_register_v')
        .select('id,plan_id,plan_type,plan_code,midp_code,document_number,deliverable_title,discipline_code,document_type_code,responsible_organization_code,milestone_name,planned_start_date,baseline_due_date,current_due_date,actual_delivery_date,delivered_revision,notes,tracking_status,plan_variance_days,approval_status,updated_at')
        .eq('plan_type','TIDP').order('plan_code').order('document_number',{nullsFirst:false}).range(from,from+size-1);
      if (planId) q = q.eq('plan_id',planId);
      const {data,error} = await q;
      if (error) throw error;
      all.push(...(data || []));
      if (!data || data.length < size) break;
    }
    return all;
  }

  async function fetchByIds(ids) {
    const unique = [...new Set(ids.filter(Boolean))], out = [];
    for (let i=0;i<unique.length;i+=100) {
      const {data,error} = await supabase.from('information_delivery_register_v')
        .select('id,plan_type,plan_code,document_number,deliverable_title,responsible_organization_code,milestone_name,planned_start_date,baseline_due_date,current_due_date,actual_delivery_date,notes,updated_at')
        .in('id',unique.slice(i,i+100));
      if (error) throw error;
      out.push(...(data || []));
    }
    return out;
  }

  async function loadOrganizations() {
    const {data,error} = await supabase.from('organizations').select('code').eq('is_active',true);
    if (error) throw error;
    organizations = new Set((data || []).map(x => norm(x.code)));
  }

  async function loadPlans() {
    const {data,error} = await supabase.from('information_delivery_plans')
      .select('id,plan_code,plan_name,status').eq('plan_type','TIDP').order('plan_code');
    if (error) throw error;
    const select = $('tidpCsvPlanV3');
    if (!select) return;
    select.innerHTML = '<option value="">All TIDPs</option>' + (data || []).map(p =>
      `<option value="${esc(p.id)}">${esc(p.plan_code)} — ${esc(p.plan_name)}${p.status ? ` (${esc(p.status)})` : ''}</option>`
    ).join('');
  }

  async function exportSchedule() {
    const btn = $('tidpCsvExportV3');
    btn.disabled = true;
    btn.textContent = 'Exporting…';
    try {
      const rows = await fetchRows($('tidpCsvPlanV3').value);
      if (!rows.length) throw new Error('No TIDP deliverables found.');
      const lines = [EXPORT_HEADERS.join(',')];
      for (const r of rows) {
        const rowVersion = String(Math.round(Date.parse(r.updated_at)));
        lines.push([
          SCHEMA_VERSION,r.id,r.plan_code,r.midp_code||'',r.document_number||'',r.deliverable_title||'',
          r.discipline_code||'',r.document_type_code||'',r.responsible_organization_code||'',r.milestone_name||'',
          r.planned_start_date||'',r.baseline_due_date||'',r.current_due_date||'','',r.notes||'',
          r.tracking_status||'',r.plan_variance_days??'',r.actual_delivery_date||'',r.delivered_revision||'',
          r.approval_status||'',rowVersion,r.updated_at||''
        ].map(quote).join(','));
      }
      const code = ($('tidpCsvPlanV3').selectedOptions[0]?.textContent?.split(' — ')[0] || 'all-tidps').replace(/[^A-Za-z0-9_-]+/g,'-');
      download(`${code}-delivery-schedule-${new Date().toISOString().slice(0,10)}.csv`,lines.join('\r\n'));
      toast(`${rows.length} deliverables exported.`);
    } catch (e) {
      toast(e.message || 'Export failed',true);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Export Schedule CSV';
    }
  }

  function addChange(arr,label,a,b) {
    if (String(a ?? '—') !== String(b ?? '—')) arr.push(`${label}: ${a ?? '—'} → ${b ?? '—'}`);
  }

  async function validate() {
    const defaultReason = String($('tidpCsvDefaultReasonV3')?.value || '').trim();
    const [dbRows] = await Promise.all([fetchByIds(loadedRows.map(r=>r.deliverable_id)),loadOrganizations()]);
    const byId = new Map(dbRows.map(x => [x.id,x]));

    validation = loadedRows.map(row => {
      const issues = [], warnings = [], changes = [];
      const db = byId.get(row.deliverable_id);
      if (norm(row.schema_version) !== SCHEMA_VERSION) issues.push(`schema_version must be ${SCHEMA_VERSION}`);
      if (!db) {
        issues.push('Deliverable not found or no longer accessible');
        return {...row,__issues:issues,__warnings:warnings,__changes:changes,__status:'error'};
      }
      if (norm(db.plan_type) !== 'TIDP') issues.push('Deliverable is not in a TIDP');
      if (norm(row.plan_code) !== norm(db.plan_code)) issues.push(`plan_code mismatch; DB is ${db.plan_code}`);
      if (norm(row.document_number) !== norm(db.document_number || '')) issues.push('document_number mismatch');

      const baselineRaw = String(row.baseline_due_date ?? '').trim();
      if (baselineRaw) {
        const candidates = dateCandidates(baselineRaw);
        if (!candidates.includes(db.baseline_due_date)) warnings.push(`Baseline is protected; Excel value ignored (DB ${db.baseline_due_date})`);
      }

      const srcVersion = sourceVersion(row);
      const dbVersion = String(Math.round(Date.parse(db.updated_at)));
      const stale = !srcVersion || srcVersion !== dbVersion;
      if (stale) warnings.push('Excel row is older than the current database row. Identity is still valid, so editable changes can be applied to the latest database values.');

      const due = resolveDate(row.current_due_date,db.current_due_date,{required:true,label:'current_due_date'});
      if (due.issue) issues.push(due.issue);
      if (due.warning) warnings.push(due.warning);
      const dueChanged = due.value !== db.current_due_date;
      const reason = String(row.reschedule_reason || '').trim() || defaultReason;
      if (dueChanged) {
        if (db.actual_delivery_date) issues.push('Delivered items cannot be rescheduled');
        if (!reason) issues.push('Date changed: add reschedule_reason in Excel or use Default Reason above');
        addChange(changes,'Current due',db.current_due_date,due.value);
      }

      const start = resolveDate(row.planned_start_date,db.planned_start_date,{allowClear:true,label:'planned_start_date'});
      if (start.issue) issues.push(start.issue);
      if (start.warning) warnings.push(start.warning);
      if (start.value && due.value && start.value > due.value) issues.push('planned_start_date cannot be after current_due_date');
      if (start.value !== (db.planned_start_date || null)) addChange(changes,'Planned start',db.planned_start_date,start.value);

      const org = resolveCode(row.responsible_organization,db.responsible_organization_code);
      if (org && !organizations.has(org)) issues.push(`Unknown/inactive responsible_organization: ${org}`);
      if (org !== (db.responsible_organization_code || null)) addChange(changes,'Responsible org',db.responsible_organization_code,org);

      const milestone = resolveText(row.milestone,db.milestone_name);
      if (milestone !== (db.milestone_name || null)) addChange(changes,'Milestone',db.milestone_name,milestone);

      const notes = resolveText(row.notes,db.notes);
      if (notes !== (db.notes || null)) addChange(changes,'Notes',db.notes ? '[existing]' : null,notes ? '[updated]' : null);

      const status = issues.length ? 'error' : changes.length ? 'update' : 'unchanged';
      return {...row,__db:db,__issues:issues,__warnings:warnings,__changes:changes,__status:status,__stale:stale,__payload:{
        schema_version:SCHEMA_VERSION,
        deliverable_id:db.id,
        plan_code:db.plan_code,
        document_number:db.document_number || '',
        baseline_due_date:db.baseline_due_date,
        current_due_date:due.value,
        reschedule_reason:reason,
        responsible_organization:org===null ? CLEAR_TOKEN : org,
        milestone:milestone===null ? CLEAR_TOKEN : milestone,
        planned_start_date:start.value===null ? CLEAR_TOKEN : start.value,
        notes:notes===null ? CLEAR_TOKEN : notes,
        row_version:srcVersion || '',
        last_updated_at:String(row.last_updated_at || '')
      }};
    });
    render();
  }

  function render() {
    const updates = validation.filter(r=>r.__status==='update');
    const errors = validation.filter(r=>r.__status==='error');
    const unchanged = validation.filter(r=>r.__status==='unchanged').length;
    const warnings = validation.filter(r=>r.__warnings?.length).length;
    const stale = validation.filter(r=>r.__stale).length;
    const dateChanges = updates.filter(r=>r.__changes.some(c=>c.startsWith('Current due:'))).length;

    $('tidpCsvSummaryV3').innerHTML = `<strong>${validation.length}</strong> rows · <strong>${updates.length}</strong> updates · <strong>${dateChanges}</strong> date changes · <strong>${unchanged}</strong> unchanged · <strong>${warnings}</strong> warnings (${stale} stale) · <strong>${errors.length}</strong> blocking errors`;
    $('tidpCsvApplyV3').disabled = !IMPORT_ROLES.has(role) || !updates.length;
    $('tidpCsvApplyV3').textContent = updates.length ? `Apply ${updates.length} Valid Updates` : 'Apply Updates';
    $('tidpCsvErrorsV3').disabled = !errors.length;
    $('tidpCsvPreviewV3').classList.toggle('hidden',!validation.length);

    $('tidpCsvBodyV3').innerHTML = validation.map(r => {
      const badge = r.__status==='update'
        ? `<span class="tidp3-chip update">${r.__warnings.length ? 'Update + Warning' : 'Update'}</span>`
        : r.__status==='error'
          ? '<span class="tidp3-chip error">Error</span>'
          : `<span class="tidp3-chip unchanged">${r.__warnings.length ? 'Unchanged + Warning' : 'Unchanged'}</span>`;
      const blocks = [];
      if (r.__changes.length) blocks.push(`<div class="tiny">${esc(r.__changes.join(' · '))}</div>`);
      else blocks.push('<div class="tiny muted">No editable changes detected</div>');
      if (r.__warnings.length) blocks.push(`<div class="tiny tidp3-warn">⚠ ${esc(r.__warnings.join(' · '))}</div>`);
      if (r.__issues.length) blocks.push(`<div class="tiny tidp3-error">${esc(r.__issues.join(' · '))}</div>`);
      return `<tr><td>${r.__row}</td><td>${esc(r.plan_code || r.__db?.plan_code || '—')}</td><td class="doc-number">${esc(r.document_number || r.__db?.document_number || '—')}</td><td>${blocks.join('')}</td><td>${badge}</td></tr>`;
    }).join('');
  }

  async function apply() {
    const updates = validation.filter(r=>r.__status==='update');
    if (!updates.length) return;
    const btn = $('tidpCsvApplyV3');
    btn.disabled = true;
    btn.textContent = 'Applying…';
    try {
      const {data,error} = await supabase.rpc('import_tidp_schedule_csv',{p_rows:updates.map(x=>x.__payload)});
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      toast(`${result?.updated ?? updates.length} updated · ${result?.due_date_changes ?? 0} delivery-date changes · ${result?.stale_warnings ?? 0} stale-source warnings accepted`);
      loadedRows = [];
      validation = [];
      $('tidpCsvFileV3').value = '';
      $('tidpCsvPreviewV3').classList.add('hidden');
      $('tidpCsvSummaryV3').textContent = 'Done. You can keep working from Excel; stale rows are warnings, not blockers.';
      $('tidpCsvApplyV3').disabled = true;
      $('tidpCsvErrorsV3').disabled = true;
      document.getElementById('pRefresh')?.click();
    } catch (e) {
      toast(e.message || 'Import failed',true);
    } finally {
      if (validation.some(x=>x.__status==='update')) {
        btn.disabled = false;
        btn.textContent = `Apply ${validation.filter(x=>x.__status==='update').length} Valid Updates`;
      }
    }
  }

  function errorReport() {
    const bad = validation.filter(r=>r.__status==='error');
    if (!bad.length) return;
    const lines = ['row,deliverable_id,plan_code,document_number,errors,warnings'];
    bad.forEach(r => lines.push([
      r.__row,r.deliverable_id,r.plan_code,r.document_number,
      r.__issues.join(' | '),r.__warnings.join(' | ')
    ].map(quote).join(',')));
    download(`tidp-schedule-import-errors-${new Date().toISOString().slice(0,10)}.csv`,lines.join('\r\n'));
  }

  function styles() {
    if ($('tidpCsvV3Styles')) return;
    const style = document.createElement('style');
    style.id = 'tidpCsvV3Styles';
    style.textContent = `
      .tidp3-panel{margin-bottom:14px}.tidp3-grid{display:grid;grid-template-columns:minmax(220px,1fr) minmax(250px,1.3fr) auto auto;gap:8px;align-items:end}
      .tidp3-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.tidp3-help{margin-top:10px;padding:11px 13px;border:1px solid #e5e9ef;border-radius:9px;background:#fafbfd;line-height:1.55}
      .tidp3-chip{display:inline-flex;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:700}.tidp3-chip.update{background:#e8f2ff;color:#1d56a8}.tidp3-chip.error{background:#fdecec;color:#982a2a}.tidp3-chip.unchanged{background:#eef2f5;color:#5f6874}
      .tidp3-error{color:#a42b2b;margin-top:3px}.tidp3-warn{color:#8a6500;margin-top:3px}.tidp3-preview{max-height:440px;overflow:auto;margin-top:12px}.tidp3-summary{margin-top:10px}
      @media(max-width:950px){.tidp3-grid{grid-template-columns:1fr 1fr}}@media(max-width:650px){.tidp3-grid{grid-template-columns:1fr}.tidp3-actions>*{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function inject() {
    const pane = $('planDeliverables');
    if (!pane) return false;
    $('tidpCsvPanel')?.remove();
    $('tidpCsvPanelV2')?.remove();
    if ($('tidpCsvPanelV3')) return true;
    styles();
    const panel = document.createElement('div');
    panel.id = 'tidpCsvPanelV3';
    panel.className = 'panel tidp3-panel';
    panel.innerHTML = `
      <div class="panel-head"><div><h3>TIDP Schedule — Excel Update</h3><p class="muted">Export, edit in Excel, choose the edited file — validation runs automatically. Older Excel rows are warnings, not blockers.</p></div></div>
      <div class="tidp3-grid">
        <label>TIDP<select id="tidpCsvPlanV3"><option value="">All TIDPs</option></select></label>
        <label>Default Reason for Date Changes<input id="tidpCsvDefaultReasonV3" placeholder="Optional — used when row reason is blank"></label>
        <button id="tidpCsvExportV3" class="btn secondary" type="button">Export Schedule CSV</button>
        <label class="btn secondary" style="cursor:pointer">Choose Edited CSV<input id="tidpCsvFileV3" type="file" accept=".csv,text/csv" hidden></label>
      </div>
      <div class="tidp3-actions">
        <button id="tidpCsvRevalidateV3" class="btn secondary" type="button" disabled>Revalidate</button>
        <button id="tidpCsvApplyV3" class="btn primary" type="button" disabled>Apply Updates</button>
        <button id="tidpCsvErrorsV3" class="btn secondary" type="button" disabled>Download Blocking Errors</button>
      </div>
      <div class="tidp3-help tiny muted">
        <strong>Editable:</strong> current_due_date, planned_start_date, milestone, responsible_organization, notes. Blank = leave unchanged; <code>${CLEAR_TOKEN}</code> clears optional values.<br>
        <strong>Stale Excel files:</strong> if the database row changed since export, you will see a warning only. The import still checks deliverable_id + plan_code + document_number, then applies your editable values to the latest database row. Baseline remains protected.<br>
        <strong>Dates:</strong> YYYY-MM-DD, DD/MM/YYYY, M/D/YYYY and Excel date serials are accepted.
      </div>
      <div id="tidpCsvSummaryV3" class="tidp3-summary muted small-text">Export a schedule, edit it in Excel, then choose the edited CSV.</div>
      <div id="tidpCsvPreviewV3" class="table-wrap tidp3-preview hidden"><table><thead><tr><th>Row</th><th>TIDP</th><th>Document</th><th>Detected Changes / Warnings / Errors</th><th>Status</th></tr></thead><tbody id="tidpCsvBodyV3"></tbody></table></div>
    `;
    pane.prepend(panel);

    $('tidpCsvExportV3').onclick = exportSchedule;
    $('tidpCsvRevalidateV3').onclick = () => validate().catch(e=>toast(e.message||'Validation failed',true));
    $('tidpCsvApplyV3').onclick = apply;
    $('tidpCsvErrorsV3').onclick = errorReport;
    $('tidpCsvDefaultReasonV3').oninput = () => {
      if (loadedRows.length) validate().catch(()=>{});
    };
    $('tidpCsvFileV3').onchange = async event => {
      loadedRows = [];
      validation = [];
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        loadedRows = csvToObjects(await file.text());
        if (!loadedRows.length) throw new Error('CSV contains no data rows.');
        $('tidpCsvRevalidateV3').disabled = false;
        $('tidpCsvSummaryV3').textContent = `${loadedRows.length} rows loaded. Validating…`;
        await validate();
      } catch (e) {
        $('tidpCsvRevalidateV3').disabled = true;
        $('tidpCsvApplyV3').disabled = true;
        toast(e.message || 'Could not read CSV',true);
      }
    };

    if (!IMPORT_ROLES.has(role)) {
      $('tidpCsvFileV3').disabled = true;
      $('tidpCsvRevalidateV3').disabled = true;
      $('tidpCsvApplyV3').disabled = true;
      $('tidpCsvErrorsV3').disabled = true;
      $('tidpCsvSummaryV3').textContent = 'Export is available. Import requires Document Controller or Admin access.';
    }

    loadPlans().catch(e=>toast(e.message||'Could not load TIDPs',true));
    return true;
  }

  async function init() {
    const {data:{session}} = await supabase.auth.getSession();
    if (!session) return;
    const {data,error} = await supabase.rpc('current_user_role');
    if (error) throw error;
    role = data || 'viewer';
    if (inject()) return;
    const observer = new MutationObserver(() => {
      if (inject()) observer.disconnect();
    });
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),10000);
  }

  setTimeout(()=>init().catch(e=>toast(e.message||'Could not initialize TIDP Excel tools',true)),350);
}
