/* Delicatta Cristã — painel de catálogo */

const DRAFT_KEY = 'delicatta_admin_draft_v1';

const CLOUD = window.DELICATTA || {};
const DB_URL = CLOUD.databaseURL || '';
const CATALOG_PATH = CLOUD.catalogPath || 'catalogo';
const IMGBB_KEY = window.DELICATTA_IMGBB_KEY || '';

const CATEGORY_LABELS = {
  vestidos: 'Vestidos',
  trico: 'Tricô',
  blusas: 'Blusas',
  acessorios: 'Acessórios',
  conjuntos: 'Conjuntos',
};

const PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 56 71%22%3E%3Crect width=%2256%22 height=%2271%22 fill=%22%23F1E9DC%22/%3E%3C/svg%3E';

/* Estado ------------------------------------------------------------------ */

let server = { aviso: '', produtos: [] };
let state = { aviso: '', produtos: [] };
let editingId = null;
let serverError = false;
let source = 'arquivo'; // 'nuvem' quando o catálogo veio do Firebase
let cloudBlocked = false; // banco respondeu 401/403 — regras fechadas
let cloudEmpty = false; // banco respondeu vazio

/* Elementos --------------------------------------------------------------- */

const els = {
  status: document.getElementById('status'),
  statusText: document.getElementById('statusText'),
  avisoInput: document.getElementById('avisoInput'),
  avisoCount: document.getElementById('avisoCount'),
  productCount: document.getElementById('productCount'),
  list: document.getElementById('productList'),
  listEmpty: document.getElementById('listEmpty'),
  form: document.getElementById('productForm'),
  formTitle: document.getElementById('formTitle'),
  formError: document.getElementById('formError'),
  nome: document.getElementById('f-nome'),
  categoria: document.getElementById('f-categoria'),
  preco: document.getElementById('f-preco'),
  meta: document.getElementById('f-meta'),
  tag: document.getElementById('f-tag'),
  imagem: document.getElementById('f-imagem'),
  destaque: document.getElementById('f-destaque'),
  preview: document.getElementById('imagePreview'),
  toast: document.getElementById('toast'),
  publicar: document.getElementById('btnPublicar'),
  upload: document.getElementById('btnUpload'),
  uploadStatus: document.getElementById('uploadStatus'),
  file: document.getElementById('f-file'),
};

/* Utilidades -------------------------------------------------------------- */

function esc(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function money(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function slug(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'peca';
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function imageSrc(path) {
  const value = String(path || '').trim();
  if (!value) return PLACEHOLDER;
  if (/^(https?:|data:)/.test(value)) return value;
  return `../${value.replace(/^\.?\//, '')}`;
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('is-visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove('is-visible'), 2800);
}

/* Normalização ------------------------------------------------------------ */

function normalize(data) {
  const produtos = Array.isArray(data && data.produtos)
    ? data.produtos
        .filter((item) => item && item.nome)
        .map((item) => ({
          id: String(item.id || slug(item.nome)),
          nome: String(item.nome),
          categoria: CATEGORY_LABELS[item.categoria] ? item.categoria : 'vestidos',
          preco: Number(item.preco) || 0,
          imagem: String(item.imagem || ''),
          meta: String(item.meta || ''),
          tag: String(item.tag || ''),
          destaque: item.destaque === true,
        }))
    : [];

  const featured = produtos.findIndex((item) => item.destaque);
  produtos.forEach((item, index) => {
    item.destaque = index === featured;
  });

  return {
    aviso: typeof (data && data.aviso) === 'string' ? data.aviso : '',
    produtos,
  };
}

function isDirty() {
  return JSON.stringify(state) !== JSON.stringify(server);
}

/* Persistência local ------------------------------------------------------ */

function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  } catch {
    toast('Não foi possível salvar o rascunho neste navegador');
  }
  updateStatus();
}

function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/* Status ------------------------------------------------------------------ */

function updateStatus() {
  const dirty = isDirty();
  const error = serverError || cloudBlocked;

  els.status.classList.toggle('is-dirty', dirty && !error);
  els.status.classList.toggle('is-clean', !dirty && !error);
  els.status.classList.toggle('is-error', error);

  if (cloudBlocked && !dirty) {
    els.statusText.textContent =
      'O Firebase recusou a leitura (regras fechadas). Libere o nó “catalogo” para ler e escrever no console do Firebase.';
    return;
  }

  if (serverError && !dirty) {
    els.statusText.textContent =
      'Não consegui ler o catálogo do site. Você pode editar, executar e baixar uma cópia normalmente.';
    return;
  }

  if (dirty) {
    els.statusText.textContent = 'Você tem alterações não publicadas. Clique em “Publicar agora” para levá-las ao site.';
    return;
  }

  if (cloudEmpty || source === 'arquivo') {
    els.statusText.textContent =
      'O site está usando o produtos.json. Clique em “Publicar agora” para levar o catálogo ao Firebase.';
    return;
  }

  els.statusText.textContent = 'Tudo certo — o painel mostra o catálogo publicado no site.';
}

/* Aviso ------------------------------------------------------------------- */

function renderAviso() {
  if (document.activeElement !== els.avisoInput) els.avisoInput.value = state.aviso;
  els.avisoCount.textContent = els.avisoInput.value.length;
}

/* Lista ------------------------------------------------------------------- */

function renderList() {
  els.productCount.textContent = state.produtos.length;
  els.listEmpty.hidden = state.produtos.length > 0;

  els.list.innerHTML = state.produtos
    .map(
      (item) => `
      <div class="row">
        <img class="row__img" src="${esc(imageSrc(item.imagem))}" alt="" />
        <div>
          <p class="row__name">
            ${esc(item.nome)}
            ${item.destaque ? '<span class="row__badge">Destaque</span>' : ''}
          </p>
          <p class="row__meta">
            ${esc(CATEGORY_LABELS[item.categoria] || item.categoria)}${item.meta ? ' · ' + esc(item.meta) : ''}${
              item.tag ? ' · ' + esc(item.tag) : ''
            }
          </p>
          <p class="row__price">${money(item.preco)}</p>
        </div>
        <div class="row__actions">
          <button class="row__btn" type="button" data-edit="${esc(item.id)}">Editar</button>
          <button class="row__btn row__btn--remove" type="button" data-remove="${esc(item.id)}">Remover</button>
        </div>
      </div>`
    )
    .join('');
}

/* Formulário -------------------------------------------------------------- */

function openForm(product) {
  editingId = product ? product.id : null;
  els.formTitle.textContent = product ? 'Editar peça' : 'Nova peça';
  els.formError.hidden = true;

  els.nome.value = product ? product.nome : '';
  els.categoria.value = product ? product.categoria : 'vestidos';
  els.preco.value = product ? String(product.preco) : '';
  els.meta.value = product ? product.meta : '';
  els.tag.value = product ? product.tag : '';
  els.imagem.value = product ? product.imagem : '';
  els.destaque.checked = product ? product.destaque : false;

  updatePreview();
  els.form.hidden = false;
  els.nome.focus();
  els.form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeForm() {
  els.form.hidden = true;
  els.formError.hidden = true;
  editingId = null;
}

function updatePreview() {
  const value = els.imagem.value.trim();
  if (!value) {
    els.preview.hidden = true;
    return;
  }
  els.preview.src = imageSrc(value);
  els.preview.hidden = false;
}

function uniqueId(name) {
  const base = slug(name);
  let id = base;
  let counter = 1;
  while (state.produtos.some((item) => item.id === id)) {
    counter += 1;
    id = `${base}-${counter}`;
  }
  return id;
}

function submitForm(event) {
  event.preventDefault();

  const nome = els.nome.value.trim();
  const preco = Number(els.preco.value);
  const imagem = els.imagem.value.trim();

  if (!nome || !imagem || !(preco > 0)) {
    els.formError.hidden = false;
    els.formError.textContent = 'Preencha o nome, um preço maior que zero e a imagem da peça.';
    return;
  }

  const product = {
    id: editingId || uniqueId(nome),
    nome,
    categoria: els.categoria.value,
    preco: Number(preco.toFixed(2)),
    imagem,
    meta: els.meta.value.trim(),
    tag: els.tag.value.trim(),
    destaque: els.destaque.checked,
  };

  if (product.destaque) {
    state.produtos.forEach((item) => {
      item.destaque = false;
    });
  }

  const wasEditing = Boolean(editingId);

  if (wasEditing) {
    state.produtos = state.produtos.map((item) => (item.id === editingId ? product : item));
  } else {
    state.produtos.push(product);
  }

  saveDraft();
  renderList();
  closeForm();
  toast(wasEditing ? 'Peça atualizada' : 'Peça adicionada');
}

/* Ações ------------------------------------------------------------------- */

function removeProduct(id) {
  const produto = state.produtos.find((item) => item.id === id);
  if (!produto) return;
  if (!confirm(`Remover “${produto.nome}” do catálogo?`)) return;

  state.produtos = state.produtos.filter((item) => item.id !== id);
  saveDraft();
  renderList();
  toast('Peça removida');
}

function exportJson() {
  const data = {
    aviso: state.aviso,
    produtos: state.produtos,
  };
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'produtos.json';
  link.click();
  URL.revokeObjectURL(url);
  toast('Cópia baixada em produtos.json');
}

/* Nuvem ------------------------------------------------------------------- */

async function loadServer() {
  if (DB_URL) {
    try {
      const response = await fetch(`${DB_URL}/${CATALOG_PATH}.json?t=${Date.now()}`, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.produtos)) {
          source = 'nuvem';
          return normalize(data);
        }
        cloudEmpty = true;
        source = 'arquivo';
      } else {
        cloudBlocked = true;
        console.warn('Firebase respondeu', response.status, 'na leitura do catálogo');
      }
    } catch (error) {
      console.warn('Firebase inacessível, usando produtos.json:', error);
    }
  }

  try {
    const response = await fetch(`../produtos.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return normalize(await response.json());
  } catch (error) {
    serverError = true;
    console.error('Não foi possível ler produtos.json:', error);
    return { aviso: '', produtos: [] };
  }
}

async function publish() {
  if (!DB_URL) {
    toast('Firebase não configurado: preencha databaseURL em config.js');
    return;
  }

  if (state.produtos.length === 0 && !confirm('Publicar um catálogo vazio? O site ficará sem peças.')) {
    return;
  }

  const button = els.publicar;
  button.disabled = true;
  button.classList.add('is-busy');

  try {
    const response = await fetch(`${DB_URL}/${CATALOG_PATH}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aviso: state.aviso, produtos: state.produtos }),
    });

    if (!response.ok) {
      cloudBlocked = response.status === 401 || response.status === 403;
      throw new Error(
        cloudBlocked
          ? 'O Firebase recusou a escrita: libere o nó “catalogo” para leitura e escrita nas regras do Realtime Database.'
          : `Firebase respondeu HTTP ${response.status}`
      );
    }

    server = clone(state);
    source = 'nuvem';
    cloudBlocked = false;
    cloudEmpty = false;
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignorado */
    }
    toast('Publicado! O site já está mostrando o catálogo novo.');
  } catch (error) {
    toast(error.message || 'Não foi possível publicar agora');
  } finally {
    button.disabled = false;
    button.classList.remove('is-busy');
    updateStatus();
  }
}

/* Foto no ImgBB ----------------------------------------------------------- */

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Não consegui ler o arquivo'));
    reader.readAsDataURL(file);
  });
}

async function uploadImage(file) {
  if (!IMGBB_KEY) {
    els.uploadStatus.textContent = 'Chave do ImgBB ausente em imgbb-config.js';
    return;
  }

  if (!file.type.startsWith('image/')) {
    els.uploadStatus.textContent = 'Escolha um arquivo de imagem';
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    els.uploadStatus.textContent = 'Imagem muito grande (máximo 10 MB)';
    return;
  }

  els.upload.disabled = true;
  els.uploadStatus.textContent = 'Enviando foto…';

  try {
    const base64 = await fileToBase64(file);
    const body = new FormData();
    body.append('image', base64);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(IMGBB_KEY)}`, {
      method: 'POST',
      body,
    });
    const result = await response.json();

    if (!response.ok || !result || !result.success) {
      throw new Error((result && result.error && result.error.message) || 'Falha no upload');
    }

    els.imagem.value = result.data.display_url || result.data.url;
    updatePreview();
    els.uploadStatus.textContent = 'Foto enviada';
  } catch (error) {
    els.uploadStatus.textContent = `Não deu para enviar: ${error.message}`;
  } finally {
    els.upload.disabled = false;
  }
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!parsed || !Array.isArray(parsed.produtos)) throw new Error('formato inesperado');
      state = normalize(parsed);
      saveDraft();
      renderAviso();
      renderList();
      toast('Catálogo importado');
    } catch {
      toast('Arquivo inválido: envie um produtos.json gerado por este painel');
    }
  };
  reader.readAsText(file);
}

function discardChanges() {
  if (isDirty() && !confirm('Descartar as alterações locais e voltar ao catálogo publicado?')) return;
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignorado */
  }
  state = clone(server);
  renderAviso();
  renderList();
  updateStatus();
  toast('Alterações descartadas');
}

/* Eventos ----------------------------------------------------------------- */

els.avisoInput.addEventListener('input', () => {
  state.aviso = els.avisoInput.value;
  els.avisoCount.textContent = els.avisoInput.value.length;
  saveDraft();
});

els.list.addEventListener('click', (event) => {
  const edit = event.target.closest('[data-edit]');
  if (edit) {
    const produto = state.produtos.find((item) => item.id === edit.dataset.edit);
    if (produto) openForm(produto);
    return;
  }

  const remove = event.target.closest('[data-remove]');
  if (remove) removeProduct(remove.dataset.remove);
});

document.getElementById('btnNova').addEventListener('click', () => openForm(null));
document.getElementById('btnCancelar').addEventListener('click', closeForm);
document.getElementById('btnCancelar2').addEventListener('click', closeForm);
els.form.addEventListener('submit', submitForm);
els.imagem.addEventListener('input', updatePreview);

document.getElementById('btnExportar').addEventListener('click', exportJson);
document.getElementById('btnDescartar').addEventListener('click', discardChanges);
els.publicar.addEventListener('click', publish);

els.upload.addEventListener('click', () => els.file.click());
els.file.addEventListener('change', () => {
  if (els.file.files && els.file.files[0]) uploadImage(els.file.files[0]);
  els.file.value = '';
});

const fileInput = document.getElementById('fileImport');
document.getElementById('btnImportar').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files && fileInput.files[0]) importJson(fileInput.files[0]);
  fileInput.value = '';
});

/* Inicialização ----------------------------------------------------------- */

async function init() {
  server = await loadServer();

  const draft = readDraft();
  state = draft ? normalize(draft) : clone(server);

  renderAviso();
  renderList();
  updateStatus();

  if (draft) toast('Rascunho local carregado');
}

init();
