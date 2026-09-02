export const SUPABASE_URL = 'https://ehdtyvqlapfldwfomsca.supabase.co';
// Publishable browser key only. Never replace this with a secret/service-role key.
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fOMBfK2pUZduDFUsJhx1nw_W5IZEB3b';

window.DLM_CONFIG={url:SUPABASE_URL,key:SUPABASE_PUBLISHABLE_KEY};

try{
  const projectRef=new URL(SUPABASE_URL).hostname.split('.')[0];
  const authKey=`sb-${projectRef}-auth-token`;
  const temp=sessionStorage.getItem('dlm-temp-auth-session');
  if(sessionStorage.getItem('dlm-remember-me')==='false'&&temp&&!localStorage.getItem(authKey))localStorage.setItem(authKey,temp);
}catch{}

// Must load before enhancement modules: blocks duplicate document-level listeners
// that were being registered repeatedly by legacy polling code.
await import('./stability-guard.js').catch(()=>{});

import('./auth-enhancements.js').catch(()=>{});
import('./remember-me.js').catch(()=>{});
import('./legacy.js').catch(()=>{});
import('./bulk-import.js').catch(()=>{});
import('./historical-revisions.js').catch(()=>{});
import('./admin-drawing-controls.js').catch(()=>{});
import('./advanced-suite.js').catch(()=>{});
import('./recovery-controls.js').catch(()=>{});
import('./planning.js').catch(()=>{});
import('./planning-session.js').catch(()=>{});
import('./planning-pro.js').catch(()=>{});
import('./production-finish.js').catch(()=>{});
import('./stage-numbering-ui.js').catch(()=>{});
import('./dashboard-polish.js').catch(()=>{});
import('./bulk-tidp-assign.js').catch(()=>{});
import('./tidp-csv-roundtrip.js').catch(()=>{});
// Disabled pending rewrite: this observer-heavy polish layer duplicated detail-page
// database work and could amplify UI stalls. Core revision history remains in app.js.
// import('./workflow-revision-polish.js').catch(()=>{});
