const ws = new WebSocket(`ws://${location.host}`);
const messages = document.getElementById('messages');
const input = document.getElementById('messageInput');
const typingStatus = document.createElement('div');
typingStatus.style.fontStyle = 'italic';
messages.appendChild(typingStatus);

let username = '';

// Menangani pesan dari server
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'info') {
        username = data.message.split(' ')[4];
        appendSystemMessage(data.message);
    }

    if (data.type === 'chat') {
        appendChatMessage(data);
    }

    if (data.type === 'typing') {
        showTyping(data.user);
    }
};

function appendChatMessage(data) {
    typingStatus.textContent = '';
    const msg = document.createElement('div');
    msg.innerHTML = `<b>${data.user}</b> [${data.timestamp}]: ${data.text}`;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
}

function appendSystemMessage(msg) {
    const div = document.createElement('div');
    div.style.color = 'gray';
    div.textContent = msg;
    messages.appendChild(div);
}

function sendMessage() {
    const text = input.value.trim();
    if (text) {
        ws.send(JSON.stringify({ type: 'chat', text }));
        input.value = '';
    }
}

function showTyping(user) {
    typingStatus.textContent = `${user} is typing...`;
    setTimeout(() => {
        typingStatus.textContent = '';
    }, 1000);
}

let typingTimeout;
input.addEventListener('input', () => {
    if (typingTimeout) clearTimeout(typingTimeout);
    ws.send(JSON.stringify({ type: 'typing' }));
    typingTimeout = setTimeout(() => {}, 1000);
});
