import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);
let mode='login';

function toast(message,error=false){const el=$('toast');if(!el)return;el.textContent=message;el.className=`toast show ${error?'error':'success'}`;clearTimeout(toast.t);toast.t=setTimeout(()=>el.className='toast',4000)}
function siteUrl(){return new URL('.',window.location.href).href}
function injectStyles(){
  if(document.getElementById('authEnhancementStyles'))return;
  const s=document.createElement('style');s.id='authEnhancementStyles';s.textContent=`
    .auth-card{width:min(460px,100%)}.auth-tabs{display:grid;grid-template-columns:1fr 1fr;background:#f2f5f9;padding:4px;border-radius:10px;margin:22px 0 6px}.auth-tab{border:0;background:transparent;border-radius:8px;padding:9px;cursor:pointer;font-weight:700;color:#697589}.auth-tab.active{background:#fff;color:#172033;box-shadow:0 1px 5px rgba(20,35,60,.1)}.password-wrap{position:relative}.password-wrap input{padding-right:62px}.password-toggle{position:absolute;right:8px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:#1769e0;font-size:12px;font-weight:750;cursor:pointer;padding:6px}.auth-divider{display:flex;align-items:center;gap:10px;color:#8a94a4;font-size:11px;margin:2px 0}.auth-divider:before,.auth-divider:after{content:'';height:1px;background:#e1e6ef;flex:1}.google-btn{display:flex;align-items:center;justify-content:center;gap:10px}.google-g{font-weight:900;font-size:17px;color:#4285f4}.auth-switch{text-align:center;margin:3px 0 0}.auth-error{min-height:17px;color:#a52b35;font-size:12px}.field-hint{font-size:11px;color:#788396;font-weight:500}.auth-card .stack{margin-top:14px}.auth-card h1{margin-bottom:4px}`;document.head.appendChild(s);
}
function injectUi(){
  const form=$('authForm');if(!form||$('authTitle'))return;
  const card=form.closest('.auth-card');
  const oldHeading=card.querySelector('h1');const oldIntro=oldHeading?.nextElementSibling;
  if(oldHeading)oldHeading.id='productTitle';
  if(oldIntro)oldIntro.classList.add('product-intro');
  const tabs=document.createElement('div');tabs.className='auth-tabs';tabs.innerHTML='<button id="loginTab" class="auth-tab active" type="button">Sign in</button><button id="signupTab" class="auth-tab" type="button">Sign up</button>';form.before(tabs);
  form.innerHTML=`
    <div><h2 id="authTitle" style="margin:0 0 4px">Welcome back</h2><p id="authSubtitle" class="muted" style="margin:0">Sign in to continue to the Drawing Log Manager.</p></div>
    <label>Email<input id="email" type="email" autocomplete="email" required /></label>
    <label>Password<div class="password-wrap"><input id="password" type="password" autocomplete="current-password" minlength="8" required /><button id="showPasswordBtn" class="password-toggle" type="button" aria-label="Show password">Show</button></div><span id="passwordHint" class="field-hint"></span></label>
    <label id="confirmPasswordLabel" class="hidden">Confirm Password<div class="password-wrap"><input id="confirmPassword" type="password" autocomplete="new-password" minlength="8" /><button id="showConfirmPasswordBtn" class="password-toggle" type="button" aria-label="Show password">Show</button></div><span id="confirmPasswordHint" class="field-hint"></span></label>
    <div id="authError" class="auth-error"></div>
    <button id="authSubmitBtn" class="btn primary" type="submit">Sign in</button>
    <button id="signUpBtn" class="hidden" type="button" aria-hidden="true"></button>
    <div class="auth-divider"><span>OR</span></div>
    <button id="googleAuthBtn" class="btn secondary google-btn" type="button"><span class="google-g">G</span><span>Continue with Google</span></button>
    <p class="auth-switch tiny muted"><span id="authModeHint">New to Drawing Log Manager?</span> <button id="authModeToggle" class="link-btn" type="button">Create account</button></p>`;
}
function setMode(next){
  mode=next;const signup=mode==='signup';
  $('authTitle').textContent=signup?'Create your account':'Welcome back';
  $('authSubtitle').textContent=signup?'Create an account to access the Drawing Log Manager.':'Sign in to continue to the Drawing Log Manager.';
  $('confirmPasswordLabel').classList.toggle('hidden',!signup);$('confirmPassword').required=signup;
  $('password').autocomplete=signup?'new-password':'current-password';$('authSubmitBtn').textContent=signup?'Create account':'Sign in';
  $('authModeHint').textContent=signup?'Already have an account?':'New to Drawing Log Manager?';$('authModeToggle').textContent=signup?'Sign in':'Create account';
  $('loginTab').classList.toggle('active',!signup);$('signupTab').classList.toggle('active',signup);$('authError').textContent='';$('passwordHint').textContent='';$('confirmPasswordHint').textContent='';
}
function togglePassword(inputId,button){const input=$(inputId);const show=input.type==='password';input.type=show?'text':'password';button.textContent=show?'Hide':'Show';button.setAttribute('aria-label',show?'Hide password':'Show password')}
function passwordMessage(password){return password.length<8?'Password must be at least 8 characters.':''}

injectStyles();injectUi();
const form=$('authForm');
form.addEventListener('submit',async e=>{
  if(mode!=='signup')return;
  e.preventDefault();e.stopImmediatePropagation();
  const email=$('email').value.trim(),password=$('password').value,confirm=$('confirmPassword').value;$('authError').textContent='';
  const pmsg=passwordMessage(password);if(pmsg){$('authError').textContent=pmsg;return toast(pmsg,true)}
  if(password!==confirm){const m='Passwords do not match.';$('authError').textContent=m;return toast(m,true)}
  const btn=$('authSubmitBtn');btn.disabled=true;btn.textContent='Creating account…';
  try{const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:siteUrl()}});if(error)throw error;if(data.session){toast('Account created successfully.');location.reload()}else{toast('Account created. Check your email to confirm your account.');setMode('login')}}catch(err){$('authError').textContent=err.message||'Could not create account.';toast(err.message||'Could not create account.',true)}finally{btn.disabled=false;btn.textContent=mode==='signup'?'Create account':'Sign in'}
},true);
$('authModeToggle').addEventListener('click',()=>setMode(mode==='login'?'signup':'login'));$('loginTab').addEventListener('click',()=>setMode('login'));$('signupTab').addEventListener('click',()=>setMode('signup'));
$('showPasswordBtn').addEventListener('click',()=>togglePassword('password',$('showPasswordBtn')));$('showConfirmPasswordBtn').addEventListener('click',()=>togglePassword('confirmPassword',$('showConfirmPasswordBtn')));
$('password').addEventListener('input',()=>{if(mode==='signup')$('passwordHint').textContent=passwordMessage($('password').value)||'Password length is OK.';else $('passwordHint').textContent=''});
$('confirmPassword').addEventListener('input',()=>{$('confirmPasswordHint').textContent=$('confirmPassword').value&&$('confirmPassword').value!==$('password').value?'Passwords do not match.':''});
$('googleAuthBtn').addEventListener('click',async()=>{const btn=$('googleAuthBtn');btn.disabled=true;try{const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:siteUrl()}});if(error)throw error}catch(err){toast(err.message||'Google sign-in is not enabled yet.',true);btn.disabled=false}});
setMode('login');
