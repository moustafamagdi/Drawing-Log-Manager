import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.DLM_CONFIG;
if (cfg) {
  const supabase = createClient(cfg.url, cfg.key);
  const $ = id => document.getElementById(id);
  const EDIT_ROLES = new Set(['document_controller', 'admin']);
  const EDITABLE = ['current_due_date', 'planned_start_date', 'milestone_name', 'responsible_organization_code', 'notes'];

  let role = 'viewer';
  let plans = [];
  let organizations = [];
  let rows = [];
  let edits = new Map();
  let selected = new Set();

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const same = (a,b) => String(a ?? '') === String(b ?? '');
  const canEdit = () => EDIT_ROLES.has(role);
  const toast = (message,error=false) => {
    const t = $('toast');
    if (!t) return;
    t.textContent = message;
    t.className = `toast show ${error ? 'error' : 'success'}`;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.className = 'toast'; }, 4200);
  };

  function injectStyles() {
    if ($('tidpGridEditorStyles')) return;
    const s = document.createElement('style');
    s.id = 'tidpGridEditorStyles';
    s.textContent = `
      .tg-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:10px}.tg-toolbar label{min-width:180px}.tg-toolbar .tg-grow{flex:1;min-width:240px}
      .tg-summary{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0}.tg-pill{display:inline-flex;align-items:center;padding:5px 9px;border-radius:999px;background:#eef2f7;font-size:11px;font-weight:700}.tg-pill.dirty{background:#e8f2ff;color:#1d56a8}.tg-pill.error{background:#fdecec;color:#982a2a}
      .tg-bulk{display:grid;grid-template-columns:minmax(180px,220px) minmax(220px,1fr) auto;gap:8px;align-items:end;padding:10px 12px;border:1px solid #e5e9ef;border-radius:10px;background:#fafbfd;margin:10px 0}.tg-bulk .tg-bulk-value input,.tg-bulk .tg-bulk-value select{width:100%}
      .tg-table-wrap{max-height:600px;overflow:auto;border:1px solid #e5e9ef;border-radius:10px}.tg-table{min-width:1550px;border-collapse:separate;border-spacing:0}.tg-table th{position:sticky;top:0;z-index:3;background:#f8fafc;white-space:nowrap}.tg-table td{vertical-align:top}.tg-table input,.tg-table select{min-width:120px;padding:6px 7px;font-size:12px}.tg-table .tg-notes{min-width:220px}.tg-table .tg-milestone{min-width:170px}.tg-table .tg-reason{min-width:200px}.tg-table tr.tg-dirty td{background:#fffdf3}.tg-table tr.tg-error td{background:#fff5f5}.tg-doc{min-width:290px;max-width:360px}.tg-title{min-width:240px;max-width:320px}.tg-readonly{white-space:nowrap}.tg-warning{font-size:10px;color:#a06400;margin-top:4px}.tg-error-text{font-size:10px;color:#a42b2b;margin-top:4px}
      .tg-review{margin-top:12px}.tg-review-list{max-height:320px;overflow:auto}.tg-review-item{padding:9px 10px;border-bottom:1px solid #edf0f4}.tg-review-item:last-child{border-bottom:0}.tg-review-change{font-size:11px;margin-top:3px}.tg-review-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      @media(max-width:850px){.tg-bulk{grid-template-columns:1fr}.tg-toolbar>*{width:100%}.tg-toolbar label{min-width:0}}
    `;
    document.head.appendChild(s);
  }

  function injectPage() {
    const planningPage = $('planningPage');
    const tabs = planningPage?.querySelector('.plan-tabs');
    if (!planningPage || !tabs) return false;
    if ($('planGridEditor')) return true;

    injectStyles();
    const tab = document.createElement('button');
    tab.className = 'btn secondary plan-tab controller-only';
    tab.dataset.tab = 'gridEditor';
    tab.textContent = 'Grid Editor';
    tab.classList.toggle('hidden', !canEdit());
    tabs.appendChild(tab);

    const pane = document.createElement('div');
    pane.id = 'planGridEditor';
    pane.className = 'plan-pane hidden';
    pane.innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <div><h3>TIDP Bulk Grid Editor</h3><p class="muted">Edit delivery planning directly in the browser. Changes stay staged until you review and apply them.</p></div>
          <button id="tgRefresh" class="btn secondary" type="button">Refresh</button>
        </div>
        <div class="tg-toolbar">
          <label>TIDP<select id="tgPlan"><option value="">Select TIDP…</option></select></label>
          <label class="tg-grow">Search<input id="tgSearch" placeholder="Document number or title"></label>
          <label>Status<select id="tgStatus"><option value="">All</option><option value="open">Open</option><option value="delivered">Delivered</option><option value="overdue">Overdue</option></select></label>
          <label class="tg-grow">Default reschedule reason<input id="tgDefaultReason" placeholder="Used for changed Current Due dates"></label>
        </div>
        <div class="tg-summary">
          <span id="tgRowCount" class="tg-pill">0 rows</span>
          <span id="tgSelectedCount" class="tg-pill">0 selected</span>
          <span id="tgDirtyCount" class="tg-pill dirty">0 changed</span>
          <span id="tgErrorCount" class="tg-pill error">0 errors</span>
          <button id="tgSelectVisible" class="btn secondary" type="button">Select All Filtered</button>
          <button id="tgClearSelection" class="btn secondary" type="button">Clear Selection</button>
        </div>
        <div class="tg-bulk">
          <label>Bulk field<select id="tgBulkField"><option value="current_due_date">Current Due Date</option><option value="planned_start_date">Planned Start</option><option value="milestone_name">Milestone</option><option value="responsible_organization_code">Responsible Organization</option><option value="notes">Notes</option></select></label>
          <div class="tg-bulk-value" id="tgBulkValue"></div>
          <button id="tgBulkApply" class="btn secondary" type="button">Set Selected</button>
        </div>
        <div class="tg-table-wrap">
          <table class="tg-table">
            <thead><tr><th><input id="tgHeaderCheck" type="checkbox" title="Select filtered rows"></th><th>Document Number</th><th>Title</th><th>Baseline</th><th>Current Due</th><th>Planned Start</th><th>Milestone</th><th>Responsible Org</th><th>Notes</th><th>Reason</th><th>Actual</th><th>Revision</th><th>Tracking</th></tr></thead>
            <tbody id="tgBody"><tr><td colspan="13" class="muted">Select a TIDP.</td></tr></tbody>
          </table>
        </div>
        <div class="tg-review-actions">
          <button id="tgReviewBtn" class="btn secondary" type="button" disabled>Review Changes</button>
          <button id="tgDiscardBtn" class="btn secondary" type="button" disabled>Discard Changes</button>
        </div>
        <div id="tgReview" class="panel tg-review hidden">
          <div class="panel-head"><div><h3>Review Changes</h3><p id="tgReviewSummary" class="muted"></p></div><button id="tgApplyBtn" class="btn primary" type="button" disabled>Apply Changes</button></div>
          <div id="tgReviewList" class="tg-review-list"></div>
        </div>
      </div>`;
    planningPage.appendChild(pane);

    tab.onclick = async () => {
      planningPage.querySelectorAll('.plan-pane').forEach(x => x.classList.add('hidden'));
      pane.classList.remove('hidden');
      planningPage.querySelectorAll('.plan-tab').forEach(x => x.classList.toggle('active', x === tab));
      if (!$('tgPlan').dataset.loaded) await loadLookupsAndPlans();
    };

    $('tgRefresh').onclick = () => loadRows(true);
    $('tgPlan').onchange = () => loadRows(true);
    $('tgSearch').oninput = renderGrid;
    $('tgStatus').onchange = renderGrid;
    $('tgDefaultReason').oninput = () => { updateSummary(); if (!$('tgReview').classList.contains('hidden')) renderReview(); };
    $('tgBulkField').onchange = renderBulkEditor;
    $('tgBulkApply').onclick = bulkSet;
    $('tgSelectVisible').onclick = selectAllVisible;
    $('tgClearSelection').onclick = () => { selected.clear(); renderGrid(); };
    $('tgHeaderCheck').onchange = e => { e.target.checked ? selectAllVisible() : (selected.clear(), renderGrid()); };
    $('tgReviewBtn').onclick = renderReview;
    $('tgDiscardBtn').onclick = discardChanges;
    $('tgApplyBtn').onclick = applyChanges;
    renderBulkEditor();
    return true;
  }

  function current(row) {
    return edits.get(row.id) || {
      current_due_date: row.current_due_date || '',
      planned_start_date: row.planned_start_date || '',
      milestone_name: row.milestone_name || '',
      responsible_organization_code: row.responsible_organization_code || '',
      notes: row.notes || '',
      reschedule_reason: ''
    };
  }

  function visibleRows() {
    const q = String($('tgSearch')?.value || '').trim().toLowerCase();
    const status = $('tgStatus')?.value || '';
    return rows.filter(r => {
      if (q && !`${r.document_number || ''} ${r.deliverable_title || ''}`.toLowerCase().includes(q)) return false;
      if (status === 'open' && r.actual_delivery_date) return false;
      if (status === 'delivered' && !r.actual_delivery_date) return false;
      if (status === 'overdue' && r.tracking_status !== 'Overdue') return false;
      return true;
    });
  }

  function rowIssues(row, state) {
    const issues = [];
    if (!state.current_due_date) issues.push('Current Due is required');
    if (state.planned_start_date && state.current_due_date && state.planned_start_date > state.current_due_date) issues.push('Planned Start is after Current Due');
    const dueChanged = !same(state.current_due_date, row.current_due_date);
    const reason = String(state.reschedule_reason || $('tgDefaultReason')?.value || '').trim();
    if (dueChanged && row.actual_delivery_date) issues.push('Delivered item cannot be rescheduled');
    if (dueChanged && !reason) issues.push('Reschedule reason is required');
    return issues;
  }

  function isDirty(row, state) {
    return EDITABLE.some(k => !same(state[k], row[k])) || Boolean(String(state.reschedule_reason || '').trim() && !same(state.current_due_date,row.current_due_date));
  }

  function normalizeEdit(row, next) {
    if (isDirty(row,next)) edits.set(row.id,next); else edits.delete(row.id);
    updateSummary();
  }

  function renderGrid() {
    const body = $('tgBody');
    if (!body) return;
    const list = visibleRows();
    $('tgRowCount').textContent = `${list.length} row${list.length===1?'':'s'}`;
    $('tgHeaderCheck').checked = Boolean(list.length) && list.every(r => selected.has(r.id));
    body.innerHTML = list.length ? list.map(r => {
      const s = current(r);
      const issues = rowIssues(r,s);
      const dirty = edits.has(r.id);
      const orgOpts = `<option value="">—</option>` + organizations.map(o => `<option value="${esc(o.code)}" ${o.code===s.responsible_organization_code?'selected':''}>${esc(o.code)} — ${esc(o.name || '')}</option>`).join('');
      const readonlyDue = r.actual_delivery_date ? 'disabled title="Delivered items cannot be rescheduled"' : '';
      return `<tr data-id="${r.id}" class="${dirty?'tg-dirty ':''}${issues.length?'tg-error':''}">
        <td><input class="tg-select" type="checkbox" ${selected.has(r.id)?'checked':''}></td>
        <td class="tg-doc"><strong>${esc(r.document_number || 'Planned item')}</strong><div class="tiny muted">${esc(r.plan_code || '')}</div></td>
        <td class="tg-title">${esc(r.deliverable_title || '')}</td>
        <td class="tg-readonly">${esc(r.baseline_due_date || '—')}</td>
        <td><input class="tg-edit" data-field="current_due_date" type="date" value="${esc(s.current_due_date)}" ${readonlyDue}></td>
        <td><input class="tg-edit" data-field="planned_start_date" type="date" value="${esc(s.planned_start_date)}"></td>
        <td><input class="tg-edit tg-milestone" data-field="milestone_name" value="${esc(s.milestone_name)}"></td>
        <td><select class="tg-edit" data-field="responsible_organization_code">${orgOpts}</select></td>
        <td><input class="tg-edit tg-notes" data-field="notes" value="${esc(s.notes)}"></td>
        <td><input class="tg-edit tg-reason" data-field="reschedule_reason" value="${esc(s.reschedule_reason)}" placeholder="Uses default if blank">${issues.length?`<div class="tg-error-text">${esc(issues.join(' · '))}</div>`:''}</td>
        <td class="tg-readonly">${esc(r.actual_delivery_date || '—')}</td>
        <td class="tg-readonly">${esc(r.delivered_revision || '—')}</td>
        <td class="tg-readonly">${esc(r.tracking_status || '—')}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="13" class="muted">No rows match the current filter.</td></tr>';

    body.querySelectorAll('.tg-select').forEach(cb => cb.onchange = e => {
      const id = e.target.closest('tr').dataset.id;
      e.target.checked ? selected.add(id) : selected.delete(id);
      updateSummary();
      $('tgHeaderCheck').checked = visibleRows().length > 0 && visibleRows().every(r => selected.has(r.id));
    });
    body.querySelectorAll('.tg-edit').forEach(input => input.onchange = e => {
      const tr = e.target.closest('tr');
      const row = rows.find(x => x.id === tr.dataset.id);
      if (!row) return;
      const next = {...current(row), [e.target.dataset.field]: e.target.value};
      normalizeEdit(row,next);
      renderGrid();
    });
    updateSummary();
  }

  function updateSummary() {
    const dirtyRows = rows.filter(r => edits.has(r.id));
    const errors = dirtyRows.reduce((n,r) => n + (rowIssues(r,current(r)).length ? 1 : 0),0);
    if ($('tgSelectedCount')) $('tgSelectedCount').textContent = `${selected.size} selected`;
    if ($('tgDirtyCount')) $('tgDirtyCount').textContent = `${dirtyRows.length} changed`;
    if ($('tgErrorCount')) $('tgErrorCount').textContent = `${errors} error${errors===1?'':'s'}`;
    if ($('tgReviewBtn')) $('tgReviewBtn').disabled = !dirtyRows.length;
    if ($('tgDiscardBtn')) $('tgDiscardBtn').disabled = !dirtyRows.length;
  }

  function renderBulkEditor() {
    const host = $('tgBulkValue');
    if (!host) return;
    const field = $('tgBulkField').value;
    if (field === 'responsible_organization_code') {
      host.innerHTML = `<label>Value<select id="tgBulkInput"><option value="">Clear value</option>${organizations.map(o=>`<option value="${esc(o.code)}">${esc(o.code)} — ${esc(o.name||'')}</option>`).join('')}</select></label>`;
    } else if (field === 'current_due_date' || field === 'planned_start_date') {
      host.innerHTML = `<label>Value<input id="tgBulkInput" type="date"></label>`;
    } else {
      host.innerHTML = `<label>Value<input id="tgBulkInput" placeholder="Blank clears optional value"></label>`;
    }
  }

  function bulkSet() {
    if (!canEdit()) return toast('Document Controller or Admin role required',true);
    const ids = [...selected];
    if (!ids.length) return toast('Select rows first',true);
    const field = $('tgBulkField').value;
    const value = $('tgBulkInput')?.value ?? '';
    if (field === 'current_due_date' && !value) return toast('Current Due Date cannot be blank',true);
    for (const id of ids) {
      const row = rows.find(r => r.id === id);
      if (!row) continue;
      if (field === 'current_due_date' && row.actual_delivery_date) continue;
      normalizeEdit(row,{...current(row),[field]:value});
    }
    renderGrid();
    toast(`Bulk value staged for ${ids.length} selected row${ids.length===1?'':'s'}.`);
  }

  function selectAllVisible() {
    visibleRows().forEach(r => selected.add(r.id));
    renderGrid();
  }

  function changeList(row,state) {
    const labels = {current_due_date:'Current Due',planned_start_date:'Planned Start',milestone_name:'Milestone',responsible_organization_code:'Responsible Org',notes:'Notes'};
    const out = [];
    for (const key of EDITABLE) if (!same(state[key],row[key])) out.push(`${labels[key]}: ${row[key] || '—'} → ${state[key] || '—'}`);
    return out;
  }

  function renderReview() {
    const changed = rows.filter(r => edits.has(r.id));
    const bad = changed.filter(r => rowIssues(r,current(r)).length);
    $('tgReview').classList.remove('hidden');
    $('tgReviewSummary').textContent = `${changed.length} deliverable${changed.length===1?'':'s'} changed · ${bad.length} with validation errors`;
    $('tgReviewList').innerHTML = changed.map(r => {
      const s = current(r), issues = rowIssues(r,s), changes = changeList(r,s);
      return `<div class="tg-review-item"><strong>${esc(r.document_number || r.deliverable_title || r.id)}</strong>${changes.map(c=>`<div class="tg-review-change">${esc(c)}</div>`).join('')}${issues.length?`<div class="tg-error-text">${esc(issues.join(' · '))}</div>`:''}</div>`;
    }).join('') || '<div class="muted">No changes staged.</div>';
    $('tgApplyBtn').disabled = !changed.length || bad.length > 0 || !canEdit();
    $('tgApplyBtn').textContent = changed.length ? `Apply ${changed.length} Rows` : 'Apply Changes';
  }

  function discardChanges() {
    edits.clear();
    $('tgReview').classList.add('hidden');
    renderGrid();
    toast('Staged changes discarded.');
  }

  async function applyChanges() {
    if (!canEdit()) return toast('Document Controller or Admin role required',true);
    const changed = rows.filter(r => edits.has(r.id));
    const bad = changed.filter(r => rowIssues(r,current(r)).length);
    if (!changed.length) return;
    if (bad.length) return toast('Fix validation errors before applying',true);
    const defaultReason = String($('tgDefaultReason').value || '').trim();
    const payload = changed.map(r => {
      const s = current(r);
      return {
        deliverable_id: r.id,
        current_due_date: s.current_due_date,
        planned_start_date: s.planned_start_date || null,
        milestone: s.milestone_name || null,
        responsible_organization: s.responsible_organization_code || null,
        notes: s.notes || null,
        reschedule_reason: String(s.reschedule_reason || defaultReason || '').trim() || null
      };
    });
    const btn = $('tgApplyBtn');
    btn.disabled = true; btn.textContent = 'Applying…';
    try {
      const {data,error} = await supabase.rpc('bulk_update_tidp_grid',{p_changes:payload});
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      toast(`${result?.updated ?? changed.length} updated · ${result?.due_date_changes ?? 0} delivery-date changes recorded.`);
      edits.clear(); selected.clear(); $('tgReview').classList.add('hidden');
      await loadRows(false);
      document.getElementById('pRefresh')?.click();
    } catch (e) {
      toast(e.message || 'Could not apply grid changes',true);
      renderReview();
    }
  }

  async function loadLookupsAndPlans() {
    try {
      const [{data:p,error:pe},{data:o,error:oe}] = await Promise.all([
        supabase.from('information_delivery_plans').select('id,plan_code,plan_name,status').eq('plan_type','TIDP').order('plan_code'),
        supabase.from('organizations').select('code,name').eq('is_active',true).order('code')
      ]);
      if (pe || oe) throw (pe || oe);
      plans = p || []; organizations = o || [];
      $('tgPlan').innerHTML = '<option value="">Select TIDP…</option>' + plans.map(x=>`<option value="${esc(x.id)}">${esc(x.plan_code)} — ${esc(x.plan_name)}${x.status?` (${esc(x.status)})`:''}</option>`).join('');
      $('tgPlan').dataset.loaded = '1';
      renderBulkEditor();
      if (plans.length === 1) { $('tgPlan').value = plans[0].id; await loadRows(true); }
    } catch (e) { toast(e.message || 'Could not load Grid Editor lookups',true); }
  }

  async function loadRows(clearDrafts=false) {
    const planId = $('tgPlan')?.value || '';
    if (!planId) {
      rows = []; if (clearDrafts) { edits.clear(); selected.clear(); }
      renderGrid(); return;
    }
    try {
      const {data,error} = await supabase.from('information_delivery_register_v')
        .select('id,plan_id,plan_code,document_number,deliverable_title,baseline_due_date,current_due_date,planned_start_date,milestone_name,responsible_organization_code,notes,actual_delivery_date,delivered_revision,tracking_status')
        .eq('plan_id',planId)
        .order('document_number',{ascending:true,nullsFirst:false});
      if (error) throw error;
      rows = data || [];
      if (clearDrafts) { edits.clear(); selected.clear(); $('tgReview')?.classList.add('hidden'); }
      renderGrid();
    } catch (e) { toast(e.message || 'Could not load TIDP grid',true); }
  }

  async function init() {
    const {data:{session}} = await supabase.auth.getSession();
    if (!session) return;
    const {data,error} = await supabase.rpc('current_user_role');
    if (error) throw error;
    role = data || 'viewer';
    if (!canEdit()) return;
    if (injectPage()) return;
    const obs = new MutationObserver(() => { if (injectPage()) obs.disconnect(); });
    obs.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>obs.disconnect(),12000);
  }

  setTimeout(() => init().catch(e => toast(e.message || 'Could not initialize TIDP Grid Editor',true)),450);
}
