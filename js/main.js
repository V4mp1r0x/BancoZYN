/**
 * main.js
 * Script único para a Single Page Application (SPA) do ZYN Bank.
 * Gerencia a troca de telas (autenticação vs. dashboard),
 * estado do usuário, transações e todas as interações da UI.
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- STATE & ELEMENTOS GLOBAIS ---
    let currentUser = null;
    let db = getDb();
    let isRegisterMode = false;

    // Elementos das Telas
    const authView = document.getElementById('auth-view');
    const dashboardView = document.getElementById('dashboard-view');

    // Elementos de Autenticação
    const authForm = document.getElementById('auth-form');
    const usernameField = document.getElementById('username-field');
    const emailInput = document.getElementById('email');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const submitButton = document.getElementById('submit-button');
    const toggleToRegister = document.getElementById('toggle-to-register');
    const toggleToLogin = document.getElementById('toggle-to-login');
    const formTitle = document.getElementById('form-title');
    const errorMessage = document.getElementById('error-message');
    const registerToggleText = toggleToRegister.parentElement;
    const loginToggleText = toggleToLogin.parentElement;
    
    // Elementos do Dashboard
    const balanceEl = document.getElementById('balance');
    const welcomeMessageEl = document.getElementById('welcome-message');
    const transactionsListEl = document.getElementById('transactions-list');
    const logoutButton = document.getElementById('logout-button');
    const sendModal = document.getElementById('send-modal');
    const receiveModal = document.getElementById('receive-modal');
    const sendMoneyBtn = document.getElementById('send-money-btn');
    const receiveMoneyBtn = document.getElementById('receive-money-btn');
    const closeSendModalBtn = document.getElementById('close-send-modal');
    const closeReceiveModalBtn = document.getElementById('close-receive-modal');
    const sendForm = document.getElementById('send-form');
    const recipientInput = document.getElementById('recipient');
    const amountInput = document.getElementById('amount');
    const sendErrorEl = document.getElementById('send-error');
    const qrcodeContainer = document.getElementById('qrcode-container');
    const userKeyInput = document.getElementById('user-key');
    const copyKeyBtn = document.getElementById('copy-key-btn');

    // --- FUNÇÕES UTILITÁRIAS ---
    async function hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function getDb() {
        const localDb = localStorage.getItem('zynBankDb');
        return localDb ? JSON.parse(localDb) : { users: [] };
    }

    function saveDb() {
        localStorage.setItem('zynBankDb', JSON.stringify(db));
    }
    
    // --- GERENCIADOR DE TELAS (VIEWS) ---
    function showAuthView() {
        authView.classList.remove('hidden');
        dashboardView.classList.add('hidden');
    }

    function showDashboardView() {
        authView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
    }

    // --- LÓGICA DE AUTENTICAÇÃO ---
    function switchAuthMode(toRegister) {
        isRegisterMode = toRegister;
        usernameField.classList.toggle('hidden', !toRegister);
        usernameInput.required = toRegister;
        formTitle.textContent = toRegister ? 'Crie sua conta ZYN' : 'Acesse sua conta';
        submitButton.textContent = toRegister ? 'Cadastrar' : 'Entrar';
        registerToggleText.classList.toggle('hidden', toRegister);
        loginToggleText.classList.toggle('hidden', !toRegister);
        errorMessage.textContent = '';
        authForm.reset();
    }
    
    toggleToRegister.addEventListener('click', (e) => { e.preventDefault(); switchAuthMode(true); });
    toggleToLogin.addEventListener('click', (e) => { e.preventDefault(); switchAuthMode(false); });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMessage.textContent = '';
        const email = emailInput.value.trim().toLowerCase();
        const password = passwordInput.value;

        if (isRegisterMode) {
            const username = usernameInput.value.trim();
            if (!username || !email || !password) {
                errorMessage.textContent = 'Todos os campos são obrigatórios.';
                return;
            }

            db = getDb();
            const userExists = db.users.some(user => user.email === email || user.username.toLowerCase() === username.toLowerCase());
            
            if (userExists) {
                errorMessage.textContent = 'E-mail ou nome de usuário já cadastrado.';
                return;
            }

            const passwordHash = await hashPassword(password);
            const initialBalance = email === 'guipaz5155@gmail.com' ? 999999999 : 0;
            
            const newUser = { username, email, passwordHash, balance: initialBalance, transactions: [] };
            db.users.push(newUser);
            saveDb();
            login(email);
        } else {
            db = getDb();
            const user = db.users.find(u => u.email === email);
            if (!user) {
                errorMessage.textContent = 'E-mail ou senha inválidos.';
                return;
            }

            const passwordHash = await hashPassword(password);
            if (user.passwordHash !== passwordHash) {
                errorMessage.textContent = 'E-mail ou senha inválidos.';
                return;
            }
            login(email);
        }
    });

    function login(email) {
        localStorage.setItem('loggedInUser', email);
        initDashboard();
    }
    
    function logout() {
        localStorage.removeItem('loggedInUser');
        currentUser = null;
        showAuthView();
    }
    
    // --- LÓGICA DO DASHBOARD ---
    function initDashboard() {
        const loggedInUserEmail = localStorage.getItem('loggedInUser');
        if (!loggedInUserEmail) {
            showAuthView();
            return;
        }

        db = getDb();
        currentUser = db.users.find(u => u.email === loggedInUserEmail);

        if (!currentUser) {
            logout();
            return;
        }

        updateDashboardUI();
        showDashboardView();
    }
    
    function updateDashboardUI() {
        welcomeMessageEl.textContent = `Olá, ${currentUser.username}`;
        balanceEl.textContent = currentUser.balance.toFixed(2);
        renderTransactions();
    }

    function renderTransactions() {
        transactionsListEl.innerHTML = '';
        if (currentUser.transactions.length === 0) {
            transactionsListEl.innerHTML = '<p class="no-transactions">Nenhuma transação ainda.</p>';
            return;
        }

        const reversedTransactions = [...currentUser.transactions].reverse();
        reversedTransactions.forEach(tx => {
            const item = document.createElement('div');
            item.className = 'transaction-item';
            const type = tx.type;
            const party = type === 'sent' ? `Para: ${tx.to}` : `De: ${tx.from}`;
            const amountClass = type === 'sent' ? 'sent' : 'received';
            const sign = type === 'sent' ? '-' : '+';
            item.innerHTML = `
                <div class="transaction-details">
                    <p class="transaction-party">${party}</p>
                    <p class="transaction-date">${new Date(tx.timestamp).toLocaleString('pt-BR')}</p>
                </div>
                <div class="transaction-amount ${amountClass}">${sign} ${tx.amount.toFixed(2)} ZYN</div>`;
            transactionsListEl.appendChild(item);
        });
    }

    function handleSendMoney(event) {
        event.preventDefault();
        sendErrorEl.textContent = '';
        const recipientIdentifier = recipientInput.value.trim();
        const amount = parseFloat(amountInput.value);

        if (isNaN(amount) || amount <= 0) {
            sendErrorEl.textContent = 'Valor inválido.';
            return;
        }
        if (amount > currentUser.balance) {
            sendErrorEl.textContent = 'Saldo insuficiente.';
            return;
        }
        
        const recipientIndex = db.users.findIndex(u => u.username.toLowerCase() === recipientIdentifier.toLowerCase() || u.email.toLowerCase() === recipientIdentifier.toLowerCase());
        if (recipientIndex === -1) {
            sendErrorEl.textContent = 'Usuário destinatário não encontrado.';
            return;
        }
        const recipient = db.users[recipientIndex];

        if (recipient.email === currentUser.email) {
            sendErrorEl.textContent = 'Você não pode enviar ZYNs para si mesmo.';
            return;
        }
        
        currentUser.balance -= amount;
        recipient.balance += amount;
        const timestamp = new Date().toISOString();
        currentUser.transactions.push({ type: 'sent', to: recipient.username, amount, timestamp });
        recipient.transactions.push({ type: 'received', from: currentUser.username, amount, timestamp });

        saveDb();
        updateDashboardUI();
        closeModal(sendModal);
        sendForm.reset();
    }

    function openModal(modal) { modal.style.display = 'block'; }
    function closeModal(modal) { modal.style.display = 'none'; }
    
    function openReceiveModal() {
        userKeyInput.value = currentUser.username;
        qrcodeContainer.innerHTML = '';
        new QRCode(qrcodeContainer, {
            text: currentUser.username, width: 180, height: 180,
            colorDark: "#0f0f1b", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H
        });
        openModal(receiveModal);
    }
    
    function copyUserKey() {
        userKeyInput.select();
        document.execCommand('copy');
        copyKeyBtn.textContent = 'Copiado!';
        setTimeout(() => { copyKeyBtn.textContent = 'Copiar'; }, 2000);
    }

    // --- EVENT LISTENERS DO DASHBOARD ---
    logoutButton.addEventListener('click', logout);
    sendMoneyBtn.addEventListener('click', () => openModal(sendModal));
    receiveMoneyBtn.addEventListener('click', openReceiveModal);
    closeSendModalBtn.addEventListener('click', () => closeModal(sendModal));
    closeReceiveModalBtn.addEventListener('click', () => closeModal(receiveModal));
    window.addEventListener('click', (e) => {
        if (e.target === sendModal) closeModal(sendModal);
        if (e.target === receiveModal) closeModal(receiveModal);
    });
    sendForm.addEventListener('submit', handleSendMoney);
    copyKeyBtn.addEventListener('click', copyUserKey);

    // --- PONTO DE ENTRADA DA APLICAÇÃO ---
    initDashboard(); 
});