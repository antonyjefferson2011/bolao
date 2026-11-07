/* Delicatta Cristã — interações da página de vendas */

const CONFIG = {
  whatsapp: '5586998174869', // troque pelo número real, com DDI + DDD
  instagram: 'delicattacrista',
};

const CATEGORY_LABELS = {
  vestidos: 'Vestidos',
  trico: 'Tricô',
  blusas: 'Blusas',
  acessorios: 'Acessórios',
  conjuntos: 'Conjuntos',
};

const STORAGE_KEY = 'delicatta_sacola';

/* --------------------------------------------------------------------------
   Catálogo
   -------------------------------------------------------------------------- */

let products = [];
const catalog = new Map();
let cart = {};

const CLOUD = window.DELICATTA || {};
const DB_URL = CLOUD.databaseURL || '';
const CATALOG_PATH = CLOUD.catalogPath || 'catalogo';

function normalizeCatalog(data) {
  const produtos = Array.isArray(data && data.produtos)
    ? data.produtos
        .filter((item) => item && item.id && item.nome && Number(item.preco) > 0)
        .map((item) => ({
          id: String(item.id),
          nome: String(item.nome),
          categoria: CATEGORY_LABELS[item.categoria] ? item.categoria : 'outros',
          preco: Number(item.preco),
          imagem: item.imagem || 'assets/peca-mes.jpg',
          meta: item.meta || '',
          tag: item.tag || '',
          destaque: item.destaque === true,
        }))
    : [];

  return { aviso: typeof (data && data.aviso) === 'string' ? data.aviso : '', produtos };
}

/* O catálogo publicado pelo painel fica no Firebase. Se o banco estiver vazio
   ou inacessível, o site usa o produtos.json do repositório. */
async function fetchCloudCatalog() {
  if (!DB_URL) return null;
  try {
    const response = await fetch(`${DB_URL}/${CATALOG_PATH}.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data && Array.isArray(data.produtos) ? data : null;
  } catch (error) {
    console.warn('Catálogo do Firebase indisponível, usando produtos.json:', error);
    return null;
  }
}

async function loadCatalog() {
  const cloud = await fetchCloudCatalog();
  if (cloud) return normalizeCatalog(cloud);

  const response = await fetch('produtos.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return normalizeCatalog(await response.json());
}

/* --------------------------------------------------------------------------
   Utilidades
   -------------------------------------------------------------------------- */

function money(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

/* --------------------------------------------------------------------------
   Elementos
   -------------------------------------------------------------------------- */

const drawer = document.getElementById('drawer');
const drawerBody = document.getElementById('drawerBody');
const drawerFoot = document.getElementById('drawerFoot');
const drawerTotal = document.getElementById('drawerTotal');
const drawerClose = document.getElementById('drawerClose');
const overlay = document.getElementById('overlay');
const bagBtn = document.getElementById('bagBtn');
const bagCount = document.getElementById('bagCount');
const checkoutBtn = document.getElementById('checkoutBtn');
const clearBtn = document.getElementById('clearBtn');
const toast = document.getElementById('toast');
const header = document.getElementById('header');
const menuBtn = document.getElementById('menuBtn');
const mobileMenu = document.getElementById('mobileMenu');
const productsGrid = document.getElementById('products');
const filtersBox = document.getElementById('filters');
const announce = document.getElementById('announce');
const announceText = document.getElementById('announceText');

/* --------------------------------------------------------------------------
   WhatsApp e Instagram
   -------------------------------------------------------------------------- */

function whatsappUrl(text) {
  const base = `https://wa.me/${CONFIG.whatsapp}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

document.querySelectorAll('a[href^="https://wa.me/"]').forEach((link) => {
  link.href = whatsappUrl();
  link.target = '_blank';
  link.rel = 'noopener';
});

document.querySelectorAll('a[href^="https://instagram.com/"]').forEach((link) => {
  link.href = `https://instagram.com/${CONFIG.instagram}`;
  link.target = '_blank';
  link.rel = 'noopener';
});

/* --------------------------------------------------------------------------
   Aviso do topo
   -------------------------------------------------------------------------- */

function renderAnnounce(text) {
  const aviso = (text || '').trim();
  if (!aviso) {
    announce.hidden = true;
    return;
  }
  announce.hidden = false;
  announceText.textContent = aviso;
}

/* --------------------------------------------------------------------------
   Coleção
   -------------------------------------------------------------------------- */

function renderFilters(list) {
  const categories = [];
  list.forEach((item) => {
    if (item.categoria !== 'outros' && !categories.includes(item.categoria)) categories.push(item.categoria);
  });

  if (!categories.length) {
    filtersBox.innerHTML = '';
    return;
  }

  filtersBox.innerHTML =
    '<button class="filter is-active" data-filter="todos" type="button">Todas</button>' +
    categories
      .map(
        (category) =>
          `<button class="filter" data-filter="${category}" type="button">${escapeHtml(
            CATEGORY_LABELS[category] || category
          )}</button>`
      )
      .join('');
}

function renderProducts(list) {
  if (!list.length) {
    productsGrid.innerHTML =
      '<p class="products__loading">Nenhuma peça publicada ainda. Volte em breve.</p>';
    return;
  }

  productsGrid.innerHTML = list
    .map(
      (item) => `
      <article class="product" data-id="${escapeHtml(item.id)}" data-name="${escapeHtml(item.nome)}" data-price="${item.preco}" data-image="${escapeHtml(item.imagem)}" data-category="${escapeHtml(item.categoria)}">
        <div class="product__media">
          <img src="${escapeHtml(item.imagem)}" alt="${escapeHtml(item.nome)}${item.meta ? ' — ' + escapeHtml(item.meta) : ''}" width="800" height="1067" loading="lazy" />
          ${item.tag ? `<span class="product__tag">${escapeHtml(item.tag)}</span>` : ''}
          <button class="product__add" type="button" data-add>Adicionar à sacola</button>
        </div>
        <div class="product__info">
          <h3 class="product__name">${escapeHtml(item.nome)}</h3>
          ${item.meta ? `<p class="product__meta">${escapeHtml(item.meta)}</p>` : ''}
          <p class="product__price">${money(item.preco)}</p>
        </div>
      </article>`
    )
    .join('');
}

function renderSpotlight(item) {
  const section = document.getElementById('spotlight');
  if (!item) {
    section.hidden = true;
    return;
  }

  const image = document.getElementById('spotlightImg');
  image.src = item.imagem;
  image.alt = `${item.nome}${item.meta ? ' — ' + item.meta : ''}`;
  document.getElementById('spotlightName').textContent = item.nome;
  document.getElementById('spotlightDesc').textContent =
    item.meta || 'Escolhida à mão para quem gosta de elegância sem esforço.';
  document.getElementById('spotlightPrice').textContent = money(item.preco);

  const button = document.getElementById('spotlightAdd');
  button.dataset.id = item.id;
  button.dataset.name = item.nome;
  button.dataset.price = item.preco;
  button.dataset.image = item.imagem;

  section.hidden = false;
}

/* --------------------------------------------------------------------------
   Sacola
   -------------------------------------------------------------------------- */

function readCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (!saved || typeof saved !== 'object') return {};
    const clean = {};
    Object.entries(saved).forEach(([id, qty]) => {
      if (catalog.has(id) && Number(qty) > 0) clean[id] = Math.min(99, Number(qty));
    });
    return clean;
  } catch {
    return {};
  }
}

function saveCart() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch {
    /* modo privado: a sacola dura o que durar a visita */
  }
}

function cartItems() {
  return Object.entries(cart)
    .map(([id, qty]) => ({ ...catalog.get(id), qty }))
    .filter((item) => item && item.nome);
}

function cartTotal() {
  return cartItems().reduce((sum, item) => sum + item.preco * item.qty, 0);
}

function renderCart() {
  const items = cartItems();
  const count = items.reduce((sum, item) => sum + item.qty, 0);

  bagCount.textContent = count;
  bagBtn.setAttribute(
    'aria-label',
    count ? `Abrir sacola, ${count} ${count === 1 ? 'peça' : 'peças'}` : 'Abrir sacola, vazia'
  );

  if (!items.length) {
    drawerBody.innerHTML = `
      <p class="empty">
        <strong>Sua sacola está vazia</strong>
        Escolha uma peça da coleção e ela aparece aqui.
      </p>`;
    drawerFoot.hidden = true;
    return;
  }

  drawerBody.innerHTML = items
    .map(
      (item) => `
      <div class="cart-item">
        <img class="cart-item__img" src="${escapeHtml(item.imagem)}" alt="${escapeHtml(item.nome)}" width="72" height="92" loading="lazy" />
        <div>
          <p class="cart-item__name">${escapeHtml(item.nome)}</p>
          <p class="cart-item__meta">${money(item.preco)}</p>
          <div class="cart-item__qty">
            <button class="qty-btn" type="button" data-act="dec" data-id="${escapeHtml(item.id)}" aria-label="Diminuir quantidade de ${escapeHtml(item.nome)}">
              <svg class="icon"><use href="#i-minus"/></svg>
            </button>
            <span>${item.qty}</span>
            <button class="qty-btn" type="button" data-act="inc" data-id="${escapeHtml(item.id)}" aria-label="Aumentar quantidade de ${escapeHtml(item.nome)}">
              <svg class="icon"><use href="#i-plus"/></svg>
            </button>
          </div>
        </div>
        <div class="cart-item__side">
          <strong>${money(item.preco * item.qty)}</strong>
          <button class="cart-item__remove" type="button" data-act="remove" data-id="${escapeHtml(item.id)}">Remover</button>
        </div>
      </div>`
    )
    .join('');

  const total = cartTotal();
  drawerTotal.textContent = money(total);
  drawerFoot.hidden = false;

  const lines = items
    .map((item) => `• ${item.nome} — ${item.qty} un. — ${money(item.preco * item.qty)}`)
    .join('\n');

  checkoutBtn.href = whatsappUrl(
    `Olá! Vim pelo site da Delicatta Cristã e quero fazer este pedido:\n\n${lines}\n\nTotal: ${money(total)}\n\nPode me ajudar com tamanho e frete?`
  );
}

function toastMessage(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastMessage.timer);
  toastMessage.timer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function addToCart(id) {
  if (!catalog.has(id)) return;
  cart[id] = (cart[id] || 0) + 1;
  saveCart();
  renderCart();
  toastMessage(`${catalog.get(id).nome} foi para a sacola`);
  openCart();
}

function changeQty(id, delta) {
  if (!cart[id]) return;
  cart[id] += delta;
  if (cart[id] <= 0) delete cart[id];
  if (cart[id] > 99) cart[id] = 99;
  saveCart();
  renderCart();
}

function openCart() {
  renderCart();
  drawer.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add('is-visible'));
  document.body.classList.add('no-scroll');
  drawerClose.focus({ preventScroll: true });
}

function closeCart() {
  drawer.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  overlay.classList.remove('is-visible');
  document.body.classList.remove('no-scroll');
  setTimeout(() => {
    if (!drawer.classList.contains('is-open')) overlay.hidden = true;
  }, 400);
  bagBtn.focus({ preventScroll: true });
}

/* --------------------------------------------------------------------------
   Eventos
   -------------------------------------------------------------------------- */

document.addEventListener('click', (event) => {
  const addButton = event.target.closest('[data-add]');
  if (addButton) {
    const source = addButton.closest('.product') || addButton;
    addToCart(source.dataset.id);
    return;
  }

  const action = event.target.closest('[data-act]');
  if (action) {
    const { act, id } = action.dataset;
    if (act === 'inc') changeQty(id, 1);
    if (act === 'dec') changeQty(id, -1);
    if (act === 'remove') {
      delete cart[id];
      saveCart();
      renderCart();
    }
  }
});

filtersBox.addEventListener('click', (event) => {
  const button = event.target.closest('.filter');
  if (!button) return;

  filtersBox.querySelectorAll('.filter').forEach((item) => item.classList.remove('is-active'));
  button.classList.add('is-active');

  const filter = button.dataset.filter;
  productsGrid.querySelectorAll('.product').forEach((card) => {
    const show = filter === 'todos' || card.dataset.category === filter;
    card.classList.toggle('is-hidden', !show);
  });
});

bagBtn.addEventListener('click', openCart);
drawerClose.addEventListener('click', closeCart);
overlay.addEventListener('click', closeCart);
clearBtn.addEventListener('click', () => {
  cart = {};
  saveCart();
  renderCart();
  toastMessage('Sacola esvaziada');
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (drawer.classList.contains('is-open')) closeCart();
  if (mobileMenu.classList.contains('is-open')) toggleMenu(false);
});

/* --------------------------------------------------------------------------
   Menu mobile
   -------------------------------------------------------------------------- */

function toggleMenu(force) {
  const open = typeof force === 'boolean' ? force : !mobileMenu.classList.contains('is-open');
  mobileMenu.classList.toggle('is-open', open);
  mobileMenu.setAttribute('aria-hidden', String(!open));
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  menuBtn.querySelector('use').setAttribute('href', open ? '#i-close' : '#i-menu');
  document.body.classList.toggle('no-scroll', open || drawer.classList.contains('is-open'));
}

menuBtn.addEventListener('click', () => toggleMenu());
mobileMenu.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => toggleMenu(false));
});

/* --------------------------------------------------------------------------
   Header ao rolar
   -------------------------------------------------------------------------- */

function onScroll() {
  header.classList.toggle('is-scrolled', window.scrollY > 12);
}

window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* --------------------------------------------------------------------------
   Animações de entrada
   -------------------------------------------------------------------------- */

function observeReveals() {
  const targets = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    targets.forEach((target) => target.classList.add('in'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
  );

  targets.forEach((target) => observer.observe(target));
}

/* --------------------------------------------------------------------------
   Inicialização
   -------------------------------------------------------------------------- */

async function init() {
  observeReveals();
  document.getElementById('year').textContent = new Date().getFullYear();

  try {
    const data = await loadCatalog();
    products = data.produtos;
    products.forEach((item) => catalog.set(item.id, item));

    renderAnnounce(data.aviso);
    renderFilters(products);
    renderProducts(products);
    renderSpotlight(products.find((item) => item.destaque));
  } catch (error) {
    announce.hidden = true;
    productsGrid.innerHTML =
      '<p class="products__loading">Não foi possível carregar a coleção agora. Recarregue a página em instantes.</p>';
    filtersBox.innerHTML = '';
    console.error('Falha ao carregar produtos.json:', error);
  }

  cart = readCart();
  renderCart();
}

init();
