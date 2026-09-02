import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.DLM_CONFIG;
if (cfg) {
  const supabase = createClient(cfg.url, cfg.key);
  const $ = id => document.getElementById(id);
  let applied = false;
  let historyLoaded = false;
  let historyPlan = '';
  let historyItems = [];
  let uiObserver = null;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function addStyles(){
    if ($('informationDeliveryUxV4Styles')) return;
    const s = document.createElement('style');
    s.id = 'informationDeliveryUxV4Styles';
    s.textContent = `
      #planningPage{--ux-border:#e3e8ef;--ux-muted:#6e7a8c}
      #planningPage>.plan-tabs{position:sticky;top:0;z-index:20;display:flex;gap:2px;padding:5px;background:rgba(255,255,255,.96);backdrop-filter:blur(8px);border:1px solid var(--ux-border);border-radius:12px;margin-bottom:14px;box-shadow:0 4px 16px rgba(25,39,60,.04)}
      #planningPage>.plan-tabs .plan-tab{border:0!important;background:transparent!important;color:#5c6879!important;border-radius:8px;padding:8px 14px;font-weight:700;box-shadow:none!important}
      #planningPage>.plan-tabs .plan-tab:hover{background:#f2f5f9!important;color:#243750!important}
      #planningPage>.plan-tabs .plan-tab.active{background:#172b46!important;color:#fff!important}
      #planGridEditorV2>.panel{padding:0;border:0;background:transparent;box-shadow:none}
      #planGridEditorV2>.panel>.panel-head{padding:2px 2px 10px;margin:0}
      #planGridEditorV2>.panel>.panel-head h3{font-size:20px;margin-bottom:2px}
      .ux-context{position:sticky;top:53px;z-index:15;padding:10px 12px!important;margin:0 0 8px!important;background:rgba(255,255,255,.97)!important;border:1px solid var(--ux-border);border-radius:11px;box-shadow:0 4px 14px rgba(25,39,60,.04)}
      .ux-context label{font-size:11px;color:#697689;font-weight:700}.ux-context input,.ux-context select{margin-top:4px}
      .ux-commandbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:7px 9px;border:1px solid var(--ux-border);border-radius:10px;background:#fff;margin:0 0 8px}.ux-commandbar .btn{padding:6px 9px;font-size:11px}.ux-commandbar .ux-spacer{flex:1}.ux-commandbar .ux-label{font-size:11px;color:var(--ux-muted);font-weight:700;margin-right:2px}
      .tg2-summary.ux-summary{margin:0 0 8px;padding:0 2px}.tg2-summary.ux-summary .btn,.tg2-summary.ux-summary .tg2-divider{display:none!important}
      .ux-selectionbar{position:sticky;top:126px;z-index:14;display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:8px 10px;margin:0 0 8px;border:1px solid #c8d8ef;border-radius:10px;background:#eef5ff;box-shadow:0 4px 14px rgba(25,63,115,.08)}.ux-selectionbar.hidden{display:none!important}.ux-selectionbar strong{color:#214c83}.ux-selectionbar .ux-spacer{flex:1}.ux-selectionbar .btn{padding:6px 9px;font-size:11px}
      .tg2-tools{display:none!important}.tg2-shortcuts{margin:4px 3px 8px!important;padding:6px 8px;border-radius:8px;background:#fafbfc}.tg2-shortcuts strong{color:#47556a}
      .tg2-table-wrap{max-height:calc(100vh - 310px)!important;min-height:380px;background:#fff;box-shadow:0 5px 18px rgba(25,39,60,.04)}.tg2-table{min-width:1640px!important}.tg2-table th{height:38px;border-bottom:1px solid #dce3ec!important}.tg2-table td{border-bottom:1px solid #edf1f5!important}.tg2-table tr:hover td{background:#f8fbff!important}.tg2-table tr.dirty td{background:#fffdf2!important}.tg2-table tr.ux-delivered-row td{background:#fbfdfb}.tg2-table tr.ux-delivered-row:hover td{background:#f4faf6!important}
      .tg2-table th:nth-child(1),.tg2-table td:nth-child(1){position:sticky;left:0;z-index:7;width:42px;min-width:42px;max-width:42px;background:#fff}.tg2-table th:nth-child(2),.tg2-table td:nth-child(2){position:sticky;left:42px;z-index:6;background:#fff;box-shadow:4px 0 7px rgba(20,37,60,.035)}.tg2-table th:nth-child(3),.tg2-table td:nth-child(3){position:sticky;left:332px;z-index:5;background:#fff;box-shadow:4px 0 7px rgba(20,37,60,.025)}.tg2-table th:nth-child(-n+3){z-index:12;background:#f8fafc}.tg2-table tr.dirty td:nth-child(-n+3){background:#fffdf2!important}.tg2-table tr.ux-delivered-row td:nth-child(-n+3){background:#fbfdfb}.tg2-doc{min-width:290px!important;width:290px!important}.tg2-title{min-width:250px!important;width:250px!important}
      .tg2-cell.cell-active{box-shadow:inset 0 0 0 2px #3568b8;outline:0!important}.tg2-cell.cell-selected{box-shadow:inset 0 0 0 1px #8a73cf;outline:0!important}.tg2-table input,.tg2-table select{border-color:transparent;background:transparent;border-radius:6px}.tg2-table input:hover,.tg2-table select:hover,.tg2-table input:focus,.tg2-table select:focus{background:#fff;border-color:#b7c7dc}
      .ux-track{display:inline-flex;padding:4px 7px;border-radius:999px;font-size:10px;font-weight:800;white-space:nowrap;background:#edf1f6;color:#526071}.ux-track.overdue,.ux-track.delivered-late{background:#fdecec;color:#962f2f}.ux-track.due-soon{background:#fff2cf;color:#806000}.ux-track.on-track,.ux-track.delivered-on-time,.ux-track.delivered-early{background:#e7f5ec;color:#24613b}.tg2-error-text{display:inline-flex;max-width:190px;padding:2px 5px;border-radius:5px;background:#fdeaea;color:#9b2f2f;font-size:9px;line-height:1.25}
      .tg2-review-actions{position:sticky;bottom:8px;z-index:13;display:flex!important;justify-content:flex-end;padding:8px 10px;border:1px solid var(--ux-border);border-radius:10px;background:rgba(255,255,255,.96);backdrop-filter:blur(8px);box-shadow:0 -4px 16px rgba(20,36,58,.05)}.tg2-review{border:1px solid var(--ux-border)!important;box-shadow:0 10px 28px rgba(25,39,60,.08)}
      .ux-drawer-overlay{position:fixed;inset:0;background:rgba(15,27,43,.26);z-index:1000}.ux-drawer-overlay.hidden{display:none}.ux-drawer{position:fixed;top:0;right:0;bottom:0;width:min(640px,94vw);z-index:1001;background:#fff;box-shadow:-12px 0 40px rgba(18,32,52,.18);display:flex;flex-direction:column}.ux-drawer.hidden{display:none}.ux-drawer-head{display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid var(--ux-border)}.ux-drawer-head div{flex:1}.ux-drawer-head h3{margin:0;font-size:18px}.ux-drawer-head p{margin:2px 0 0;color:var(--ux-muted);font-size:11px}.ux-drawer-close{border:0;background:#f1f4f8;width:34px;height:34px;border-radius:9px;font-size:18px;cursor:pointer}.ux-drawer-body{padding:14px 16px;overflow:auto;flex:1}.ux-drawer-section.hidden{display:none}.ux-drawer .tg2-tool{border:0!important;background:transparent!important;padding:0!important;margin:0!important}.ux-drawer .tg2-tool h4{font-size:15px;margin-bottom:12px}.ux-drawer .tg2-tool-row{display:grid!important;grid-template-columns:1fr!important}.ux-drawer .td3-panel{border:0!important;padding:0!important;margin:0!important;background:transparent!important}.ux-drawer .td3-grid{grid-template-columns:1fr!important}.ux-drawer .td3-grid label{grid-column:auto!important}.ux-drawer .td3-queue{max-height:none!important}.ux-drawer .td3-head h4{font-size:16px}
      .ux-calendar-wrap{margin-top:14px}.ux-calendar-wrap>summary{cursor:pointer;padding:10px 12px;border:1px solid var(--ux-border);border-radius:10px;background:#fafbfd;font-weight:800;color:#41526a}.ux-calendar-wrap[open]>summary{border-radius:10px 10px 0 0}.ux-calendar-wrap>.panel{margin:0;border-radius:0 0 10px 10px;border-top:0}
      .ux-history-toolbar{display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-bottom:12px}.ux-history-toolbar label{min-width:190px}.ux-history-toolbar .grow{flex:1;min-width:220px}.ux-history-list{display:flex;flex-direction:column;gap:8px}.ux-history-item{display:grid;grid-template-columns:125px 16px 1fr;gap:10px;align-items:start}.ux-history-time{font-size:10px;color:#738095;padding-top:4px;text-align:right}.ux-history-dot{width:10px;height:10px;border-radius:50%;background:#5679a8;margin-top:4px;box-shadow:0 0 0 4px #edf3fb}.ux-history-dot.delivery{background:#3f8258;box-shadow:0 0 0 4px #e9f5ed}.ux-history-dot.reschedule{background:#9b7426;box-shadow:0 0 0 4px #fbf3df}.ux-history-card{border:1px solid var(--ux-border);border-radius:9px;background:#fff;padding:9px 11px}.ux-history-card strong{display:block;font-size:12px}.ux-history-card .meta{font-size:10px;color:#6f7b8d;margin-top:2px}.ux-history-card .detail{font-size:11px;margin-top:5px;color:#35455a}.ux-history-empty{padding:28px;text-align:center;color:#788496;border:1px dashed #d7dee8;border-radius:10px}
      @media(max-width:900px){.tg2-table-wrap{max-height:620px!important}.ux-context,.ux-selectionbar{position:static}.tg2-table th:nth-child(3),.tg2-table td:nth-child(3){position:static;box-shadow:none}.ux-history-item{grid-template-columns:1fr}.ux-history-time{text-align:left}.ux-history-dot{display:none}}
    `;
    document.head.appendChild(s);
  }

  function createDrawer(){
    if ($('uxDeliveryDrawer')) return;
    const overlay = document.createElement('div');
    overlay.id = 'uxDrawerOverlay';
    overlay.className = 'ux-drawer-overlay hidden';
    const drawer = document.createElement('aside');
    drawer.id = 'uxDeliveryDrawer';
    drawer.className = 'ux-drawer hidden';
    drawer.innerHTML = `<div class="ux-drawer-head"><div><h3 id="uxDrawerTitle">Edit</h3><p id="uxDrawerSub">Changes remain staged until you apply them.</p></div><button id="uxDrawerClose" class="ux-drawer-close" type="button" aria-label="Close">×</button></div><div class="ux-drawer-body"><div id="uxBulkHost" class="ux-drawer-section hidden"></div><div id="uxFindHost" class="ux-drawer-section hidden"></div><div id="uxDeliveryHost" class="ux-drawer-section hidden"></div></div>`;
    document.body.append(overlay, drawer);
    const close = () => { overlay.classList.add('hidden'); drawer.classList.add('hidden'); };
    overlay.onclick = close;
    $('uxDrawerClose').onclick = close;
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !drawer.classList.contains('hidden')) close(); });
  }

  function openDrawer(mode, deliveryAction='deliver'){
    const drawer = $('uxDeliveryDrawer'), overlay = $('uxDrawerOverlay');
    if (!drawer || !overlay) return;
    ['uxBulkHost','uxFindHost','uxDeliveryHost'].forEach(id => $(id)?.classList.add('hidden'));
    if (mode === 'bulk') {
      $('uxBulkHost')?.classList.remove('hidden');
      $('uxDrawerTitle').textContent = 'Edit selected deliverables';
      $('uxDrawerSub').textContent = 'Set one planning field across the selected rows. Review before applying.';
    } else if (mode === 'find') {
      $('uxFindHost')?.classList.remove('hidden');
      $('uxDrawerTitle').textContent = 'Find & Replace';
      $('uxDrawerSub').textContent = 'Apply controlled replacements to selected, filtered, or all TIDP rows.';
    } else {
      $('uxDeliveryHost')?.classList.remove('hidden');
      $('uxDrawerTitle').textContent = deliveryAction === 'reopen' ? 'Reopen deliveries' : 'Record delivery';
      $('uxDrawerSub').textContent = 'Stage actual delivery dates, revisions and notes before committing.';
      const scope = $('td3Scope'); if (scope) scope.value = 'selected';
      const action = $('td3Action');
      if (action && [...action.options].some(o => o.value === deliveryAction)) {
        action.value = deliveryAction;
        action.dispatchEvent(new Event('change', {bubbles:true}));
      }
    }
    overlay.classList.remove('hidden');
    drawer.classList.remove('hidden');
  }

  function reorganizeSchedule(){
    const pane = $('planGridEditorV2'); if (!pane) return;
    const heading = pane.querySelector(':scope>.panel>.panel-head h3'); if (heading) heading.textContent = 'TIDP Schedule';
    const sub = pane.querySelector(':scope>.panel>.panel-head .muted'); if (sub) sub.textContent = 'Plan, edit and control delivery information in one spreadsheet-style workspace.';
    const toolbar = $('tg2Plan')?.closest('.tg2-toolbar'); if (toolbar) toolbar.classList.add('ux-context');
    const summary = $('tg2RowCount')?.closest('.tg2-summary'); if (summary) summary.classList.add('ux-summary');

    createDrawer();
    const tools = pane.querySelector('.tg2-tools');
    const toolItems = tools ? [...tools.querySelectorAll(':scope>.tg2-tool')] : [];
    if (toolItems[0]) $('uxBulkHost')?.appendChild(toolItems[0]);
    if (toolItems[1]) $('uxFindHost')?.appendChild(toolItems[1]);
    const delivery = $('tidpDeliveryControlV3');
    if (delivery) {
      const h = delivery.querySelector('.td3-head h4'); if (h) h.textContent = 'Delivery Actions';
      const m = delivery.querySelector('.td3-muted'); if (m) m.textContent = 'Selected or filtered rows can be marked delivered. Admins can also reopen delivery records.';
      $('uxDeliveryHost')?.appendChild(delivery);
    }

    const command = document.createElement('div');
    command.className = 'ux-commandbar';
    command.id = 'uxScheduleCommandbar';
    command.innerHTML = '<span class="ux-label">Spreadsheet tools</span><button id="uxBulkBtn" class="btn secondary" type="button">Bulk Edit</button><button id="uxFindBtn" class="btn secondary" type="button">Find & Replace</button><button id="uxDeliveryBtn" class="btn secondary" type="button">Delivery Actions</button><span class="ux-spacer"></span>';
    const tableWrap = $('tg2GridWrap');
    tableWrap?.parentNode.insertBefore(command, tableWrap);
    ['tg2SelectVisible','tg2Undo','tg2Redo','tg2Copy','tg2Paste','tg2FillDown'].forEach(id => { const el = $(id); if (el) command.appendChild(el); });
    $('uxBulkBtn').onclick = () => openDrawer('bulk');
    $('uxFindBtn').onclick = () => openDrawer('find');
    $('uxDeliveryBtn').onclick = () => openDrawer('delivery','deliver');

    const selection = document.createElement('div');
    selection.id = 'uxSelectionBar';
    selection.className = 'ux-selectionbar hidden';
    selection.innerHTML = '<strong id="uxSelectionText">0 selected</strong><span>Bulk actions apply only to the selected rows.</span><span class="ux-spacer"></span><button id="uxSelEdit" class="btn secondary" type="button">Edit Selected</button><button id="uxSelDeliver" class="btn primary" type="button">Mark Delivered</button><button id="uxSelReopen" class="btn secondary hidden" type="button">Reopen</button>';
    if (summary) summary.insertAdjacentElement('afterend', selection); else tableWrap?.parentNode.insertBefore(selection, tableWrap);
    const clear = $('tg2ClearSelection'); if (clear) selection.appendChild(clear);
    $('uxSelEdit').onclick = () => openDrawer('bulk');
    $('uxSelDeliver').onclick = () => openDrawer('delivery','deliver');
    const reopenOption = $('td3Action')?.querySelector('option[value="reopen"]');
    if (reopenOption) {
      $('uxSelReopen').classList.remove('hidden');
      $('uxSelReopen').onclick = () => openDrawer('delivery','reopen');
    }

    const oldRefresh = $('tg2Refresh');
    if (oldRefresh) { oldRefresh.textContent = 'Refresh data'; oldRefresh.title = 'Reload the latest TIDP schedule'; }
    const reviewActions = pane.querySelector('.tg2-review-actions');
    if (reviewActions) {
      const r = $('tg2ReviewBtn'), d = $('tg2DiscardBtn');
      if (r) r.textContent = 'Review staged changes';
      if (d) d.textContent = 'Discard staged changes';
    }
    syncSelectionBar();
    polishGridRows();
  }

  function syncSelectionBar(){
    const source = $('tg2SelectedCount'), bar = $('uxSelectionBar'), text = $('uxSelectionText');
    if (!source || !bar) return;
    const count = parseInt(source.textContent, 10) || 0;
    if (text) text.textContent = `${count} selected`;
    bar.classList.toggle('hidden', count === 0);
  }

  function polishGridRows(){
    const body = $('tg2Body'); if (!body) return;
    body.querySelectorAll('tr[data-id]').forEach(tr => {
      const tracking = tr.children[12];
      if (tracking && !tracking.querySelector('.ux-track')) {
        const raw = tracking.textContent.trim();
        const slug = raw.toLowerCase().replaceAll(' ','-');
        tracking.innerHTML = `<span class="ux-track ${esc(slug)}">${esc(raw || '—')}</span>`;
      }
      const actual = (tr.children[10]?.textContent || '').trim();
      tr.classList.toggle('ux-delivered-row', Boolean(actual && actual !== '—'));
    });
  }

  function reorganizeTabs(){
    const page = $('planningPage'), tabs = page?.querySelector(':scope>.plan-tabs'); if (!page || !tabs) return;
    const overview = tabs.querySelector('[data-tab="overview"]');
    const plans = tabs.querySelector('[data-tab="plans"]');
    const delivery = tabs.querySelector('[data-tab="deliverables"]');
    const calendar = tabs.querySelector('[data-tab="calendar"]');
    const schedule = tabs.querySelector('[data-tab="gridEditorV2"]');
    if (plans) plans.textContent = 'Plans';
    if (delivery) delivery.textContent = 'Delivery';
    if (schedule) schedule.textContent = 'Schedule';
    calendar?.remove();
    const plansH = $('planPlans')?.querySelector('h3'); if (plansH) plansH.textContent = 'Delivery Plans';
    const deliveryH = $('planDeliverables')?.querySelector('.panel-head h3'); if (deliveryH) deliveryH.textContent = 'Delivery Register';

    const calPane = $('planCalendar'), delPane = $('planDeliverables');
    if (calPane && delPane && !$('uxCalendarWrap')) {
      const panel = calPane.querySelector('.panel');
      if (panel) {
        const details = document.createElement('details');
        details.id = 'uxCalendarWrap';
        details.className = 'ux-calendar-wrap';
        details.innerHTML = '<summary>Delivery Calendar</summary>';
        details.appendChild(panel);
        delPane.appendChild(details);
      }
      calPane.remove();
    }

    createHistoryTab(tabs, page);
    [overview, plans, schedule, delivery, $('uxHistoryTab')].forEach(x => { if (x) tabs.appendChild(x); });
  }

  function createHistoryTab(tabs, page){
    if ($('uxHistoryTab')) return;
    const tab = document.createElement('button');
    tab.id = 'uxHistoryTab';
    tab.className = 'btn secondary plan-tab';
    tab.dataset.tab = 'historyV4';
    tab.textContent = 'History';
    tabs.appendChild(tab);
    const pane = document.createElement('div');
    pane.id = 'planHistoryV4';
    pane.className = 'plan-pane hidden';
    pane.innerHTML = `<div class="panel"><div class="panel-head"><div><h3>Delivery History</h3><p class="muted">A read-only timeline of delivery events and planned-date changes.</p></div><button id="uxHistoryRefresh" class="btn secondary" type="button">Refresh</button></div><div class="ux-history-toolbar"><label>TIDP<select id="uxHistoryPlan"><option value="">All TIDPs</option></select></label><label>Type<select id="uxHistoryType"><option value="">All activity</option><option value="delivery">Delivery events</option><option value="reschedule">Date changes</option></select></label><label class="grow">Search<input id="uxHistorySearch" placeholder="Document number, title, note or reason"></label></div><div id="uxHistoryList" class="ux-history-list"><div class="ux-history-empty">Open History to load recent activity.</div></div></div>`;
    page.appendChild(pane);
    tab.onclick = async () => {
      page.querySelectorAll('.plan-pane').forEach(x => x.classList.add('hidden'));
      pane.classList.remove('hidden');
      tabs.querySelectorAll('.plan-tab').forEach(x => x.classList.toggle('active', x === tab));
      const currentPlan = $('tg2Plan')?.value || '';
      if ($('uxHistoryPlan')?.options.length > 1 && currentPlan && [...$('uxHistoryPlan').options].some(o => o.value === currentPlan)) $('uxHistoryPlan').value = currentPlan;
      await loadHistory(false);
    };
    $('uxHistoryRefresh').onclick = () => loadHistory(true);
    $('uxHistoryPlan').onchange = () => { historyPlan = $('uxHistoryPlan').value; loadHistory(true); };
    $('uxHistoryType').onchange = renderHistory;
    $('uxHistorySearch').oninput = renderHistory;
  }

  async function loadHistory(force=false){
    if (historyLoaded && !force && historyPlan === ($('uxHistoryPlan')?.value || '')) { renderHistory(); return; }
    const host = $('uxHistoryList'); if (!host) return;
    host.innerHTML = '<div class="ux-history-empty">Loading history…</div>';
    try {
      const {data:plans,error:pe} = await supabase.from('information_delivery_plans').select('id,plan_code,plan_name').eq('plan_type','TIDP').order('plan_code');
      if (pe) throw pe;
      const select = $('uxHistoryPlan');
      const current = select.value || $('tg2Plan')?.value || historyPlan || '';
      select.innerHTML = '<option value="">All TIDPs</option>' + (plans || []).map(p => `<option value="${esc(p.id)}">${esc(p.plan_code)} — ${esc(p.plan_name)}</option>`).join('');
      if (current && [...select.options].some(o => o.value === current)) select.value = current;
      historyPlan = select.value;

      let q = supabase.from('information_delivery_register_v').select('id,plan_id,plan_code,document_number,deliverable_title');
      if (historyPlan) q = q.eq('plan_id',historyPlan);
      const {data:del,error:de} = await q;
      if (de) throw de;
      const map = new Map((del || []).map(d => [d.id,d]));
      const ids = [...map.keys()];
      if (!ids.length) { historyItems = []; historyLoaded = true; renderHistory(); return; }

      const chunks = [];
      for (let i=0;i<ids.length;i+=100) chunks.push(ids.slice(i,i+100));
      let events = [], changes = [];
      for (const chunk of chunks) {
        const [{data:e,error:ee},{data:c,error:ce}] = await Promise.all([
          supabase.from('information_delivery_events').select('id,deliverable_id,revision_id,event_type,event_date,note,created_at').in('deliverable_id',chunk).order('event_date',{ascending:false}).limit(300),
          supabase.from('information_delivery_date_changes').select('id,deliverable_id,old_due_date,new_due_date,reason,changed_at').in('deliverable_id',chunk).order('changed_at',{ascending:false}).limit(300)
        ]);
        if (ee || ce) throw (ee || ce);
        events.push(...(e || []));
        changes.push(...(c || []));
      }

      const revIds = [...new Set(events.map(e => e.revision_id).filter(Boolean))];
      let revMap = new Map();
      if (revIds.length) {
        const {data:r,error:re} = await supabase.from('drawing_revisions').select('id,revision').in('id',revIds);
        if (!re) revMap = new Map((r || []).map(x => [x.id,x.revision]));
      }

      historyItems = [
        ...events.map(e => {
          const d = map.get(e.deliverable_id) || {};
          return {kind:'delivery',when:e.event_date || e.created_at,document:d.document_number || d.deliverable_title || e.deliverable_id,title:`${String(e.event_type || 'event').replace(/^./,x=>x.toUpperCase())} delivery event`,plan:d.plan_code || '',detail:[e.revision_id ? `Revision ${revMap.get(e.revision_id) || 'linked'}` : '',e.note || ''].filter(Boolean).join(' · ')};
        }),
        ...changes.map(c => {
          const d = map.get(c.deliverable_id) || {};
          return {kind:'reschedule',when:c.changed_at,document:d.document_number || d.deliverable_title || c.deliverable_id,title:'Planned delivery date changed',plan:d.plan_code || '',detail:`${c.old_due_date || '—'} → ${c.new_due_date || '—'}${c.reason ? ` · ${c.reason}` : ''}`};
        })
      ].sort((a,b) => String(b.when || '').localeCompare(String(a.when || ''))).slice(0,500);
      historyLoaded = true;
      renderHistory();
    } catch (e) {
      host.innerHTML = `<div class="ux-history-empty">${esc(e.message || 'Could not load delivery history')}</div>`;
    }
  }

  function renderHistory(){
    const host = $('uxHistoryList'); if (!host) return;
    const type = $('uxHistoryType')?.value || '';
    const q = String($('uxHistorySearch')?.value || '').trim().toLowerCase();
    const list = historyItems.filter(x => (!type || x.kind === type) && (!q || `${x.document} ${x.title} ${x.plan} ${x.detail}`.toLowerCase().includes(q)));
    host.innerHTML = list.length ? list.map(x => {
      const dt = x.when ? new Date(x.when) : null;
      const time = dt && !Number.isNaN(dt.valueOf()) ? dt.toLocaleString() : x.when || '—';
      return `<div class="ux-history-item"><div class="ux-history-time">${esc(time)}</div><div class="ux-history-dot ${esc(x.kind)}"></div><div class="ux-history-card"><strong>${esc(x.document)}</strong><div class="meta">${esc(x.plan)} · ${esc(x.title)}</div>${x.detail ? `<div class="detail">${esc(x.detail)}</div>` : ''}</div></div>`;
    }).join('') : '<div class="ux-history-empty">No activity matches the current filters.</div>';
  }

  function startUiObserver(){
    if (uiObserver) return;
    const target = $('planGridEditorV2'); if (!target) return;
    uiObserver = new MutationObserver(() => { syncSelectionBar(); polishGridRows(); });
    uiObserver.observe(target,{childList:true,subtree:true,characterData:true});
  }

  function apply(){
    if (applied) return true;
    if (!$('planningPage') || !$('planGridEditorV2') || !$('tidpDeliveryControlV3')) return false;
    addStyles();
    reorganizeSchedule();
    reorganizeTabs();
    startUiObserver();
    applied = true;
    return true;
  }

  setTimeout(() => {
    if (apply()) return;
    const obs = new MutationObserver(() => { if (apply()) obs.disconnect(); });
    obs.observe(document.body,{childList:true,subtree:true});
    setTimeout(() => obs.disconnect(),15000);
  },650);
}
