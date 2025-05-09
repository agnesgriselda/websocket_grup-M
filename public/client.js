const messagesContainer = document.getElementById('messages'); // Ganti nama variabel agar lebih jelas
const messageInput = document.getElementById('messageInput'); // Ganti nama variabel
const typingStatusDiv = document.getElementById('typingStatus'); // Dapatkan elemen dari HTML

let currentUsername = ''; // Ganti nama variabel
let ownWsId = null; // Untuk menyimpan ID WebSocket klien ini sendiri
let ws;
let heartbeatIntervalId;
const HEARTBEAT_INTERVAL_MS_CLIENT = 25000;

// Fungsi untuk menginisialisasi koneksi WebSocket
function initializeWebSocket() {
    if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
    }
    ws = new WebSocket(`wss://${location.host}`);
    ws.onopen = () => {
        appendSystemMessage('Connected to the server.'); // Ini tetap, tapi stylenya dari CSS
        console.log('Client: WebSocket connection established.');
        if (heartbeatIntervalId) clearInterval(heartbeatIntervalId);
        heartbeatIntervalId = setInterval(sendClientPing, HEARTBEAT_INTERVAL_MS_CLIENT);
    };

    // Fungsi untuk menangani pesan yang diterima dari server
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'info') {
            // Asumsi server mengirimkan ID koneksi WebSocket klien ini di pesan info
            // Misalnya, data.id berisi ID koneksi
            if (data.connectionId) { // Kita akan asumsikan server mengirim 'connectionId'
                ownWsId = data.connectionId;
            }
            currentUsername = data.message.split(' ')[4]; // Tetap parsing username
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
        appendSystemMessage('Disconnected from server. Attempting to reconnect in 5 seconds...');
        clearInterval(heartbeatIntervalId);
        setTimeout(initializeWebSocket, 5000);
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

// --- REVISI FUNGSI APPEND DIMULAI DI SINI ---

// Fungsi untuk menampilkan pesan chat dengan struktur baru
function appendChatMessage(data) {
    if (typingStatusDiv) typingStatusDiv.textContent = ''; // Hapus status typing

    const messageItem = document.createElement('div');
    messageItem.classList.add('message-item');

    // Tentukan apakah pesan ini milik sendiri atau orang lain
    if (ownWsId && data.id === ownWsId) { // 'data.id' harus dikirim dari server berisi ID pengirim
        messageItem.classList.add('own');
    } else {
        messageItem.classList.add('other');
        // Tampilkan username hanya untuk pesan orang lain di atas bubble
        const usernameDisplay = document.createElement('span');
        usernameDisplay.classList.add('username-display');
        usernameDisplay.textContent = data.user;
        messageItem.appendChild(usernameDisplay);
    }

    const messageBubble = document.createElement('div');
    messageBubble.classList.add('message-bubble');

    const messageText = document.createElement('p');
    // messageText.classList.add('message-text'); // Tidak perlu jika styling bubble sudah cukup
    messageText.textContent = data.text; // Hindari innerHTML untuk teks dari user jika memungkinkan
    messageBubble.appendChild(messageText);

    const timestampDisplay = document.createElement('span');
    timestampDisplay.classList.add('timestamp-display');
    timestampDisplay.textContent = data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    messageBubble.appendChild(timestampDisplay); // Timestamp di dalam bubble

    messageItem.appendChild(messageBubble);
    messagesContainer.appendChild(messageItem);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Fungsi untuk menampilkan pesan sistem dengan class CSS baru
function appendSystemMessage(msgText) {
    const div = document.createElement('div');
    div.classList.add('system-message'); // Gunakan class dari CSS
    div.textContent = msgText;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Fungsi untuk menampilkan pengumuman dari server dengan class CSS baru
function appendServerAnnouncement(data) {
    if (typingStatusDiv) typingStatusDiv.textContent = ''; // Hapus status typing

    const div = document.createElement('div');
    div.classList.add('server-announcement'); // Gunakan class dari CSS
    div.innerHTML = `📢 ${data.message} [${data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]`;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Fungsi untuk menampilkan notifikasi aktivitas pengguna dengan class CSS baru
function appendUserActivityNotification(data) {
    if (typingStatusDiv) typingStatusDiv.textContent = ''; // Hapus status typing

    const div = document.createElement('div');
    div.classList.add('user-activity'); // Class dasar
    if (data.activity === 'joined') {
        div.classList.add('joined');
    } else if (data.activity === 'left') {
        div.classList.add('left');
    }
    div.textContent = `🔔 ${data.message} [${data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]`;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// --- AKHIR REVISI FUNGSI APPEND ---


// Fungsi untuk mengirim pesan chat
function sendMessage() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        appendSystemMessage('Not connected to server. Cannot send message.');
        return;
    }
    const text = messageInput.value.trim();
    if (text) {
        ws.send(JSON.stringify({ type: 'chat', text }));
        messageInput.value = '';
    }
}

// Fungsi untuk menampilkan status typing di div yang sudah ada
function showTyping(user) {
    if (typingStatusDiv) {
        typingStatusDiv.textContent = `${user} is typing...`;
        setTimeout(() => {
            // Hanya hapus jika masih pesan yang sama dan user yang sama
            if (typingStatusDiv.textContent === `${user} is typing...`) {
                typingStatusDiv.textContent = '';
            }
        }, 3000); // Perpanjang sedikit timeout
    }
}

let typingTimeout;
messageInput.addEventListener('input', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    if (typingTimeout) clearTimeout(typingTimeout);
    ws.send(JSON.stringify({ type: 'typing' }));
    // Timeout untuk menghentikan 'typing' jika pengguna berhenti mengetik (opsional, server bisa handle ini)
    // typingTimeout = setTimeout(() => {
    //     // ws.send(JSON.stringify({ type: 'stop_typing' })); // Jika ada pesan stop_typing
    // }, 3000);
});

initializeWebSocket();

const sendButton = document.getElementById('sendButton');
if (sendButton) {
    sendButton.addEventListener('click', sendMessage);
}
messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
        event.preventDefault(); // Mencegah default action (misalnya, submit form jika ada)
    }
});