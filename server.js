const express = require('express');
const https = require('https');
const fs = require('fs');
const WebSocket = require('ws');
const path = require('path');
const url = require('url'); // Diperlukan untuk parse URL dan query params
// const bcrypt = require('bcryptjs'); // Tidak diperlukan jika menggunakan password plain text
const jwt = require('jsonwebtoken'); // Tetap diperlukan untuk JWT

const app = express();
app.use(express.json()); // Middleware untuk parse JSON body requests
app.use(express.static(path.join(__dirname, 'public')));

// --- Konfigurasi Autentikasi ---
const JWT_SECRET = 'TUGASINSISWEBSOCKETGRUPMKELASB_!_MySup3rS3cr3t_2025@P@$$'; // Secret key JWT-mu
let users = [];
const usersFilePath = path.join(__dirname, 'users.json'); // Path ke file users.json

try {
    if (fs.existsSync(usersFilePath)) {
        const usersData = fs.readFileSync(usersFilePath, 'utf8');
        users = JSON.parse(usersData);
        console.log('Successfully loaded users from users.json (USING PLAIN TEXT PASSWORDS - INSECURE!)');
    } else {
        console.warn('users.json not found. User authentication will not work correctly.');
    }
} catch (err) {
    console.error('Error reading or parsing users.json:', err);
}
// --- Akhir Konfigurasi Autentikasi ---

const server = https.createServer({
    key: fs.readFileSync('cert/key.pem'),
    cert: fs.readFileSync('cert/cert.pem')
}, app);

const wss = new WebSocket.Server({ server });

const HEARTBEAT_INTERVAL = 30000;
const SERVER_ANNOUNCEMENT_INTERVAL_MS = 20000;
let announcementIntervalId;
const MAX_CONNECTIONS = 10; // Sesuaikan jika perlu
let activeConnections = 0;

function heartbeat() { this.isAlive = true; }

// Fungsi untuk mengirim pengumuman periodik ke semua klien
function broadcastServerAnnouncement() {
    const announcement = { type: 'server_announcement', message: `Server Info: Waktu server saat ini ${new Date().toLocaleTimeString()}`, timestamp: new Date().toLocaleTimeString() };
    const announcementString = JSON.stringify(announcement);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client.user) { // Kirim hanya ke klien terautentikasi
            client.send(announcementString);
        }
    });
}

// Fungsi untuk mengirim notifikasi user bergabung/meninggalkan chat
function broadcastUserActivity(username, activityType, excludedWsId = null) {
    const message = activityType === 'joined' ? `${username} has joined the chat!` : `${username} has left the chat.`;
    const notification = { type: 'user_activity_notification', user: username, activity: activityType, message: message, timestamp: new Date().toLocaleTimeString() };
    const notificationString = JSON.stringify(notification);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client.user && client.id !== excludedWsId) {
            client.send(notificationString);
        }
    });
    console.log(`Server: Broadcasted ${activityType} notification for ${username}`);
}

// Endpoint HTTP untuk Login (dengan plain text password)
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }
    const user = users.find(u => u.username === username);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }
    // PERBANDINGAN PASSWORD PLAIN TEXT
    if (password === user.password) { // Pastikan field di users.json adalah "password"
        const payload = { userId: user.id, username: user.username };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' }); // Token berlaku 1 jam
        res.json({ success: true, token: token, username: user.username });
    } else {
        res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }
});

// Event handler untuk setiap koneksi WebSocket baru (DENGAN VALIDASI TOKEN)
wss.on('connection', (ws, req) => { // req (request HTTP awal) penting di sini
    const queryParams = url.parse(req.url, true).query;
    const token = queryParams.token;

    if (!token) {
        console.log('Server: Connection attempt without token. Rejecting.');
        ws.send(JSON.stringify({ type: 'error', message: 'Authentication token required.' }));
        ws.terminate();
        return;
    }

    jwt.verify(token, JWT_SECRET, (err, decodedPayload) => {
        if (err) {
            console.log('Server: Invalid or expired token. Rejecting connection.', err.message);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid or expired token.' }));
            ws.terminate();
            return;
        }

        // Token valid, lanjutkan dengan setup koneksi
        if (activeConnections >= MAX_CONNECTIONS) {
            console.log(`Server: Connection limit (${MAX_CONNECTIONS}) reached. Rejecting connection for ${decodedPayload.username}.`);
            ws.send(JSON.stringify({ type: 'error', message: 'Server is full. Please try again later.' }));
            ws.terminate();
            return;
        }

        activeConnections++;
        console.log(`Server: Active connections: ${activeConnections}/${MAX_CONNECTIONS}`);

        ws.user = decodedPayload; // Berisi { userId, username }
        ws.id = ws.user.userId;   // Gunakan userId dari token sebagai ID koneksi WebSocket
        ws.username = ws.user.username; // Gunakan username dari token
        ws.isAlive = true;

        console.log(`Server: Client ${ws.username} (ID: ${ws.id}) connected and authenticated.`);

        // Kirim pesan info ke klien yang baru terhubung
        ws.send(JSON.stringify({
            type: 'info',
            message: `You are connected as ${ws.username}`,
            connectionId: ws.id // Ini adalah userId-nya sekarang
        }));

        // Kirim notifikasi ke klien LAIN bahwa pengguna baru telah bergabung
        broadcastUserActivity(ws.username, 'joined', ws.id);

        ws.on('pong', heartbeat);

        ws.on('message', (message) => {
            if (!ws.user) {
                console.log('Server: Message from unauthenticated connection (ws.user missing). Ignoring.');
                return ws.terminate();
            }
            ws.isAlive = true;
            let data;
            try { data = JSON.parse(message); }
            catch (e) { console.error("Invalid JSON received:", message.toString()); return; }

            if (data.type === 'chat') {
                const msgObj = {
                    type: 'chat',
                    user: ws.username, // Username dari token
                    id: ws.id,         // userId dari token
                    text: data.text,
                    timestamp: new Date().toLocaleTimeString(),
                };
                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN && client.user) {
                        client.send(JSON.stringify(msgObj));
                    }
                });
            } else if (data.type === 'typing') {
                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN && client.user && client.id !== ws.id) {
                        client.send(JSON.stringify({ type: 'typing', user: ws.username }));
                    }
                });
            }
        });

        ws.on('close', () => {
            activeConnections--;
            console.log(`Server: Client ${ws.username} (ID: ${ws.id}) disconnected. Active connections: ${activeConnections}/${MAX_CONNECTIONS}`);
            if (ws.username) {
                broadcastUserActivity(ws.username, 'left');
            }
        });

        ws.on('error', (err) => {
            console.error(`Server: Error from client ${ws.username || 'UNAUTHENTICATED'} (ID: ${ws.id || 'N/A'}): ${err.message}`);
        });
    }); // Akhir dari jwt.verify callback
});

const heartbeatCheckInterval = setInterval(function pingClients() {
    wss.clients.forEach(function each(ws) {
        if (!ws.user && ws.readyState === WebSocket.OPEN) {
            // Logika potensial untuk menutup koneksi yang tidak terautentikasi setelah timeout
            // console.log("Server: Potential unauthenticated connection still open.");
        }
        if (ws.user && ws.isAlive === false) {
            console.log(`Server: Terminating connection with ${ws.username} (ID: ${ws.id}) due to inactivity.`);
            return ws.terminate();
        }
        if (ws.user) { // Hanya ping klien yang sudah terautentikasi
            ws.isAlive = false;
            ws.ping();
        }
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
server.listen(PORT, () => { console.log(`Secure server running at https://localhost:${PORT}`); });