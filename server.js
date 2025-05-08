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
const SERVER_ANNOUNCEMENT_INTERVAL_MS = 20000; // Kirim pengumuman setiap 20 detik
let announcementIntervalId;

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

    // console.log("Server: Broadcasting announcement:", announcement.message);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(announcementString);
        }
    });
}

// Fungsi untuk mengirim notifikasi user bergabung/meninggalkan chat
function broadcastUserActivity(username, activityType) { // activityType bisa 'joined' atau 'left'
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
            // Kirim ke semua klien
            client.send(notificationString);
        }
    });
    console.log(`Server: Broadcasted ${activityType} notification for ${username}`);
}


wss.on('connection', (ws) => {
    ws.id = uuidv4();
    ws.username = `User-${ws.id.slice(0, 4)}`;
    ws.isAlive = true;

    console.log(`${ws.username} connected`);

    // Kirim pesan info personal ke klien yang baru terhubung
    ws.send(JSON.stringify({ type: 'info', message: `You are connected as ${ws.username}` }));

    // Kirim notifikasi ke semua klien bahwa pengguna baru telah bergabung
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
                id: ws.id,
                text: data.text,
                timestamp: new Date().toLocaleTimeString(),
            };
            // Broadcast pesan chat ke semua klien
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(msgObj));
                }
            });
        } else if (data.type === 'typing') {
            // Broadcast status typing ke klien lain
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
        // Kirim notifikasi ke semua klien bahwa pengguna telah meninggalkan chat
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


wss.on('listening', () => { // Mulai interval pengumuman setelah server benar-benar listen
    if (SERVER_ANNOUNCEMENT_INTERVAL_MS > 0 && !announcementIntervalId) {
        announcementIntervalId = setInterval(broadcastServerAnnouncement, SERVER_ANNOUNCEMENT_INTERVAL_MS);
        console.log(`Server: Started broadcasting announcements every ${SERVER_ANNOUNCEMENT_INTERVAL_MS / 1000} seconds.`);
    }
});

wss.on('close', function closeServer() { // Renamed for clarity
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