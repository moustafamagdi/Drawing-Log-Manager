import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg=window.DLM_CONFIG;
if(cfg){
  const supabase=createClient(cfg.url,cfg.key);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const roleOptions=['viewer','editor','document_controller','admin'];

  function notify(message,error=false){
    const el=document.getElementById('toast');
    if(!el)return;
    el.textContent=message;
    el.className=`toast show ${error?'error':'success'}`;
    setTimeout(()=>el.className='toast',3000);
  }

  async function renderUsers(){
    const mount=document.getElementById('adminUserMount');
    if(!mount)return;
    const {data,error}=await supabase.rpc('admin_list_users');
    if(error){mount.innerHTML=`<div class="empty">${esc(error.message)}</div>`;return;}
    const rows=data||[];
    mount.innerHTML=`
      <div class="panel settings-card admin-only" style="grid-column:1/-1">
        <div class="section-title"><h3>User Access</h3><p class="muted">New users start as Viewer. Assign higher access only when required.</p></div>
        <div class="table-wrap"><table><thead><tr><th>Email</th><th>Role</th><th>Created</th><th>Last Sign-in</th><th></th></tr></thead><tbody>
        ${rows.map(u=>`<tr><td>${esc(u.email||u.user_id)}</td><td><select class="user-role-select" data-id="${u.user_id}">${roleOptions.map(r=>`<option value="${r}" ${r===u.role?'selected':''}>${r}</option>`).join('')}</select></td><td>${u.created_at?new Date(u.created_at).toLocaleString():'—'}</td><td>${u.last_sign_in_at?new Date(u.last_sign_in_at).toLocaleString():'—'}</td><td><button class="btn secondary save-user-role" data-id="${u.user_id}">Save</button></td></tr>`).join('')}
        </tbody></table></div>
      </div>`;
    mount.querySelectorAll('.save-user-role').forEach(btn=>btn.addEventListener('click',async()=>{
      const select=mount.querySelector(`.user-role-select[data-id="${btn.dataset.id}"]`);
      btn.disabled=true;
      const {error}=await supabase.rpc('admin_set_user_role',{p_user_id:btn.dataset.id,p_role:select.value});
      btn.disabled=false;
      if(error)return notify(error.message,true);
      notify('User role updated');
      await renderUsers();
    }));
  }

  async function init(){
    const settings=document.getElementById('settingsPage');
    if(!settings)return;
    let mount=document.getElementById('adminUserMount');
    if(!mount){mount=document.createElement('div');mount.id='adminUserMount';mount.style.display='contents';settings.querySelector('.settings-grid')?.appendChild(mount);}
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){mount.innerHTML='';return;}
    const {data:role}=await supabase.rpc('current_user_role');
    if(role!=='admin'){mount.innerHTML='';return;}
    await renderUsers();
  }

  init();
  supabase.auth.onAuthStateChange(()=>setTimeout(init,100));
}
