/* ================================================================
   Re-Habita Maringá — data.js
   POO: Doacao, Membro, Familia, FilaPrioridade, Instituicao
   Estrutura de dados: Fila de Prioridade (max-heap)
   Dados: Google Sheets → localStorage → fallback demo
   ================================================================ */

const BAIRROS_MARINGA = [
  'Zona 01','Zona 02','Zona 03','Zona 04','Zona 05','Zona 06','Zona 07','Zona 08',
  'Jardim Alvorada','Jardim Aclimação','Jardim América','Jardim Andrade','Jardim Avaré',
  'Jardim Belo Horizonte','Jardim Bonafé','Jardim Brasil','Jardim Caobiúva',
  'Jardim Cidade Monções','Jardim Dinalva','Jardim Florença','Jardim Horizonte',
  'Jardim Imperial','Jardim Independência','Jardim Ipanema','Jardim Ivatuba',
  'Jardim Liberdade','Jardim Marcelino','Jardim Morumbi','Jardim Nova Esperança',
  'Jardim Novo Horizonte','Jardim Olímpico','Jardim Ouro Branco','Jardim Paris',
  'Jardim Paulista','Jardim Pinheiros','Jardim Planalto','Jardim Querência',
  'Jardim Rebouças','Jardim Santa Helena','Jardim Santa Rosa','Jardim Santo André',
  'Jardim São Cristóvão','Jardim São Jorge','Jardim São Paulo','Jardim Sumaré',
  'Jardim Universitário','Jardim Vila Bosque','Jardim Vista Alegre','Jardim Winstron',
  'Santa Felicidade','Santa Mônica','Santo Onofre','Santos Dumont','São Cristóvão',
  'São João','São Jorge','São Judas Tadeu','São Pedro','São Rafael',
  'Vila Bosque','Vila Brasileira','Vila Esperança','Vila Froter','Vila Georgina',
  'Vila Industrial','Vila Ipiranga','Vila Luzia','Vila Morangueira','Vila Nova',
  'Vila Olímpia','Vila Operária','Vila Rica','Vila Roma','Vila Santa Inês',
  'Vila Santos Dumont','Vila Vardelina','Alto Alegre','Alto da XV','Arrayã',
  'Boa Esperança','Bom Retiro','Centro','Conjunto Aníbal Khury','Conjunto Requião',
  'Conjunto Residencial Borba Gato','Esperança','Floriano','Franco','Laranjeiras',
  'Maringá Velho','Novo Conjunto','Parque das Laranjeiras','Parque Hortência',
  'Parque Industrial','Parque Itaipu','Parque Tarumã','Requião',
  'Remanso Campineiro','Santa Cruz','Santa Luzia','Santa Maria',
  'Sarandi','Pinheiros','Mandaguaçu','Marialva','Astorga'
];

// ── CLASSES ──────────────────────────────────────────────────

class Doacao {
  constructor(item, data, qtd = 1) {
    this.item = item;
    this.data = data;
    this.qtd  = qtd;
  }
  diasDesde() {
    return Math.floor((new Date() - new Date(this.data)) / 86400000);
  }
}

class Membro {
  constructor(nome, idade, parentesco, sexo) {
    this.nome       = nome;
    this.idade      = parseInt(idade) || 0;
    this.parentesco = parentesco;
    this.sexo       = sexo;
  }
}

class Familia {
  constructor(id, d) {
    this.id           = id;
    this.responsavel  = d.responsavel  || '';
    this.cpf          = d.cpf          || '';
    this.nasc         = d.nasc         || '';
    this.tel          = d.tel          || '';
    this.bairro       = d.bairro       || '';
    this.endereco     = d.endereco     || '';
    this.cep          = d.cep          || '';
    this.rua          = d.rua          || '';
    this.numero       = d.numero       || '';
    this.complemento  = d.complemento  || '';
    this.pessoas      = parseInt(d.pessoas) || 1;
    this.moradia      = d.moradia      || '';
    this.renda        = d.renda        || '';
    this.escolar      = d.escolar      || '';
    this.emprego      = d.emprego      || '';
    this.itens        = d.itens        || [];
    this.urgencia     = d.urgencia     || '';
    this.freq         = d.freq         || '';
    this.obs          = d.obs          || '';
    this.status       = d.status       || 'Novo';
    this.lat          = d.lat          || -23.4205;
    this.lng          = d.lng          || -51.9335;
    this.dataVisita   = d.dataVisita   || '';
    this.revisita     = d.revisita     || '';
    this.dataCadastro = d.dataCadastro || new Date().toISOString().split('T')[0];
    // normaliza: aceita array, string JSON, ou vazio (planilha às vezes manda texto)
    const _arr = (v) => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') {
        const s = v.trim();
        if (!s) return [];
        try { const p = JSON.parse(s); return Array.isArray(p) ? p : []; }
        catch (e) { return []; }
      }
      return [];
    };

    this.membros      = _arr(d.membros).map(m =>
      m instanceof Membro ? m : new Membro(m.nome, m.idade, m.parentesco, m.sexo)
    );
    this.historico    = _arr(d.historico).map(h =>
      h instanceof Doacao ? h : new Doacao(h.item, h.data, h.qtd)
    );
  }

  ultimaDoacao() {
    if (!this.historico.length) return null;
    return this.historico.reduce((a, b) => new Date(a.data) > new Date(b.data) ? a : b);
  }
  diasSemDoacao() {
    const u = this.ultimaDoacao();
    return u ? u.diasDesde() : 999;
  }
  prioridade() {
    const d = this.diasSemDoacao();
    if (this.urgencia.includes('Emergência')) return 4;
    if (d > 30 || this.urgencia.includes('Alta'))   return 3;
    if (d > 15 || this.urgencia.includes('Média'))  return 2;
    return 1;
  }
  addDoacao(item, qtd = 1) {
    const hoje = new Date().toISOString().split('T')[0];
    this.historico.unshift(new Doacao(item, hoje, qtd));
  }
}

// ── FILA DE PRIORIDADE (max-heap) ────────────────────────────
class FilaPrioridade {
  constructor() { this._h = []; }
  _p(i)  { return Math.floor((i - 1) / 2); }
  _l(i)  { return 2 * i + 1; }
  _r(i)  { return 2 * i + 2; }
  _sw(a, b) { [this._h[a], this._h[b]] = [this._h[b], this._h[a]]; }
  _gt(a, b) {
    if (a.prioridade() !== b.prioridade()) return a.prioridade() > b.prioridade();
    return a.diasSemDoacao() > b.diasSemDoacao();
  }
  inserir(f) { this._h.push(f); this._subir(this._h.length - 1); }
  _subir(i) {
    while (i > 0 && this._gt(this._h[i], this._h[this._p(i)])) {
      this._sw(i, this._p(i)); i = this._p(i);
    }
  }
  reconstruir(arr) {
    this._h = [...arr];
    for (let i = Math.floor(this._h.length / 2) - 1; i >= 0; i--) this._descer(i);
  }
  _descer(i) {
    let m = i, l = this._l(i), r = this._r(i);
    if (l < this._h.length && this._gt(this._h[l], this._h[m])) m = l;
    if (r < this._h.length && this._gt(this._h[r], this._h[m])) m = r;
    if (m !== i) { this._sw(i, m); this._descer(m); }
  }
  toArray() {
    return [...this._h].sort((a, b) =>
      b.prioridade() - a.prioridade() || b.diasSemDoacao() - a.diasSemDoacao()
    );
  }
}

// ── INSTITUIÇÃO ──────────────────────────────────────────────
class Instituicao {
  constructor(nome) {
    this.nome      = nome;
    this.familias  = [];
    this.pendentes = [];
    this._fila     = new FilaPrioridade();
    this._nextId   = 1;
  }

  adicionarFamilia(dados) {
    const f = new Familia(this._nextId++, dados);
    this.familias.push(f);
    this._fila.inserir(f);
    return f;
  }
  atualizarFila() { this._fila.reconstruir(this.familias); }
  filaOrdenada()  { this.atualizarFila(); return this._fila.toArray(); }
  alertas()       { return this.familias.filter(f => f.diasSemDoacao() > 30); }
  atencao()       { return this.familias.filter(f => f.diasSemDoacao() > 15 && f.diasSemDoacao() <= 30); }
  adicionarPendente(p) { this.pendentes.unshift(p); }
  aprovarPendente(idx) {
    const p = this.pendentes[idx];
    if (!p) return null;
    const f = this.adicionarFamilia({
      responsavel: p.nome, bairro: p.bairro,
      endereco: p.endereco || 'A confirmar na visita',
      pessoas: p.pessoas || 1, tel: p.tel, itens: p.itens,
      obs: p.obs, status: 'Novo', urgencia: 'Média — necessidade regular', freq: 'Mensal',
      lat: -23.4205 + (Math.random() - 0.5) * 0.08,
      lng: -51.9335 + (Math.random() - 0.5) * 0.08,
    });
    this.pendentes.splice(idx, 1);
    return f;
  }
}

// ── INSTÂNCIA PRINCIPAL ──────────────────────────────────────
const inst = new Instituicao('Igreja Central Maringá');

// ── FALLBACK DEMO (usado só se Sheets E localStorage falharem) ──
const _DEMO = [
  { responsavel:'Maria Aparecida Silva', bairro:'Zona 01', endereco:'Rua Santos Dumont, 142',
    pessoas:5, itens:['Cesta básica','Leite'], status:'Ativo',
    lat:-23.4205, lng:-51.9335, tel:'(44) 99876-5432',
    renda:'Até 1/2 salário mínimo', moradia:'Alugada',
    escolar:'Fundamental incompleto', emprego:'Desempregado',
    urgencia:'Alta — situação crítica', freq:'Mensal',
    obs:'Dados de demonstração — conecte ao Google Sheets para dados reais.',
    dataCadastro: new Date().toISOString().split('T')[0],
    membros:[{nome:'Pedro Silva',idade:'8',parentesco:'Filho',sexo:'M'}],
    historico:[{item:'Cesta básica', data: new Date(Date.now()-45*86400000).toISOString().split('T')[0], qtd:1}]
  },
  { responsavel:'Antônia Ferreira', bairro:'Zona 03', endereco:'Rua Pioneiro, 77',
    pessoas:6, itens:['Cesta básica','Alimentos gerais'], status:'Em acompanhamento',
    lat:-23.4120, lng:-51.9280, tel:'(44) 99654-3210',
    renda:'Sem renda', moradia:'Própria',
    escolar:'Sem escolaridade', emprego:'Benefício social',
    urgencia:'Emergência — necessidade imediata', freq:'Semanal',
    obs:'Dados de demonstração — conecte ao Google Sheets para dados reais.',
    dataCadastro: new Date().toISOString().split('T')[0],
    membros:[{nome:'Dona Maria',idade:'78',parentesco:'Avó',sexo:'F'}],
    historico:[{item:'Alimentos gerais', data: new Date(Date.now()-60*86400000).toISOString().split('T')[0], qtd:1}]
  },
  { responsavel:'José Roberto Lima', bairro:'Zona 02', endereco:'Av. Colombo, 450',
    pessoas:3, itens:['Leite','Fralda'], status:'Ativo',
    lat:-23.4290, lng:-51.9380, tel:'(44) 99765-4321',
    renda:'1/2 a 1 salário mínimo', moradia:'Cedida',
    escolar:'Médio completo', emprego:'Autônomo',
    urgencia:'Média — necessidade regular', freq:'Quinzenal',
    obs:'Dados de demonstração — conecte ao Google Sheets para dados reais.',
    dataCadastro: new Date().toISOString().split('T')[0],
    membros:[{nome:'Bebê Lima',idade:'0',parentesco:'Filho',sexo:'M'}],
    historico:[{item:'Leite', data: new Date(Date.now()-8*86400000).toISOString().split('T')[0], qtd:1}]
  },
];

function _carregarDemo() {
  inst.familias  = _DEMO.map((d, i) => new Familia(i + 1, d));
  inst._nextId   = _DEMO.length + 1;
  inst.pendentes = [
    { nome:'Ana Paula Gomes', bairro:'Zona 06', tel:'(44) 99001-2233',
      itens:['Cesta básica','Leite'], obs:'Filha recém-nascida', data:'2026-06-01', pessoas:3 },
  ];
  inst.atualizarFila();
}

// ── PERSISTÊNCIA LOCAL ───────────────────────────────────────
const LS_KEY_FAMILIAS  = 'rh_familias';
const LS_KEY_PENDENTES = 'rh_pendentes_ls';
const LS_KEY_NEXT_ID   = 'rh_next_id';

function salvarLocal() {
  try {
    localStorage.setItem(LS_KEY_FAMILIAS,  JSON.stringify(inst.familias));
    localStorage.setItem(LS_KEY_PENDENTES, JSON.stringify(inst.pendentes));
    localStorage.setItem(LS_KEY_NEXT_ID,   String(inst._nextId));
  } catch(e) { console.warn('[Local] Erro ao salvar:', e); }
}

function carregarLocal() {
  try {
    const fams  = JSON.parse(localStorage.getItem(LS_KEY_FAMILIAS)  || 'null');
    const pends = JSON.parse(localStorage.getItem(LS_KEY_PENDENTES) || 'null');
    const nid   = parseInt(localStorage.getItem(LS_KEY_NEXT_ID)     || '0');
    if (fams && fams.length > 0) {
      inst.familias  = fams.map(d => new Familia(d.id, d));
      inst.pendentes = pends || [];
      inst._nextId   = nid || (inst.familias.length + 1);
      inst.atualizarFila();
      return true;
    }
  } catch(e) { console.warn('[Local] Erro ao carregar:', e); }
  return false;
}

// ── INTEGRAÇÃO GOOGLE SHEETS ─────────────────────────────────
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx-6KFEAUfDQ3wJxNsnou30g_LvVvi0m0CYoQg9vFM3jvLmGB5AYugP9cy4oOfU8Oyw/exec';

function sheetPost(dados) {
  return fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(dados)
  }).then(r => r.json()).catch(err => { console.warn('[Sheets] Erro:', err); return { ok: false }; });
}

function salvarFamiliaSheets(f) {
  salvarLocal();
  return sheetPost({ acao: 'salvarFamilia', familia: {
    id: f.id, responsavel: f.responsavel, cpf: f.cpf, nasc: f.nasc, tel: f.tel,
    bairro: f.bairro, endereco: f.endereco, pessoas: f.pessoas, moradia: f.moradia,
    renda: f.renda, escolar: f.escolar, emprego: f.emprego,
    itens: f.itens, urgencia: f.urgencia, freq: f.freq, status: f.status,
    obs: f.obs, dataVisita: f.dataVisita, revisita: f.revisita,
    dataCadastro: f.dataCadastro, lat: f.lat, lng: f.lng,
    membros: f.membros, historico: f.historico
  }});
}

function atualizarPreCadSheets(nome, tel, novoStatus) {
  sheetPost({ acao: 'atualizarPreCad', nome, tel, novoStatus });
}

async function carregarDoSheets() {
  try {
    const url  = SCRIPT_URL + '?acao=carregar&t=' + Date.now();
    const resp = await fetch(url);
    const json = await resp.json();
    if (!json.ok || (!json.familias && !json.preCad)) return false;
    const famsDados = json.familias || [];
    if (famsDados.length === 0) return false;
    inst.familias  = famsDados.map(d => new Familia(d.id || d.ID, d));
    inst.pendentes = json.preCad || [];
    const maxId    = Math.max(...inst.familias.map(f => f.id || 0));
    inst._nextId   = maxId + 1;
    inst.atualizarFila();
    salvarLocal();
    return true;
  } catch(e) {
    console.warn('[Sheets] Falha ao carregar:', e);
    return false;
  }
}

// ── INICIALIZAÇÃO: Sheets → localStorage → demo ──────────────
async function inicializarDados() {
  const doSheets = await carregarDoSheets();
  if (doSheets) { console.info('[Re-Habita] Dados carregados do Google Sheets.'); return; }

  const doLocal = carregarLocal();
  if (doLocal) { console.info('[Re-Habita] Dados carregados do localStorage.'); return; }

  _carregarDemo();
  console.info('[Re-Habita] Sem conexão e sem dados locais — exibindo dados de demonstração.');
}

// ── UTILITÁRIOS COMPARTILHADOS ───────────────────────────────
function acFiltrar(inputId, dropId, fnSelect) {
  const val = document.getElementById(inputId).value.toLowerCase().trim();
  const dd  = document.getElementById(dropId);
  if (!val) { dd.classList.remove('open'); return; }
  const m = BAIRROS_MARINGA.filter(b => b.toLowerCase().includes(val)).slice(0, 12);
  if (!m.length) { dd.classList.remove('open'); return; }
  dd.innerHTML = m.map(b =>
    `<div class="ac-item" onmousedown="event.preventDefault();${fnSelect}('${inputId}','${dropId}','${b.replace(/'/g,"\\'")}');">${b}</div>`
  ).join('');
  dd.classList.add('open');
}

function acSelecionar(inputId, dropId, val) {
  document.getElementById(inputId).value = val;
  document.getElementById(dropId).classList.remove('open');
}

document.addEventListener('click', () => {
  document.querySelectorAll('.ac-dropdown, .ac-c-dd').forEach(d => d.classList.remove('open'));
});

function diasLabel(d) {
  if (d === 999) return '<span class="badge badge-red">Nunca recebeu</span>';
  if (d > 30)    return `<span class="badge badge-red">${d} dias</span>`;
  if (d > 15)    return `<span class="badge badge-yellow">${d} dias</span>`;
  return `<span class="badge badge-green">${d} dias</span>`;
}

function statusBadge(s) {
  const m = { 'Ativo':'badge-green','Em acompanhamento':'badge-orange','Novo':'badge-gray','Inativo':'badge-gray' };
  return `<span class="badge ${m[s]||'badge-gray'}">${s}</span>`;
}

function urgBadge(u) {
  if (!u) return '<span class="badge badge-gray">—</span>';
  const cls = u.includes('Emergência')?'badge-red':u.includes('Alta')?'badge-orange':u.includes('Média')?'badge-yellow':'badge-green';
  return `<span class="badge ${cls}">${u.split('—')[0].trim()}</span>`;
}

function showToast(msg, tipo) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.background = tipo === 'err' ? 'var(--red)' : 'var(--green-dark)';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function salvarPendente(p) {
  let arr = [];
  try { arr = JSON.parse(sessionStorage.getItem('rh_pendentes') || '[]'); } catch(e) {}
  arr.unshift(p);
  sessionStorage.setItem('rh_pendentes', JSON.stringify(arr));
}

function carregarPendentesExtras() {
  try {
    const arr = JSON.parse(sessionStorage.getItem('rh_pendentes') || '[]');
    arr.forEach(p => {
      const jaExiste = inst.pendentes.find(x =>
        x.tel.replace(/\D/g,'') === p.tel.replace(/\D/g,'') &&
        x.nome.trim().toLowerCase() === p.nome.trim().toLowerCase()
      );
      if (!jaExiste) inst.pendentes.unshift(p);
    });
  } catch(e) {}
}