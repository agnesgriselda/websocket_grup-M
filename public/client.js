// --- Ambil Elemen DOM ---
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const typingStatusDiv = document.getElementById('typingStatus');
const sendButton = document.getElementById('sendButton'); // Tombol kirim pesan

// Elemen untuk Login
const loginSection = document.getElementById('loginSection');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const loginButton = document.getElementById('loginButton');
const logoutButton = document.getElementById('logoutButton');
const chatContainer = document.querySelector('.chat-container'); // Ambil kontainer chat utama
const togglePasswordButton = document.getElementById('togglePassword'); // Tombol toggle password

// Variabel Global
let currentUsername = '';
let ownWsId = null;
let ws;
let heartbeatIntervalId;
const HEARTBEAT_INTERVAL_MS_CLIENT = 25000;

// --- Fungsi untuk Mengelola Tampilan UI ---
function showLoginView() {
    if (loginSection) loginSection.style.display = 'block';
    if (chatContainer) chatContainer.style.display = 'none';
    if (logoutButton) logoutButton.style.display = 'none';
}

function showChatView() {
    if (loginSection) loginSection.style.display = 'none';
    if (chatContainer) chatContainer.style.display = 'flex'; // Karena .chat-container pakai flex
    if (logoutButton) logoutButton.style.display = 'inline-block'; // Atau 'block'
}

// --- Fungsi Login ---
async function handleLogin() {
    if (!usernameInput || !passwordInput) {
        console.error("Login form elements not found.");
        appendSystemMessage("Login form error. Check console.");
        return;
    }
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        appendSystemMessage("Username and password are required for login.");
        return;
    }

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok && data.success && data.token) {
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('loggedInUsername', data.username);
            currentUsername = data.username;
            // Kosongkan pesan error login jika ada
            const loginErrorMsgEl = document.getElementById('loginErrorMessage');
            if (loginErrorMsgEl) loginErrorMsgEl.textContent = '';

            appendSystemMessage(`Login successful as ${data.username}. Connecting to chat...`);
            showChatView();
            initializeWebSocket();
        } else {
            const errorMessage = data.message || 'Login failed. Please check your credentials.';
            // Tampilkan pesan error di UI login
            const loginErrorMsgEl = document.getElementById('loginErrorMessage');
            if (loginErrorMsgEl) loginErrorMsgEl.textContent = errorMessage;
            else appendSystemMessage(errorMessage); // Fallback jika elemen error tidak ada
            console.error('Login failed:', errorMessage);
        }
    } catch (error) {
        const loginErrorMsgEl = document.getElementById('loginErrorMessage');
        if (loginErrorMsgEl) loginErrorMsgEl.textContent = 'Error during login. Please try again.';
        else appendSystemMessage('Error during login. Please try again.');
        console.error('Login request error:', error);
    }
}

// --- Fungsi Logout ---
function handleLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('loggedInUsername');
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
    }
    currentUsername = '';
    ownWsId = null;
    showLoginView();
    if (messagesContainer) messagesContainer.innerHTML = ''; // Hapus pesan lama
    appendSystemMessage("You have been logged out.");
}


// Fungsi untuk menginisialisasi koneksi WebSocket
function initializeWebSocket() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        console.log("No auth token found. Please login.");
        showLoginView();
        return;
    }

    if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
    }

    ws = new WebSocket(`wss://${location.host}?token=${token}`);

    ws.onopen = () => {
        console.log('Client: WebSocket connection established.');
        if (heartbeatIntervalId) clearInterval(heartbeatIntervalId);
        heartbeatIntervalId = setInterval(sendClientPing, HEARTBEAT_INTERVAL_MS_CLIENT);
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'error') {
            appendSystemMessage(`Server Error: ${data.message}`);
            if (data.message.toLowerCase().includes('token') || data.message.toLowerCase().includes('authentication')) {
                handleLogout(); // Jika error terkait token/autentikasi, logout klien
            }
            return;
        }

        if (data.type === 'info') {
            if (data.connectionId) {
                ownWsId = data.connectionId;
            }
            appendSystemMessage(data.message);
        } else if (data.type === 'chat') {
            appendChatMessage(data);
        } else if (data.type === 'typing') {
            showTyping(data.user);
        } else if (data.type === 'server_announcement') {
            appendServerAnnouncement(data);
        } else if (data.type === 'user_activity_notification') {
            appendUserActivityNotification(data);
        } else if (data.type === '__pong__') {
            // console.log('Client: Received __pong__ from server');
        }
    };

    ws.onclose = (event) => {
        console.log('Client: WebSocket connection closed.', event.code, event.reason);
        clearInterval(heartbeatIntervalId);
        if (localStorage.getItem('authToken')) {
            appendSystemMessage('Disconnected. Attempting to reconnect in 5 seconds...');
            setTimeout(initializeWebSocket, 5000);
        } else {
            showLoginView();
        }
    };

    ws.onerror = (error) => {
        console.error('Client: WebSocket error:', error);
        appendSystemMessage('Connection error. Check console.');
    };
}

// Fungsi untuk mengirim ping aplikasi ke server
function sendClientPing() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: '__ping__' }));
    }
}

// --- Fungsi-fungsi Append Pesan ---
function appendChatMessage(data) {
    if (typingStatusDiv) typingStatusDiv.textContent = '';
    const messageItem = document.createElement('div');
    messageItem.classList.add('message-item');
    if (ownWsId && data.id === ownWsId) {
        messageItem.classList.add('own');
    } else {
        messageItem.classList.add('other');
        const usernameDisplay = document.createElement('span');
        usernameDisplay.classList.add('username-display');
        usernameDisplay.textContent = data.user;
        messageItem.appendChild(usernameDisplay);
    }
    const messageBubble = document.createElement('div');
    messageBubble.classList.add('message-bubble');
    const messageText = document.createElement('p');
    messageText.textContent = data.text;
    messageBubble.appendChild(messageText);
    const timestampDisplay = document.createElement('span');
    timestampDisplay.classList.add('timestamp-display');
    timestampDisplay.textContent = data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    messageBubble.appendChild(timestampDisplay);
    messageItem.appendChild(messageBubble);
    messagesContainer.appendChild(messageItem);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
function appendSystemMessage(msgText) {
    // Cek apakah elemen messagesContainer ada sebelum menambah pesan
    if (!messagesContainer && loginSection && loginSection.style.display === 'block') {
        const loginErrorMsgEl = document.getElementById('loginErrorMessage');
        if (loginErrorMsgEl) {
            loginErrorMsgEl.textContent = msgText;
            return;
        }
    }
    if(messagesContainer){
        const div = document.createElement('div');
        div.classList.add('system-message');
        div.textContent = msgText;
        messagesContainer.appendChild(div);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } else {
        console.warn("messagesContainer not found for system message:", msgText)
    }
}
function appendServerAnnouncement(data) {
    if (typingStatusDiv) typingStatusDiv.textContent = '';
    const div = document.createElement('div');
    div.classList.add('server-announcement');
    div.innerHTML = `📢 ${data.message} [${data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]`;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
function appendUserActivityNotification(data) {
    if (typingStatusDiv) typingStatusDiv.textContent = '';
    const div = document.createElement('div');
    div.classList.add('user-activity');
    if (data.activity === 'joined') { div.classList.add('joined'); }
    else if (data.activity === 'left') { div.classList.add('left'); }
    div.textContent = `🔔 ${data.message} [${data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]`;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Fungsi untuk mengirim pesan chat
function sendMessage() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        appendSystemMessage('Not connected. Please login again if necessary.');
        return;
    }
    const text = messageInput.value.trim();
    if (text) {
        ws.send(JSON.stringify({ type: 'chat', text }));
        messageInput.value = '';
    }
}

// Fungsi untuk menampilkan status typing
function showTyping(user) {
    if (typingStatusDiv) {
        typingStatusDiv.textContent = `${user} is typing...`;
        setTimeout(() => {
            if (typingStatusDiv.textContent === `${user} is typing...`) {
                typingStatusDiv.textContent = '';
            }
        }, 3000);
    }
}

let typingTimeout;
messageInput.addEventListener('input', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (typingTimeout) clearTimeout(typingTimeout);
    ws.send(JSON.stringify({ type: 'typing' }));
});


// --- Event Listeners untuk Login dan Tombol Lain ---
if (loginButton) {
    loginButton.addEventListener('click', handleLogin);
}
if (passwordInput) {
    passwordInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            handleLogin();
            event.preventDefault(); // Mencegah submit form jika ada
        }
    });
}
if (logoutButton) {
    logoutButton.addEventListener('click', handleLogout);
}
if (togglePasswordButton && passwordInput) { // Event listener untuk toggle password
    togglePasswordButton.addEventListener('click', function () {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.classList.toggle('fa-eye');
        this.classList.toggle('fa-eye-slash');
    });
}
if (sendButton) {
    sendButton.addEventListener('click', sendMessage);
}
messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
        event.preventDefault();
    }
});

// --- Inisialisasi Aplikasi Saat Halaman Dimuat ---
function initializeAppState() {
    const token = localStorage.getItem('authToken');
    currentUsername = localStorage.getItem('loggedInUsername') || '';
    if (token && currentUsername) {
        showChatView();
        initializeWebSocket();
    } else {
        showLoginView();
    }
}
initializeAppState();