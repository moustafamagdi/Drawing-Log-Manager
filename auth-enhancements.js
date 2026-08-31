import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);
let mode='login';

function toast(message,error=false){const el=$('toast');if(!el)return;el.textContent=message;el.className=`toast show ${error?'error':'success'}`;clearTimeout(toast.t);toast.t=setTimeout(()=>el.className='toast',4000)}
function siteUrl(){return new URL('.',window.location.href).href}
function setMode(next){
  mode=next;
  const signup=mode==='signup';
  $('authTitle').textContent=signup?'Create your account':'Welcome back';
  $('authSubtitle').textContent=signup?'Create an account to access the Drawing Log Manager.':'Sign in to continue to the Drawing Log Manager.';
  $('confirmPasswordLabel').classList.toggle('hidden',!signup);
  $('confirmPassword').required=signup;
  $('password').autocomplete=signup?'new-password':'current-password';
  $('authSubmitBtn').textContent=signup?'Create account':'Sign in';
  $('authModeHint').textContent=signup?'Already have an account?':'New to Drawing Log Manager?';
  $('authModeToggle').textContent=signup?'Sign in':'Create account';
  $('loginTab').classList.toggle('active',!signup);
  $('signupTab').classList.toggle('active',signup);
  $('signUpBtn').classList.add('hidden');
  $('authError').textContent='';
}
function togglePassword(inputId,button){
  const input=$(inputId);const show=input.type==='password';input.type=show?'text':'password';button.textContent=show?'Hide':'Show';button.setAttribute('aria-label',show?'Hide password':'Show password');
}
function passwordMessage(password){
  if(password.length<8)return 'Password must be at least 8 characters.';
  return '';
}

const form=$('authForm');
form.addEventListener('submit',async e=>{
  if(mode!=='signup')return;
  e.preventDefault();e.stopImmediatePropagation();
  const email=$('email').value.trim();const password=$('password').value;const confirm=$('confirmPassword').value;
  $('authError').textContent='';
  const pmsg=passwordMessage(password);if(pmsg){$('authError').textContent=pmsg;return toast(pmsg,true)}
  if(password!==confirm){const m='Passwords do not match.';$('authError').textContent=m;return toast(m,true)}
  const btn=$('authSubmitBtn');btn.disabled=true;btn.textContent='Creating account…';
  try{
    const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:siteUrl()}});if(error)throw error;
    if(data.session){toast('Account created successfully.');location.reload();}
    else{toast('Account created. Check your email to confirm your account.');setMode('login');}
  }catch(err){$('authError').textContent=err.message||'Could not create account.';toast(err.message||'Could not create account.',true)}finally{btn.disabled=false;btn.textContent=mode==='signup'?'Create account':'Sign in'}
},true);

$('authModeToggle').addEventListener('click',()=>setMode(mode==='login'?'signup':'login'));
$('loginTab').addEventListener('click',()=>setMode('login'));
$('signupTab').addEventListener('click',()=>setMode('signup'));
$('showPasswordBtn').addEventListener('click',()=>togglePassword('password',$('showPasswordBtn')));
$('showConfirmPasswordBtn').addEventListener('click',()=>togglePassword('confirmPassword',$('showConfirmPasswordBtn')));
$('password').addEventListener('input',()=>{if(mode==='signup')$('passwordHint').textContent=passwordMessage($('password').value)||'Password strength looks acceptable.';else $('passwordHint').textContent=''});
$('confirmPassword').addEventListener('input',()=>{$('confirmPasswordHint').textContent=$('confirmPassword').value&&$('confirmPassword').value!==$('password').value?'Passwords do not match.':''});

$('googleAuthBtn').addEventListener('click',async()=>{
  $('googleAuthBtn').disabled=true;
  try{
    const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:siteUrl()}});if(error)throw error;
  }catch(err){toast(err.message||'Google sign-in is not enabled yet.',true);$('googleAuthBtn').disabled=false;}
});

setMode('login');
