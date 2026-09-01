const $=id=>document.getElementById(id);

function clean(v){return String(v||'').trim().toUpperCase()}
function build(vals,serial='XXXXXX'){
  const {portfolio,campus,dataCenter,projectContract,organization,documentType,discipline,stage,drawingType,level}=vals;
  if(![portfolio,campus,dataCenter,projectContract,organization,documentType,discipline,stage,drawingType,level].every(Boolean))return null;
  return `${portfolio}-${campus}-${dataCenter}-${projectContract}-${organization}-${documentType}-${discipline}-${stage}-${drawingType}${level}-${serial}`.toUpperCase();
}
function newDrawingVals(){return{
  portfolio:clean($('portfolio')?.value),campus:clean($('campus')?.value),dataCenter:clean($('dataCenter')?.value),projectContract:clean($('projectContract')?.value),organization:clean($('organization')?.value),documentType:clean($('documentType')?.value),discipline:clean($('discipline')?.value),stage:clean($('stage')?.value),drawingType:clean($('drawingType')?.value),level:clean($('level')?.value)
}}
function syncNewPreview(){
  const preview=$('numberPreview');if(!preview)return;
  const n=build(newDrawingVals());
  preview.textContent=n||'Complete the fields, including Stage, to preview the number';
}
function adminVals(){return{
  portfolio:clean($('adePortfolio')?.value),campus:clean($('adeCampus')?.value),dataCenter:clean($('adeDataCenter')?.value),projectContract:clean($('adeProject')?.value),organization:clean($('adeOrganization')?.value),documentType:clean($('adeDocumentType')?.value),discipline:clean($('adeDiscipline')?.value),stage:clean($('adeStage')?.value),drawingType:clean($('adeDrawingType')?.value),level:clean($('adeLevel')?.value)
}}
function syncAdminNumber(){
  const input=$('adeDocumentNumber'),auto=$('adeAutoNumber');if(!input||!auto?.checked)return;
  const serial=Number($('adeSerial')?.value||0);const n=build(adminVals(),serial>0?String(serial).padStart(6,'0'):'XXXXXX');if(n)input.value=n;
}
function patchStaticUi(){
  const stage=$('stage');if(stage){stage.required=true;const first=stage.options?.[0];if(first&&first.value==='')first.textContent='Select stage…';}
  const stageLabel=stage?.closest('label');if(stageLabel&&stageLabel.firstChild?.nodeType===3)stageLabel.firstChild.textContent='Stage ';
  const note=document.querySelector('.rule-note p');if(note)note.textContent='Portfolio-Campus-Data Center-Project-Organization-Document Type-Discipline-Stage-Type+Level-Serial';
  const stageNote=[...document.querySelectorAll('.rule-note p')].find(p=>/Stage is metadata/i.test(p.textContent));if(stageNote)stageNote.textContent='Stage is a controlled part of the drawing number (for example 5B = Construction).';
  const detailNote=[...document.querySelectorAll('#detailsPage .tiny.muted')].find(p=>/stage-only update/i.test(p.textContent));if(detailNote)detailNote.textContent='Changing Stage does not increment the revision, but it updates the controlled drawing number because Stage is part of the identifier.';
}
function patchFilenamePreview(){
  const p=$('filenamePreview');if(!p)return;
  if(p.textContent.includes('SAAD-PL1-DC1A-101-JLL-SDW-ME-2L1-000001'))p.textContent=p.textContent.replace('SAAD-PL1-DC1A-101-JLL-SDW-ME-2L1-000001','SAAD-PL1-DC1A-101-JLL-SDW-ME-5B-2L1-000001');
}
function wire(){
  patchStaticUi();syncNewPreview();patchFilenamePreview();
  ['portfolio','campus','dataCenter','projectContract','organization','documentType','discipline','stage','drawingType','level'].forEach(id=>{const el=$(id);if(!el||el.dataset.stageNumberWired)return;el.dataset.stageNumberWired='1';el.addEventListener('input',()=>queueMicrotask(syncNewPreview));el.addEventListener('change',()=>queueMicrotask(syncNewPreview));});
  const adminForm=$('adminDrawingEditForm');if(adminForm&&!adminForm.dataset.stageNumberWired){adminForm.dataset.stageNumberWired='1';['adePortfolio','adeCampus','adeDataCenter','adeProject','adeOrganization','adeDocumentType','adeDiscipline','adeStage','adeDrawingType','adeLevel','adeSerial','adeAutoNumber'].forEach(id=>{const el=$(id);if(el){el.addEventListener('input',()=>queueMicrotask(syncAdminNumber));el.addEventListener('change',()=>queueMicrotask(syncAdminNumber));}});adminForm.addEventListener('submit',syncAdminNumber,true);}
  const filename=$('filenameTemplate');if(filename&&!filename.dataset.stageNumberWired){filename.dataset.stageNumberWired='1';filename.addEventListener('input',()=>queueMicrotask(patchFilenamePreview));}
}

wire();
let attempts=0;const t=setInterval(()=>{wire();if(++attempts>30)clearInterval(t)},300);
