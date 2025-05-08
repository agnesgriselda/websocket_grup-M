const express = require('express');
const https = require('https');
const fs = require('fs');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();

const server = https.createServer({
    key: fs.readFileSync('cert/key.pem'),
    cert: fs.readFileSync('cert/cert.pem')
}, app);

const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

const HEARTBEAT_INTERVAL = 30000; // 30 seconds

function heartbeat() {
    this.isAlive = true;
}

wss.on('connection', (ws) => {
    ws.id = uuidv4();
    ws.username = `User-${ws.id.slice(0, 4)}`;
    ws.isAlive = true;

    console.log(`${ws.username} connected`);

    ws.send(JSON.stringify({ type: 'info', message: `You are connected as ${ws.username}` }));

    ws.on('pong', heartbeat);

    ws.on('message', (message) => {
        ws.isAlive = true;

        let data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            console.error("Invalid JSON received:", message.toString());
            return;
        }

        if (data.type === 'chat') {
            const msgObj = {
                type: 'chat',
                user: ws.username,
                id: ws.id,
                text: data.text,
                timestamp: new Date().toLocaleTimeString(),
            };

            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(msgObj));
                }
            });
        } else if (data.type === 'typing') {
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN && client !== ws) {
                    client.send(JSON.stringify({
                        type: 'typing',
                        user: ws.username,
                    }));
                }
            });
        }
        // else if (data.type === '__ping__') { // Jika klien mengirim ping aplikasi
        //     ws.send(JSON.stringify({ type: '__pong__' }));
        // }
    });

    ws.on('close', () => {
        console.log(`${ws.username} disconnected`);
    });

    ws.on('error', (err) => {
        console.error(`${ws.username} error: ${err.message}`);
    });
});

const interval = setInterval(function pingClients() { // Ganti nama fungsi agar lebih deskriptif
    wss.clients.forEach(function each(ws) {
        if (ws.isAlive === false) {
            console.log(`Terminating connection with ${ws.username} due to inactivity.`);
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping(); // PERBAIKAN DI SINI
    });
}, HEARTBEAT_INTERVAL);

wss.on('close', function close() {
    clearInterval(interval);
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Secure server running at https://localhost:${PORT}`);
});