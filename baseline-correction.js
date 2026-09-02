import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.DLM_CONFIG;
if (cfg && !window.__DLM_BASELINE_CORRECTION__) {
  window.__DLM_BASELINE_CORRECTION__ = true;
  const supabase = createClient(cfg.url, cfg.key);
  const $ = id => document.getElementById(id);
  let role = 'viewer';

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast = (m, e=false) => {
    const t = $('toast');
    if (!t) return;
    t.textContent = m;
    t.className = `toast show ${e ? 'error' : 'success'}`;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.className = 'toast', 4500);
  };

  function selectedRows() {
    return [...document.querySelectorAll('#tg2Body tr[data-id]')]
      .filter(tr => tr.querySelector('.tg2-select')?.checked)
      .map(tr => ({
        id: tr.dataset.id,
        document: tr.querySelector('.tg2-doc strong')?.textContent?.trim() || tr.dataset.id,
        baseline: tr.children[3]?.textContent?.trim() || '—'
      }));
  }

  function hasStagedPlanningEdits() {
    return Boolean(document.querySelector('#tg2Body tr.dirty'));
  }

  function addStyles() {
    if ($('baselineCorrectionStyles')) return;
    const s = document.createElement('style');
    s.id = 'baselineCorrectionStyles';
    s.textContent = `
      .bc-modal .modal-card{max-width:720px}
      .bc-warning{padding:10px 12px;border:1px solid #f0d8a6;background:#fff8e9;border-radius:9px;font-size:12px;line-height:1.45}
      .bc-summary{padding:10px 12px;border:1px solid #e3e8ef;background:#f8fafc;border-radius:9px}
      .bc-list{max-height:180px;overflow:auto;margin-top:8px;border-top:1px solid #e8edf3}
      .bc-row{display:grid;grid-template-columns:1fr 110px;gap:10px;padding:7px 0;border-bottom:1px solid #eef2f6;font-size:11px}
      .bc-row strong{overflow-wrap:anywhere}.bc-old{text-align:right;color:#69768a}
      .bc-form{display:grid;grid-template-columns:1fr 1fr;gap:12px}.bc-form .wide{grid-column:1/-1}
      .bc-check{display:flex;align-items:flex-start;gap:8px}.bc-check input{width:16px;height:16px;margin-top:2px}
      @media(max-width:700px){.bc-form{grid-template-columns:1fr}.bc-form .wide{grid-column:auto}}
    `;
    document.head.appendChild(s);
  }

  function ensureModal() {
    if ($('baselineCorrectionModal')) return;
    const m = document.createElement('div');
    m.id = 'baselineCorrectionModal';
    m.className = 'modal hidden bc-modal';
    m.innerHTML = `
      <div class="modal-card">
        <div class="modal-head">
          <div><h3>Correct Baseline Date</h3><p class="muted tiny">Admin-only correction of an incorrectly entered original baseline. This is not a reschedule.</p></div>
          <button id="bcClose" class="icon-btn" type="button">×</button>
        </div>
        <form id="bcForm" class="modal-body bc-form">
          <div class="bc-warning wide"><strong>Controlled correction:</strong> the original and corrected dates, reason, user and time are retained in baseline history and the audit log.</div>
          <div class="bc-summary wide"><strong id="bcCount">0</strong> selected deliverables<div id="bcSelectedList" class="bc-list"></div></div>
          <label>New Baseline Date<input id="bcDate" type="date" required></label>
          <label class="wide">Correction Reason<textarea id="bcReason" rows="3" required placeholder="e.g. Initial baseline entered incorrectly during setup"></textarea></label>
          <label class="bc-check wide"><input id="bcSyncCurrent" type="checkbox" checked><span><strong>Keep initial plan aligned where safe</strong><br><span class="tiny muted">If Current Due still equals the old Baseline and there is no reschedule history, update Current Due to the corrected Baseline too. Otherwise Current Due is preserved.</span></span></label>
          <div class="form-actions wide"><button id="bcSubmit" class="btn primary" type="submit">Apply Baseline Correction</button><button id="bcCancel" class="btn secondary" type="button">Cancel</button></div>
        </form>
      </div>`;
    document.body.appendChild(m);
    const close = () => m.classList.add('hidden');
    $('bcClose').onclick = close;
    $('bcCancel').onclick = close;
    m.addEventListener('click', e => { if (e.target === m) close(); });
    $('bcForm').onsubmit = submitCorrection;
  }

  function openModal() {
    if (role !== 'admin') return toast('Admin role required to correct baseline dates.', true);
    if (hasStagedPlanningEdits()) return toast('Apply or discard staged Schedule edits before correcting the Baseline.', true);
    const rows = selectedRows();
    if (!rows.length) return toast('Select one or more Schedule rows first.', true);
    ensureModal();
    $('bcCount').textContent = rows.length;
    $('bcSelectedList').innerHTML = rows.slice(0, 30).map(r => `<div class="bc-row"><strong>${esc(r.document)}</strong><span class="bc-old">Baseline ${esc(r.baseline)}</span></div>`).join('') + (rows.length > 30 ? `<div class="tiny muted" style="padding:8px 0">+ ${rows.length - 30} more selected</div>` : '');
    $('bcDate').value = '';
    $('bcReason').value = '';
    $('bcSyncCurrent').checked = true;
    $('baselineCorrectionModal').classList.remove('hidden');
    requestAnimationFrame(() => $('bcDate')?.focus());
  }

  async function submitCorrection(e) {
    e.preventDefault();
    if (hasStagedPlanningEdits()) return toast('Apply or discard staged Schedule edits first.', true);
    const rows = selectedRows();
    if (!rows.length) return toast('The row selection is empty. Select the rows again.', true);
    const date = $('bcDate').value;
    const reason = $('bcReason').value.trim();
    if (!date) return toast('New Baseline Date is required.', true);
    if (!reason) return toast('Correction Reason is required.', true);

    const btn = $('bcSubmit');
    btn.disabled = true;
    btn.textContent = 'Applying…';
    const { data, error } = await supabase.rpc('correct_information_delivery_baseline', {
      p_deliverable_ids: rows.map(r => r.id),
      p_new_baseline_date: date,
      p_reason: reason,
      p_sync_current_due_if_unchanged: $('bcSyncCurrent').checked
    });
    btn.disabled = false;
    btn.textContent = 'Apply Baseline Correction';
    if (error) return toast(error.message || 'Could not correct baseline dates.', true);

    $('baselineCorrectionModal').classList.add('hidden');
    const r = data || {};
    toast(`${r.corrected || 0} baseline${Number(r.corrected) === 1 ? '' : 's'} corrected${r.current_due_synced ? ` · ${r.current_due_synced} Current Due synced` : ''}${r.unchanged ? ` · ${r.unchanged} unchanged` : ''}`);
    $('tg2Refresh')?.click();
    window.dispatchEvent(new CustomEvent('dlm:planning-changed', { detail: { source: 'baseline-correction' } }));
  }

  function mountButton() {
    if (role !== 'admin') return true;
    if ($('bcOpen')) return true;
    const summary = document.querySelector('#planGridEditorV2 .tg2-summary');
    if (!summary) return false;
    const b = document.createElement('button');
    b.id = 'bcOpen';
    b.className = 'btn secondary';
    b.type = 'button';
    b.textContent = 'Correct Baseline';
    b.title = 'Admin-only controlled correction of the original Baseline Date';
    b.onclick = openModal;
    const anchor = $('tg2ClearSelection');
    if (anchor?.parentElement === summary) anchor.after(b); else summary.appendChild(b);
    return true;
  }

  async function init() {
    addStyles();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data, error } = await supabase.rpc('current_user_role');
    if (error) throw error;
    role = data || 'viewer';
    if (role !== 'admin') return;
    ensureModal();
    for (let i = 0; i < 40; i++) {
      if (mountButton()) return;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  setTimeout(() => init().catch(e => console.error('Baseline correction module:', e)), 250);
}
