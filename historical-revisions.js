import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg=window.DLM_CONFIG;
if(cfg){
  const supabase=createClient(cfg.url,cfg.key);
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const headers=['document_number','revision','extension','stage','issue_status','review_status','reason_for_issue','revision_description','is_formal','issued_at'];
  let role='viewer',rows=[],validation=[],stages=[],statuses=[],drawings=new Map(),existing=new Set();
  const canImport=()=>['document_controller','admin'].includes(role);
  const q=v=>`"${String(v??'').replaceAll('"','""')}"`;
  function notify(m,e=false){const el=$('toast');if(!el)return;el.textContent=m;el.className=`toast show ${e?'error':'success'}`;setTimeout(()=>el.className='toast',4000)}
  function download(name,text){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/csv;charset=utf-8'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
  function parseCsv(text){text=text.replace(/^\uFEFF/,'');const out=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const ch=text[i];if(quoted){if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(ch==='"')quoted=false;else cell+=ch;}else{if(ch==='"')quoted=true;else if(ch===','){row.push(cell);cell='';}else if(ch==='\n'){row.push(cell);out.push(row);row=[];cell='';}else if(ch!=='\r')cell+=ch;}}if(cell.length||row.length){row.push(cell);out.push(row);}return out.filter(r=>r.some(x=>String(x).trim()!==''));}
  function csvToObjects(text){const p=parseCsv(text);if(!p.length)throw new Error('CSV file is empty.');const hs=p[0].map(x=>x.trim().toLowerCase());const missing=headers.filter(h=>!hs.includes(h));if(missing.length)throw new Error(`Missing columns: ${missing.join(', ')}`);return p.slice(1).map((r,i)=>{const o={};hs.forEach((h,j)=>o[h]=(r[j]??'').trim());o.__row=i+2;return o;});}
  function boolVal(v){const s=String(v??'').trim().toLowerCase();if(['true','1','yes','y','formal'].includes(s))return true;if(['false','0','no','n','draft'].includes(s))return false;return null;}
  function validRevision(v){return /^(?:[A-Z]|[0-9]{2}|[0-9]{2}\.[0-9]+)$/.test(String(v||'').toUpperCase())}
  function validDate(v){if(!v)return true;return !Number.isNaN(Date.parse(v))}
  async function refreshReference(){
    const [dr,rv,st,ds]=await Promise.all([
      supabase.from('drawing_register_v').select('id,document_number,title'),
      supabase.from('drawing_revisions').select('drawing_id,revision,file_extension'),
      supabase.from('stages').select('code,is_active'),
      supabase.from('document_statuses').select('code,is_active')
    ]);for(const r of [dr,rv,st,ds])if(r.error)throw r.error;
    drawings=new Map((dr.data||[]).map(x=>[String(x.document_number).toUpperCase(),x]));
    const idToDoc=new Map((dr.data||[]).map(x=>[x.id,String(x.document_number).toUpperCase()]));
    existing=new Set((rv.data||[]).map(x=>`${idToDoc.get(x.drawing_id)||x.drawing_id}|${String(x.revision).toUpperCase()}|${String(x.file_extension).toUpperCase()}`));
    stages=(st.data||[]).filter(x=>x.is_active).map(x=>x.code);statuses=(ds.data||[]).filter(x=>x.is_active).map(x=>x.code);
  }
  async function validateRows(){
    await refreshReference();const seen=new Set();
    validation=rows.map(r=>{const issues=[];const doc=String(r.document_number||'').toUpperCase(),rev=String(r.revision||'').toUpperCase(),ext=String(r.extension||'').toUpperCase(),stage=String(r.stage||'').toUpperCase(),issue=String(r.issue_status||'').toUpperCase(),review=String(r.review_status||'').toUpperCase();
      if(!doc)issues.push('document_number is required');else if(!drawings.has(doc))issues.push('Drawing not found in register');
      if(!rev)issues.push('revision is required');else if(!validRevision(rev))issues.push('Invalid revision format');
      if(!ext)issues.push('extension is required');else if(!['PDF','DWG','RVT','NWC','NWD','IFC','AVI'].includes(ext))issues.push('Unsupported extension');
      if(stage&&!stages.includes(stage))issues.push(`Unknown/inactive stage: ${stage}`);if(issue&&!statuses.includes(issue))issues.push(`Unknown issue status: ${issue}`);if(review&&!statuses.includes(review))issues.push(`Unknown review status: ${review}`);
      if(boolVal(r.is_formal)===null)issues.push('is_formal must be true/false');if(!validDate(r.issued_at))issues.push('issued_at is not a valid date/time');
      const key=`${doc}|${rev}|${ext}`;if(existing.has(key))issues.push('Revision/extension already exists');if(seen.has(key))issues.push('Duplicate revision row inside CSV');seen.add(key);
      return{...r,document_number:doc,revision:rev,extension:ext,stage,issue_status:issue,review_status:review,__issues:issues,__valid:issues.length===0};
    });render();
  }
  function render(){const good=validation.filter(x=>x.__valid).length,bad=validation.length-good;$('revBulkSummary').innerHTML=`<strong>${validation.length}</strong> rows · <strong>${good}</strong> valid · <strong>${bad}</strong> with errors`;$('revBulkImport').disabled=!good;$('revBulkBody').innerHTML=validation.map(r=>`<tr><td>${r.__row}</td><td class="doc-number">${esc(r.document_number)}</td><td>${esc(r.revision)}</td><td>${esc(r.extension)}</td><td>${esc(r.stage||'—')}</td><td>${r.__valid?'<span class="badge active">Valid</span>':`<span class="badge cancelled">Error</span><div class="tiny muted">${esc(r.__issues.join('; '))}</div>`}</td></tr>`).join('');}
  function template(){const sample=['SAAD-000-D00-000-HUN-DWG-ME-201-000125','00','PDF','5A','FI','','First issue','Historical IFC issue','true','2026-01-15T10:00:00+03:00'];download('drawing-log-historical-revisions-template.csv',[headers.join(','),sample.map(q).join(',')].join('\r\n'))}
  async function exportRevisions(){await refreshReference();const {data,error}=await supabase.from('drawing_revisions').select('drawing_id,revision,file_extension,stage_code,issue_status_code,review_status_code,reason_for_issue,revision_description,is_formal_issue,created_at').order('sequence_no',{ascending:true});if(error)throw error;const idToDoc=new Map([...drawings.values()].map(x=>[x.id,x.document_number]));const body=(data||[]).map(r=>[idToDoc.get(r.drawing_id)||'',r.revision,r.file_extension,r.stage_code||'',r.issue_status_code||'',r.review_status_code||'',r.reason_for_issue||'',r.revision_description||'',r.is_formal_issue,r.created_at||''].map(q).join(','));download(`drawing-revisions-import-schema-${new Date().toISOString().slice(0,10)}.csv`,[headers.join(','),...body].join('\r\n'))}
  async function importValid(){const valid=validation.filter(x=>x.__valid);if(!valid.length)return;const btn=$('revBulkImport');btn.disabled=true;let ok=0,fail=0;for(let i=0;i<valid.length;i++){const r=valid[i];btn.textContent=`Importing ${i+1}/${valid.length}…`;const {error}=await supabase.rpc('import_existing_revision',{p_document_number:r.document_number,p_revision:r.revision,p_extension:r.extension,p_stage:r.stage||null,p_issue_status_code:r.issue_status||null,p_review_status_code:r.review_status||null,p_reason_for_issue:r.reason_for_issue||null,p_revision_description:r.revision_description||null,p_is_formal:boolVal(r.is_formal),p_created_at:r.issued_at||null});if(error){fail++;r.__valid=false;r.__issues=[error.message];}else ok++;}btn.textContent='Import Valid Revisions';notify(`${ok} revisions imported${fail?`, ${fail} failed`:''}`,!!fail);await validateRows();}
  function inject(){if($('historicalRevisionPanel'))return true;const page=$('legacyPage');if(!page)return false;const panel=document.createElement('div');panel.id='historicalRevisionPanel';panel.className='panel section-gap';panel.innerHTML=`<div class="panel-head"><div><h3>Historical Revision CSV</h3><p class="muted">Import old revision history after the drawings exist in the register. Exact historical revision values and issue dates are preserved.</p></div><div class="form-actions"><button id="revTemplate" class="btn secondary" type="button">Download Revision Template</button><button id="revExport" class="btn secondary" type="button">Export Revisions</button></div></div><div class="toolbar"><input id="revCsvFile" type="file" accept=".csv,text/csv" /><button id="revBulkValidate" class="btn primary" type="button" disabled>Validate Revisions</button><button id="revBulkImport" class="btn primary" type="button" disabled>Import Valid Revisions</button></div><div id="revBulkSummary" class="muted small-text">Choose a revision CSV file to begin.</div><div class="table-wrap section-gap"><table><thead><tr><th>Row</th><th>Document Number</th><th>Revision</th><th>Extension</th><th>Stage</th><th>Validation</th></tr></thead><tbody id="revBulkBody"></tbody></table></div>`;page.appendChild(panel);$('revTemplate').addEventListener('click',template);$('revExport').addEventListener('click',()=>exportRevisions().catch(e=>notify(e.message,true)));$('revCsvFile').addEventListener('change',async e=>{validation=[];$('revBulkBody').innerHTML='';const f=e.target.files?.[0];if(!f){$('revBulkValidate').disabled=true;return}try{rows=csvToObjects(await f.text());$('revBulkValidate').disabled=false;$('revBulkSummary').textContent=`${rows.length} revision rows loaded. Click Validate Revisions.`}catch(err){notify(err.message,true);$('revBulkValidate').disabled=true}});$('revBulkValidate').addEventListener('click',()=>validateRows().catch(e=>notify(e.message,true)));$('revBulkImport').addEventListener('click',importValid);return true;}
  async function init(){const {data:{session}}=await supabase.auth.getSession();if(!session)return;const {data}=await supabase.rpc('current_user_role');role=data||'viewer';if(!canImport())return;for(let i=0;i<25&&!inject();i++)await new Promise(r=>setTimeout(r,150));}
  setTimeout(()=>init().catch(e=>notify(e.message,true)),250);
}
