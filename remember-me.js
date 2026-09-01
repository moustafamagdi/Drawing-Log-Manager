import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg=window.DLM_CONFIG;
if(cfg){
  const projectRef=new URL(cfg.url).hostname.split('.')[0];
  const authKey=`sb-${projectRef}-auth-token`;
  const tempKey='dlm-temp-auth-session';
  const rememberFlag='dlm-remember-me';
  const supabase=createClient(cfg.url,cfg.key);
  const $=id=>document.getElementById(id);
  let timer=null;

  function syncTemporarySession(){
    if(sessionStorage.getItem(rememberFlag)!=='false')return;
    const value=localStorage.getItem(authKey);
    if(value){sessionStorage.setItem(tempKey,value);localStorage.removeItem(authKey);}
  }
  function inject(){
    if($('rememberMe'))return true;
    const forgot=$('forgotRow');if(!forgot)return false;
    const wrap=document.createElement('label');wrap.id='rememberMeWrap';wrap.className='inline-check tiny muted';wrap.style.cssText='justify-content:flex-start;margin-top:-5px;';wrap.innerHTML='<input id="rememberMe" type="checkbox" checked /> Remember me on this device';forgot.after(wrap);
    const saved=sessionStorage.getItem(rememberFlag);$('rememberMe').checked=saved!=='false';
    $('rememberMe').addEventListener('change',()=>{sessionStorage.setItem(rememberFlag,$('rememberMe').checked?'true':'false');if($('rememberMe').checked){const temp=sessionStorage.getItem(tempKey);if(temp)localStorage.setItem(authKey,temp);sessionStorage.removeItem(tempKey);}else syncTemporarySession();});
    const form=$('authForm');form?.addEventListener('submit',()=>{const signup=!$('confirmPasswordLabel')?.classList.contains('hidden');if(signup)return;sessionStorage.setItem(rememberFlag,$('rememberMe').checked?'true':'false');},true);
    return true;
  }
  async function init(){for(let i=0;i<30&&!inject();i++)await new Promise(r=>setTimeout(r,100));const {data:{session}}=await supabase.auth.getSession();if(session&&sessionStorage.getItem(rememberFlag)==='false')syncTemporarySession();}
  supabase.auth.onAuthStateChange((event,session)=>{if(!session)return;if(sessionStorage.getItem(rememberFlag)==='false')setTimeout(syncTemporarySession,0);});
  timer=setInterval(syncTemporarySession,500);
  window.addEventListener('pagehide',syncTemporarySession);
  window.addEventListener('beforeunload',syncTemporarySession);
  setTimeout(()=>init(),0);
}
