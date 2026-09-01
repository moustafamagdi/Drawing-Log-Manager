import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cfg=window.DLM_CONFIG;
if(cfg){
  const supabase=createClient(cfg.url,cfg.key),$=id=>document.getElementById(id);
  let isAdmin=false,last='';
  const toast=(m,e=false)=>{const t=$('toast');if(!t)return;t.textContent=m;t.className=`toast show ${e?'error':'success'}`;clearTimeout(toast.t);toast.t=setTimeout(()=>t.className='toast',4000)};
  async function init(){const {data:{session}}=await supabase.auth.getSession();if(!session)return;const {data}=await supabase.rpc('current_user_role');isAdmin=data==='admin';if(!isAdmin)return;ensureButton();setInterval(ensureButton,700)}
  function ensureButton(){const actions=document.querySelector('#detailsPage .detail-actions');if(!actions||$('moveRecycleBtn'))return;const b=document.createElement('button');b.id='moveRecycleBtn';b.className='btn secondary admin-only';b.textContent='Move to Recycle Bin';b.onclick=moveToRecycle;actions.appendChild(b)}
  async function moveToRecycle(){const number=$('detailNumber')?.textContent?.trim();if(!number)return;const {data,error}=await supabase.from('drawing_register_v').select('id,title').eq('document_number',number).maybeSingle();if(error||!data)return toast(error?.message||'Drawing not found',true);const reason=prompt(`Move ${number} to Recycle Bin?\n\nReason (optional):`,'Created/entered in error');if(reason===null)return;if(!confirm('The drawing will disappear from the active register, but an Admin can restore it later. Continue?'))return;const b=$('moveRecycleBtn');b.disabled=true;b.textContent='Moving…';const {error:delErr}=await supabase.rpc('admin_soft_delete_drawing',{p_drawing_id:data.id,p_reason:reason||null});b.disabled=false;b.textContent='Move to Recycle Bin';if(delErr)return toast(delErr.message,true);toast('Drawing moved to Recycle Bin');$('backToRegister')?.click();setTimeout(()=>location.reload(),500)}
  setTimeout(()=>init().catch(()=>{}),350);
}
