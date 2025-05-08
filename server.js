const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', (ws) => {
    ws.id = uuidv4();
    ws.username = `User-${ws.id.slice(0, 4)}`;

    console.log(`${ws.username} connected`);

    ws.send(JSON.stringify({ type: 'info', message: `You are connected as ${ws.username}` }));

    ws.on('message', (message) => {
        let data;
        try {
            data = JSON.parse(message);
        } catch {
            console.error("Invalid JSON");
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
        }

        if (data.type === 'typing') {
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN && client !== ws) {
                    client.send(JSON.stringify({
                        type: 'typing',
                        user: ws.username,
                    }));
                }
            });
        }
    });

    ws.on('close', () => {
        console.log(`${ws.username} disconnected`);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
