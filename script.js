/* ============================================================================
   BOLÃO DA ENNES — script.js
   Toda a lógica do site: Firebase (Firestore), TheSportsDB API, navegação,
   formulários, painel administrativo e cálculo automático de resultados.
   ============================================================================

   ---------------------------------------------------------------------------
   COMO ALTERAR A SENHA DO PAINEL ADMINISTRATIVO:
   Basta trocar o valor da constante SENHA_ADMIN abaixo por uma nova senha.
   ---------------------------------------------------------------------------
*/
const SENHA_ADMIN = "ennes2026"; // <-- ALTERE AQUI A SENHA DO PAINEL ADMIN

/* ---------------------------------------------------------------------------
   COMO PERSONALIZAR O VALOR DA APOSTA:
   O valor da aposta NÃO é fixo no código — ele é salvo no Firestore, na
   coleção "configuracoes" (documento "geral", campo "valorAposta").
   Para alterá-lo, use o Painel Administrativo > Configurações > "Valor da
   aposta (R$)" e clique em "Salvar Configurações". O site inteiro (cartão
   inicial, formulário de palpite, cálculo de prêmios) usa sempre o valor
   salvo ali automaticamente.
   --------------------------------------------------------------------------- */

// ============================================================================
// 1. CONFIGURAÇÃO DO FIREBASE (exatamente como fornecido pelo usuário)
// ============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics, isSupported as analyticsIsSupported } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc,
  updateDoc, deleteDoc, query, where, orderBy, onSnapshot, increment, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAnpqLos4gtwIF6fgbh9Y9RIEZScrX33u0",
  authDomain: "bizflow-oficial.firebaseapp.com",
  databaseURL: "https://bizflow-oficial-default-rtdb.firebaseio.com",
  projectId: "bizflow-oficial",
  storageBucket: "bizflow-oficial.firebasestorage.app",
  messagingSenderId: "767888965470",
  appId: "1:767888965470:web:ba38371163e030adfad9cf",
  measurementId: "G-G4702KC57C"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Analytics só é inicializado se o navegador suportar (evita erros em alguns ambientes)
analyticsIsSupported().then((suportado) => {
  if (suportado) getAnalytics(app);
}).catch(() => {});

// ============================================================================
// 2. CONFIGURAÇÃO DA API THESPORTSDB
// ============================================================================
const API_KEY = "123";
const API_BASE = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;
const ID_BRASIL = "133753"; // ID da seleção do Brasil no TheSportsDB

// ============================================================================
// 3. REFERÊNCIAS DE COLEÇÕES DO FIRESTORE
// ============================================================================
const refUsuarios     = collection(db, "usuarios");
const refPalpites     = collection(db, "palpites");
const refPagamentos   = collection(db, "pagamentos");
const refJogos        = collection(db, "jogos");
const refConfig       = doc(db, "configuracoes", "geral");
const refHistorico    = collection(db, "historico");
const refRanking      = collection(db, "ranking");

// ============================================================================
// 4. ESTADO GLOBAL DA APLICAÇÃO
// ============================================================================
const estado = {
  configuracoes: { valorAposta: 10, limiteApostas: 1, statusApostas: "aberto", saldoAcumulado: 0 },
  jogos: [],
  palpites: [],
  participantes: [],
  pagamentos: [],
  jogoAtual: null,        // próximo jogo em destaque
  adminLogado: false
};

let intervaloContagem = null;

// ============================================================================
// 5. UTILITÁRIOS
// ============================================================================

/** Formata número como moeda brasileira */
function formatarMoeda(valor) {
  return (Number(valor) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Formata data ISO (YYYY-MM-DD) para DD/MM/AAAA */
function formatarData(dataISO) {
  if (!dataISO) return "--/--/----";
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Mostra um aviso (sucesso ou erro) em um elemento por um tempo */
function mostrarAviso(idElemento, mensagem, tipo = "sucesso", duracao = 4000) {
  const el = document.getElementById(idElemento);
  if (!el) return;
  el.textContent = mensagem;
  el.className = `aviso mostrar ${tipo}`;
  setTimeout(() => el.classList.remove("mostrar"), duracao);
}

/** Troca a seção visível (navegação por abas) */
function irParaSecao(nomeSecao) {
  document.querySelectorAll(".secao").forEach(s => s.classList.remove("ativa"));
  document.getElementById(`secao-${nomeSecao}`)?.classList.add("ativa");

  document.querySelectorAll(".aba-btn").forEach(b => b.classList.toggle("ativa", b.dataset.secao === nomeSecao));
  document.querySelectorAll("#menu-inferior button").forEach(b => b.classList.toggle("ativa", b.dataset.secao === nomeSecao));

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================================
// 6. INTEGRAÇÃO COM A API THESPORTSDB
// ============================================================================

/** Busca os próximos jogos da Seleção Brasileira */
async function buscarProximosJogosAPI() {
  try {
    const resp = await fetch(`${API_BASE}/eventsnext.php?id=${ID_BRASIL}`);
    const dados = await resp.json();
    return dados.events || [];
  } catch (erro) {
    console.error("Erro ao buscar próximos jogos da API:", erro);
    return [];
  }
}

/** Busca os últimos resultados da Seleção Brasileira */
async function buscarUltimosResultadosAPI() {
  try {
    const resp = await fetch(`${API_BASE}/eventslast.php?id=${ID_BRASIL}`);
    const dados = await resp.json();
    return dados.results || [];
  } catch (erro) {
    console.error("Erro ao buscar últimos resultados da API:", erro);
    return [];
  }
}

/** Busca o escudo de um time pelo nome (usado quando a API não fornece direto) */
async function buscarEscudoTime(nomeTime) {
  try {
    const resp = await fetch(`${API_BASE}/searchteams.php?t=${encodeURIComponent(nomeTime)}`);
    const dados = await resp.json();
    return dados.teams?.[0]?.strTeamBadge || "";
  } catch {
    return "";
  }
}

/**
 * Sincroniza os jogos da API com a coleção "jogos" do Firestore.
 * Jogos que já existem (mesmo idEvento) não são duplicados.
 */
async function sincronizarJogosComFirestore() {
  const proximos = await buscarProximosJogosAPI();
  const resultados = await buscarUltimosResultadosAPI();
  const todosEventosAPI = [...proximos, ...resultados];

  const snapshotJogos = await getDocs(refJogos);
  const idsExistentes = new Set(snapshotJogos.docs.map(d => d.data().idEventoAPI).filter(Boolean));

  for (const evento of todosEventosAPI) {
    if (idsExistentes.has(evento.idEvent)) continue; // já existe, evita duplicar

    const ehBrasilCasa = evento.idHomeTeam === ID_BRASIL;
    const adversarioNome = ehBrasilCasa ? evento.strAwayTeam : evento.strHomeTeam;
    let escudoAdversario = ehBrasilCasa ? evento.strAwayTeamBadge : evento.strHomeTeamBadge;
    if (!escudoAdversario) escudoAdversario = await buscarEscudoTime(adversarioNome);

    const placarBrasil = ehBrasilCasa ? evento.intHomeScore : evento.intAwayScore;
    const placarAdversario = ehBrasilCasa ? evento.intAwayScore : evento.intHomeScore;

    await addDoc(refJogos, {
      idEventoAPI: evento.idEvent,
      adversario: adversarioNome || "Adversário",
      escudoAdversario: escudoAdversario || "",
      escudoBrasil: "https://r2.thesportsdb.com/images/media/team/badge/y2sosx1473502165.png",
      data: evento.dateEvent || "",
      hora: evento.strTime ? evento.strTime.substring(0, 5) : "",
      placarBrasil: placarBrasil !== null && placarBrasil !== undefined ? Number(placarBrasil) : null,
      placarAdversario: placarAdversario !== null && placarAdversario !== undefined ? Number(placarAdversario) : null,
      finalizado: placarBrasil !== null && placarBrasil !== undefined,
      criadoEm: serverTimestamp(),
      origemManual: false
    });
  }
}

// ============================================================================
// 7. CONFIGURAÇÕES (Firestore: configuracoes/geral)
// ============================================================================

async function carregarConfiguracoes() {
  const snap = await getDoc(refConfig);
  if (snap.exists()) {
    estado.configuracoes = { ...estado.configuracoes, ...snap.data() };
  } else {
    // cria o documento padrão na primeira execução
    await setDoc(refConfig, estado.configuracoes);
  }
}

function ouvirConfiguracoes() {
  onSnapshot(refConfig, (snap) => {
    if (snap.exists()) {
      estado.configuracoes = { ...estado.configuracoes, ...snap.data() };
      renderizarTudoQueDependeDeConfig();
    }
  });
}

function renderizarTudoQueDependeDeConfig() {
  renderizarGridInicio();
  renderizarFormularioPalpite();
  preencherFormularioConfigAdmin();
}

// ============================================================================
// 8. CARTÃO DO PRÓXIMO JOGO + CONTAGEM REGRESSIVA
// ============================================================================

function definirJogoAtual() {
  const agora = new Date();
  // próximo jogo não finalizado, ordenado por data/hora
  const futuros = estado.jogos
    .filter(j => !j.finalizado)
    .sort((a, b) => new Date(`${a.data}T${a.hora || "00:00"}`) - new Date(`${b.data}T${b.hora || "00:00"}`));

  estado.jogoAtual = futuros[0] || null;
}

function renderizarCardProximoJogo() {
  const card = document.getElementById("card-proximo-jogo");
  const jogo = estado.jogoAtual;

  if (!jogo) {
    card.innerHTML = `<div class="vazio-msg">Nenhum jogo futuro encontrado no momento.</div>`;
    if (intervaloContagem) clearInterval(intervaloContagem);
    return;
  }

  card.innerHTML = `
    <div style="font-size:0.75rem; color:var(--cinza); text-transform:uppercase; letter-spacing:.5px;">Próximo Jogo do Brasil</div>
    <div class="jogo-confronto">
      <div class="time">
        <img src="${jogo.escudoBrasil || ''}" alt="Brasil" onerror="this.style.display='none'">
        <span>Brasil</span>
      </div>
      <div class="vs">VS</div>
      <div class="time">
        <img src="${jogo.escudoAdversario || ''}" alt="${jogo.adversario}" onerror="this.style.display='none'">
        <span>${jogo.adversario}</span>
      </div>
    </div>
    <div class="jogo-info-linha">
      <span>📅 <b>${formatarData(jogo.data)}</b></span>
      <span>⏰ <b>${jogo.hora || "A definir"}</b></span>
    </div>
    <div class="contagem-regressiva" id="contagem-regressiva"></div>
  `;

  iniciarContagemRegressiva(jogo);
}

function iniciarContagemRegressiva(jogo) {
  if (intervaloContagem) clearInterval(intervaloContagem);
  const elemento = document.getElementById("contagem-regressiva");
  if (!elemento || !jogo.data) return;

  const dataAlvo = new Date(`${jogo.data}T${jogo.hora || "00:00"}:00`);

  function atualizar() {
    const diff = dataAlvo.getTime() - Date.now();
    if (diff <= 0) {
      elemento.innerHTML = `<div style="color:var(--verde); font-weight:700;">⚽ Jogo em andamento ou finalizado!</div>`;
      clearInterval(intervaloContagem);
      return;
    }
    const dias = Math.floor(diff / 86400000);
    const horas = Math.floor((diff % 86400000) / 3600000);
    const minutos = Math.floor((diff % 3600000) / 60000);
    const segundos = Math.floor((diff % 60000) / 1000);

    elemento.innerHTML = `
      <div class="cr-bloco"><span class="num">${dias}</span><span class="label">dias</span></div>
      <div class="cr-bloco"><span class="num">${horas}</span><span class="label">horas</span></div>
      <div class="cr-bloco"><span class="num">${minutos}</span><span class="label">min</span></div>
      <div class="cr-bloco"><span class="num">${segundos}</span><span class="label">seg</span></div>
    `;
  }

  atualizar();
  intervaloContagem = setInterval(atualizar, 1000);
}

// ============================================================================
// 9. GRID DE ESTATÍSTICAS RÁPIDAS (TELA INICIAL)
// ============================================================================

function renderizarGridInicio() {
  const grid = document.getElementById("grid-stats-inicio");
  if (!grid) return;

  const premioAtual = calcularPremioAtual();
  const qtdParticipantes = estado.participantes.length;
  const qtdPalpites = estado.palpites.length;

  grid.innerHTML = `
    <div class="stat-mini"><div class="valor">${formatarMoeda(estado.configuracoes.valorAposta)}</div><div class="rotulo">Valor da Aposta</div></div>
    <div class="stat-mini"><div class="valor">${formatarMoeda(premioAtual)}</div><div class="rotulo">Prêmio Atual</div></div>
    <div class="stat-mini"><div class="valor">${qtdParticipantes}</div><div class="rotulo">Participantes</div></div>
    <div class="stat-mini"><div class="valor">${qtdPalpites}</div><div class="rotulo">Palpites</div></div>
  `;
}

/** Prêmio atual = (valor da aposta × nº de palpites) + saldo acumulado */
function calcularPremioAtual() {
  const total = estado.palpites.length * Number(estado.configuracoes.valorAposta || 0);
  return total + Number(estado.configuracoes.saldoAcumulado || 0);
}

// ============================================================================
// 10. ÚLTIMOS VENCEDORES
// ============================================================================

function renderizarUltimosVencedores() {
  const container = document.getElementById("card-ultimos-vencedores");
  // busca no histórico os últimos bolões com vencedores
  getDocs(query(refHistorico, orderBy("finalizadoEm", "desc"))).then(snap => {
    const itens = snap.docs.map(d => d.data()).filter(h => h.vencedores && h.vencedores.length > 0).slice(0, 5);
    if (itens.length === 0) {
      container.innerHTML = `<div class="vazio-msg">Nenhum vencedor registrado ainda.</div>`;
      return;
    }
    container.innerHTML = itens.map(item => `
      <div class="vencedor-item">
        <div>
          <div class="vencedor-nome">${item.vencedores.map(v => v.nome).join(", ")}</div>
          <div class="vencedor-jogo">${item.tituloJogo || ""} — Placar: ${item.placarFinal || ""}</div>
        </div>
        <div class="vencedor-premio">${formatarMoeda(item.premioTotal)}</div>
      </div>
    `).join("");
  }).catch(() => {
    container.innerHTML = `<div class="vazio-msg">Nenhum vencedor registrado ainda.</div>`;
  });
}

// ============================================================================
// 11. PRÓXIMOS JOGOS (LISTA COMPLETA)
// ============================================================================

function renderizarListaProximosJogos() {
  const container = document.getElementById("lista-proximos-jogos");
  if (!estado.jogos.length) {
    container.innerHTML = `<div class="vazio-msg">Nenhum jogo cadastrado.</div>`;
    return;
  }

  const ordenados = [...estado.jogos].sort((a, b) => new Date(`${a.data}T${a.hora||"00:00"}`) - new Date(`${b.data}T${b.hora||"00:00"}`));

  container.innerHTML = ordenados.map(jogo => `
    <div class="jogo-card">
      <div class="time-mini"><img src="${jogo.escudoBrasil||''}" onerror="this.style.display='none'"><span>Brasil</span></div>
      <div class="centro">
        ${jogo.finalizado
          ? `<div class="placar-final">${jogo.placarBrasil} x ${jogo.placarAdversario}</div>`
          : `<div class="placar-final" style="font-size:1rem; color:var(--cinza);">VS</div>`}
        <div class="data-hora">${formatarData(jogo.data)} · ${jogo.hora||"--:--"}</div>
        <span class="badge-status ${jogo.finalizado ? "badge-encerrado" : "badge-agendado"}">${jogo.finalizado ? "Encerrado" : "Agendado"}</span>
      </div>
      <div class="time-mini"><img src="${jogo.escudoAdversario||''}" onerror="this.style.display='none'"><span>${jogo.adversario}</span></div>
    </div>
  `).join("");
}

// ============================================================================
// 12. RANKING DE APOSTADORES
// ============================================================================

function renderizarRanking() {
  const container = document.getElementById("lista-ranking");

  // Agrega dados a partir dos palpites + pagamentos para montar o ranking
  const mapa = {};
  estado.palpites.forEach(p => {
    const chave = p.nome.trim().toLowerCase();
    if (!mapa[chave]) mapa[chave] = { nome: p.nome, apostas: 0, vitorias: 0, ganho: 0 };
    mapa[chave].apostas++;
    if (p.acertou) mapa[chave].vitorias++;
    if (p.premioRecebido) mapa[chave].ganho += Number(p.premioRecebido);
  });

  const lista = Object.values(mapa).sort((a, b) => b.ganho - a.ganho || b.vitorias - a.vitorias);

  if (lista.length === 0) {
    container.innerHTML = `<div class="vazio-msg">Nenhum apostador no ranking ainda.</div>`;
    return;
  }

  container.innerHTML = lista.map((item, i) => {
    const posClasse = i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : "";
    const medalha = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (i + 1);
    return `
      <div class="ranking-item">
        <div class="ranking-pos ${posClasse}">${medalha}</div>
        <div class="ranking-info">
          <div class="ranking-nome">${item.nome}</div>
          <div class="ranking-sub">${item.apostas} apostas · ${item.vitorias} vitórias</div>
        </div>
        <div class="ranking-ganho">${formatarMoeda(item.ganho)}</div>
      </div>
    `;
  }).join("");
}

// ============================================================================
// 13. ESTATÍSTICAS GERAIS
// ============================================================================

function renderizarEstatisticas() {
  const grid = document.getElementById("grid-estatisticas-gerais");
  const totalArrecadado = estado.palpites.length * Number(estado.configuracoes.valorAposta || 0);

  grid.innerHTML = `
    <div class="stat-mini"><div class="valor">${estado.participantes.length}</div><div class="rotulo">Participantes</div></div>
    <div class="stat-mini"><div class="valor">${formatarMoeda(totalArrecadado)}</div><div class="rotulo">Total Arrecadado</div></div>
    <div class="stat-mini"><div class="valor">${formatarMoeda(calcularPremioAtual())}</div><div class="rotulo">Prêmio Atual</div></div>
    <div class="stat-mini"><div class="valor">${estado.palpites.length}</div><div class="rotulo">Total de Palpites</div></div>
  `;

  // placar mais apostado
  const contagemPlacares = {};
  estado.palpites.forEach(p => {
    const chave = `${p.placarBrasil} x ${p.placarAdversario}`;
    contagemPlacares[chave] = (contagemPlacares[chave] || 0) + 1;
  });
  const placares = Object.entries(contagemPlacares).sort((a, b) => b[1] - a[1]);
  const containerPlacar = document.getElementById("card-placar-mais-apostado");

  if (placares.length === 0) {
    containerPlacar.innerHTML = `<div class="vazio-msg">Ainda não há palpites suficientes.</div>`;
  } else {
    const [placarTop, qtd] = placares[0];
    containerPlacar.innerHTML = `
      <div style="text-align:center;">
        <div style="font-size:2rem; font-weight:900; color:var(--azul-claro);">${placarTop}</div>
        <div style="color:var(--cinza); font-size:0.8rem; margin-top:4px;">${qtd} pessoa(s) apostaram nesse placar</div>
      </div>
    `;
  }
}

// ============================================================================
// 14. FORMULÁRIO DE PALPITE (USUÁRIO)
// ============================================================================

function renderizarFormularioPalpite() {
  const labelBrasil = document.getElementById("label-placar-brasil");
  const labelAdversario = document.getElementById("label-placar-adversario");
  const infoValor = document.getElementById("palpite-valor-info");
  const botaoEnviar = document.querySelector("#form-palpite button[type=submit]");

  if (estado.jogoAtual) {
    labelAdversario.textContent = `Placar ${estado.jogoAtual.adversario}`;
  }
  infoValor.value = formatarMoeda(estado.configuracoes.valorAposta);

  const apostasFechadas = estado.configuracoes.statusApostas === "fechado";
  botaoEnviar.disabled = apostasFechadas;
  botaoEnviar.textContent = apostasFechadas ? "Apostas Encerradas" : "Enviar Palpite";
}

async function enviarPalpite(evento) {
  evento.preventDefault();

  if (estado.configuracoes.statusApostas === "fechado") {
    mostrarAviso("aviso-palpite", "As apostas estão encerradas no momento.", "erro");
    return;
  }
  if (!estado.jogoAtual) {
    mostrarAviso("aviso-palpite", "Não há jogo disponível para apostar agora.", "erro");
    return;
  }

  const nome = document.getElementById("palpite-nome").value.trim();
  const placarBrasil = Number(document.getElementById("palpite-brasil").value);
  const placarAdversario = Number(document.getElementById("palpite-adversario").value);

  if (!nome) {
    mostrarAviso("aviso-palpite", "Informe seu nome completo.", "erro");
    return;
  }

  // valida limite de apostas por pessoa
  const apostasDoUsuario = estado.palpites.filter(p =>
    p.nome.trim().toLowerCase() === nome.toLowerCase() && p.idJogo === estado.jogoAtual.id
  );
  if (apostasDoUsuario.length >= Number(estado.configuracoes.limiteApostas || 1)) {
    mostrarAviso("aviso-palpite", `Limite de ${estado.configuracoes.limiteApostas} aposta(s) por pessoa atingido para este jogo.`, "erro");
    return;
  }

  try {
    // garante que o participante existe na coleção "usuarios"
    await garantirParticipante(nome);

    await addDoc(refPalpites, {
      nome,
      idJogo: estado.jogoAtual.id,
      placarBrasil,
      placarAdversario,
      acertou: false,
      premioRecebido: 0,
      criadoEm: serverTimestamp()
    });

    mostrarAviso("aviso-palpite", "Palpite enviado com sucesso! Boa sorte! 🍀", "sucesso");
    document.getElementById("form-palpite").reset();
    renderizarFormularioPalpite();
  } catch (erro) {
    console.error(erro);
    mostrarAviso("aviso-palpite", "Erro ao enviar palpite. Tente novamente.", "erro");
  }
}

/** Cria o participante em "usuarios" caso ele ainda não exista */
async function garantirParticipante(nome) {
  const existente = estado.participantes.find(p => p.nome.trim().toLowerCase() === nome.trim().toLowerCase());
  if (existente) return existente;
  const novoRef = await addDoc(refUsuarios, { nome, criadoEm: serverTimestamp() });
  await addDoc(refPagamentos, { idUsuario: novoRef.id, nome, pago: false, criadoEm: serverTimestamp() });
  return { id: novoRef.id, nome };
}

// ============================================================================
// 15. CÁLCULO AUTOMÁTICO DE RESULTADOS E PREMIAÇÃO
// ============================================================================

/**
 * Verifica jogos finalizados que ainda não tiveram a premiação processada,
 * encontra os palpites vencedores, calcula e divide o prêmio, e registra
 * tudo na coleção "historico". Saldo excedente (caso a divisão não seja
 * exata) é guardado automaticamente em "configuracoes.saldoAcumulado".
 */
async function processarResultadosFinalizados() {
  const jogosFinalizadosNaoProcessados = estado.jogos.filter(j => j.finalizado && !j.premiacaoProcessada);

  for (const jogo of jogosFinalizadosNaoProcessados) {
    const palpitesDoJogo = estado.palpites.filter(p => p.idJogo === jogo.id);
    const vencedores = palpitesDoJogo.filter(p =>
      Number(p.placarBrasil) === Number(jogo.placarBrasil) &&
      Number(p.placarAdversario) === Number(jogo.placarAdversario)
    );

    const premioTotal = calcularPremioAtual();
    let premioPorVencedor = 0;
    let sobra = 0;

    if (vencedores.length > 0) {
      premioPorVencedor = Math.floor((premioTotal / vencedores.length) * 100) / 100; // arredonda pra baixo (2 casas)
      sobra = Math.round((premioTotal - premioPorVencedor * vencedores.length) * 100) / 100;

      // marca cada palpite vencedor com o prêmio recebido
      for (const vencedor of vencedores) {
        await updateDoc(doc(db, "palpites", vencedor.id), { acertou: true, premioRecebido: premioPorVencedor });
      }
    } else {
      // ninguém acertou — todo o prêmio vira saldo acumulado
      sobra = premioTotal;
    }

    // guarda a sobra (ou prêmio total se ninguém ganhou) para o próximo bolão
    await updateDoc(refConfig, { saldoAcumulado: increment(sobra) });

    // registra no histórico
    await addDoc(refHistorico, {
      idJogo: jogo.id,
      tituloJogo: `Brasil x ${jogo.adversario}`,
      placarFinal: `${jogo.placarBrasil} x ${jogo.placarAdversario}`,
      vencedores: vencedores.map(v => ({ nome: v.nome, premio: premioPorVencedor })),
      premioTotal,
      quantidadeParticipantes: new Set(palpitesDoJogo.map(p => p.nome.toLowerCase())).size,
      finalizadoEm: serverTimestamp()
    });

    // marca o jogo como processado para não repetir o cálculo
    await updateDoc(doc(db, "jogos", jogo.id), { premiacaoProcessada: true });
  }
}

// ============================================================================
// 16. HISTÓRICO COMPLETO
// ============================================================================

function ouvirHistorico() {
  onSnapshot(query(refHistorico, orderBy("finalizadoEm", "desc")), (snap) => {
    const container = document.getElementById("card-historico");
    if (snap.empty) {
      container.innerHTML = `<div class="vazio-msg">Nenhum bolão finalizado ainda.</div>`;
      return;
    }
    container.innerHTML = snap.docs.map(d => {
      const item = d.data();
      const nomesVencedores = item.vencedores?.length ? item.vencedores.map(v => v.nome).join(", ") : "Ninguém acertou";
      return `
        <div class="historico-item">
          <div class="h-titulo">${item.tituloJogo} — ${item.placarFinal}</div>
          <div class="h-sub">🏅 Vencedor(es): ${nomesVencedores}</div>
          <div class="h-sub">💰 Prêmio: ${formatarMoeda(item.premioTotal)} · 👥 ${item.quantidadeParticipantes} participantes</div>
        </div>
      `;
    }).join("");
  });
}

// ============================================================================
// 17. LISTENERS EM TEMPO REAL (FIRESTORE)
// ============================================================================

function ouvirJogos() {
  onSnapshot(refJogos, async (snap) => {
    estado.jogos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    definirJogoAtual();
    renderizarCardProximoJogo();
    renderizarListaProximosJogos();
    renderizarFormularioPalpite();
    renderizarAdminListaJogos();
    await processarResultadosFinalizados();
  });
}

function ouvirPalpites() {
  onSnapshot(refPalpites, (snap) => {
    estado.palpites = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarGridInicio();
    renderizarRanking();
    renderizarEstatisticas();
    renderizarUltimosVencedores();
    renderizarAdminListaPalpites();
    renderizarEstatisticasAdmin();
  });
}

function ouvirParticipantes() {
  onSnapshot(refUsuarios, (snap) => {
    estado.participantes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarGridInicio();
    renderizarEstatisticas();
    renderizarAdminListaParticipantes();
    renderizarEstatisticasAdmin();
  });
}

function ouvirPagamentos() {
  onSnapshot(refPagamentos, (snap) => {
    estado.pagamentos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarAdminListaPagamentos();
  });
}

// ============================================================================
// 18. PAINEL ADMINISTRATIVO — LOGIN
// ============================================================================

function configurarLoginAdmin() {
  document.getElementById("form-login-admin").addEventListener("submit", (e) => {
    e.preventDefault();
    const senhaDigitada = document.getElementById("senha-admin").value;
    if (senhaDigitada === SENHA_ADMIN) {
      estado.adminLogado = true;
      document.getElementById("card-login-admin").style.display = "none";
      document.getElementById("painel-admin-conteudo").style.display = "block";
      preencherFormularioConfigAdmin();
    } else {
      mostrarAviso("aviso-login", "Senha incorreta. Tente novamente.", "erro");
    }
  });

  document.getElementById("btn-sair-admin").addEventListener("click", () => {
    estado.adminLogado = false;
    document.getElementById("card-login-admin").style.display = "block";
    document.getElementById("painel-admin-conteudo").style.display = "none";
    document.getElementById("senha-admin").value = "";
  });
}

// ============================================================================
// 19. PAINEL ADMIN — NAVEGAÇÃO INTERNA (SUBABAS)
// ============================================================================

function configurarSubnavAdmin() {
  document.querySelectorAll("#admin-subnav button").forEach(botao => {
    botao.addEventListener("click", () => {
      document.querySelectorAll("#admin-subnav button").forEach(b => b.classList.remove("ativa"));
      botao.classList.add("ativa");
      document.querySelectorAll(".admin-painel-conteudo").forEach(p => p.classList.remove("ativa"));
      document.getElementById(`admin-${botao.dataset.painel}`).classList.add("ativa");
    });
  });
}

// ============================================================================
// 20. PAINEL ADMIN — CONFIGURAÇÕES
// ============================================================================

function preencherFormularioConfigAdmin() {
  if (!estado.adminLogado) return;
  document.getElementById("cfg-valor-aposta").value = estado.configuracoes.valorAposta;
  document.getElementById("cfg-limite-apostas").value = estado.configuracoes.limiteApostas;
  document.getElementById("cfg-status-apostas").value = estado.configuracoes.statusApostas;
  document.getElementById("cfg-saldo-acumulado").value = estado.configuracoes.saldoAcumulado;
}

function configurarBotaoSalvarConfig() {
  document.getElementById("btn-salvar-config").addEventListener("click", async () => {
    try {
      await updateDoc(refConfig, {
        valorAposta: Number(document.getElementById("cfg-valor-aposta").value),
        limiteApostas: Number(document.getElementById("cfg-limite-apostas").value),
        statusApostas: document.getElementById("cfg-status-apostas").value,
        saldoAcumulado: Number(document.getElementById("cfg-saldo-acumulado").value)
      });
      mostrarAviso("aviso-config", "Configurações salvas com sucesso!", "sucesso");
    } catch (erro) {
      console.error(erro);
      mostrarAviso("aviso-config", "Erro ao salvar configurações.", "erro");
    }
  });
}

// ============================================================================
// 21. PAINEL ADMIN — GESTÃO DE JOGOS
// ============================================================================

function renderizarAdminListaJogos() {
  const container = document.getElementById("lista-admin-jogos");
  if (!container) return;
  if (!estado.jogos.length) {
    container.innerHTML = `<div class="vazio-msg">Nenhum jogo cadastrado.</div>`;
    return;
  }
  container.innerHTML = estado.jogos.map(jogo => `
    <div class="lista-admin-item">
      <div class="info">
        <b>Brasil x ${jogo.adversario}</b>
        ${formatarData(jogo.data)} às ${jogo.hora || "--:--"}
        ${jogo.finalizado ? ` · Placar: ${jogo.placarBrasil} x ${jogo.placarAdversario}` : " · Agendado"}
      </div>
      <div class="acoes">
        <button class="btn-secundario" onclick="window.editarJogoAdmin('${jogo.id}')">Editar</button>
        <button class="btn-perigo" onclick="window.excluirJogoAdmin('${jogo.id}')">Excluir</button>
      </div>
    </div>
  `).join("");
}

function configurarAdicionarJogo() {
  document.getElementById("btn-add-jogo").addEventListener("click", async () => {
    const adversario = document.getElementById("jogo-adversario").value.trim();
    const escudo = document.getElementById("jogo-escudo").value.trim();
    const data = document.getElementById("jogo-data").value;
    const hora = document.getElementById("jogo-hora").value;

    if (!adversario || !data) {
      mostrarAviso("aviso-jogo-admin", "Preencha pelo menos o adversário e a data.", "erro");
      return;
    }

    await addDoc(refJogos, {
      adversario, escudoAdversario: escudo,
      escudoBrasil: "https://r2.thesportsdb.com/images/media/team/badge/y2sosx1473502165.png",
      data, hora, placarBrasil: null, placarAdversario: null,
      finalizado: false, origemManual: true, criadoEm: serverTimestamp()
    });

    mostrarAviso("aviso-jogo-admin", "Jogo adicionado com sucesso!", "sucesso");
    document.getElementById("jogo-adversario").value = "";
    document.getElementById("jogo-escudo").value = "";
    document.getElementById("jogo-data").value = "";
    document.getElementById("jogo-hora").value = "";
  });
}

window.excluirJogoAdmin = async function (idJogo) {
  if (!confirm("Tem certeza que deseja excluir este jogo?")) return;
  await deleteDoc(doc(db, "jogos", idJogo));
};

window.editarJogoAdmin = function (idJogo) {
  const jogo = estado.jogos.find(j => j.id === idJogo);
  if (!jogo) return;

  abrirModal(`Editar jogo vs ${jogo.adversario}`, `
    <div class="form-grupo"><label>Adversário</label><input id="m-adversario" value="${jogo.adversario}"></div>
    <div class="form-grupo"><label>Escudo (URL)</label><input id="m-escudo" value="${jogo.escudoAdversario||''}"></div>
    <div class="linha-dupla">
      <div class="form-grupo"><label>Data</label><input type="date" id="m-data" value="${jogo.data||''}"></div>
      <div class="form-grupo"><label>Hora</label><input type="time" id="m-hora" value="${jogo.hora||''}"></div>
    </div>
    <div class="linha-dupla">
      <div class="form-grupo"><label>Placar Brasil</label><input type="number" id="m-placar-brasil" value="${jogo.placarBrasil ?? ''}"></div>
      <div class="form-grupo"><label>Placar Adversário</label><input type="number" id="m-placar-adversario" value="${jogo.placarAdversario ?? ''}"></div>
    </div>
  `, async () => {
    const placarBrasil = document.getElementById("m-placar-brasil").value;
    const placarAdversario = document.getElementById("m-placar-adversario").value;
    const finalizado = placarBrasil !== "" && placarAdversario !== "";

    await updateDoc(doc(db, "jogos", idJogo), {
      adversario: document.getElementById("m-adversario").value.trim(),
      escudoAdversario: document.getElementById("m-escudo").value.trim(),
      data: document.getElementById("m-data").value,
      hora: document.getElementById("m-hora").value,
      placarBrasil: finalizado ? Number(placarBrasil) : null,
      placarAdversario: finalizado ? Number(placarAdversario) : null,
      finalizado,
      premiacaoProcessada: false // permite reprocessar se o placar for corrigido
    });
  });
};

// ============================================================================
// 22. PAINEL ADMIN — GESTÃO DE PARTICIPANTES
// ============================================================================

function renderizarAdminListaParticipantes() {
  const container = document.getElementById("lista-admin-participantes");
  if (!container) return;
  if (!estado.participantes.length) {
    container.innerHTML = `<div class="vazio-msg">Nenhum participante.</div>`;
    return;
  }
  container.innerHTML = estado.participantes.map(p => `
    <div class="lista-admin-item">
      <div class="info"><b>${p.nome}</b></div>
      <div class="acoes">
        <button class="btn-secundario" onclick="window.editarParticipanteAdmin('${p.id}')">Editar</button>
        <button class="btn-perigo" onclick="window.excluirParticipanteAdmin('${p.id}')">Excluir</button>
      </div>
    </div>
  `).join("");
}

function configurarAdicionarParticipante() {
  document.getElementById("btn-add-participante").addEventListener("click", async () => {
    const nome = document.getElementById("participante-nome").value.trim();
    if (!nome) {
      mostrarAviso("aviso-participante-admin", "Informe um nome.", "erro");
      return;
    }
    await garantirParticipante(nome);
    mostrarAviso("aviso-participante-admin", "Participante adicionado!", "sucesso");
    document.getElementById("participante-nome").value = "";
  });
}

window.excluirParticipanteAdmin = async function (id) {
  if (!confirm("Excluir este participante?")) return;
  await deleteDoc(doc(db, "usuarios", id));
};

window.editarParticipanteAdmin = function (id) {
  const participante = estado.participantes.find(p => p.id === id);
  if (!participante) return;
  abrirModal("Editar participante", `
    <div class="form-grupo"><label>Nome</label><input id="m-nome-participante" value="${participante.nome}"></div>
  `, async () => {
    await updateDoc(doc(db, "usuarios", id), { nome: document.getElementById("m-nome-participante").value.trim() });
  });
};

// ============================================================================
// 23. PAINEL ADMIN — GESTÃO DE PALPITES
// ============================================================================

function renderizarAdminListaPalpites() {
  const container = document.getElementById("lista-admin-palpites");
  if (!container) return;
  if (!estado.palpites.length) {
    container.innerHTML = `<div class="vazio-msg">Nenhum palpite registrado.</div>`;
    return;
  }
  container.innerHTML = estado.palpites.slice().reverse().map(p => `
    <div class="lista-admin-item">
      <div class="info">
        <b>${p.nome}</b>
        Placar: ${p.placarBrasil} x ${p.placarAdversario}
        ${p.acertou ? `<span class="tag-pago">Acertou · ${formatarMoeda(p.premioRecebido)}</span>` : ""}
      </div>
      <div class="acoes">
        <button class="btn-secundario" onclick="window.editarPalpiteAdmin('${p.id}')">Editar</button>
        <button class="btn-perigo" onclick="window.excluirPalpiteAdmin('${p.id}')">Excluir</button>
      </div>
    </div>
  `).join("");
}

function configurarAdicionarPalpiteAdmin() {
  document.getElementById("btn-add-palpite-admin").addEventListener("click", async () => {
    const nome = document.getElementById("adm-palpite-nome").value.trim();
    const placarBrasil = Number(document.getElementById("adm-palpite-brasil").value);
    const placarAdversario = Number(document.getElementById("adm-palpite-adversario").value);

    if (!nome || !estado.jogoAtual) {
      mostrarAviso("aviso-palpite-admin", "Preencha o nome e verifique se há um jogo ativo.", "erro");
      return;
    }

    await garantirParticipante(nome);
    await addDoc(refPalpites, {
      nome, idJogo: estado.jogoAtual.id, placarBrasil, placarAdversario,
      acertou: false, premioRecebido: 0, criadoEm: serverTimestamp()
    });

    mostrarAviso("aviso-palpite-admin", "Palpite adicionado!", "sucesso");
    document.getElementById("adm-palpite-nome").value = "";
    document.getElementById("adm-palpite-brasil").value = "";
    document.getElementById("adm-palpite-adversario").value = "";
  });
}

window.excluirPalpiteAdmin = async function (id) {
  if (!confirm("Excluir este palpite?")) return;
  await deleteDoc(doc(db, "palpites", id));
};

window.editarPalpiteAdmin = function (id) {
  const palpite = estado.palpites.find(p => p.id === id);
  if (!palpite) return;
  abrirModal("Editar palpite", `
    <div class="form-grupo"><label>Nome</label><input id="m-nome-palpite" value="${palpite.nome}"></div>
    <div class="linha-dupla">
      <div class="form-grupo"><label>Placar Brasil</label><input type="number" id="m-placar-b" value="${palpite.placarBrasil}"></div>
      <div class="form-grupo"><label>Placar Adversário</label><input type="number" id="m-placar-a" value="${palpite.placarAdversario}"></div>
    </div>
  `, async () => {
    await updateDoc(doc(db, "palpites", id), {
      nome: document.getElementById("m-nome-palpite").value.trim(),
      placarBrasil: Number(document.getElementById("m-placar-b").value),
      placarAdversario: Number(document.getElementById("m-placar-a").value)
    });
  });
};

// ============================================================================
// 24. PAINEL ADMIN — PAGAMENTOS
// ============================================================================

function renderizarAdminListaPagamentos() {
  const container = document.getElementById("lista-admin-pagamentos");
  if (!container) return;
  if (!estado.pagamentos.length) {
    container.innerHTML = `<div class="vazio-msg">Nenhum participante.</div>`;
    return;
  }
  container.innerHTML = estado.pagamentos.map(p => `
    <div class="lista-admin-item">
      <div class="info">
        <b>${p.nome}</b>
        ${p.pago ? `<span class="tag-pago">Pago</span>` : `<span class="tag-pendente">Pendente</span>`}
      </div>
      <div class="acoes">
        ${p.pago
          ? `<button class="btn-perigo" onclick="window.cancelarPagamento('${p.id}')">Cancelar Pagamento</button>`
          : `<button class="btn-sucesso" onclick="window.confirmarPagamento('${p.id}')">Confirmar Pagamento</button>`}
      </div>
    </div>
  `).join("");
}

window.confirmarPagamento = async function (id) {
  await updateDoc(doc(db, "pagamentos", id), { pago: true, confirmadoEm: serverTimestamp() });
};
window.cancelarPagamento = async function (id) {
  await updateDoc(doc(db, "pagamentos", id), { pago: false });
};

// ============================================================================
// 25. PAINEL ADMIN — ESTATÍSTICAS (visão geral)
// ============================================================================

function renderizarEstatisticasAdmin() {
  const grid = document.getElementById("grid-estatisticas-admin");
  if (!grid) return;
  const pagos = estado.pagamentos.filter(p => p.pago).length;
  const pendentes = estado.pagamentos.length - pagos;

  grid.innerHTML = `
    <div class="stat-mini"><div class="valor">${estado.participantes.length}</div><div class="rotulo">Participantes</div></div>
    <div class="stat-mini"><div class="valor">${estado.palpites.length}</div><div class="rotulo">Palpites</div></div>
    <div class="stat-mini"><div class="valor">${pagos}</div><div class="rotulo">Pagamentos Confirmados</div></div>
    <div class="stat-mini"><div class="valor">${pendentes}</div><div class="rotulo">Pagamentos Pendentes</div></div>
  `;
}

// ============================================================================
// 26. MODAL DE EDIÇÃO GENÉRICO (reutilizado em vários CRUDs)
// ============================================================================

function abrirModal(titulo, corpoHTML, aoSalvar) {
  const modal = document.getElementById("modal-edicao");
  document.getElementById("modal-titulo").textContent = titulo;
  document.getElementById("modal-corpo").innerHTML = corpoHTML;
  modal.classList.add("mostrar");

  const botaoSalvar = document.getElementById("modal-salvar");
  const novoBotao = botaoSalvar.cloneNode(true); // remove listeners antigos
  botaoSalvar.replaceWith(novoBotao);

  novoBotao.addEventListener("click", async () => {
    await aoSalvar();
    modal.classList.remove("mostrar");
  });

  document.getElementById("modal-cancelar").onclick = () => modal.classList.remove("mostrar");
}

// ============================================================================
// 27. NAVEGAÇÃO GERAL (ABAS + MENU INFERIOR + BOTÃO ADMIN)
// ============================================================================

function configurarNavegacao() {
  document.querySelectorAll(".aba-btn, #menu-inferior button").forEach(botao => {
    botao.addEventListener("click", () => irParaSecao(botao.dataset.secao));
  });

  document.getElementById("btn-abrir-admin").addEventListener("click", () => irParaSecao("admin"));
}

// ============================================================================
// 28. INICIALIZAÇÃO GERAL DA APLICAÇÃO
// ============================================================================

async function iniciarAplicacao() {
  try {
    configurarNavegacao();
    configurarLoginAdmin();
    configurarSubnavAdmin();
    configurarBotaoSalvarConfig();
    configurarAdicionarJogo();
    configurarAdicionarParticipante();
    configurarAdicionarPalpiteAdmin();

    document.getElementById("form-palpite").addEventListener("submit", enviarPalpite);

    await carregarConfiguracoes();
    ouvirConfiguracoes();

    // sincroniza com a API do TheSportsDB (não bloqueia a interface)
    sincronizarJogosComFirestore().catch(e => console.error("Falha ao sincronizar API:", e));

    ouvirJogos();
    ouvirPalpites();
    ouvirParticipantes();
    ouvirPagamentos();
    ouvirHistorico();

    // Atualiza dados da API periodicamente (a cada 5 minutos)
    setInterval(() => sincronizarJogosComFirestore().catch(() => {}), 5 * 60 * 1000);

  } catch (erro) {
    console.error("Erro ao iniciar aplicação:", erro);
  } finally {
    document.getElementById("loading-overlay").classList.add("hidden");
  }
}

document.addEventListener("DOMContentLoaded", iniciarAplicacao);
