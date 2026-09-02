import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.DLM_CONFIG;
if (cfg) {
  const supabase = createClient(cfg.url, cfg.key);
  const $ = id => document.getElementById(id);
  let role = 'viewer';
  let staged = new Map();
  let revisionsByDrawing = new Map();

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const canControl = () => ['document_controller','admin'].includes(role);
  const canReopen = () => role === 'admin';
  const today = () => new Date().toISOString().slice(0,10);
  const toast = (message,error=false) => {
    const t = $('toast'); if (!t) return;
    t.textContent = message; t.className = `toast show ${error?'error':'success'}`;
    clearTimeout(toast.timer); toast.timer = setTimeout(()=>t.className='toast',4300);
  };

  function injectStyles(){
    if ($('tidpDeliveryV3Styles')) return;
    const s = document.createElement('style');
    s.id = 'tidpDeliveryV3Styles';
    s.textContent = `
      .td3-panel{margin:12px 0;border:1px solid #dfe6ef;border-radius:11px;background:#fbfcfe;padding:12px}.td3-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px}.td3-head h4{margin:0}.td3-grid{display:grid;grid-template-columns:170px 170px 190px minmax(220px,1fr) auto;gap:8px;align-items:end}.td3-grid label{margin:0}.td3-summary{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.td3-pill{display:inline-flex;padding:5px 9px;border-radius:999px;background:#edf2f7;font-size:11px;font-weight:700}.td3-pill.good{background:#e7f6ed;color:#21633a}.td3-pill.warn{background:#fff3cf;color:#8a6500}.td3-pill.bad{background:#fdecec;color:#982a2a}.td3-queue{max-height:360px;overflow:auto;border:1px solid #e5e9ef;border-radius:9px}.td3-queue table{min-width:1120px}.td3-queue th{position:sticky;top:0;background:#f8fafc;z-index:2}.td3-queue input,.td3-queue select{min-width:125px;padding:6px 7px;font-size:12px}.td3-note{min-width:230px!important}.td3-error{font-size:10px;color:#a42b2b;margin-top:3px}.td3-warn{font-size:10px;color:#8a6500;margin-top:3px}.td3-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.td3-muted{font-size:11px;color:#697586}.td3-deliver{color:#21633a;font-weight:700}.td3-reopen{color:#8a6500;font-weight:700}
      @media(max-width:1100px){.td3-grid{grid-template-columns:1fr 1fr}}@media(max-width:680px){.td3-grid{grid-template-columns:1fr}.td3-grid>*{width:100%}}
    `;
    document.head.appendChild(s);
  }

  function inject(){
    const pane = $('planGridEditorV2');
    if (!pane || $('tidpDeliveryControlV3')) return false;
    injectStyles();
    const panel = document.createElement('div');
    panel.id = 'tidpDeliveryControlV3';
    panel.className = 'td3-panel';
    panel.innerHTML = `
      <div class="td3-head"><div><h4>Phase 3 — Delivery Control</h4><div class="td3-muted">Use the same Grid selection to mark deliverables as delivered or, for Admins, reopen delivered records. Actions are staged and reviewed before database updates.</div></div></div>
      <div class="td3-grid">
        <label>Scope<select id="td3Scope"><option value="selected">Selected Rows</option><option value="filtered">All Filtered Rows</option></select></label>
        <label>Action<select id="td3Action"><option value="deliver">Mark Delivered</option>${canReopen()?'<option value="reopen">Reopen Delivery</option>':''}</select></label>
        <label id="td3DateLabel">Actual Delivery Date<input id="td3Date" type="date" value="${today()}"></label>
        <label id="td3RevisionLabel">Revision Strategy<select id="td3RevisionStrategy"><option value="latest">Latest available revision per drawing</option><option value="none">No revision</option></select></label>
        <button id="td3Stage" class="btn secondary" type="button">Stage Delivery Actions</button>
        <label id="td3NoteLabel" style="grid-column:1 / span 3">Default Delivery Note<input id="td3Note" placeholder="Optional — can be changed per row after staging"></label>
        <label id="td3ReasonLabel" class="hidden" style="grid-column:1 / span 3">Reopen Reason<input id="td3Reason" placeholder="Required for reopening"></label>
      </div>
      <div class="td3-summary"><span id="td3Staged" class="td3-pill">0 staged</span><span id="td3Errors" class="td3-pill bad">0 errors</span><span id="td3Warnings" class="td3-pill warn">0 warnings</span></div>
      <div id="td3Queue" class="td3-queue hidden"><table><thead><tr><th>Action</th><th>Document</th><th>Actual / Current</th><th>Revision</th><th>Note / Reason</th><th>Validation</th><th></th></tr></thead><tbody id="td3Body"></tbody></table></div>
      <div class="td3-actions"><button id="td3Apply" class="btn primary" type="button" disabled>Apply Delivery Actions</button><button id="td3Clear" class="btn secondary" type="button" disabled>Clear Queue</button></div>`;
    const tools = pane.querySelector('.tg2-tools');
    if (tools) tools.insertAdjacentElement('afterend',panel); else pane.querySelector('.panel')?.prepend(panel);

    $('td3Action').onchange = syncActionUi;
    $('td3Stage').onclick = stageFromGrid;
    $('td3Clear').onclick = clearQueue;
    $('td3Apply').onclick = applyActions;
    syncActionUi();
    return true;
  }

  function syncActionUi(){
    const action = $('td3Action')?.value || 'deliver';
    $('td3DateLabel')?.classList.toggle('hidden',action!=='deliver');
    $('td3RevisionLabel')?.classList.toggle('hidden',action!=='deliver');
    $('td3NoteLabel')?.classList.toggle('hidden',action!=='deliver');
    $('td3ReasonLabel')?.classList.toggle('hidden',action!=='reopen');
  }

  function gridIds(){
    const rows = [...document.querySelectorAll('#tg2Body tr[data-id]')];
    const scope = $('td3Scope')?.value || 'selected';
    if (scope === 'filtered') return rows.map(tr=>tr.dataset.id).filter(Boolean);
    return rows.filter(tr=>tr.querySelector('.tg2-select:checked')).map(tr=>tr.dataset.id).filter(Boolean);
  }

  async function fetchDeliverables(ids){
    const out=[];
    for(let i=0;i<ids.length;i+=100){
      const {data,error}=await supabase.from('information_delivery_register_v')
        .select('id,plan_id,plan_type,plan_code,drawing_id,document_number,deliverable_title,actual_delivery_date,delivered_revision_id,delivered_revision,tracking_status')
        .in('id',ids.slice(i,i+100));
      if(error) throw error; out.push(...(data||[]));
    }
    return out;
  }

  async function fetchRevisions(drawingIds){
    revisionsByDrawing = new Map();
    const ids=[...new Set(drawingIds.filter(Boolean))];
    for(let i=0;i<ids.length;i+=100){
      const {data,error}=await supabase.from('drawing_revisions')
        .select('id,drawing_id,revision,filename,sequence_no,created_at')
        .in('drawing_id',ids.slice(i,i+100))
        .order('sequence_no',{ascending:false});
      if(error) throw error;
      for(const r of data||[]){
        if(!revisionsByDrawing.has(r.drawing_id)) revisionsByDrawing.set(r.drawing_id,[]);
        revisionsByDrawing.get(r.drawing_id).push(r);
      }
    }
  }

  async function stageFromGrid(){
    if(!canControl()) return toast('Document Controller or Admin role required',true);
    const ids=gridIds();
    if(!ids.length) return toast('Select rows in the Grid, or use All Filtered Rows.',true);
    const action=$('td3Action').value;
    if(action==='reopen'&&!canReopen()) return toast('Admin role required to reopen deliveries',true);
    const btn=$('td3Stage'); btn.disabled=true; btn.textContent='Loading…';
    try{
      const dbRows=await fetchDeliverables(ids);
      await fetchRevisions(dbRows.map(r=>r.drawing_id));
      let added=0,skipped=0;
      const date=$('td3Date').value;
      const strategy=$('td3RevisionStrategy').value;
      const defaultNote=String($('td3Note').value||'').trim();
      const reopenReason=String($('td3Reason').value||'').trim();
      for(const r of dbRows){
        if(action==='deliver'){
          if(r.actual_delivery_date){ skipped++; continue; }
          const revs=revisionsByDrawing.get(r.drawing_id)||[];
          const revId=strategy==='latest'?(revs[0]?.id||''):'';
          staged.set(r.id,{id:r.id,action:'deliver',document_number:r.document_number||r.deliverable_title||r.id,drawing_id:r.drawing_id||null,actual_delivery_date:date,revision_id:revId,note:defaultNote,reason:'',current_actual:r.actual_delivery_date||'',current_revision:r.delivered_revision||'',tracking_status:r.tracking_status||''});
          added++;
        } else {
          if(!r.actual_delivery_date){ skipped++; continue; }
          staged.set(r.id,{id:r.id,action:'reopen',document_number:r.document_number||r.deliverable_title||r.id,drawing_id:r.drawing_id||null,actual_delivery_date:'',revision_id:'',note:'',reason:reopenReason,current_actual:r.actual_delivery_date||'',current_revision:r.delivered_revision||'',tracking_status:r.tracking_status||''});
          added++;
        }
      }
      renderQueue();
      toast(`${added} action${added===1?'':'s'} staged${skipped?` · ${skipped} incompatible row${skipped===1?'':'s'} skipped`:''}.`);
    }catch(e){toast(e.message||'Could not stage delivery actions',true)}
    finally{btn.disabled=false;btn.textContent='Stage Delivery Actions'}
  }

  function validDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||''));}
  function issuesFor(s){
    const issues=[],warnings=[];
    if(s.action==='deliver'){
      if(s.current_actual) issues.push('Already delivered — reopen first');
      if(!s.actual_delivery_date||!validDate(s.actual_delivery_date)) issues.push('Actual delivery date is required');
      const revs=revisionsByDrawing.get(s.drawing_id)||[];
      if(s.revision_id && !revs.some(r=>r.id===s.revision_id)) issues.push('Selected revision is invalid for this drawing');
      if(s.drawing_id && !s.revision_id) warnings.push(revs.length?'No revision selected':'No revision exists; delivery will be recorded without one');
    } else if(s.action==='reopen'){
      if(!canReopen()) issues.push('Admin role required');
      if(!s.current_actual) issues.push('Item is not delivered');
      if(!String(s.reason||'').trim()) issues.push('Reopen reason is required');
    }
    return {issues,warnings};
  }

  function revisionOptions(s){
    const revs=revisionsByDrawing.get(s.drawing_id)||[];
    return `<option value="">No revision</option>`+revs.map(r=>`<option value="${esc(r.id)}" ${r.id===s.revision_id?'selected':''}>${esc(r.revision)} — ${esc(r.filename||'')}</option>`).join('');
  }

  function renderQueue(){
    const body=$('td3Body'),queue=$('td3Queue'); if(!body||!queue)return;
    const arr=[...staged.values()]; let errors=0,warnings=0;
    body.innerHTML=arr.map(s=>{
      const v=issuesFor(s); if(v.issues.length)errors++; if(v.warnings.length)warnings++;
      const detail=v.issues.length?`<div class="td3-error">${esc(v.issues.join(' · '))}</div>`:v.warnings.length?`<div class="td3-warn">${esc(v.warnings.join(' · '))}</div>`:'<span class="td3-pill good">Ready</span>';
      if(s.action==='deliver') return `<tr data-id="${s.id}"><td><span class="td3-deliver">Deliver</span></td><td><strong>${esc(s.document_number)}</strong></td><td><input class="td3-edit" data-field="actual_delivery_date" type="date" value="${esc(s.actual_delivery_date)}"></td><td><select class="td3-edit" data-field="revision_id">${revisionOptions(s)}</select></td><td><input class="td3-edit td3-note" data-field="note" value="${esc(s.note)}" placeholder="Delivery note"></td><td>${detail}</td><td><button class="btn secondary td3-remove" type="button">Remove</button></td></tr>`;
      return `<tr data-id="${s.id}"><td><span class="td3-reopen">Reopen</span></td><td><strong>${esc(s.document_number)}</strong></td><td><div>${esc(s.current_actual||'—')}</div></td><td><div>${esc(s.current_revision||'—')}</div></td><td><input class="td3-edit td3-note" data-field="reason" value="${esc(s.reason)}" placeholder="Required reopen reason"></td><td>${detail}</td><td><button class="btn secondary td3-remove" type="button">Remove</button></td></tr>`;
    }).join('');
    queue.classList.toggle('hidden',!arr.length);
    $('td3Staged').textContent=`${arr.length} staged`;
    $('td3Errors').textContent=`${errors} error${errors===1?'':'s'}`;
    $('td3Warnings').textContent=`${warnings} warning${warnings===1?'':'s'}`;
    $('td3Apply').disabled=!arr.length||errors>0;
    $('td3Apply').textContent=arr.length?`Apply ${arr.length} Delivery Action${arr.length===1?'':'s'}`:'Apply Delivery Actions';
    $('td3Clear').disabled=!arr.length;
    body.querySelectorAll('.td3-edit').forEach(el=>el.onchange=e=>{const tr=e.target.closest('tr'),s=staged.get(tr.dataset.id);if(!s)return;s[e.target.dataset.field]=e.target.value;staged.set(s.id,s);renderQueue()});
    body.querySelectorAll('.td3-remove').forEach(b=>b.onclick=e=>{staged.delete(e.target.closest('tr').dataset.id);renderQueue()});
  }

  function clearQueue(){staged.clear();renderQueue();toast('Delivery action queue cleared.');}

  function planningDraftCount(){
    const txt=String($('tg2DirtyCount')?.textContent||'0');
    const n=parseInt(txt,10); return Number.isFinite(n)?n:0;
  }

  async function applyActions(){
    if(!canControl()) return toast('Document Controller or Admin role required',true);
    const arr=[...staged.values()]; if(!arr.length)return;
    const bad=arr.filter(s=>issuesFor(s).issues.length); if(bad.length)return toast('Fix delivery validation errors first',true);
    if(planningDraftCount()>0) return toast('Apply or discard the staged planning edits first, then apply Delivery Actions.',true);
    const payload=arr.map(s=>s.action==='deliver'?{deliverable_id:s.id,action:'deliver',actual_delivery_date:s.actual_delivery_date,revision_id:s.revision_id||null,note:String(s.note||'').trim()||null}:{deliverable_id:s.id,action:'reopen',reason:String(s.reason||'').trim()});
    const b=$('td3Apply');b.disabled=true;b.textContent='Applying…';
    try{
      const {data,error}=await supabase.rpc('bulk_tidp_delivery_actions',{p_actions:payload});
      if(error)throw error;
      const r=Array.isArray(data)?data[0]:data;
      staged.clear();renderQueue();
      toast(`${r?.processed??payload.length} processed · ${r?.delivered??0} delivered · ${r?.reopened??0} reopened.`);
      $('tg2Refresh')?.click();
      $('pRefresh')?.click();
    }catch(e){toast(e.message||'Could not apply delivery actions',true);renderQueue()}
  }

  async function init(){
    const {data:{session}}=await supabase.auth.getSession(); if(!session)return;
    const {data,error}=await supabase.rpc('current_user_role'); if(error)return;
    role=data||'viewer'; if(!canControl())return;
    if(inject())return;
    const obs=new MutationObserver(()=>{if(inject())obs.disconnect()});
    obs.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>obs.disconnect(),15000);
  }

  setTimeout(()=>init().catch(e=>toast(e.message||'Could not initialize Delivery Control',true)),650);
}
