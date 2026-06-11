/* ================================================================
   Re-Habita Maringá — painel.js
   ================================================================ */

function formatDate(v){if(!v)return'—';var m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[3]+'/'+m[2]+'/'+m[1]:String(v);}

let tentativas = 0, bloqueadoAte = null;
let mapInit = false, leafletMap = null, membrosCount = 0;
const customTagsCad = [];
let _editandoFamiliaId = null;

// Credenciais fixas como fallback (caso Sheets falhe)
const CREDENCIAIS_FALLBACK = [
  { user: 'lider', pass: '1234' },
];

let _credenciaisCache = null;

async function carregarCredenciais() {
  if (_credenciaisCache) return _credenciaisCache;
  try {
    var res  = await fetch(SCRIPT_URL + '?acao=credenciais&t=' + Date.now());
    var json = await res.json();
    if (json.ok && json.credenciais && json.credenciais.length > 0) {
      _credenciaisCache = json.credenciais;
      return _credenciaisCache;
    }
  } catch(e) { console.warn('[Credenciais] Falha ao carregar do Sheets:', e); }
  return CREDENCIAIS_FALLBACK;
}

// ── LOGIN ─────────────────────────────────────────────────────
async function tentarLogin() {
  var user  = (document.getElementById('login-user') || {}).value || '';
  var pass  = (document.getElementById('login-pass') || {}).value || '';
  var errEl = document.getElementById('login-err');
  var blqEl = document.getElementById('login-block');

  if (bloqueadoAte && new Date() < bloqueadoAte) {
    var s = Math.ceil((bloqueadoAte - new Date()) / 1000);
    blqEl.style.display = 'block';
    blqEl.textContent = 'Acesso bloqueado. Aguarde ' + s + 's.';
    return;
  }

  errEl.textContent = 'Verificando...';
  var credenciais = await carregarCredenciais();
  var credEncontrada = credenciais.find(function(c){ return c.user === user.trim() && c.pass === pass; });
  var ok = !!credEncontrada;

  if (ok) {
    tentativas = 0; bloqueadoAte = null;
    errEl.textContent = ''; blqEl.style.display = 'none';
    sessionStorage.setItem('rh_auth', '1');
    sessionStorage.setItem('rh_user', user.trim());
    var nomeInst = credEncontrada.instituicao || 'Re-Habita';
    sessionStorage.setItem('rh_instituicao', nomeInst);
    var topbar = document.getElementById('topbar-user');
    if (topbar) topbar.textContent = nomeInst;
    document.getElementById('login-screen').style.display  = 'none';
    document.getElementById('painel-screen').style.display = 'flex';
    inicializarDados().then(async function() {
    await sanearCoordenadas();
    carregarPendentesExtras();
    renderDashboard();
    showTab('tab-dashboard');
    //iniciarPolling();
    });
  } else {
    errEl.textContent = '';
    tentativas++;
    if (tentativas >= 5) {
      bloqueadoAte = new Date(Date.now() + 60000);
      tentativas = 0;
      blqEl.style.display = 'block';
      blqEl.textContent = 'Muitas tentativas incorretas. Bloqueado por 60 segundos.';
      errEl.textContent = '';
    } else {
      errEl.textContent = 'Usuário ou senha incorretos. (' + (5 - tentativas) + ' tentativa' + (5 - tentativas > 1 ? 's' : '') + ' restante' + (5 - tentativas > 1 ? 's' : '') + ')';
    }
  }
}

function fazerLogout() {
  pararPolling(); 
  sessionStorage.removeItem('rh_auth');
  sessionStorage.removeItem('rh_instituicao');
  document.getElementById('painel-screen').style.display = 'none';
  document.getElementById('login-screen').style.display  = 'flex';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-err').textContent = '';
  document.getElementById('login-block').style.display = 'none';
}

// ── ATUALIZAÇÃO EM TEMPO REAL ─────────────────────────────────
let _rhPollTimer = null;

async function recarregarDados(silencioso) {
  const ok = await carregarDoSheets();   // relê a planilha (já tem cache-busting)
  if (!ok) { if (!silencioso) showToast('Sem conexão com a planilha', 'err'); return; }

  carregarPendentesExtras();             // mantém pendentes do sessionStorage
  await sanearCoordenadas();   // corrige lat/lng inválidos antes de desenhar o mapa
  renderDashboard();

  // re-renderiza só a aba que está aberta
  const abas = {
    'tab-familias':  renderFamilias,
    'tab-pendentes': renderPendentes,
    'tab-alertas':   renderAlertas,
  };
  for (const id in abas) {
    const el = document.getElementById(id);
    if (el && el.style.display !== 'none') abas[id]();
  }
  const mapaEl = document.getElementById('tab-mapa');
  if (mapaEl && mapaEl.style.display !== 'none') { mapInit = false; initMapa(); }

  if (!silencioso) showToast('Dados atualizados');
}

function iniciarPolling() {
  pararPolling();
  // relê a planilha a cada 30 segundos (ajuste se quiser)
  _rhPollTimer = setInterval(() => recarregarDados(true), 30000);
}
function pararPolling() {
  if (_rhPollTimer) { clearInterval(_rhPollTimer); _rhPollTimer = null; }
}

// ── CEP ───────────────────────────────────────────────────────
function mascaraCep(input) {
  let v = input.value.replace(/\D/g, '').substring(0, 8);
  if (v.length > 5) v = v.substring(0, 5) + '-' + v.substring(5);
  input.value = v;
}

async function buscarCep() {
  const cep = (document.getElementById('cad-cep').value || '').replace(/\D/g, '');
  if (cep.length !== 8) return;
  try {
    const res  = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const json = await res.json();
    if (json.erro) { showToast('CEP não encontrado.', 'err'); return; }
    if (json.logradouro) document.getElementById('cad-rua').value    = json.logradouro;
    if (json.bairro)     document.getElementById('cad-bairro').value = json.bairro;
    document.getElementById('cad-numero').focus();
  } catch(e) {
    showToast('Erro ao buscar CEP. Preencha manualmente.', 'err');
  }
}

async function geocodificarEndereco(rua, numero, bairro, cidade = 'Maringá', estado = 'PR') {
  const query = encodeURIComponent(`${rua}, ${numero}, ${bairro}, ${cidade}, ${estado}, Brasil`);
  try {
    const res  = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
      headers: { 'Accept-Language': 'pt-BR' }
    });
    const json = await res.json();
    if (json.length > 0) return { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) };
  } catch(e) {}
  // fallback: coordenada aleatória em Maringá
  return {
    lat: -23.4205 + (Math.random() - 0.5) * 0.08,
    lng: -51.9335 + (Math.random() - 0.5) * 0.08
  };
}

// ── TABS ──────────────────────────────────────────────────────
const TAB_IDS = ['tab-dashboard','tab-familias','tab-cadastrar','tab-pendentes','tab-alertas','tab-mapa'];

function showTab(id) {
  TAB_IDS.forEach(t => document.getElementById(t).style.display = 'none');
  document.getElementById(id).style.display = 'block';
  document.querySelectorAll('.nav-tab').forEach((t, i) =>
    t.classList.toggle('active', TAB_IDS[i] === id)
  );
  if (id === 'tab-familias')  renderFamilias();
  if (id === 'tab-pendentes') renderPendentes();
  if (id === 'tab-alertas')   renderAlertas();
  if (id === 'tab-mapa')      initMapa();
}

// ── DASHBOARD ─────────────────────────────────────────────────
function renderDashboard() {
  const total   = inst.familias.length;
  const pend    = inst.pendentes.length;
  const alrts   = inst.alertas().length;
  const atcao   = inst.atencao().length;

  document.getElementById('badge-familias').textContent  = total;
  document.getElementById('badge-pendentes').textContent = pend;
  document.getElementById('badge-alertas').textContent   = alrts;

  document.getElementById('metrics-grid').innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Famílias cadastradas</div>
      <div class="metric-value">${total}</div>
      <div class="metric-sub">no sistema</div>
    </div>
    <div class="metric-card warn">
      <div class="metric-label">Solicitações pendentes</div>
      <div class="metric-value">${pend}</div>
      <div class="metric-sub">aguardam visita</div>
    </div>
    <div class="metric-card alert">
      <div class="metric-label">Alertas urgentes</div>
      <div class="metric-value">${alrts}</div>
      <div class="metric-sub">+30 dias sem receber</div>
    </div>
    <div class="metric-card info">
      <div class="metric-label">Atenção</div>
      <div class="metric-value">${atcao}</div>
      <div class="metric-sub">+15 dias sem receber</div>
    </div>`;

  const top5 = inst.filaOrdenada().slice(0, 5);
  document.getElementById('priority-table').innerHTML = `
    <table><thead><tr>
      <th>#</th><th>Família</th><th>Bairro</th><th>Urgência</th><th>Última doação</th><th>Ação</th>
    </tr></thead><tbody>
    ${top5.map((f, i) => `<tr>
      <td style="font-weight:700;color:var(--green)">${i + 1}</td>
      <td style="font-weight:500">${f.responsavel}</td>
      <td><span class="tag">${f.bairro}</span></td>
      <td>${urgBadge(f.urgencia)}</td>
      <td>${diasLabel(f.diasSemDoacao())}</td>
      <td><button class="btn-tbl primary" onclick="abrirFicha(${f.id})">Ver ficha</button></td>
    </tr>`).join('')}
    </tbody></table>`;
}

// ── FAMÍLIAS ──────────────────────────────────────────────────
function renderFamilias() {
  const busca   = (document.getElementById('f-busca')   || {}).value || '';
  const fStatus = (document.getElementById('f-status')  || {}).value || '';
  const fBairro = (document.getElementById('f-bairro-f')|| {}).value || '';

  const sel = document.getElementById('f-bairro-f');
  if (sel && sel.options.length <= 1) {
    [...new Set(inst.familias.map(f => f.bairro))].sort().forEach(b => {
      const o = document.createElement('option'); o.value = b; o.textContent = b;
      sel.appendChild(o);
    });
  }

  const lista = inst.filaOrdenada().filter(f => {
    const okB = !busca   || f.responsavel.toLowerCase().includes(busca.toLowerCase()) || f.bairro.toLowerCase().includes(busca.toLowerCase());
    const okS = !fStatus || f.status  === fStatus;
    const okBr= !fBairro || f.bairro  === fBairro;
    return okB && okS && okBr;
  });

  const STATUS_OPTS  = ['Ativo','Em acompanhamento','Novo','Inativo'];
  const URG_OPTS     = ['Baixa — acompanhamento periódico','Média — necessidade regular','Alta — situação crítica','Emergência — necessidade imediata'];
  const FREQ_OPTS    = ['Semanal','Quinzenal','Mensal','Bimestral','Conforme necessidade'];

  document.getElementById('familias-table').innerHTML = `
    <table><thead><tr>
      <th>Família</th><th>Bairro</th><th>Pessoas</th>
      <th>Status</th><th>Urgência</th><th>Frequência</th>
      <th>Última doação</th><th>Ações</th>
    </tr></thead><tbody>
    ${lista.map(f => `<tr>
      <td style="font-weight:500;white-space:nowrap">${f.responsavel}</td>
      <td><span class="tag">${f.bairro}</span></td>
      <td style="text-align:center">${f.pessoas}</td>
      <td>
        <select class="inline-select" onchange="alterarCampo(${f.id},'status',this.value)">
          ${STATUS_OPTS.map(s => `<option ${f.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td>
        <select class="inline-select" onchange="alterarCampo(${f.id},'urgencia',this.value)">
          ${URG_OPTS.map(u => `<option ${f.urgencia===u?'selected':''}>${u}</option>`).join('')}
        </select>
      </td>
      <td>
        <select class="inline-select" onchange="alterarCampo(${f.id},'freq',this.value)">
          ${FREQ_OPTS.map(fr => `<option ${f.freq===fr?'selected':''}>${fr}</option>`).join('')}
        </select>
      </td>
      <td>${diasLabel(f.diasSemDoacao())}</td>
      <td class="td-actions">
        <button class="btn-tbl primary" onclick="abrirFicha(${f.id})">Ficha</button>
        <button class="btn-tbl" onclick="darBaixaRapido(${f.id})">Dar baixa</button>
      </td>
    </tr>`).join('')}
    ${!lista.length ? '<tr><td colspan="8" class="empty">Nenhuma família encontrada.</td></tr>' : ''}
    </tbody></table>`;
}

function alterarCampo(id, campo, valor) {
  const f = inst.familias.find(x => x.id === id);
  if (!f) return;
  f[campo] = valor;
  inst.atualizarFila();
  renderDashboard();
  showToast(`${campo === 'status' ? 'Status' : campo === 'urgencia' ? 'Urgência' : 'Frequência'} atualizado`);
  if (typeof salvarFamiliaSheets !== 'undefined') { const fx = inst.familias.find(x=>x.id===id); if(fx) salvarFamiliaSheets(fx); }
}

function darBaixaRapido(id) {
  const f = inst.familias.find(x => x.id === id);
  if (!f) return;
  f.addDoacao(f.itens[0] || 'Cesta básica', 1);
  inst.atualizarFila();
  renderFamilias(); renderDashboard();
  showToast(`Doação registrada para ${f.responsavel}`);
}

// ── DETALHES PENDENTE ────────────────────────────────────────
function abrirDetalhesPendente(i) {
const p = inst.pendentes[i];
if (!p) return;
document.getElementById('modal-nome-familia').textContent = p.nome + ' — Solicitação Pendente';

let endHtml = '';
if (p.rua) endHtml += '<div class="ficha-row"><span class="ficha-label">Rua</span><span class="ficha-value">' + p.rua + '</span></div>';
if (p.numero) endHtml += '<div class="ficha-row"><span class="ficha-label">Número</span><span class="ficha-value">' + p.numero + '</span></div>';
if (p.complemento) endHtml += '<div class="ficha-row"><span class="ficha-label">Complemento</span><span class="ficha-value">' + p.complemento + '</span></div>';
if (p.bairro) endHtml += '<div class="ficha-row"><span class="ficha-label">Bairro</span><span class="ficha-value">' + (p.bairro||'—') + '</span></div>';
if (p.cep) endHtml += '<div class="ficha-row"><span class="ficha-label">CEP</span><span class="ficha-value">' + p.cep + '</span></div>';
// fallback para registros antigos sem campos separados
if (!p.rua && !p.numero && p.endereco) {
  endHtml = '<div class="ficha-row"><span class="ficha-label">Bairro</span><span class="ficha-value">' + (p.bairro||'—') + '</span></div>'
           + '<div class="ficha-row"><span class="ficha-label">Endereço</span><span class="ficha-value">' + p.endereco + '</span></div>';
}

document.getElementById('modal-content').innerHTML =
'<div class="ficha-section">' +
'<h4>Dados pessoais</h4>' +
'<div class="ficha-row"><span class="ficha-label">Nome</span><span class="ficha-value">' + p.nome + '</span></div>' +
'<div class="ficha-row"><span class="ficha-label">Telefone</span><span class="ficha-value">' + (p.tel||'—') + '</span></div>' +
'<div class="ficha-row"><span class="ficha-label">Data</span><span class="ficha-value">' + (formatDate(p.data)||'—') + '</span></div>' +
(p.pessoas ? '<div class="ficha-row"><span class="ficha-label">Pessoas na casa</span><span class="ficha-value">' + p.pessoas + '</span></div>' : '') +
'</div>' +
'<div class="ficha-section">' +
'<h4>Endereço</h4>' +
endHtml +
'</div>' +
'<div class="ficha-section">' +
'<h4>Itens solicitados</h4>' +
'<div>' + (p.itens||[]).map(function(it){ return '<span class="tag">' + it + '</span>'; }).join('') + '</div>' +
'</div>' +
(p.obs ? '<div class="ficha-section"><h4>Observações</h4><p style="font-size:.85rem;color:var(--gray-600);line-height:1.7">' + p.obs + '</p></div>' : '') +
'<div class="ficha-section" style="display:flex;gap:10px;padding-top:8px">' +
'<button onclick="fecharModal();aprovarPendente(' + i + ')" style="flex:1;padding:12px;background:var(--green);color:#fff;border:none;border-radius:8px;font-size:.9rem;font-weight:600;cursor:pointer">Aprovar</button>' +
'<button onclick="fecharModal();rejeitarPendente(' + i + ')" style="flex:1;padding:12px;background:#e74c3c;color:#fff;border:none;border-radius:8px;font-size:.9rem;font-weight:600;cursor:pointer">Recusar</button>' +
'</div>';
document.getElementById('ficha-modal').classList.add('open');
}
// ── PENDENTES ─────────────────────────────────────────────────
function renderPendentes() {
  const el = document.getElementById('pendentes-list');
  if (!inst.pendentes.length) { el.innerHTML = '<div class="empty">Nenhuma solicitação pendente.</div>'; return; }
  el.innerHTML = inst.pendentes.map((p, i) => `
    <div class="pending-card">
      <div>
        <div class="pending-info">${p.nome} — ${p.bairro}</div>
        <div class="pending-sub">
          ${formatDate(p.data)} &nbsp;|&nbsp; ${p.tel}
          ${p.pessoas ? ` &nbsp;|&nbsp; ${p.pessoas} pessoa(s)` : ''}
          &nbsp;|&nbsp; ${p.itens.join(', ')}
          ${p.obs ? ` &nbsp;|&nbsp; ${p.obs}` : ''}
        </div>
      </div>
      <div class="pending-actions">
        <button class="btn-tbl" onclick="abrirDetalhesPendente(${i})">Detalhes</button>
        <button class="btn-tbl primary" onclick="aprovarPendente(${i})">Aprovar</button>
        <button class="btn-tbl danger"  onclick="rejeitarPendente(${i})">Recusar</button>
      </div>
    </div>`).join('');
}

function aprovarPendente(i) {
  const p = inst.pendentes[i];
  inst.aprovarPendente(i);
  if (typeof salvarFamiliaSheets !== 'undefined') { var fAp = inst.familias[inst.familias.length-1]; if(fAp) salvarFamiliaSheets(fAp); }
  if (typeof atualizarPreCadSheets !== 'undefined') atualizarPreCadSheets(p.nome, p.tel, 'Aprovado');
  renderPendentes(); renderDashboard(); mapInit = false;
  showToast(`Família "${p.nome}" cadastrada com sucesso`);
}
function rejeitarPendente(i) {
  if (!confirm('Recusar esta solicitação?')) return;
  inst.pendentes.splice(i, 1);
  renderPendentes(); renderDashboard();
  showToast('Solicitação recusada', 'err');
}

// ── ALERTAS ───────────────────────────────────────────────────
function renderAlertas() {
  const el = document.getElementById('alertas-list');
  const alrts = inst.alertas(), atcao = inst.atencao();
  if (!alrts.length && !atcao.length) { el.innerHTML = '<div class="empty">Nenhum alerta no momento.</div>'; return; }
  el.innerHTML =
    alrts.map(f => `
      <div class="alert-card">
        <div>
          <div class="alert-text"><strong>${f.responsavel}</strong> — ${f.bairro}</div>
          <div class="alert-sub">${f.diasSemDoacao()===999?'Nunca recebeu doação':`Sem receber há ${f.diasSemDoacao()} dias`} &nbsp;|&nbsp; ${f.itens.join(', ')}</div>
        </div>
        <button class="btn-tbl primary" onclick="abrirFicha(${f.id})">Ver ficha</button>
      </div>`).join('') +
    atcao.map(f => `
      <div class="alert-card warn">
        <div>
          <div class="alert-text"><strong>${f.responsavel}</strong> — ${f.bairro}</div>
          <div class="alert-sub">Sem receber há ${f.diasSemDoacao()} dias &nbsp;|&nbsp; ${f.itens.join(', ')}</div>
        </div>
        <button class="btn-tbl" onclick="abrirFicha(${f.id})">Ver ficha</button>
      </div>`).join('');
}

// ── ATUALIZAR DADOS ───────────────────────────────────────────
function abrirAtualizarDados(id) {
  const f = inst.familias.find(x => x.id === id);
  if (!f) return;
  fecharModal();
  _editandoFamiliaId = id;
  showTab('tab-cadastrar');
  setTimeout(function() {
    const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
    const setSel = (elId, val) => {
      const el = document.getElementById(elId);
      if (!el || !val) return;
      for (let i = 0; i < el.options.length; i++) {
        if (el.options[i].value === val || el.options[i].text === val) { el.selectedIndex = i; break; }
      }
    };
    set('cad-nome', f.responsavel);
    set('cad-cpf', f.cpf);
    set('cad-nasc', f.nasc ? (f.nasc.length > 10 ? f.nasc.substring(0,10) : f.nasc) : '');
    set('cad-tel', f.tel);
    set('cad-bairro', f.bairro);
    set('cad-end', f.endereco);
    set('cad-cep', f.cep);
    set('cad-rua', f.rua || f.endereco);
    set('cad-numero', f.numero);
    set('cad-complemento', f.complemento);
    set('cad-pessoas', f.pessoas);
    setSel('cad-moradia', f.moradia);
    setSel('cad-renda', f.renda);
    setSel('cad-escolar', f.escolar);
    setSel('cad-emprego', f.emprego);
    setSel('cad-urgencia', f.urgencia);
    setSel('cad-freq', f.freq);
    set('cad-obs', f.obs);
    set('cad-data-visita', f.dataVisita ? f.dataVisita.substring(0,10) : '');
    set('cad-revisita', f.revisita ? f.revisita.substring(0,10) : '');
    document.querySelectorAll('.cad-item').forEach(cb => cb.checked = false);
    customTagsCad.length = 0;
    const ITENS_PADRAO = ['Cesta básica','Leite','Fralda','Alimentos gerais','Higiene pessoal','Roupas','Remédios','Gás de cozinha'];
    (f.itens || []).forEach(item => {
      const cbEl = document.querySelector('.cad-item[value="' + item + '"]');
      if (cbEl) cbEl.checked = true;
      else if (item && !ITENS_PADRAO.includes(item)) customTagsCad.push(item);
    });
    renderCustomTagsCad();
    document.getElementById('membros-lista').innerHTML = '';
    (f.membros || []).forEach(m => {
      addMembro();
      const rows = document.querySelectorAll('.membro-row');
      const lastRow = rows[rows.length - 1];
      if (lastRow) {
        const inputs = lastRow.querySelectorAll('input, select');
        if (inputs[0]) inputs[0].value = m.nome || '';
        if (inputs[1]) inputs[1].value = m.idade || '';
        if (inputs[2]) { for (let i=0;i<inputs[2].options.length;i++) { if (inputs[2].options[i].value===m.parentesco||inputs[2].options[i].text===m.parentesco) { inputs[2].selectedIndex=i; break; } } }
        if (inputs[3]) { for (let i=0;i<inputs[3].options.length;i++) { if (inputs[3].options[i].value===m.sexo) { inputs[3].selectedIndex=i; break; } } }
      }
    });
    const sectionTitle = document.querySelector('#tab-cadastrar .section-title');
    if (sectionTitle) sectionTitle.textContent = 'Atualizar dados da família — ' + f.responsavel;
    const btnCad = document.querySelector('#tab-cadastrar .btn-cadastrar');
    if (btnCad) { btnCad.textContent = 'Salvar Alterações'; btnCad.setAttribute('onclick', 'salvarAtualizacaoFamilia()'); }
    document.getElementById('tab-cadastrar').scrollTop = 0;
    window.scrollTo(0, 0);
  }, 100);
}

function salvarAtualizacaoFamilia() {
  const id = _editandoFamiliaId;
  if (!id) { cadastrarFamilia(); return; }
  const f = inst.familias.find(x => x.id === id);
  if (!f) { cadastrarFamilia(); return; }
  const g = elId => { const el = document.getElementById(elId); return el ? el.value.trim() : ''; };
  const responsavel = g('cad-nome'), bairro = g('cad-bairro'), endereco = g('cad-end'), pessoas = g('cad-pessoas'), tel = g('cad-tel');
  if (!responsavel || !bairro || !g('cad-rua') || !g('cad-numero') || !pessoas || !tel) {
  alert('Preencha os campos obrigatórios: Nome, Rua, Número, Bairro, Pessoas e Telefone.');
  return;}
  const itens = [...[...document.querySelectorAll('.cad-item:checked')].map(c=>c.value), ...customTagsCad];
  if (!itens.length) { alert('Selecione ao menos um item necessário.'); return; }
  f.responsavel = responsavel; f.cpf = g('cad-cpf'); f.nasc = g('cad-nasc'); f.tel = tel;
  f.bairro = bairro; 
  f.cep         = g('cad-cep');
  f.rua         = g('cad-rua');
  f.numero      = g('cad-numero');
  f.complemento = g('cad-complemento');
  f.endereco    = `${f.rua}, ${f.numero}${f.complemento ? ', ' + f.complemento : ''} — ${f.bairro}`;
  f.pessoas = parseInt(pessoas);
  f.moradia = g('cad-moradia'); f.renda = g('cad-renda'); f.escolar = g('cad-escolar'); f.emprego = g('cad-emprego');
  f.itens = itens; f.urgencia = g('cad-urgencia'); f.freq = g('cad-freq'); f.obs = g('cad-obs');
  f.dataVisita = g('cad-data-visita'); f.revisita = g('cad-revisita'); f.membros = coletarMembros();
  inst.atualizarFila();
  if (typeof salvarFamiliaSheets !== 'undefined') salvarFamiliaSheets(f);
  _editandoFamiliaId = null;
  const sectionTitle = document.querySelector('#tab-cadastrar .section-title');
  if (sectionTitle) sectionTitle.textContent = 'Cadastrar nova família — visita presencial do líder';
  const btnCad = document.querySelector('#tab-cadastrar .btn-cadastrar');
  if (btnCad) { btnCad.textContent = 'Cadastrar Família'; btnCad.setAttribute('onclick', 'cadastrarFamilia()'); }
  document.querySelectorAll('#tab-cadastrar input, #tab-cadastrar select, #tab-cadastrar textarea').forEach(el => el.value = '');
  document.querySelectorAll('.cad-item').forEach(c => c.checked = false);
  customTagsCad.length = 0; renderCustomTagsCad();
  document.getElementById('membros-lista').innerHTML = '';
  renderDashboard();
  showToast('Dados de "' + responsavel + '" atualizados com sucesso!');
  setTimeout(() => showTab('tab-familias'), 400);
}

// ── FICHA ─────────────────────────────────────────────────────
function abrirFicha(id) {
  const f = inst.familias.find(x => x.id === id);
  if (!f) return;
  const STATUS_OPTS = ['Ativo','Em acompanhamento','Novo','Inativo'];
  const URG_OPTS    = ['Baixa — acompanhamento periódico','Média — necessidade regular','Alta — situação crítica','Emergência — necessidade imediata'];
  const FREQ_OPTS   = ['Semanal','Quinzenal','Mensal','Bimestral','Conforme necessidade'];

  document.getElementById('modal-nome-familia').textContent = f.responsavel;
  document.getElementById('modal-content').innerHTML = `
    <div class="ficha-section">
      <h4>Dados pessoais</h4>
      <div class="ficha-row"><span class="ficha-label">Nome</span><span class="ficha-value">${f.responsavel}</span></div>
      ${f.cpf  ? `<div class="ficha-row"><span class="ficha-label">CPF</span><span class="ficha-value">${f.cpf}</span></div>` : ''}
      ${f.nasc ? `<div class="ficha-row"><span class="ficha-label">Nascimento</span><span class="ficha-value">${formatDate(f.nasc)}</span></div>` : ''}
      <div class="ficha-row"><span class="ficha-label">Telefone</span><span class="ficha-value">${f.tel||'—'}</span></div>
      <div class="ficha-row"><span class="ficha-label">Cadastro</span><span class="ficha-value">${formatDate(f.dataCadastro)}</span></div>
    </div>
    <div class="ficha-section">
      <h4>Residência</h4>
      <div class="ficha-row"><span class="ficha-label">Bairro</span><span class="ficha-value">${f.bairro}</span></div>
      ${f.rua ? `<div class="ficha-row"><span class="ficha-label">Rua</span><span class="ficha-value">${f.rua}</span></div>` : `<div class="ficha-row"><span class="ficha-label">Endereço</span><span class="ficha-value">${f.endereco}</span></div>`}
      ${f.numero ? `<div class="ficha-row"><span class="ficha-label">Número</span><span class="ficha-value">${f.numero}</span></div>` : ''}
      ${f.complemento ? `<div class="ficha-row"><span class="ficha-label">Complemento</span><span class="ficha-value">${f.complemento}</span></div>` : ''}
      ${f.cep ? `<div class="ficha-row"><span class="ficha-label">CEP</span><span class="ficha-value">${f.cep}</span></div>` : ''}
      <div class="ficha-row"><span class="ficha-label">Pessoas</span><span class="ficha-value">${f.pessoas}</span></div>
      <div class="ficha-row"><span class="ficha-label">Tipo de moradia</span><span class="ficha-value">${f.moradia||'—'}</span></div>
    </div>
    <div class="ficha-section">
      <h4>Situação socioeconômica</h4>
      <div class="ficha-row"><span class="ficha-label">Renda familiar</span><span class="ficha-value">${f.renda||'—'}</span></div>
      <div class="ficha-row"><span class="ficha-label">Escolaridade</span><span class="ficha-value">${f.escolar||'—'}</span></div>
      <div class="ficha-row"><span class="ficha-label">Emprego</span><span class="ficha-value">${f.emprego||'—'}</span></div>
    </div>
    ${f.membros.length ? `<div class="ficha-section"><h4>Membros (${f.membros.length})</h4>${f.membros.map(m=>`<div class="historico-item"><span>${m.nome} <span style="color:var(--gray-400);font-size:.78rem">${m.parentesco}</span></span><span class="hist-data">${m.idade} anos &nbsp;|&nbsp; ${m.sexo==='F'?'Feminino':'Masculino'}</span></div>`).join('')}</div>` : ''}
    <div class="ficha-section">
      <h4>Atendimento</h4>
      <div class="ficha-row">
        <span class="ficha-label">Status</span>
        <span class="ficha-value">
          <select class="inline-select" onchange="alterarCampo(${f.id},'status',this.value)">
            ${STATUS_OPTS.map(s=>`<option ${f.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </span>
      </div>
      <div class="ficha-row">
        <span class="ficha-label">Urgência</span>
        <span class="ficha-value">
          <select class="inline-select" onchange="alterarCampo(${f.id},'urgencia',this.value)">
            ${URG_OPTS.map(u=>`<option ${f.urgencia===u?'selected':''}>${u}</option>`).join('')}
          </select>
        </span>
      </div>
      <div class="ficha-row">
        <span class="ficha-label">Frequência</span>
        <span class="ficha-value">
          <select class="inline-select" onchange="alterarCampo(${f.id},'freq',this.value)">
            ${FREQ_OPTS.map(fr=>`<option ${f.freq===fr?'selected':''}>${fr}</option>`).join('')}
          </select>
        </span>
      </div>
      ${f.dataVisita?`<div class="ficha-row"><span class="ficha-label">Última visita</span><span class="ficha-value">${formatDate(f.dataVisita)}</span></div>`:''}
      ${f.revisita?`<div class="ficha-row"><span class="ficha-label">Próxima revisita</span><span class="ficha-value">${formatDate(f.revisita)}</span></div>`:''}
    </div>
    <div class="ficha-section">
      <h4>Itens necessários</h4>
      <div>${f.itens.map(it=>`<span class="tag">${it}</span>`).join('')}</div>
    </div>
    ${f.obs?`<div class="ficha-section"><h4>Observações do líder</h4><p style="font-size:.85rem;color:var(--gray-600);line-height:1.7">${f.obs}</p></div>`:''}
    <div class="ficha-section">
      <h4>Registrar entrega</h4>
      <div class="doacao-form">
        <select id="d-item-${id}">
          ${['Cesta básica','Leite','Fralda','Alimentos gerais','Higiene pessoal','Roupas','Remédios','Gás de cozinha','Outros'].map(i=>`<option>${i}</option>`).join('')}
        </select>
        <input type="number" id="d-qtd-${id}" value="1" min="1" max="20"/>
        <button class="btn-registrar" onclick="registrarDoacao(${id})">Registrar</button>
      </div>
    </div>
    <div class="ficha-section">
      <h4>Histórico de doações (${f.historico.length})</h4>
      ${f.historico.length
        ? f.historico.map(h=>`<div class="historico-item"><span>${h.item} <span style="color:var(--gray-400);font-size:.78rem">(${h.qtd}x)</span></span><span class="hist-data">${h.data} &nbsp;|&nbsp; há ${h.diasDesde()} dias</span></div>`).join('')
        : '<p style="color:var(--gray-400);font-size:.83rem">Nenhuma entrega registrada.</p>'}
    </div>
<div class="ficha-section" style="border-top:2px solid var(--green);padding-top:16px;margin-top:8px"><button onclick="abrirAtualizarDados(${id})" style="width:100%;padding:12px 20px;background:var(--green);color:#fff;border:none;border-radius:8px;font-size:.95rem;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:background .2s;" onmouseover="this.style.background='#1a5c48'" onmouseout="this.style.background='var(--green)'">Atualizar Dados</button></div>`;

  document.getElementById('ficha-modal').classList.add('open');
}

function registrarDoacao(id) {
  const f = inst.familias.find(x => x.id === id);
  const item = document.getElementById('d-item-' + id).value;
  const qtd  = parseInt(document.getElementById('d-qtd-'  + id).value) || 1;
  f.addDoacao(item, qtd);
  inst.atualizarFila();
  abrirFicha(id);
  renderDashboard();
  showToast(`Entrega registrada: ${item} (${qtd}x)`);
  if (typeof salvarFamiliaSheets !== 'undefined') { const frd = inst.familias.find(x=>x.id===id); if(frd) salvarFamiliaSheets(frd); }
}

function fecharModal() { document.getElementById('ficha-modal').classList.remove('open'); }
document.getElementById('ficha-modal').addEventListener('click', function(e) { if (e.target === this) fecharModal(); });

// ── CADASTRAR FAMÍLIA ─────────────────────────────────────────
function addMembro() {
  const id = membrosCount++;
  const div = document.createElement('div');
  div.className = 'membro-row'; div.id = 'membro-' + id;
  div.innerHTML = `
    <button class="membro-del" type="button" onclick="document.getElementById('membro-${id}').remove()">×</button>
    <div class="membro-grid">
      <div><label>Nome</label><input placeholder="Nome completo"/></div>
      <div><label>Idade</label><input type="number" min="0" max="120" placeholder="Idade"/></div>
      <div><label>Parentesco</label>
        <select><option>Filho(a)</option><option>Esposo(a)</option><option>Pai/Mãe</option>
        <option>Avô/Avó</option><option>Neto(a)</option><option>Irmão/Irmã</option><option>Outro</option></select>
      </div>
      <div><label>Sexo</label>
        <select><option value="M">Masculino</option><option value="F">Feminino</option></select>
      </div>
    </div>`;
  document.getElementById('membros-lista').appendChild(div);
}

function coletarMembros() {
  return [...document.querySelectorAll('.membro-row')].map(row => {
    const inp = row.querySelectorAll('input, select');
    return new Membro(inp[0].value.trim(), inp[1].value, inp[2].value, inp[3].value);
  }).filter(m => m.nome);
}

function addCustomTagCad() {
  const inp = document.getElementById('cad-item-custom');
  const v = inp.value.trim(); if (!v) return;
  customTagsCad.push(v);
  renderCustomTagsCad(); inp.value = '';
}
function removeCustomTagCad(i) { customTagsCad.splice(i,1); renderCustomTagsCad(); }
function renderCustomTagsCad() {
  document.getElementById('cad-custom-tags').innerHTML = customTagsCad.map((t,i)=>
    `<div class="ctag">${t}<button type="button" onclick="removeCustomTagCad(${i})">×</button></div>`).join('');
}

async function cadastrarFamilia() {
  const g = id => document.getElementById(id).value.trim();
  const responsavel = g('cad-nome'), bairro = g('cad-bairro');
  const rua = g('cad-rua'), numero = g('cad-numero');
  const pessoas = g('cad-pessoas'), tel = g('cad-tel');

  if (!responsavel || !bairro || !rua || !numero || !pessoas || !tel) {
    alert('Preencha os campos obrigatórios: Nome, CEP, Rua, Número, Bairro, Pessoas e Telefone.');
    return;
  }
  const itens = [...[...document.querySelectorAll('.cad-item:checked')].map(c => c.value), ...customTagsCad];
  if (!itens.length) { alert('Selecione ao menos um item necessário.'); return; }

  const complemento = g('cad-complemento');
  const endereco = `${rua}, ${numero}${complemento ? ', ' + complemento : ''} — ${bairro}`;

  showToast('Buscando localização no mapa...');
  const coords = await geocodificarEndereco(rua, numero, bairro);

  const fNova = inst.adicionarFamilia({
    responsavel, cpf: g('cad-cpf'), nasc: g('cad-nasc'), tel, bairro, endereco,
    cep: g('cad-cep'), rua, numero, complemento,
    pessoas: parseInt(pessoas), moradia: g('cad-moradia'), renda: g('cad-renda'),
    escolar: g('cad-escolar'), emprego: g('cad-emprego'), itens,
    urgencia: g('cad-urgencia'), freq: g('cad-freq'), obs: g('cad-obs'), status: 'Novo',
    dataVisita: g('cad-data-visita'), revisita: g('cad-revisita'),
    membros: coletarMembros(),
    lat: coords.lat, lng: coords.lng,
  });

  if (typeof salvarFamiliaSheets !== 'undefined') salvarFamiliaSheets(fNova);
  mapInit = false; renderDashboard();
  showToast(`Família "${responsavel}" cadastrada com sucesso!`);
  document.querySelectorAll('#tab-cadastrar input, #tab-cadastrar select, #tab-cadastrar textarea').forEach(el => el.value = '');
  document.querySelectorAll('.cad-item').forEach(c => c.checked = false);
  customTagsCad.length = 0; renderCustomTagsCad();
  document.getElementById('membros-lista').innerHTML = '';
  setTimeout(() => showTab('tab-familias'), 400);
}
// ── SANEAMENTO DE COORDENADAS ─────────────────────────────────
// Corrige famílias cujo lat/lng vieram inválidos (ex.: campos
// desalinhados da planilha). Geocodifica pelo bairro e cacheia.
const RH_CENTRO = { lat: -23.4205, lng: -51.9335 }; // centro de Maringá
const RH_BBOX   = '-52.05,-23.30,-51.85,-23.55';    // limites aprox. de Maringá

function rhCoordValida(la, ln) {
  la = parseFloat(la); ln = parseFloat(ln);
  return Number.isFinite(la) && Number.isFinite(ln) &&
         la < -23.30 && la > -23.55 && ln < -51.85 && ln > -52.05;
}

function rhGetCacheBairros() {
  try { return JSON.parse(sessionStorage.getItem('rh_bairroCoords')) || {}; }
  catch (e) { return {}; }
}
function rhSetCacheBairros(c) {
  try { sessionStorage.setItem('rh_bairroCoords', JSON.stringify(c)); } catch (e) {}
}

async function rhGeocodBairro(bairro, cache) {
  if (cache[bairro]) return cache[bairro];
  const q = encodeURIComponent(bairro + ', Maringá, Paraná, Brasil');
  const url = 'https://nominatim.openstreetmap.org/search?q=' + q +
              '&format=json&limit=1&countrycodes=br&viewbox=' + RH_BBOX + '&bounded=1';
  let coord = { ...RH_CENTRO };
  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
    const j = await res.json();
    if (j.length) {
      const la = parseFloat(j[0].lat), ln = parseFloat(j[0].lon);
      if (rhCoordValida(la, ln)) coord = { lat: la, lng: ln };
    }
  } catch (e) { /* mantém fallback no centro */ }
  cache[bairro] = coord;
  rhSetCacheBairros(cache);
  return coord;
}

// Saneia inst.familias. Geocodifica bairros faltantes (com pausa p/ rate-limit).
async function sanearCoordenadas() {
  const cache = rhGetCacheBairros();
  const familias = (typeof inst !== 'undefined' && inst.familias) ? inst.familias : [];
  let corrigidas = 0;

  for (const f of familias) {
    if (rhCoordValida(f.lat, f.lng)) {
      f.lat = parseFloat(f.lat); f.lng = parseFloat(f.lng);
      continue;
    }
    const base = await rhGeocodBairro(f.bairro, cache);
    // jitter p/ famílias do mesmo bairro não se sobreporem
    f.lat = +(base.lat + (Math.random() - 0.5) * 0.004).toFixed(6);
    f.lng = +(base.lng + (Math.random() - 0.5) * 0.004).toFixed(6);
    corrigidas++;
    if (!cache.__justFetched) await new Promise(r => setTimeout(r, 1100));
  }
  if (corrigidas) {
    try { localStorage.setItem('rh_familias', JSON.stringify(familias)); } catch (e) {}
    console.info('[Re-Habita] Coordenadas saneadas em ' + corrigidas + ' família(s).');
  }
  return corrigidas;
}
// ── MAPA ──────────────────────────────────────────────────────
function initMapa() {
  if (mapInit && leafletMap) { leafletMap.invalidateSize(); return; }
  if (leafletMap) { leafletMap.remove(); leafletMap = null; }
  leafletMap = L.map('leaflet-map').setView([-23.4205,-51.9335],13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(leafletMap);
  inst.familias.forEach(f => {
    const d = f.diasSemDoacao();
    const cor = d>30||d===999?'#e74c3c':d>15?'#f39c12':'#27ae60';
    L.circleMarker([f.lat,f.lng],{radius:10,fillColor:cor,color:'#fff',weight:2,opacity:1,fillOpacity:.9})
      .addTo(leafletMap)
      .bindPopup(`<b>${f.responsavel}</b><br>${f.bairro}<br>Itens: ${f.itens.join(', ')}<br>${d===999?'Nunca recebeu':`Última doação: ${d} dias atrás`}<br>Urgência: ${f.urgencia||'—'}`);
  });
  inst.pendentes.forEach(p => {
    const lat=-23.4205+(Math.random()-.5)*.06, lng=-51.9335+(Math.random()-.5)*.06;
    L.circleMarker([lat,lng],{radius:8,fillColor:'#3498db',color:'#fff',weight:2,opacity:1,fillOpacity:.9})
      .addTo(leafletMap).bindPopup(`<b>${p.nome}</b> (pendente)<br>${p.bairro}<br>${p.itens.join(', ')}`);
  });
  mapInit=true;
  setTimeout(()=>leafletMap&&leafletMap.invalidateSize(),200);
}

inst.familias.forEach(f => {
    const lat = parseFloat(f.lat), lng = parseFloat(f.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.warn('[Re-Habita] Família sem coordenada válida, ignorada no mapa:', f.id, f.responsavel);
      return;
    }
  const d = f.diasSemDoacao();
  const cor = d>30||d===999?'#e74c3c':d>15?'#f39c12':'#27ae60';
  L.circleMarker([lat, lng], {radius:10, fillColor:cor, color:'#fff', weight:2, opacity:1, fillOpacity:.9})
    .addTo(leafletMap)
    .bindPopup(`<b>${f.responsavel}</b><br>${f.bairro}<br>Itens: ${f.itens.join(', ')}<br>${d===999?'Nunca recebeu':`Última doação: ${d} dias atrás`}<br>Urgência: ${f.urgencia||'—'}`);
});

function acPainel(inputId, dropId) { acFiltrar(inputId, dropId, 'acSelecionar'); }

// Enter no login
['login-pass','login-user'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('keydown', e => { if (e.key==='Enter') tentarLogin(); });
});
