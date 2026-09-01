import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg=window.DLM_CONFIG;
if(cfg){
  const supabase=createClient(cfg.url,cfg.key);
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let lookups={};
  let role='viewer';

  function notify(message,error=false){const el=$('toast');if(!el)return;el.textContent=message;el.className=`toast show ${error?'error':'success'}`;setTimeout(()=>el.className='toast',3500);}
  const canImport=()=>['document_controller','admin'].includes(role);
  const active=name=>(lookups[name]||[]).filter(x=>x.is_active!==false);
  const options=(rows,placeholder='Select…')=>`<option value="">${placeholder}</option>`+rows.map(r=>`<option value="${esc(r.code)}">${esc(r.code)} — ${esc(r.name)}</option>`).join('');

  function inject(){
    if($('legacyPage'))return;
    const nav=document.querySelector('.nav');
    if(nav){const btn=document.createElement('button');btn.id='legacyNavBtn';btn.className='nav-item-static role-create';btn.textContent='Import Existing';nav.appendChild(btn);btn.addEventListener('click',openPage);document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>btn.classList.remove('active')));}
    const main=document.querySelector('.main');if(!main)return;
    const page=document.createElement('section');page.id='legacyPage';page.className='page hidden';page.innerHTML=`
      <div class="form-layout">
        <form id="legacyForm" class="panel form-panel">
          <div class="section-title"><h3>Import Existing Drawing</h3><p class="muted">For drawings issued before this system. Stage is mandatory because it is part of the controlled drawing number.</p></div>
          <label class="span-2">Drawing Title<input id="legacyTitle" required /></label>
          <label>Portfolio<select id="legacyPortfolio" required></select></label><label>Campus Plot<select id="legacyCampus" required></select></label>
          <label>Data Center<select id="legacyDataCenter" required></select></label><label>Project / Contract<select id="legacyProjectContract" required></select></label>
          <label>Organization<select id="legacyOrganization" required></select></label><label>Document Type<select id="legacyDocumentType" required></select></label>
          <label>Discipline<select id="legacyDiscipline" required></select></label><label>Stage<select id="legacyStage" required></select></label>
          <label id="legacyDrawingTypeLabel">Drawing / DDE Type<select id="legacyDrawingType" required></select></label><label>Level<select id="legacyLevel" required></select></label>
          <label>Historical Serial<input id="legacySerial" type="number" min="1" max="999999" required placeholder="e.g. 20001" /></label>
          <label class="span-2">Source / Legacy Note<input id="legacySourceNote" placeholder="e.g. Imported from old Excel register" /></label>
          <label class="span-2">Comments<textarea id="legacyComments" rows="3"></textarea></label>
          <div class="span-2 form-actions"><button id="legacySubmitBtn" class="btn primary" type="submit">Import Existing Drawing</button><button class="btn secondary" type="reset">Clear</button></div>
        </form>
        <aside class="panel preview-panel">
          <span class="eyebrow">LEGACY NUMBER PREVIEW</span><div id="legacyPreview" class="number-preview">Complete all fields, Stage and serial to preview the number</div>
          <div class="rule-note"><strong>Controlled format</strong><p>Portfolio-Campus-Data Center-Project-Organization-Document Type-Discipline-Stage-Type+Level-Serial</p><p>The complete document number must be unique. The same six-digit serial may be reused when another controlled part of the number is different.</p></div>
          <div id="legacyLastResult" class="legacy-result hidden"></div>
        </aside>
      </div>`;
    main.appendChild(page);
    $('legacyForm').addEventListener('submit',submitLegacy);$('legacyForm').addEventListener('change',updatePreview);$('legacyForm').addEventListener('input',updatePreview);$('legacyDocumentType').addEventListener('change',()=>{filterType();updatePreview();});$('legacyForm').addEventListener('reset',()=>setTimeout(()=>{if(active('portfolios').some(x=>x.code==='SAAD'))$('legacyPortfolio').value='SAAD';filterType();updatePreview();}));
  }

  async function loadLookups(){
    const names=['portfolios','campus_plots','data_centers','project_contracts','organizations','document_types','disciplines','drawing_types','levels','stages'];
    const rows=await Promise.all(names.map(async n=>{const {data,error}=await supabase.from(n).select('*').order('code');if(error)throw error;return[n,data||[]];}));lookups=Object.fromEntries(rows);
    $('legacyPortfolio').innerHTML=options(active('portfolios'));$('legacyCampus').innerHTML=options(active('campus_plots'));$('legacyDataCenter').innerHTML=options(active('data_centers'));$('legacyProjectContract').innerHTML=options(active('project_contracts'));$('legacyOrganization').innerHTML=options(active('organizations'));$('legacyDocumentType').innerHTML=options(active('document_types').filter(x=>x.category!=='document'),'Select drawing / DDE type…');$('legacyDiscipline').innerHTML=options(active('disciplines'));$('legacyLevel').innerHTML=options(active('levels'));$('legacyStage').innerHTML=options(active('stages'),'Select stage…');
    if(active('portfolios').some(x=>x.code==='SAAD'))$('legacyPortfolio').value='SAAD';filterType();updatePreview();
  }
  function filterType(){const dt=active('document_types').find(x=>x.code===$('legacyDocumentType').value);const kind=dt?.category==='dde'?'dde':'drawing';$('legacyDrawingType').innerHTML=options(active('drawing_types').filter(x=>x.type_kind===kind),kind==='dde'?'Select DDE type A–I…':'Select drawing type 0–8…');$('legacyDrawingTypeLabel').firstChild.textContent=kind==='dde'?'DDE Type':'Drawing Type';}
  function updatePreview(){if(!$('legacyPreview'))return;const ids=['legacyPortfolio','legacyCampus','legacyDataCenter','legacyProjectContract','legacyOrganization','legacyDocumentType','legacyDiscipline','legacyStage','legacyDrawingType','legacyLevel'];const vals=ids.map(id=>$(id).value);const serial=Number($('legacySerial').value||0);$('legacyPreview').textContent=vals.every(Boolean)&&serial>0?`${vals[0]}-${vals[1]}-${vals[2]}-${vals[3]}-${vals[4]}-${vals[5]}-${vals[6]}-${vals[7]}-${vals[8]}${vals[9]}-${String(serial).padStart(6,'0')}`.toUpperCase():'Complete all fields, Stage and serial to preview the number';}
  async function submitLegacy(e){
    e.preventDefault();if(!canImport())return notify('Document Controller or Admin role required',true);const btn=$('legacySubmitBtn');btn.disabled=true;btn.textContent='Importing…';
    const serial=Number($('legacySerial').value);const documentNumber=`${$('legacyPortfolio').value}-${$('legacyCampus').value}-${$('legacyDataCenter').value}-${$('legacyProjectContract').value}-${$('legacyOrganization').value}-${$('legacyDocumentType').value}-${$('legacyDiscipline').value}-${$('legacyStage').value}-${$('legacyDrawingType').value}${$('legacyLevel').value}-${String(serial).padStart(6,'0')}`.toUpperCase();
    const p={p_title:$('legacyTitle').value,p_portfolio:$('legacyPortfolio').value,p_campus:$('legacyCampus').value,p_data_center:$('legacyDataCenter').value,p_project_contract:$('legacyProjectContract').value,p_organization:$('legacyOrganization').value,p_document_type:$('legacyDocumentType').value,p_discipline:$('legacyDiscipline').value,p_drawing_type:$('legacyDrawingType').value,p_level:$('legacyLevel').value,p_serial:serial,p_stage:$('legacyStage').value,p_comments:$('legacyComments').value||null,p_document_number:documentNumber,p_legacy_source_note:$('legacySourceNote').value||null};
    try{const {data,error}=await supabase.rpc('import_existing_drawing',p);if(error)throw error;const row=Array.isArray(data)?data[0]:data;notify(`Imported: ${row.document_number}`);$('legacyLastResult').classList.remove('hidden');$('legacyLastResult').innerHTML=`<strong>Imported successfully</strong><div class="doc-number">${esc(row.document_number)}</div><div class="tiny muted">Stage ${esc(row.stage_code)} · Serial ${String(row.serial_number).padStart(6,'0')}.</div><button id="legacyRefreshRegister" class="btn secondary" type="button">Refresh & Open Register</button>`;$('legacyRefreshRegister').addEventListener('click',()=>location.reload());}catch(err){notify(err.message||'Could not import existing drawing',true);}finally{btn.disabled=false;btn.textContent='Import Existing Drawing';}
  }
  function openPage(){if(!canImport())return notify('Document Controller or Admin role required',true);document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden'));$('legacyPage').classList.remove('hidden');document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));$('legacyNavBtn').classList.add('active');$('pageTitle').textContent='Import Existing Drawing';$('pageSubtitle').textContent='Import historical drawings using the controlled stage-aware number';window.scrollTo({top:0,behavior:'smooth'});}
  async function init(){inject();const {data:{session}}=await supabase.auth.getSession();if(!session){$('legacyNavBtn')?.classList.add('hidden');return;}const {data}=await supabase.rpc('current_user_role');role=data||'viewer';$('legacyNavBtn')?.classList.toggle('hidden',!canImport());if(canImport())try{await loadLookups();}catch(e){notify(e.message,true);}}
  setTimeout(init,0);supabase.auth.onAuthStateChange(()=>setTimeout(init,100));
}
