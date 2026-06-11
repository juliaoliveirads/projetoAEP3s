/* ================================================================
   Re-Habita Maringá — comunidade.js
   Formulário público em 3 etapas
   ================================================================ */

let stepAtual = 1;
const TOTAL   = 3;
const customItens = [];
let _enviando = false;
let _ultimaChaveEnviada = '';

const ITENS = [
  { valor:'Cesta básica',       svg:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>' },
  { valor:'Leite',              svg:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M7 7l-2 13h14L17 7"/></svg>' },
  { valor:'Fralda',             svg:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2z"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/></svg>' },
  { valor:'Alimentos gerais',   svg:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>' },
  { valor:'Higiene pessoal',    svg:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>' },
  { valor:'Roupas',             svg:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>' },
  { valor:'Remédios',           svg:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7 7-7z"/></svg>' },
  { valor:'Fraldas geriátricas',svg:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>' },
  { valor:'Material escolar',   svg:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>' },
  { valor:'Gás de cozinha',     svg:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>' },
];


function renderItens() {
  document.getElementById('itens-grid').innerHTML = ITENS.map(it => `
    <label class="item-card" onclick="toggleItem(event, this)">
      <input type="checkbox" class="c-item" value="${it.valor}"/>
      ${it.svg}
      <span>${it.valor}</span>
    </label>`).join('');
}

function toggleItem(event, card){
  event.preventDefault();   
  card.classList.toggle('checked');
  card.querySelector('input').checked = card.classList.contains('checked');
  document.getElementById('itens-erro').classList.remove('show');
}

// Autocomplete
function acCom(inputId, dropId) {
  const val = document.getElementById(inputId).value.toLowerCase().trim();
  const dd  = document.getElementById(dropId);
  if (!val) { dd.classList.remove('open'); return; }
  const m = BAIRROS_MARINGA.filter(b => b.toLowerCase().includes(val)).slice(0, 12);
  if (!m.length) { dd.classList.remove('open'); return; }
  dd.innerHTML = m.map(b =>
    `<div class="ac-c-item" onmousedown="event.preventDefault();acSelCom('${inputId}','${dropId}','${b.replace(/'/g,"\\'")}');">${b}</div>`
  ).join('');
  dd.classList.add('open');
}
function acSelCom(inputId, dropId, val) {
  document.getElementById(inputId).value = val;
  document.getElementById(dropId).classList.remove('open');
  limparErro('bairro');
}

// Itens custom
function addItemCustom() {
  const inp = document.getElementById('item-custom-inp');
  const v = inp.value.trim(); if (!v) return;
  customItens.push(v); renderPills(); inp.value = '';
  document.getElementById('itens-erro').classList.remove('show');
}
function removeItemCustom(i) { customItens.splice(i,1); renderPills(); }
function renderPills() {
  document.getElementById('custom-pills').innerHTML = customItens.map((t,i)=>
    `<div class="cpill">${t}<button type="button" onclick="removeItemCustom(${i})">×</button></div>`).join('');
}
document.getElementById('item-custom-inp').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); addItemCustom(); }
});

// Validação
function limparErro(campo) {
  const row = document.querySelector(`.f-row[data-campo="${campo}"]`);
  const err = document.getElementById('err-' + campo);
  if (row) row.classList.remove('invalid');
  if (err) err.classList.remove('show');
}
function validarCampo(campo, regra, msg) {
  const inp = document.getElementById('c-' + campo);
  const err = document.getElementById('err-' + campo);
  const row = document.querySelector(`.f-row[data-campo="${campo}"]`);
  const val = inp ? inp.value : '';
  const ok  = regra(val);
  if (row) row.classList.toggle('invalid', !ok);
  if (err) { err.textContent = msg; err.classList.toggle('show', !ok); }
  return ok;
}
function validarStep(step) {
  let ok = true;
  if (step === 1) {
    ok = validarCampo('nome',    v=>v.trim().length>=3,              'Informe o nome completo.') & ok;
    ok = validarCampo('bairro',  v=>v.trim().length>=2,              'Selecione ou digite o bairro.') & ok;
    ok = validarCampo('rua',    v=>v.trim().length>=3,  'Informe a rua.')    & ok;
    ok = validarCampo('numero', v=>v.trim().length>=1,  'Informe o número.') & ok;
    ok = validarCampo('pessoas', v=>parseInt(v)>=1,                  'Informe o número de moradores.') & ok;
    ok = validarCampo('tel',     v=>v.replace(/\D/g,'').length>=10,  'Informe um telefone válido (com DDD).') & ok;
  }
  if (step === 2) {
    const total = [...document.querySelectorAll('.c-item:checked')].length + customItens.length;
    if (!total) { document.getElementById('itens-erro').classList.add('show'); ok = false; }
  }
  return !!ok;
}

function atualizarProgress() {
  document.querySelectorAll('.step-dot').forEach((d, i) => {
    d.classList.toggle('done',   i + 1 < stepAtual);
    d.classList.toggle('active', i + 1 === stepAtual);
  });
  document.getElementById('progress-label').textContent = `Etapa ${stepAtual} de ${TOTAL}`;
}

function irStep(dest) {
  if (dest > stepAtual && !validarStep(stepAtual)) return;
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById('step-' + dest).classList.add('active');
  stepAtual = dest;
  atualizarProgress();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx-6KFEAUfDQ3wJxNsnou30g_LvVvi0m0CYoQg9vFM3jvLmGB5AYugP9cy4oOfU8Oyw/exec';

function salvarPendente(p) {
  let arr = [];
  try { arr = JSON.parse(sessionStorage.getItem('rh_pendentes') || '[]'); } catch(e) {}
  arr.unshift(p);
  sessionStorage.setItem('rh_pendentes', JSON.stringify(arr));

  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p)
  }).catch(err => console.warn('Falha ao enviar para Sheets:', err));
}

function enviar() {
  if (!validarStep(2)) return;
  if (_enviando) return;
  const g = id => (document.getElementById('c-' + id)||{}).value||'';
  const itens = [...[...document.querySelectorAll('.c-item:checked')].map(c=>c.value), ...customItens];
  const dataHoje = new Date().toISOString().split('T')[0];
  const nome = g('nome'), tel = g('tel');
  const chave = nome.trim().toLowerCase() + '|' + tel.replace(/\D/g,'') + '|' + dataHoje;
  if (chave === _ultimaChaveEnviada) {
    console.warn('[comunidade] Solicitação duplicada bloqueada no cliente.');
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.querySelector('.progress-wrap').style.display = 'none';
    document.getElementById('success-wrap').classList.add('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  _enviando = true;
  _ultimaChaveEnviada = chave;
  const rua = g('rua'), numero = g('numero'), complemento = g('complemento'), cep = g('cep'), bairro = g('bairro');
  const p = {
    acao: 'solicitacao',
    nome, bairro,
    rua, numero, complemento, cep,
    endereco: [rua, numero ? 'n\u00ba '+numero : '', complemento, bairro].filter(Boolean).join(', '),
    pessoas: parseInt(g('pessoas'))||1, tel, itens,
    obs: g('obs'), data: dataHoje,
  };
  salvarPendente(p);
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.querySelector('.progress-wrap').style.display = 'none';
  document.getElementById('success-wrap').classList.add('show');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => { _enviando = false; }, 5000);
}

function novaSolicitacao() {
  document.querySelectorAll('#c-nome,#c-bairro,#c-end,#c-tel,#c-pessoas,#c-obs').forEach(el=>el.value='');
  document.querySelectorAll('.c-item').forEach(c=>c.checked=false);
  document.querySelectorAll('.item-card').forEach(c=>c.classList.remove('checked'));
  document.querySelectorAll('.f-row').forEach(r=>r.classList.remove('invalid'));
  document.querySelectorAll('.f-err').forEach(e=>e.classList.remove('show'));
  document.getElementById('itens-erro').classList.remove('show');
  customItens.length=0; renderPills();
  stepAtual=1;
  document.getElementById('success-wrap').classList.remove('show');
  document.querySelector('.progress-wrap').style.display='block';
  document.querySelectorAll('.step').forEach(s=>s.classList.remove('active'));
  document.getElementById('step-1').classList.add('active');
  atualizarProgress();
  window.scrollTo({ top:0, behavior:'smooth' });
}

renderItens();
atualizarProgress();
