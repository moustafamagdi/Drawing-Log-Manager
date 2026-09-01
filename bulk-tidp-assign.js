import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg=window.DLM_CONFIG;
if(cfg && !window.__DLM_BULK_TIDP_ASSIGN__){
  window.__DLM_BULK_TIDP_ASSIGN__=true;
  const supabase=createClient(cfg.url,cfg.key);
  const $=id=>document.getElementById(id);
  const selected=new Set();
  let role='viewer';
  let observer=null;
  const canAssign=()=>['document_controller','admin'].includes(role);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast=(m,e=false)=>{const t=$('toast');if(!t)return;t.textContent=m;t.className=`toast show ${e?'error':'success'}`;clearTimeout(toast.t);toast.t=setTimeout(()=>t.className='toast',4500)};

  function styles(){
    if($('bulkTidpStyles'))return;
    const s=document.createElement('style');s.id='bulkTidpStyles';s.textContent=`
      .bulk-tidp-cell{width:38px;text-align:center}.bulk-tidp-cell input{width:16px;height:16px;cursor:pointer}
      .bulk-tidp-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.bulk-tidp-count{font-size:12px;font-weight:700;color:#42526a;min-width:74px}
      .bulk-tidp-modal .modal-card{max-width:680px}.bulk-tidp-form{display:grid;grid-template-columns:1fr 1fr;gap:12px}.bulk-tidp-form .span-2{grid-column:span 2}
      .bulk-tidp-summary{padding:12px;border:1px solid #e3e8ef;border-radius:9px;background:#f8fafc}.bulk-tidp-summary strong{font-size:18px}
      @media(max-width:700px){.bulk-tidp-form{grid-template-columns:1fr}.bulk-tidp-form .span-2{grid-column:span 1}}
    `;document.head.appendChild(s);
  }

  function updateCount(){
    const n=selected.size;
    if($('bulkTidpCount'))$('bulkTidpCount').textContent=`${n} selected`;
    if($('bulkAssignTidpBtn'))$('bulkAssignTidpBtn').disabled=!n;
    if($('bulkClearSelectionBtn'))$('bulkClearSelectionBtn').disabled=!n;
    if($('bulkTidpModalCount'))$('bulkTidpModalCount').textContent=n;
    const visible=[...document.querySelectorAll('#registerBody tr[data-id]')];
    const all=visible.length>0&&visible.every(tr=>selected.has(tr.dataset.id));
    const head=$('bulkTidpSelectVisible');if(head){head.checked=all;head.indeterminate=!all&&visible.some(tr=>selected.has(tr.dataset.id));}
  }

  function decorateRegister(){
    if(!canAssign())return;
    const page=$('registerPage'),body=$('registerBody');if(!page||!body)return;
    const table=body.closest('table'),headRow=table?.querySelector('thead tr');
    if(headRow&&!headRow.querySelector('.bulk-tidp-head')){
      const th=document.createElement('th');th.className='bulk-tidp-cell bulk-tidp-head';th.title='Select visible drawings';th.innerHTML='<input id="bulkTidpSelectVisible" type="checkbox" aria-label="Select visible drawings" />';headRow.prepend(th);
      th.querySelector('input').addEventListener('click',e=>e.stopPropagation());
      th.querySelector('input').addEventListener('change',e=>{
        document.querySelectorAll('#registerBody tr[data-id]').forEach(tr=>{e.target.checked?selected.add(tr.dataset.id):selected.delete(tr.dataset.id)});decorateRows();updateCount();
      });
    }
    decorateRows();
    const toolbar=page.querySelector('.toolbar');
    if(toolbar&&!$('bulkAssignTidpBtn')){
      const wrap=document.createElement('div');wrap.className='bulk-tidp-actions';wrap.innerHTML=`<span id="bulkTidpCount" class="bulk-tidp-count">0 selected</span><button id="bulkAssignTidpBtn" class="btn primary" type="button" disabled>Assign to TIDP</button><button id="bulkClearSelectionBtn" class="btn secondary" type="button" disabled>Clear Selection</button>`;
      toolbar.appendChild(wrap);
      $('bulkAssignTidpBtn').onclick=openModal;$('bulkClearSelectionBtn').onclick=()=>{selected.clear();decorateRows();updateCount()};
    }
    updateCount();
  }

  function decorateRows(){
    document.querySelectorAll('#registerBody tr[data-id]').forEach(tr=>{
      let td=tr.querySelector('.bulk-tidp-check-cell');
      if(!td){td=document.createElement('td');td.className='bulk-tidp-cell bulk-tidp-check-cell';td.innerHTML=`<input type="checkbox" class="bulk-tidp-check" aria-label="Select drawing" />`;tr.prepend(td);}
      const cb=td.querySelector('input');cb.checked=selected.has(tr.dataset.id);
      cb.onclick=e=>e.stopPropagation();
      cb.onchange=e=>{e.stopPropagation();e.target.checked?selected.add(tr.dataset.id):selected.delete(tr.dataset.id);updateCount()};
    });
  }

  function ensureModal(){
    if($('bulkTidpModal'))return;
    const m=document.createElement('div');m.id='bulkTidpModal';m.className='modal hidden bulk-tidp-modal';m.innerHTML=`<div class="modal-card"><div class="modal-head"><div><h3>Assign Drawings to TIDP</h3><p class="muted tiny">Create one information deliverable for each selected drawing.</p></div><button id="bulkTidpClose" class="icon-btn" type="button">×</button></div><form id="bulkTidpForm" class="modal-body bulk-tidp-form"><div class="bulk-tidp-summary span-2"><strong id="bulkTidpModalCount">0</strong> drawings selected<div class="tiny muted">Drawings already assigned to the selected TIDP will be skipped automatically.</div></div><label class="span-2">TIDP<select id="bulkTidpPlan" required></select></label><label>Baseline Due Date<input id="bulkTidpDue" type="date" required /></label><label>Planned Start<input id="bulkTidpStart" type="date" /></label><label class="span-2">Milestone<input id="bulkTidpMilestone" placeholder="e.g. Coordination Issue / IFC Package" /></label><label class="span-2">Notes<textarea id="bulkTidpNotes" rows="3" placeholder="Optional common note for the selected drawings"></textarea></label><div class="span-2 form-actions"><button id="bulkTidpSubmit" class="btn primary" type="submit">Assign Selected Drawings</button><button id="bulkTidpCancel" class="btn secondary" type="button">Cancel</button></div></form></div>`;
    document.body.appendChild(m);
    $('bulkTidpClose').onclick=closeModal;$('bulkTidpCancel').onclick=closeModal;$('bulkTidpForm').onsubmit=submitAssignment;
    m.addEventListener('click',e=>{if(e.target===m)closeModal()});
  }

  async function openModal(){
    if(!selected.size)return toast('Select at least one drawing first',true);
    ensureModal();
    const {data,error}=await supabase.from('information_delivery_plans').select('id,plan_code,plan_name,status,plan_type,parent_plan_id').eq('plan_type','TIDP').in('status',['draft','active']).order('plan_code');
    if(error)return toast(error.message,true);
    if(!(data||[]).length)return toast('No Draft or Active TIDP is available. Create a TIDP first.',true);
    $('bulkTidpPlan').innerHTML='<option value="">Select TIDP…</option>'+data.map(p=>`<option value="${p.id}">${esc(p.plan_code)} — ${esc(p.plan_name)}</option>`).join('');
    $('bulkTidpModalCount').textContent=selected.size;
    $('bulkTidpModal').classList.remove('hidden');
  }
  function closeModal(){$('bulkTidpModal')?.classList.add('hidden')}

  async function submitAssignment(e){
    e.preventDefault();if(!selected.size)return;
    const due=$('bulkTidpDue').value,start=$('bulkTidpStart').value;
    if(start&&due&&start>due)return toast('Planned Start cannot be after Baseline Due Date',true);
    const btn=$('bulkTidpSubmit');btn.disabled=true;btn.textContent='Assigning…';
    const ids=[...selected];
    const {data,error}=await supabase.rpc('bulk_assign_drawings_to_tidp',{
      p_plan_id:$('bulkTidpPlan').value,
      p_drawing_ids:ids,
      p_baseline_due_date:due,
      p_milestone_name:$('bulkTidpMilestone').value||null,
      p_planned_start:start||null,
      p_notes:$('bulkTidpNotes').value||null
    });
    btn.disabled=false;btn.textContent='Assign Selected Drawings';
    if(error)return toast(error.message||'Could not assign drawings',true);
    const r=data||{};
    closeModal();selected.clear();decorateRows();updateCount();
    toast(`${r.created||0} assigned to TIDP${r.skipped?` · ${r.skipped} already assigned`:''}${r.missing?` · ${r.missing} unavailable`:''}`);
    window.dispatchEvent(new CustomEvent('dlm:planning-changed',{detail:{source:'bulk-tidp-assign'}}));
  }

  async function init(){
    styles();ensureModal();
    const {data:{session}}=await supabase.auth.getSession();if(!session)return;
    const {data,error}=await supabase.rpc('current_user_role');if(error)return;role=data||'viewer';if(!canAssign())return;
    decorateRegister();
    const body=$('registerBody');if(body&&!observer){observer=new MutationObserver(()=>decorateRegister());observer.observe(body,{childList:true});}
  }

  setTimeout(()=>init().catch(e=>toast(e.message,true)),250);
  supabase.auth.onAuthStateChange(()=>setTimeout(()=>init().catch(()=>{}),200));
}
