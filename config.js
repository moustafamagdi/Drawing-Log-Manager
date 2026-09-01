export const SUPABASE_URL = 'https://ehdtyvqlapfldwfomsca.supabase.co';
// Publishable browser key only. Never replace this with a secret/service-role key.
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fOMBfK2pUZduDFUsJhx1nw_W5IZEB3b';

window.DLM_CONFIG={url:SUPABASE_URL,key:SUPABASE_PUBLISHABLE_KEY};

// Restore a temporary (session-only) Supabase session just long enough for the
// app client to initialize. remember-me.js moves it back out of localStorage.
try{
  const projectRef=new URL(SUPABASE_URL).hostname.split('.')[0];
  const authKey=`sb-${projectRef}-auth-token`;
  const temp=sessionStorage.getItem('dlm-temp-auth-session');
  if(sessionStorage.getItem('dlm-remember-me')==='false'&&temp&&!localStorage.getItem(authKey))localStorage.setItem(authKey,temp);
}catch{}

import('./auth-enhancements.js').catch(()=>{});
import('./remember-me.js').catch(()=>{});
import('./legacy.js').catch(()=>{});
import('./bulk-import.js').catch(()=>{});
import('./historical-revisions.js').catch(()=>{});
import('./admin-drawing-controls.js').catch(()=>{});
