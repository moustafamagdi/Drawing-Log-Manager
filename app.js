import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);
const state={user:null,role:'viewer',rows:[],lookups:{},settings:null,selected:null,revisions:[],page:1,pageSize:25,sort:'created_at',sortDir:'desc',codeList:'document_types',editingCode:null};
const pages={dashboard:['Dashboard','Project drawing register overview'],register:['Drawing Register','Search, filter and manage controlled drawing records'],new:['New Drawing','Generate a controlled number and reserve its serial'],details:['Drawing Details','Metadata, revisions and audit trail'],codes:['Code Lists','Controlled project reference codes'],settings:['Settings & Access','Numbering rules, filename settings and user permissions']};
const roleRank={viewer:0,editor:1,document_controller:2,admin:3};
const codeLists=[
  ['portfolios','Portfolios'],['campus_plots','Campus Plots'],['data_centers','Data Centers'],['project_contracts','Projects / Contracts'],['organizations','Organizations'],['document_types','Document Types'],['disciplines','Disciplines'],['drawing_types','Drawing / DDE Types'],['levels','Levels'],['stages','Stages'],['document_statuses','Document Statuses']
];

function toast(message,error=false){const el=$('toast');el.textContent=message;el.className=`toast show ${error?'error':'success'}`;clearTimeout(toast.t);toast.t=setTimeout(()=>el.className='toast',3500)}
function esc(v=''){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function can(role){return roleRank[state.role]>=roleRank[role]}
function fmtDate(v){return v?new Date(v).toLocaleString():'—'}
function activeRows(name){return (state.lookups[name]||[]).filter(x=>x.is_active!==false)}
function optionRows(rows,placeholder='Select…'){return `<option value="">${placeholder}</option>`+rows.map(r=>`<option value="${esc(r.code)}">${esc(r.code)} — ${esc(r.name)}</option>`).join('')}
function setBusy(btn,busy,label){if(!btn)return;btn.disabled=busy;if(label)btn.textContent=busy?'Working…':label}
function copyText(text){navigator.clipboard?.writeText(text).then(()=>toast('Copied to clipboard')).catch(()=>toast('Could not copy',true))}
function openModal(id){$(id).classList.remove('hidden')}
function closeModal(id){$(id).classList.add('hidden')}

function renderPermissionMatrix(){
  const rows=[
    ['Viewer','Read dashboard, register, details, code lists and settings'],
    ['Editor','Viewer + edit title/comments + stage-only updates'],
    ['Document Controller','Editor + allocate official numbers + revisions/drafts + duplicate + lifecycle status'],
    ['Admin','Document Controller + all code lists + filename template + user roles']
  ];
  $('permissionMatrix').innerHTML=rows.map(([r,d])=>`<div class="permission-row"><strong>${r}</strong><span>${d}</span></div>`).join('');
}

async function loadRole(){
  const {data,error}=await supabase.rpc('current_user_role');if(error)throw error;
  state.role=data||'viewer';$('roleBadge').textContent=state.role;$('settingsRole').textContent=state.role;
  const desc={viewer:'Read-only access.',editor:'Can edit non-numbering drawing metadata and stage.',document_controller:'Can allocate official numbers, create revisions and control drawing lifecycle.',admin:'Full application access: all Document Controller actions, all controlled code lists, filename settings and user roles.'};
  $('roleDescription').textContent=desc[state.role]||'';
  document.querySelectorAll('.role-create,.role-controller').forEach(el=>el.classList.toggle('hidden',!can('document_controller')));
  document.querySelectorAll('.role-edit').forEach(el=>el.classList.toggle('hidden',!can('editor')));
  document.querySelectorAll('.admin-only').forEach(el=>el.classList.toggle('hidden',!can('admin')));
  renderPermissionMatrix();
  if(can('admin'))await loadUsers();
}

async function loadLookups(){
  const names=codeLists.map(x=>x[0]);
  const results=await Promise.all(names.map(async name=>{
    const {data,error}=await supabase.from(name).select('*').order('code');if(error)throw error;return[name,data||[]];
  }));
  state.lookups=Object.fromEntries(results);populateForms();renderCodeTabs();renderCodeList();
}

function populateForms(){
  const map={portfolio:'portfolios',campus:'campus_plots',dataCenter:'data_centers',projectContract:'project_contracts',organization:'organizations',discipline:'disciplines',level:'levels'};
  for(const[id,name]of Object.entries(map))$(id).innerHTML=optionRows(activeRows(name));
  $('documentType').innerHTML=optionRows(activeRows('document_types').filter(x=>x.category!=='document'),'Select drawing / DDE type…');
  $('stage').innerHTML=optionRows(activeRows('stages'),'Not specified');
  $('detailStage').innerHTML=optionRows(activeRows('stages'),'Select stage…');
  $('revisionStage').innerHTML=optionRows(activeRows('stages'),'Select stage…');
  $('disciplineFilter').innerHTML=optionRows(activeRows('disciplines'),'All disciplines');
  $('typeFilter').innerHTML=optionRows(activeRows('document_types').filter(x=>x.category!=='document'),'All document types');
  $('issueStatus').innerHTML='<option value="">None</option>'+activeRows('document_statuses').filter(x=>x.status_group==='issue').map(x=>`<option value="${x.code}">${x.code} — ${esc(x.name)}</option>`).join('');
  $('reviewStatus').innerHTML='<option value="">None</option>'+activeRows('document_statuses').filter(x=>x.status_group==='review').map(x=>`<option value="${x.code}">${x.code} — ${esc(x.name)}</option>`).join('');
  if(activeRows('portfolios').some(x=>x.code==='SAAD'))$('portfolio').value='SAAD';
  filterDrawingTypes();updatePreview();
}

function filterDrawingTypes(){
  const dt=activeRows('document_types').find(x=>x.code===$('documentType').value);
  const kind=dt?.category==='dde'?'dde':'drawing';
  $('drawingType').innerHTML=optionRows(activeRows('drawing_types').filter(x=>x.type_kind===kind),kind==='dde'?'Select DDE type A–I…':'Select drawing type 0–8…');
  $('drawingTypeLabel').firstChild.textContent=kind==='dde'?'DDE Type':'Drawing Type';
}

async function loadSettings(){
  const {data,error}=await supabase.from('numbering_settings').select('*').eq('id',1).single();if(error)throw error;
  state.settings=data;$('filenameTemplate').value=data.filename_template||'{document_number}_{revision}.{extension}';renderSettings();previewFilename();
}
function renderSettings(){
  const s=state.settings;if(!s)return;
  $('numberingInfo').innerHTML=[['Serial scope',s.serial_scope],['Serial digits',s.serial_digits],['Number separator',s.separator],['Revision separator',s.revision_separator],['Stage in number',s.include_stage_in_number?'Yes':'No'],['Filename template',s.filename_template]].map(([a,b])=>`<div class="meta-item"><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`).join('');
}
function previewFilename(){const t=$('filenameTemplate').value||'';$('filenamePreview').textContent=t.replaceAll('{document_number}','SAAD-PL1-DC1A-101-JLL-SDW-ME-2L1-000001').replaceAll('{revision}','00').replaceAll('{extension}','dwg').replaceAll('{title}','Sample Drawing Title')}

async function loadUsers(){
  if(!can('admin'))return;
  const {data,error}=await supabase.rpc('admin_list_users');
  if(error){$('userAccessBody').innerHTML=`<tr><td colspan="5">${esc(error.message)}</td></tr>`;return;}
  const roles=['viewer','editor','document_controller','admin'];
  $('userAccessBody').innerHTML=(data||[]).map(u=>`<tr><td>${esc(u.email||u.user_id)}</td><td><select class="user-role-select" data-id="${u.user_id}">${roles.map(r=>`<option value="${r}" ${r===u.role?'selected':''}>${r}</option>`).join('')}</select></td><td>${fmtDate(u.created_at)}</td><td>${fmtDate(u.last_sign_in_at)}</td><td><button class="btn secondary save-user-role" data-id="${u.user_id}">Save</button></td></tr>`).join('');
  document.querySelectorAll('.save-user-role').forEach(btn=>btn.addEventListener('click',async()=>{
    const select=document.querySelector(`.user-role-select[data-id="${btn.dataset.id}"]`);setBusy(btn,true);
    const {error}=await supabase.rpc('admin_set_user_role',{p_user_id:btn.dataset.id,p_role:select.value});setBusy(btn,false,'Save');
    if(error)return toast(error.message,true);toast('User role updated');await loadUsers();
  }));
}

async function loadRegister(){const {data,error}=await supabase.from('drawing_register_v').select('*').order('created_at',{ascending:false});if(error)throw error;state.rows=data||[];renderDashboard();renderRegister()}
async function loadRevisionCount(){const {count,error}=await supabase.from('drawing_revisions').select('*',{count:'exact',head:true}).eq('is_formal_issue',true);$('statRevisions').textContent=error?'—':(count||0)}
function renderDashboard(){
  $('statTotal').textContent=state.rows.length;$('statActive').textContent=state.rows.filter(r=>r.status==='active').length;$('statDisciplines').textContent=new Set(state.rows.map(r=>r.discipline_code).filter(Boolean)).size;loadRevisionCount();
  const rows=state.rows.slice(0,8);$('recentBody').innerHTML=rows.length?rows.map(r=>`<tr class="clickable" data-id="${r.id}"><td class="doc-number">${esc(r.document_number)}</td><td class="title-cell">${esc(r.title)}</td><td>${esc(r.discipline_code)}</td><td>${esc(r.stage_code||'—')}</td><td>${esc(r.latest_revision||'—')}</td><td><span class="badge ${esc(r.status)}">${esc(r.status)}</span></td></tr>`).join(''):`<tr><td colspan="6" class="muted">No drawings yet.</td></tr>`;
  document.querySelectorAll('#recentBody tr[data-id]').forEach(tr=>tr.addEventListener('click',()=>openDetails(tr.dataset.id)));
}
function filteredRows(){
  const q=$('searchInput').value.trim().toLowerCase(),d=$('disciplineFilter').value,t=$('typeFilter').value,s=$('statusFilter').value;
  let rows=state.rows.filter(r=>(!q||`${r.document_number} ${r.title}`.toLowerCase().includes(q))&&(!d||r.discipline_code===d)&&(!t||r.document_type_code===t)&&(!s||r.status===s));
  rows=[...rows].sort((a,b)=>{const av=a[state.sort]??'',bv=b[state.sort]??'';const cmp=String(av).localeCompare(String(bv),undefined,{numeric:true,sensitivity:'base'});return state.sortDir==='asc'?cmp:-cmp});return rows;
}
function renderRegister(){
  const all=filteredRows(),pagesCount=Math.max(1,Math.ceil(all.length/state.pageSize));state.page=Math.min(state.page,pagesCount);const start=(state.page-1)*state.pageSize,rows=all.slice(start,start+state.pageSize);
  $('registerEmpty').classList.toggle('hidden',all.length>0);
  $('registerBody').innerHTML=rows.map(r=>`<tr class="clickable" data-id="${r.id}"><td class="doc-number">${esc(r.document_number)}</td><td class="title-cell" title="${esc(r.title)}">${esc(r.title)}</td><td>${esc(r.document_type_code)}</td><td>${esc(r.discipline_code)}</td><td>${esc(r.type_level_code)}</td><td>${esc(r.stage_code||'—')}</td><td>${esc(r.latest_revision||'—')}</td><td><span class="badge ${esc(r.status)}">${esc(r.status)}</span></td><td><button class="btn secondary row-view" data-id="${r.id}">View</button></td></tr>`).join('');
  $('pagerInfo').textContent=all.length?`${start+1}–${Math.min(start+state.pageSize,all.length)} of ${all.length}`:'0 records';$('prevPageBtn').disabled=state.page<=1;$('nextPageBtn').disabled=state.page>=pagesCount;
  document.querySelectorAll('#registerBody tr[data-id]').forEach(tr=>tr.addEventListener('click',e=>{if(!e.target.closest('button'))openDetails(tr.dataset.id)}));document.querySelectorAll('.row-view').forEach(b=>b.addEventListener('click',()=>openDetails(b.dataset.id)));
}
function navigate(name){document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden'));$(`${name}Page`).classList.remove('hidden');document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page===name));$('pageTitle').textContent=pages[name][0];$('pageSubtitle').textContent=pages[name][1];window.scrollTo({top:0,behavior:'smooth'});if(name==='settings'&&can('admin'))loadUsers()}

function updatePreview(){const ids=['portfolio','campus','dataCenter','projectContract','organization','documentType','discipline','drawingType','level'];const vals=ids.map(id=>$(id).value);$('numberPreview').textContent=vals.every(Boolean)?`${vals[0]}-${vals[1]}-${vals[2]}-${vals[3]}-${vals[4]}-${vals[5]}-${vals[6]}-${vals[7]}${vals[8]}-XXXXXX`:'Complete the fields to preview the number'}
function drawingPayload(){return{p_title:$('title').value,p_portfolio:$('portfolio').value,p_campus:$('campus').value,p_data_center:$('dataCenter').value,p_project_contract:$('projectContract').value,p_organization:$('organization').value,p_document_type:$('documentType').value,p_discipline:$('discipline').value,p_drawing_type:$('drawingType').value,p_level:$('level').value,p_stage:$('stage').value||null,p_comments:$('comments').value||null}}
async function createDrawing(e){e.preventDefault();if(!can('document_controller'))return toast('Document Controller or Admin role required',true);const btn=$('createDrawingBtn');setBusy(btn,true);try{const {data,error}=await supabase.rpc('create_drawing',drawingPayload());if(error)throw error;const row=Array.isArray(data)?data[0]:data;toast(`Created: ${row.document_number}`);e.target.reset();if(activeRows('portfolios').some(x=>x.code==='SAAD'))$('portfolio').value='SAAD';filterDrawingTypes();updatePreview();await loadRegister();await openDetails(row.id)}catch(err){toast(err.message||'Could not create drawing',true)}finally{setBusy(btn,false,'Generate & Save Number')}}

async function openDetails(id){const row=state.rows.find(r=>r.id===id);if(!row)return toast('Drawing not found',true);state.selected=row;$('detailNumber').textContent=row.document_number;$('detailTitle').textContent=row.title;$('lifecycleSelect').value=row.status;$('detailStage').value=row.stage_code||'';$('revisionStage').value=row.stage_code||'5A';renderMetadata();navigate('details');await loadDetailsData()}
function renderMetadata(){const r=state.selected;if(!r)return;const items=[['Portfolio',r.portfolio],['Campus Plot',r.campus],['Data Center',r.data_center],['Project / Contract',r.project_contract],['Organization',r.organization],['Document Type',`${r.document_type_code} — ${r.document_type_name||''}`],['Discipline',`${r.discipline_code} — ${r.discipline_name||''}`],['Type / Level',r.type_level_code],['Stage',r.stage_name?`${r.stage_code} — ${r.stage_name}`:(r.stage_code||'—')],['Serial',String(r.serial_number).padStart(6,'0')],['Status',r.status],['Comments',r.comments||'—']];$('metadataGrid').innerHTML=items.map(([a,b])=>`<div class="meta-item"><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`).join('')}
async function loadDetailsData(){const id=state.selected.id;const {data:revs,error}=await supabase.from('drawing_revisions').select('*').eq('drawing_id',id).order('sequence_no',{ascending:false}).order('created_at',{ascending:false});if(error)throw error;state.revisions=revs||[];renderRevisions();const ids=[id,...state.revisions.map(x=>x.id).filter(Boolean)];const {data:audit,error:aerr}=await supabase.from('audit_log').select('*').in('entity_id',ids).order('created_at',{ascending:false});if(aerr)$('auditList').innerHTML='<div class="empty">Audit trail unavailable for this account.</div>';else renderAudit(audit||[])}
function renderRevisions(){$('revisionBody').innerHTML=state.revisions.length?state.revisions.map(r=>`<tr><td><strong>${esc(r.revision)}</strong></td><td><span class="badge ${r.is_formal_issue?'':'draft'}">${r.is_formal_issue?'Formal':'Draft'}</span></td><td>${esc(r.stage_code||'—')}</td><td class="doc-number">${esc(r.filename)}</td><td>${esc(r.issue_status_code||'—')}</td><td>${esc(r.review_status_code||'—')}</td><td class="title-cell">${esc(r.revision_description||'—')}</td><td>${esc(fmtDate(r.created_at))}</td></tr>`).join(''):`<tr><td colspan="8" class="muted">No revisions recorded yet.</td></tr>`}
function renderAudit(rows){$('auditList').innerHTML=rows.length?rows.map(a=>`<div class="audit-row"><span>${esc(fmtDate(a.created_at))}</span><span class="audit-action">${esc(a.action)}</span><span>${esc(a.entity_type)} ${esc(a.entity_id||'')}</span></div>`).join(''):'<div class="empty">No audit entries yet.</div>'}

async function saveStage(){if(!state.selected||!can('editor'))return;const stage=$('detailStage').value;if(!stage)return toast('Choose a stage',true);try{const {error}=await supabase.rpc('update_drawing_stage',{p_drawing_id:state.selected.id,p_stage:stage});if(error)throw error;toast('Stage updated without changing revision');await loadRegister();await openDetails(state.selected.id)}catch(e){toast(e.message,true)}}
async function saveMetadata(e){e.preventDefault();if(!can('editor'))return;try{const {error}=await supabase.rpc('update_drawing_metadata',{p_drawing_id:state.selected.id,p_title:$('editTitle').value,p_comments:$('editComments').value||null});if(error)throw error;closeModal('metadataModal');toast('Metadata updated');await loadRegister();await openDetails(state.selected.id)}catch(err){toast(err.message,true)}}
async function setLifecycle(){if(!can('document_controller'))return;try{const {error}=await supabase.rpc('set_drawing_status',{p_drawing_id:state.selected.id,p_status:$('lifecycleSelect').value});if(error)throw error;toast('Drawing status updated');await loadRegister();await openDetails(state.selected.id)}catch(e){toast(e.message,true)}}
async function duplicateSelected(){if(!can('document_controller')||!state.selected)return;const r=state.selected;try{const p={p_title:`${r.title} - Copy`,p_portfolio:r.portfolio_code||r.portfolio,p_campus:r.campus_plot_code||r.campus,p_data_center:r.data_center_code||r.data_center,p_project_contract:r.project_contract_code||r.project_contract,p_organization:r.organization_code||r.organization,p_document_type:r.document_type_code,p_discipline:r.discipline_code,p_drawing_type:r.drawing_type_code,p_level:r.level_code,p_stage:r.stage_code||null,p_comments:r.comments||null};const {data,error}=await supabase.rpc('create_drawing',p);if(error)throw error;const row=Array.isArray(data)?data[0]:data;toast(`Duplicated as ${row.document_number}`);await loadRegister();await openDetails(row.id)}catch(e){toast(e.message,true)}}
async function addRevision(e){e.preventDefault();if(!can('document_controller'))return;const btn=e.submitter;setBusy(btn,true);try{const p={p_drawing_id:state.selected.id,p_stage:$('revisionStage').value,p_extension:$('revisionExtension').value,p_revision_description:$('revisionDescription').value||null,p_issue_status_code:$('issueStatus').value||null,p_review_status_code:$('reviewStatus').value||null,p_reason_for_issue:$('reasonForIssue').value||null,p_is_formal:$('revisionFormal').value==='true'};const {data,error}=await supabase.rpc('add_drawing_revision',p);if(error)throw error;closeModal('revisionModal');e.target.reset();toast(`Revision ${data.revision} created`);await loadRegister();await openDetails(state.selected.id)}catch(err){toast(err.message,true)}finally{setBusy(btn,false,'Create Revision')}}

function exportCsv(){const rows=filteredRows();if(!rows.length)return toast('No rows to export',true);const cols=['document_number','title','portfolio','campus','data_center','project_contract','organization','document_type_code','discipline_code','drawing_type_code','level_code','type_level_code','stage_code','serial_number','latest_revision','latest_filename','status','created_at','updated_at','comments'];const quote=v=>`"${String(v??'').replaceAll('"','""')}"`;const csv='\uFEFF'+[cols.join(','),...rows.map(r=>cols.map(c=>quote(r[c])).join(','))].join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=`drawing-register-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href)}

function codeCategoryValue(r){return r.category||r.type_kind||r.status_group||'—'}
function renderCodeTabs(){$('codeTabs').innerHTML=codeLists.map(([k,n])=>`<button class="code-tab ${state.codeList===k?'active':''}" data-code-list="${k}">${n}</button>`).join('');document.querySelectorAll('.code-tab').forEach(b=>b.addEventListener('click',()=>{state.codeList=b.dataset.codeList;clearCodeEditor();renderCodeTabs();renderCodeList()}))}
function renderCodeList(){
  const rows=state.lookups[state.codeList]||[];
  $('codeListBody').innerHTML=rows.length?rows.map(r=>`<tr><td class="doc-number">${esc(r.code)}</td><td>${esc(r.name)}</td><td>${esc(codeCategoryValue(r))}</td><td>${r.is_active===false?'No':'Yes'}</td><td class="admin-only"><button class="btn secondary edit-code" data-code="${esc(r.code)}">Edit</button></td></tr>`).join(''):`<tr><td colspan="5" class="muted">No codes.</td></tr>`;
  document.querySelectorAll('.admin-only').forEach(el=>el.classList.toggle('hidden',!can('admin')));
  document.querySelectorAll('.edit-code').forEach(btn=>btn.addEventListener('click',()=>editCode(btn.dataset.code)));
}
function configureCodeEditor(row=null){
  const list=state.codeList;
  const extra=$('codeExtraLabel'),textExtra=$('codeTextExtraLabel'),sort=$('codeSortLabel'),desc=$('codeDescriptionLabel'),source=$('codeSourceLabel');
  [extra,textExtra,sort,desc,source].forEach(x=>x.classList.add('hidden'));
  $('codeEditExtra').innerHTML='';
  if(list==='document_types'){extra.classList.remove('hidden');$('codeExtraLabel').firstChild.textContent='Category';$('codeEditExtra').innerHTML='<option value="document">document</option><option value="drawing">drawing</option><option value="dde">dde</option>';}
  if(list==='drawing_types'){extra.classList.remove('hidden');$('codeExtraLabel').firstChild.textContent='Type Kind';$('codeEditExtra').innerHTML='<option value="drawing">drawing</option><option value="dde">dde</option>';}
  if(list==='document_statuses'){extra.classList.remove('hidden');$('codeExtraLabel').firstChild.textContent='Status Group';$('codeEditExtra').innerHTML='<option value="issue">issue</option><option value="review">review</option><option value="lifecycle">lifecycle</option>';}
  if(list==='disciplines'){textExtra.classList.remove('hidden');}
  if(['document_types','disciplines','stages'].includes(list))desc.classList.remove('hidden');
  if(['portfolios','campus_plots','data_centers','project_contracts','organizations','document_types'].includes(list))source.classList.remove('hidden');
  if(list==='stages')sort.classList.remove('hidden');
  if(row){
    $('codeEditExtra').value=row.category||row.type_kind||row.status_group||'';$('codeEditTextExtra').value=row.category||'';$('codeEditSort').value=row.sort_order??'';$('codeEditDescription').value=row.description||'';$('codeEditSource').value=row.source_note||'';
  }
}
function editCode(code){const row=(state.lookups[state.codeList]||[]).find(x=>x.code===code);if(!row)return;state.editingCode=code;$('codeEditorTitle').textContent=`Update ${code}`;$('codeEditCode').value=row.code;$('codeEditCode').readOnly=true;$('codeEditName').value=row.name;$('codeEditActive').checked=row.is_active!==false;configureCodeEditor(row);$('codeEditorForm').scrollIntoView({behavior:'smooth',block:'start'})}
function clearCodeEditor(){state.editingCode=null;$('codeEditorForm').reset();$('codeEditActive').checked=true;$('codeEditCode').readOnly=false;$('codeEditorTitle').textContent='Add Code';configureCodeEditor()}
async function saveCode(e){
  e.preventDefault();if(!can('admin'))return toast('Admin role required',true);
  const list=state.codeList,extra={};
  if(list==='document_types')extra.category=$('codeEditExtra').value;
  if(list==='drawing_types')extra.type_kind=$('codeEditExtra').value;
  if(list==='document_statuses')extra.status_group=$('codeEditExtra').value;
  if(list==='disciplines'&&$('codeEditTextExtra').value)extra.category=$('codeEditTextExtra').value;
  if(['document_types','disciplines','stages'].includes(list)&&$('codeEditDescription').value)extra.description=$('codeEditDescription').value;
  if(['portfolios','campus_plots','data_centers','project_contracts','organizations','document_types'].includes(list)&&$('codeEditSource').value)extra.source_note=$('codeEditSource').value;
  if(list==='stages'&&$('codeEditSort').value!=='')extra.sort_order=Number($('codeEditSort').value);
  try{
    const {error}=await supabase.rpc('admin_upsert_code',{p_list:list,p_code:$('codeEditCode').value,p_name:$('codeEditName').value,p_is_active:$('codeEditActive').checked,p_extra:extra});if(error)throw error;
    toast(state.editingCode?'Code updated':'Code created');clearCodeEditor();await loadLookups();
  }catch(err){toast(err.message,true)}
}
async function saveFilename(e){e.preventDefault();if(!can('admin'))return;try{const {data,error}=await supabase.rpc('update_numbering_settings',{p_filename_template:$('filenameTemplate').value});if(error)throw error;state.settings=data;toast('Filename template saved');renderSettings()}catch(err){toast(err.message,true)}}

async function enterApp(session){state.user=session.user;$('authView').classList.add('hidden');$('appView').classList.remove('hidden');$('userEmail').textContent=session.user.email||'';try{await loadRole();await Promise.all([loadLookups(),loadSettings(),loadRegister()])}catch(err){toast(err.message,true)}}
function leaveApp(){state.user=null;state.rows=[];state.selected=null;$('appView').classList.add('hidden');$('authView').classList.remove('hidden')}

$('authForm').addEventListener('submit',async e=>{e.preventDefault();const {data,error}=await supabase.auth.signInWithPassword({email:$('email').value,password:$('password').value});if(error)return toast(error.message,true);if(data.session)await enterApp(data.session)});
$('signUpBtn').addEventListener('click',async()=>{const email=$('email').value,password=$('password').value;if(!email||!password)return toast('Enter email and password first',true);const redirectUrl=new URL('.',window.location.href).href;const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:redirectUrl}});if(error)return toast(error.message,true);toast(data.session?'Account created':'Account created. Check your email to confirm your account.')});
$('logoutBtn').addEventListener('click',async()=>{await supabase.auth.signOut();leaveApp()});
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.page==='new'&&!can('document_controller'))return toast('Document Controller or Admin role required',true);navigate(b.dataset.page)}));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.go)));$('quickNewBtn').addEventListener('click',()=>navigate('new'));
$('newDrawingForm').addEventListener('submit',createDrawing);$('newDrawingForm').addEventListener('change',updatePreview);$('newDrawingForm').addEventListener('reset',()=>setTimeout(()=>{filterDrawingTypes();updatePreview()}));$('documentType').addEventListener('change',()=>{filterDrawingTypes();updatePreview()});
['searchInput','disciplineFilter','typeFilter','statusFilter'].forEach(id=>$(id).addEventListener(id==='searchInput'?'input':'change',()=>{state.page=1;renderRegister()}));$('exportCsvBtn').addEventListener('click',exportCsv);$('prevPageBtn').addEventListener('click',()=>{state.page--;renderRegister()});$('nextPageBtn').addEventListener('click',()=>{state.page++;renderRegister()});document.querySelectorAll('.sortable').forEach(th=>th.addEventListener('click',()=>{const k=th.dataset.sort;if(state.sort===k)state.sortDir=state.sortDir==='asc'?'desc':'asc';else{state.sort=k;state.sortDir='asc'}renderRegister()}));
$('backToRegister').addEventListener('click',()=>navigate('register'));$('copyNumberBtn').addEventListener('click',()=>copyText(state.selected?.document_number||''));$('duplicateBtn').addEventListener('click',duplicateSelected);$('saveStageBtn').addEventListener('click',saveStage);$('lifecycleSelect').addEventListener('change',setLifecycle);$('openRevisionBtn').addEventListener('click',()=>{if(state.selected?.stage_code)$('revisionStage').value=state.selected.stage_code;openModal('revisionModal')});$('revisionForm').addEventListener('submit',addRevision);$('editMetadataBtn').addEventListener('click',()=>{$('editTitle').value=state.selected.title;$('editComments').value=state.selected.comments||'';openModal('metadataModal')});$('metadataForm').addEventListener('submit',saveMetadata);document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));
$('codeEditorForm').addEventListener('submit',saveCode);$('newCodeBtn').addEventListener('click',()=>{clearCodeEditor();$('codeEditorForm').scrollIntoView({behavior:'smooth'})});$('cancelCodeEditBtn').addEventListener('click',clearCodeEditor);$('filenameForm').addEventListener('submit',saveFilename);$('filenameTemplate').addEventListener('input',previewFilename);

clearCodeEditor();
const {data:{session}}=await supabase.auth.getSession();if(session)await enterApp(session);else leaveApp();
supabase.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||!session)leaveApp()});