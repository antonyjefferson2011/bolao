// ========== FIREBASE CONFIG ==========
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

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// ========== MERCADO PAGO ==========
const mp = new MercadoPago('APP_USR-7e8b7e2a-6b1f-4c8d-9a2e-3f5c6d8e9f0a', {
    locale: 'pt-BR'
});

// ========== DOM REFS ==========
const userDisplay = document.getElementById('userDisplay');
const authBtn = document.getElementById('authBtn');
const adminToggleBtn = document.getElementById('adminToggleBtn');
const adminPanel = document.getElementById('adminPanel');
const futureGamesDiv = document.getElementById('futureGames');
const allGamesDiv = document.getElementById('allGames');
const gameSelector = document.getElementById('gameSelector');
const team1Input = document.getElementById('team1Input');
const team2Input = document.getElementById('team2Input');
const flag1Input = document.getElementById('flag1Input');
const flag2Input = document.getElementById('flag2Input');
const gameDateInput = document.getElementById('gameDateInput');
const addGameBtn = document.getElementById('addGameBtn');
const score1Update = document.getElementById('score1Update');
const score2Update = document.getElementById('score2Update');
const updateScoreBtn = document.getElementById('updateScoreBtn');
const deleteGameBtn = document.getElementById('deleteGameBtn');
const toggleAdminMode = document.getElementById('toggleAdminMode');
const adminEmailInput = document.getElementById('adminEmailInput');
const makeAdminBtn = document.getElementById('makeAdminBtn');
const totalGamesEl = document.getElementById('totalGames');
const finishedGamesEl = document.getElementById('finishedGames');
const totalUsersEl = document.getElementById('totalUsers');
const totalPrizeEl = document.getElementById('totalPrize');

// Auth Modal
const authModal = document.getElementById('authModal');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const submitAuthBtn = document.getElementById('submitAuthBtn');
const toggleAuthMode = document.getElementById('toggleAuthMode');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalTitle = document.getElementById('modalTitle');
const authError = document.getElementById('authError');

// Pix Modal
const pixModal = document.getElementById('pixModal');
const qrCodeContainer = document.getElementById('qrCodeContainer');
const pixCopyCode = document.getElementById('pixCopyCode');
const copyPixBtn = document.getElementById('copyPixBtn');
const closePixModal = document.getElementById('closePixModal');
const paymentStatus = document.getElementById('paymentStatus');

// ========== STATE ==========
let currentUser = null;
let isAdmin = false;
let isLoginMode = true;
let totalPrize = 0;
const gamesRef = db.ref('jogos');
const usersRef = db.ref('usuarios');
const paymentsRef = db.ref('pagamentos');

// ========== AUTH ==========
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        userDisplay.innerHTML = `<i class="fas fa-user-circle"></i> ${user.displayName || user.email || 'Usuário'}`;
        authBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Sair';
        
        usersRef.child(user.uid).once('value').then(snap => {
            const userData = snap.val();
            isAdmin = userData?.admin === true;
            if (isAdmin) {
                adminToggleBtn.classList.remove('hide');
            } else {
                adminToggleBtn.classList.add('hide');
                adminPanel.classList.add('hide');
            }
        });
    } else {
        currentUser = null;
        userDisplay.innerHTML = '<i class="fas fa-user-circle"></i> Convidado';
        authBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
        isAdmin = false;
        adminToggleBtn.classList.add('hide');
        adminPanel.classList.add('hide');
    }
});

// ========== MODAL ==========
function openModal() {
    authModal.classList.remove('hide');
    authError.textContent = '';
    emailInput.value = '';
    passwordInput.value = '';
    isLoginMode = true;
    modalTitle.textContent = 'Entrar';
    submitAuthBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
    toggleAuthMode.textContent = 'Criar conta';
}

function closeModal() {
    authModal.classList.add('hide');
}

authBtn.addEventListener('click', () => {
    if (currentUser) {
        auth.signOut();
    } else {
        openModal();
    }
});

closeModalBtn.addEventListener('click', closeModal);
authModal.addEventListener('click', (e) => {
    if (e.target === authModal) closeModal();
});

toggleAuthMode.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        modalTitle.textContent = 'Entrar';
        submitAuthBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
        toggleAuthMode.textContent = 'Criar conta';
    } else {
        modalTitle.textContent = 'Criar Conta';
        submitAuthBtn.innerHTML = '<i class="fas fa-user-plus"></i> Cadastrar';
        toggleAuthMode.textContent = 'Já tenho conta';
    }
    authError.textContent = '';
});

submitAuthBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    if (!email || !password) {
        authError.textContent = 'Preencha email e senha.';
        return;
    }
    authError.textContent = '';
    try {
        if (isLoginMode) {
            await auth.signInWithEmailAndPassword(email, password);
            closeModal();
        } else {
            const cred = await auth.createUserWithEmailAndPassword(email, password);
            await usersRef.child(cred.user.uid).set({
                email: email,
                admin: false,
                criadoEm: firebase.database.ServerValue.TIMESTAMP
            });
            closeModal();
            showToast('Conta criada! Faça login para acessar.');
        }
    } catch (error) {
        authError.textContent = error.message;
    }
});

// ========== ADMIN ==========
adminToggleBtn.addEventListener('click', () => {
    if (isAdmin) {
        adminPanel.classList.toggle('hide');
    } else {
        alert('Apenas administradores');
    }
});

toggleAdminMode.addEventListener('click', () => {
    adminPanel.classList.add('hide');
});

// Make Admin
makeAdminBtn.addEventListener('click', async () => {
    if (!isAdmin) { alert('Acesso negado'); return; }
    const email = adminEmailInput.value.trim();
    if (!email) { alert('Digite um email'); return; }
    
    try {
        const snapshot = await usersRef.orderByChild('email').equalTo(email).once('value');
        if (!snapshot.exists()) {
            showToast('Usuário não encontrado');
            return;
        }
        const userKey = Object.keys(snapshot.val())[0];
        await usersRef.child(userKey).update({ admin: true });
        showToast(`Usuário ${email} agora é admin!`);
        adminEmailInput.value = '';
    } catch (error) {
        showToast('Erro: ' + error.message);
    }
});

// ========== ADD GAME ==========
addGameBtn.addEventListener('click', () => {
    if (!isAdmin) { alert('Acesso negado'); return; }
    const time1 = team1Input.value.trim();
    const time2 = team2Input.value.trim();
    const flag1 = flag1Input.value.trim() || '🏳️';
    const flag2 = flag2Input.value.trim() || '🏳️';
    const data = gameDateInput.value || new Date().toISOString().split('T')[0];
    if (!time1 || !time2) {
        alert('Preencha os nomes dos times.');
        return;
    }
    gamesRef.push({
        time1, time2, flag1, flag2, data,
        placar1: null,
        placar2: null,
        criadoEm: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        team1Input.value = ''; team2Input.value = ''; flag1Input.value = ''; flag2Input.value = '';
        showToast('Jogo adicionado!');
    }).catch(err => alert('Erro: '+err.message));
});

// ========== UPDATE SCORE ==========
updateScoreBtn.addEventListener('click', () => {
    if (!isAdmin) { alert('Acesso negado'); return; }
    const gameId = gameSelector.value;
    if (!gameId) { alert('Selecione um jogo.'); return; }
    const s1 = parseInt(score1Update.value);
    const s2 = parseInt(score2Update.value);
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
        alert('Insira valores válidos (números >= 0)');
        return;
    }
    gamesRef.child(gameId).update({
        placar1: s1,
        placar2: s2
    }).then(() => {
        showToast('Placar atualizado!');
        score1Update.value = ''; score2Update.value = '';
    }).catch(err => alert('Erro: '+err.message));
});

// ========== DELETE GAME ==========
deleteGameBtn.addEventListener('click', () => {
    if (!isAdmin) { alert('Acesso negado'); return; }
    const gameId = gameSelector.value;
    if (!gameId) { alert('Selecione um jogo.'); return; }
    if (confirm('Remover este jogo permanentemente?')) {
        gamesRef.child(gameId).remove().then(() => {
            showToast('Jogo removido.');
        }).catch(err => alert('Erro: '+err.message));
    }
});

// ========== RENDER ==========
function renderGames(snapshot) {
    const games = snapshot.val();
    if (!games) {
        futureGamesDiv.innerHTML = '<p style="opacity:0.6;">Nenhum jogo cadastrado.</p>';
        allGamesDiv.innerHTML = '<p style="opacity:0.6;">Nenhum jogo disponível.</p>';
        gameSelector.innerHTML = '<option value="">Selecione jogo</option>';
        totalGamesEl.textContent = '0';
        finishedGamesEl.textContent = '0';
        return;
    }
    const gameIds = Object.keys(games);
    const gameList = gameIds.map(id => ({ id, ...games[id] }));
    gameList.sort((a,b) => (a.data || '').localeCompare(b.data || ''));

    const future = gameList.filter(g => g.placar1 === undefined || g.placar1 === null);
    const withScore = gameList.filter(g => g.placar1 !== undefined && g.placar1 !== null);

    totalGamesEl.textContent = gameList.length;
    finishedGamesEl.textContent = withScore.length;

    // Future
    if (future.length === 0) {
        futureGamesDiv.innerHTML = '<p style="opacity:0.6;">Nenhum jogo futuro.</p>';
    } else {
        futureGamesDiv.innerHTML = future.map(g => `
            <div class="game-item">
                <div class="teams">
                    <span><span class="flag">${g.flag1 || '🏳️'}</span> ${g.time1 || 'Time 1'}</span>
                    <span style="font-size:0.9rem; color:#aac;">vs</span>
                    <span>${g.time2 || 'Time 2'} <span class="flag">${g.flag2 || '🏳️'}</span></span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-top: 12px;">
                    <span class="status future"><i class="far fa-clock"></i> ${g.data || 'Data não definida'}</span>
                    <span><i class="fas fa-hourglass-half"></i> Aguardando</span>
                </div>
            </div>
        `).join('');
    }

    // All games
    allGamesDiv.innerHTML = gameList.map(g => {
        const hasScore = (g.placar1 !== undefined && g.placar1 !== null);
        const statusClass = hasScore ? 'finished' : 'future';
        const statusText = hasScore ? '✅ Finalizado' : '⏳ Pendente';
        return `
            <div class="game-item" style="border-left-color: ${hasScore ? '#4caf50' : '#f5c842'}">
                <div class="teams">
                    <span><span class="flag">${g.flag1 || '🏳️'}</span> ${g.time1 || 'Time 1'}</span>
                    <span class="score">
                        ${hasScore ? `<strong>${g.placar1}</strong> - <strong>${g.placar2}</strong>` : '⚽ vs ⚽'}
                    </span>
                    <span>${g.time2 || 'Time 2'} <span class="flag">${g.flag2 || '🏳️'}</span></span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-top: 12px;">
                    <span class="status ${statusClass}">${statusText}</span>
                    <span style="font-size:0.8rem; opacity:0.7;">${g.data || ''}</span>
                </div>
            </div>
        `;
    }).join('');

    // Populate selector
    gameSelector.innerHTML = '<option value="">Selecione jogo</option>' + 
        gameList.map(g => `<option value="${g.id}">${g.time1} vs ${g.time2}</option>`).join('');
}

gamesRef.on('value', snapshot => {
    renderGames(snapshot);
});

// ========== USERS COUNT ==========
usersRef.on('value', snapshot => {
    const users = snapshot.val();
    totalUsersEl.textContent = users ? Object.keys(users).length : '0';
});

// ========== PAYMENTS ==========
paymentsRef.on('value', snapshot => {
    const payments = snapshot.val();
    if (payments) {
        totalPrize = Object.values(payments).reduce((sum, p) => sum + (p.valor || 0), 0);
        totalPrizeEl.textContent = `R$ ${totalPrize.toFixed(2)}`;
    } else {
        totalPrize = 0;
        totalPrizeEl.textContent = 'R$ 0,00';
    }
});

// ========== PIX PAYMENT ==========
function createPixPayment(amount) {
    if (!currentUser) {
        showToast('Faça login para pagar!');
        openModal();
        return;
    }

    const paymentData = {
        transaction_amount: amount,
        description: `Contribuição Bolão da Ennes - R$ ${amount}`,
        payment_method_id: 'pix',
        payer: {
            email: currentUser.email
        }
    };

    // Simula criação de pagamento (na vida real, isso seria feito no backend)
    // Aqui geramos um QR Code mock para demonstração
    const mockQrCode = `00020126580014BR.GOV.BCB.PIX0136${currentUser.email.replace('@', '')}5204000053039865404${amount.toFixed(2)}5802BR5913Bolao Ennes6009Sao Paulo62070503***6304E2F3`;
    
    // Salva no Firebase
    paymentsRef.push({
        usuario: currentUser.uid,
        email: currentUser.email,
        valor: amount,
        data: firebase.database.ServerValue.TIMESTAMP,
        status: 'pendente'
    }).then(() => {
        showPixModal(mockQrCode, amount);
    }).catch(err => {
        showToast('Erro ao processar pagamento: ' + err.message);
    });
}

function showPixModal(qrCode, amount) {
    qrCodeContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}" alt="QR Code Pix" style="width:200px;height:200px;">`;
    pixCopyCode.textContent = qrCode;
    pixModal.classList.remove('hide');
    paymentStatus.innerHTML = `<p style="color:#4caf50;">✅ Pagamento de R$ ${amount.toFixed(2)} gerado! Escaneie o QR Code.</p>`;
}

document.getElementById('pix10Btn').addEventListener('click', () => createPixPayment(10));
document.getElementById('pix20Btn').addEventListener('click', () => createPixPayment(20));
document.getElementById('pix50Btn').addEventListener('click', () => createPixPayment(50));

copyPixBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(pixCopyCode.textContent).then(() => {
        showToast('Código Pix copiado!');
    }).catch(() => {
        showToast('Erro ao copiar');
    });
});

closePixModal.addEventListener('click', () => {
    pixModal.classList.add('hide');
});

pixModal.addEventListener('click', (e) => {
    if (e.target === pixModal) pixModal.classList.add('hide');
});

// ========== TOAST ==========
function showToast(msg) {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const div = document.createElement('div');
    div.className = 'toast';
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

console.log('⚡ Bolão da Ennes carregado!');
console.log('Para tornar um usuário admin: db.ref("usuarios/"+uid).update({admin: true})');
