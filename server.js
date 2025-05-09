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

const HEARTBEAT_INTERVAL = 30000;
const SERVER_ANNOUNCEMENT_INTERVAL_MS = 20000;
let announcementIntervalId;

const MAX_CONNECTIONS = 20; // Batas maksimum koneksi diubah kembali ke 20 (sesuai diskusi sebelumnya)
let activeConnections = 0;  // Counter untuk koneksi aktif

function heartbeat() {
    this.isAlive = true;
}

// Fungsi untuk mengirim pengumuman periodik ke semua klien
function broadcastServerAnnouncement() {
    const announcement = {
        type: 'server_announcement',
        message: `Server Info: Waktu server saat ini ${new Date().toLocaleTimeString()}`,
        timestamp: new Date().toLocaleTimeString()
    };
    const announcementString = JSON.stringify(announcement);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(announcementString);
        }
    });
}

// Fungsi untuk mengirim notifikasi user bergabung/meninggalkan chat
function broadcastUserActivity(username, activityType) {
    const message = activityType === 'joined'
        ? `${username} has joined the chat!`
        : `${username} has left the chat.`;
    const notification = {
        type: 'user_activity_notification',
        user: username,
        activity: activityType,
        message: message,
        timestamp: new Date().toLocaleTimeString()
    };
    const notificationString = JSON.stringify(notification);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(notificationString);
        }
    });
    console.log(`Server: Broadcasted ${activityType} notification for ${username}`);
}

// Event handler untuk setiap koneksi WebSocket baru
wss.on('connection', (ws) => {
    if (activeConnections >= MAX_CONNECTIONS) {
        console.log(`Server: Connection limit (${MAX_CONNECTIONS}) reached. Rejecting new connection.`);
        ws.send(JSON.stringify({ type: 'error', message: 'Server is full. Please try again later.' }));
        ws.terminate();
        return;
    }

    activeConnections++;
    console.log(`Server: Active connections: ${activeConnections}/${MAX_CONNECTIONS}`);

    ws.id = uuidv4();
    ws.username = `User-${ws.id.slice(0, 4)}`;
    ws.isAlive = true;

    console.log(`${ws.username} connected`);

    // Mengirim pesan info termasuk ID koneksi WebSocket klien
    ws.send(JSON.stringify({
        type: 'info',
        message: `You are connected as ${ws.username}`,
        connectionId: ws.id // <<< PENAMBAHAN FIELD connectionId
    }));
    broadcastUserActivity(ws.username, 'joined');

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
                id: ws.id, // id pengirim sudah ada di sini, ini penting untuk client
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
    });

    ws.on('close', () => {
        activeConnections--;
        console.log(`${ws.username} disconnected. Active connections: ${activeConnections}/${MAX_CONNECTIONS}`);
        broadcastUserActivity(ws.username, 'left');
    });

    ws.on('error', (err) => {
        console.error(`${ws.username} error: ${err.message}`);
    });
});

const heartbeatCheckInterval = setInterval(function pingClients() {
    wss.clients.forEach(function each(ws) {
        if (ws.isAlive === false) {
            console.log(`Terminating connection with ${ws.username} due to inactivity.`);
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, HEARTBEAT_INTERVAL);

wss.on('listening', () => {
    if (SERVER_ANNOUNCEMENT_INTERVAL_MS > 0 && !announcementIntervalId) {
        announcementIntervalId = setInterval(broadcastServerAnnouncement, SERVER_ANNOUNCEMENT_INTERVAL_MS);
        console.log(`Server: Started broadcasting announcements every ${SERVER_ANNOUNCEMENT_INTERVAL_MS / 1000} seconds.`);
    }
});

wss.on('close', function closeServer() {
    clearInterval(heartbeatCheckInterval);
    if (announcementIntervalId) {
        clearInterval(announcementIntervalId);
        console.log("Server: Stopped broadcasting announcements.");
    }
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Secure server running at https://localhost:${PORT}`);
});