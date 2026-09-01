import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cfg=window.DLM_CONFIG;
if(cfg){
  const supabase=createClient(cfg.url,cfg.key);
  supabase.auth.onAuthStateChange((event,session)=>{
    if(event!=='SIGNED_IN'||!session?.user?.id)return;
    const key=`dlm-planning-session-${session.user.id}`;
    if(sessionStorage.getItem(key))return;
    sessionStorage.setItem(key,'1');
    setTimeout(()=>location.reload(),50);
  });
}
