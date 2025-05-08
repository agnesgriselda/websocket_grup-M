const messages = document.getElementById('messages');
const input = document.getElementById('messageInput');
const typingStatus = document.createElement('div');
typingStatus.style.fontStyle = 'italic';
messages.appendChild(typingStatus);

let username = '';
let ws;
let heartbeatIntervalId;
const HEARTBEAT_INTERVAL_MS_CLIENT = 25000;

function initializeWebSocket() {
    if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
    }

    ws = new WebSocket(`wss://${location.host}`);

    ws.onopen = () => {
        appendSystemMessage('Connected to the server.');
        console.log('Client: WebSocket connection established.');
        if (heartbeatIntervalId) clearInterval(heartbeatIntervalId);
        heartbeatIntervalId = setInterval(sendClientPing, HEARTBEAT_INTERVAL_MS_CLIENT);
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'info') {
            username = data.message.split(' ')[4]; // Parsing username dari pesan info
            appendSystemMessage(data.message);
        } else if (data.type === 'chat') {
            appendChatMessage(data);
        } else if (data.type === 'typing') {
            showTyping(data.user);
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

function sendClientPing() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: '__ping__' }));
        console.log('Client: Sent __ping__ to server'); // << TAMBAHKAN INI
    }
}

function appendChatMessage(data) {
    typingStatus.textContent = '';
    const msg = document.createElement('div');
    msg.innerHTML = `<b>${data.user}</b> [${data.timestamp}]: ${data.text}`;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
}

function appendSystemMessage(msgText) {
    const div = document.createElement('div');
    div.style.color = 'gray';
    div.textContent = msgText;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function sendMessage() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        appendSystemMessage('Not connected to server. Cannot send message.');
        return;
    }
    const text = input.value.trim();
    if (text) {
        ws.send(JSON.stringify({ type: 'chat', text }));
        input.value = '';
    }
}

function showTyping(user) {
    typingStatus.textContent = `${user} is typing...`;
    setTimeout(() => {
        if (typingStatus.textContent === `${user} is typing...`) {
            typingStatus.textContent = '';
        }
    }, 2000);
}

let typingTimeout;
input.addEventListener('input', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    if (typingTimeout) clearTimeout(typingTimeout);
    ws.send(JSON.stringify({ type: 'typing' }));
});

initializeWebSocket();

const sendButton = document.getElementById('sendButton');
if (sendButton) {
    sendButton.addEventListener('click', sendMessage);
}
input.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
});