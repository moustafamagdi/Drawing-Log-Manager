import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = (id) => document.getElementById(id);
const state = { rows: [], lookups: {}, user: null };
const pages = {
  dashboard: ['Dashboard','Project drawing register overview'],
  register: ['Drawing Register','Search, filter and export controlled drawing records'],
  new: ['New Drawing','Generate a compliant drawing number and save it to the register']
};

function toast(message, error=false){ const el=$('toast'); el.textContent=message; el.className=`toast show${error?' error':''}`; clearTimeout(toast.t); toast.t=setTimeout(()=>el.className='toast',3500); }
function esc(v=''){ return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function optionRows(rows, placeholder='Select…'){ return `<option value="">${placeholder}</option>`+rows.map(r=>`<option value="${esc(r.code)}">${esc(r.code)} — ${esc(r.name)}</option>`).join(''); }

async function loadLookups(){
  const names=['portfolios','campus_plots','data_centers','project_contracts','organizations','document_types','disciplines','drawing_types','levels','stages'];
  const results=await Promise.all(names.map(async name=>{ const {data,error}=await supabase.from(name).select('*').eq('is_active',true).order('code'); if(error) throw error; return [name,data]; }));
  state.lookups=Object.fromEntries(results);
  const map={portfolio:'portfolios',campus:'campus_plots',dataCenter:'data_centers',projectContract:'project_contracts',organization:'organizations',documentType:'document_types',discipline:'disciplines',drawingType:'drawing_types',level:'levels',stage:'stages'};
  for(const [id,name] of Object.entries(map)){ const el=$(id); const first=id==='stage'?'<option value="">Not specified</option>':'<option value="">Select…</option>'; el.innerHTML=first+state.lookups[name].map(r=>`<option value="${esc(r.code)}">${esc(r.code)} — ${esc(r.name)}</option>`).join(''); }
  $('disciplineFilter').innerHTML=optionRows(state.lookups.disciplines,'All disciplines');
  $('typeFilter').innerHTML=optionRows(state.lookups.document_types,'All document types');
  if(state.lookups.portfolios.some(x=>x.code==='SAAD')) $('portfolio').value='SAAD';
  updatePreview();
}

async function loadRegister(){
  const {data,error}=await supabase.from('drawing_register_v').select('*').order('created_at',{ascending:false});
  if(error) throw error;
  state.rows=data||[];
  renderDashboard(); renderRegister();
}

function renderDashboard(){
  $('statTotal').textContent=state.rows.length;
  $('statActive').textContent=state.rows.filter(r=>r.status==='active').length;
  $('statDisciplines').textContent=new Set(state.rows.map(r=>r.discipline_code).filter(Boolean)).size;
  $('statTypes').textContent=new Set(state.rows.map(r=>r.document_type_code).filter(Boolean)).size;
  const rows=state.rows.slice(0,8);
  $('recentBody').innerHTML=rows.length?rows.map(r=>`<tr><td class="doc-number">${esc(r.document_number)}</td><td class="title-cell">${esc(r.title)}</td><td>${esc(r.discipline_code)}</td><td>${esc(r.stage_code||'—')}</td><td>${esc(r.latest_revision||'—')}</td></tr>`).join(''):`<tr><td colspan="5" class="muted">No drawings yet. Create the first drawing from “New Drawing”.</td></tr>`;
}

function filteredRows(){
  const q=$('searchInput').value.trim().toLowerCase(), d=$('disciplineFilter').value, t=$('typeFilter').value;
  return state.rows.filter(r=>(!q||`${r.document_number} ${r.title}`.toLowerCase().includes(q))&&(!d||r.discipline_code===d)&&(!t||r.document_type_code===t));
}
function renderRegister(){
  const rows=filteredRows(); $('registerEmpty').classList.toggle('hidden',rows.length>0);
  $('registerBody').innerHTML=rows.map(r=>`<tr><td class="doc-number">${esc(r.document_number)}</td><td class="title-cell" title="${esc(r.title)}">${esc(r.title)}</td><td>${esc(r.document_type_code)}</td><td>${esc(r.discipline_code)}</td><td>${esc(r.type_level_code)}</td><td>${esc(r.stage_code||'—')}</td><td>${esc(r.latest_revision||'—')}</td><td><span class="badge">${esc(r.status)}</span></td></tr>`).join('');
}

function navigate(name){
  document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden')); $(`${name}Page`).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page===name));
  $('pageTitle').textContent=pages[name][0]; $('pageSubtitle').textContent=pages[name][1];
}

function updatePreview(){
  const ids=['portfolio','campus','dataCenter','projectContract','organization','documentType','discipline','drawingType','level'];
  const vals=ids.map(id=>$(id).value);
  $('numberPreview').textContent=vals.every(Boolean)?`${vals[0]}-${vals[1]}-${vals[2]}-${vals[3]}-${vals[4]}-${vals[5]}-${vals[6]}-${vals[7]}${vals[8]}-XXXXXX`:'Complete the fields to preview the number';
}

async function createDrawing(e){
  e.preventDefault(); const btn=$('createDrawingBtn'); btn.disabled=true; btn.textContent='Generating…';
  const p={p_title:$('title').value,p_portfolio:$('portfolio').value,p_campus:$('campus').value,p_data_center:$('dataCenter').value,p_project_contract:$('projectContract').value,p_organization:$('organization').value,p_document_type:$('documentType').value,p_discipline:$('discipline').value,p_drawing_type:$('drawingType').value,p_level:$('level').value,p_stage:$('stage').value||null,p_comments:$('comments').value||null};
  try{
    const {data,error}=await supabase.rpc('create_drawing',p); if(error) throw error;
    const row=Array.isArray(data)?data[0]:data; toast(`Created: ${row.document_number}`); e.target.reset(); if(state.lookups.portfolios.some(x=>x.code==='SAAD')) $('portfolio').value='SAAD'; updatePreview(); await loadRegister(); navigate('register');
  }catch(err){toast(err.message||'Could not create drawing',true);}finally{btn.disabled=false;btn.textContent='Generate & Save Drawing Number';}
}

function exportCsv(){
  const rows=filteredRows(); if(!rows.length) return toast('No rows to export',true);
  const cols=['document_number','title','document_type_code','discipline_code','drawing_type_code','level_code','type_level_code','stage_code','serial_number','latest_revision','latest_filename','status','created_at','updated_at'];
  const quote=v=>`"${String(v??'').replaceAll('"','""')}"`; const csv='\uFEFF'+[cols.join(','),...rows.map(r=>cols.map(c=>quote(r[c])).join(','))].join('\r\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download=`drawing-register-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
}

async function enterApp(session){
  state.user=session.user; $('authView').classList.add('hidden'); $('appView').classList.remove('hidden'); $('userEmail').textContent=session.user.email||'';
  try{await Promise.all([loadLookups(),loadRegister()]);}catch(err){toast(err.message,true);}
}
function leaveApp(){state.user=null;state.rows=[];$('appView').classList.add('hidden');$('authView').classList.remove('hidden');}

$('authForm').addEventListener('submit',async e=>{e.preventDefault();const {data,error}=await supabase.auth.signInWithPassword({email:$('email').value,password:$('password').value});if(error)return toast(error.message,true);if(data.session)enterApp(data.session);});
$('signUpBtn').addEventListener('click',async()=>{
  const email=$('email').value,password=$('password').value;
  if(!email||!password)return toast('Enter email and password first',true);
  const redirectUrl=new URL('.',window.location.href).href;
  const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:redirectUrl}});
  if(error)return toast(error.message,true);
  toast(data.session?'Account created':'Account created. Check your email to confirm your account.');
});
$('logoutBtn').addEventListener('click',async()=>{await supabase.auth.signOut();leaveApp();});
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.go)));
$('quickNewBtn').addEventListener('click',()=>navigate('new'));
$('newDrawingForm').addEventListener('submit',createDrawing);
$('newDrawingForm').addEventListener('change',updatePreview);
$('newDrawingForm').addEventListener('reset',()=>setTimeout(updatePreview));
['searchInput','disciplineFilter','typeFilter'].forEach(id=>$(id).addEventListener(id==='searchInput'?'input':'change',renderRegister));
$('exportCsvBtn').addEventListener('click',exportCsv);

const {data:{session}}=await supabase.auth.getSession(); if(session) await enterApp(session); else leaveApp();
supabase.auth.onAuthStateChange((_event,session)=>{if(!session)leaveApp();});
