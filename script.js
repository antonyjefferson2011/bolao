/* Delicatta Cristã — interações da página de vendas */

const CONFIG = {
  whatsapp: '5586998174869', // troque pelo número real, com DDI + DDD
  instagram: 'delicattacrista',
};

/* --------------------------------------------------------------------------
   Catálogo (lido do HTML, para a sacola acompanhar os produtos da página)
   -------------------------------------------------------------------------- */

const catalog = new Map();

document.querySelectorAll('.product').forEach((card) => {
  catalog.set(card.dataset.id, {
    id: card.dataset.id,
    name: card.dataset.name,
    price: Number(card.dataset.price),
    image: card.dataset.image,
  });
});

/* --------------------------------------------------------------------------
   Estado da sacola
   -------------------------------------------------------------------------- */

const STORAGE_KEY = 'delicatta_sacola';

function readCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (!saved || typeof saved !== 'object') return {};
    const cart = {};
    Object.entries(saved).forEach(([id, qty]) => {
      if (catalog.has(id) && Number(qty) > 0) cart[id] = Math.min(99, Number(qty));
    });
    return cart;
  } catch {
    return {};
  }
}

let cart = readCart();

function saveCart() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch {
    /* modo privado: a sacola só dura a visita */
  }
}

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

function cartItems() {
  return Object.entries(cart)
    .map(([id, qty]) => ({ ...catalog.get(id), qty }))
    .filter((item) => item.name);
}

function cartTotal() {
  return cartItems().reduce((sum, item) => sum + item.price * item.qty, 0);
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

/* --------------------------------------------------------------------------
   Links de WhatsApp e Instagram
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

const instaLink = document.querySelector('a[href^="https://instagram.com/"]');
if (instaLink) instaLink.href = `https://instagram.com/${CONFIG.instagram}`;

/* --------------------------------------------------------------------------
   Sacola: renderização
   -------------------------------------------------------------------------- */

function renderCart() {
  const items = cartItems();
  const count = items.reduce((sum, item) => sum + item.qty, 0);

  bagCount.textContent = count;
  bagBtn.setAttribute('aria-label', count ? `Abrir sacola, ${count} ${count === 1 ? 'peça' : 'peças'}` : 'Abrir sacola, vazia');

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
    .map((item) => `
      <div class="cart-item">
        <img class="cart-item__img" src="${item.image}" alt="${escapeHtml(item.name)}" width="72" height="92" loading="lazy" />
        <div>
          <p class="cart-item__name">${escapeHtml(item.name)}</p>
          <p class="cart-item__meta">${money(item.price)}</p>
          <div class="cart-item__qty">
            <button class="qty-btn" type="button" data-act="dec" data-id="${item.id}" aria-label="Diminuir quantidade de ${escapeHtml(item.name)}">
              <svg class="icon"><use href="#i-minus"/></svg>
            </button>
            <span>${item.qty}</span>
            <button class="qty-btn" type="button" data-act="inc" data-id="${item.id}" aria-label="Aumentar quantidade de ${escapeHtml(item.name)}">
              <svg class="icon"><use href="#i-plus"/></svg>
            </button>
          </div>
        </div>
        <div class="cart-item__side">
          <strong>${money(item.price * item.qty)}</strong>
          <button class="cart-item__remove" type="button" data-act="remove" data-id="${item.id}">Remover</button>
        </div>
      </div>`)
    .join('');

  const total = cartTotal();
  drawerTotal.textContent = money(total);
  drawerFoot.hidden = false;

  const lines = items
    .map((item) => `• ${item.name} — ${item.qty} un. — ${money(item.price * item.qty)}`)
    .join('\n');

  checkoutBtn.href = whatsappUrl(
    `Olá! Vim pelo site da Delicatta Cristã e quero fazer este pedido:\n\n${lines}\n\nTotal: ${money(total)}\n\nPode me ajudar com tamanho e frete?`
  );
}

/* --------------------------------------------------------------------------
   Sacola: ações
   -------------------------------------------------------------------------- */

function toastMessage(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastMessage.timer);
  toastMessage.timer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function addToCart(product) {
  if (!product || !product.id) return;
  cart[product.id] = (cart[product.id] || 0) + 1;
  saveCart();
  renderCart();
  toastMessage(`${product.name} foi para a sacola`);
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

function removeItem(id) {
  delete cart[id];
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

document.addEventListener('click', (event) => {
  const addButton = event.target.closest('[data-add]');
  if (addButton) {
    const source = addButton.closest('.product') || addButton;
    addToCart({
      id: source.dataset.id,
      name: source.dataset.name,
      price: Number(source.dataset.price),
      image: source.dataset.image,
    });
    return;
  }

  const action = event.target.closest('[data-act]');
  if (action) {
    const { act, id } = action.dataset;
    if (act === 'inc') changeQty(id, 1);
    if (act === 'dec') changeQty(id, -1);
    if (act === 'remove') removeItem(id);
  }
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
   Filtros da coleção
   -------------------------------------------------------------------------- */

const filterButtons = document.querySelectorAll('.filter');
const productCards = document.querySelectorAll('.product');

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    filterButtons.forEach((item) => item.classList.remove('is-active'));
    button.classList.add('is-active');

    const filter = button.dataset.filter;
    productCards.forEach((card) => {
      const show = filter === 'todos' || card.dataset.category === filter;
      card.classList.toggle('is-hidden', !show);
    });
  });
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

const revealTargets = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
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

  revealTargets.forEach((target) => observer.observe(target));
} else {
  revealTargets.forEach((target) => target.classList.add('in'));
}

/* --------------------------------------------------------------------------
   Inicialização
   -------------------------------------------------------------------------- */

document.getElementById('year').textContent = new Date().getFullYear();
renderCart();
