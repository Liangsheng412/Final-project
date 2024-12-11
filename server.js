const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let players = {}; // Store player information

// Platforms and coins (consistent with the client)
let platforms = [
    { x: 200, y: 600, width: 300, height: 20 },
    { x: 600, y: 500, width: 300, height: 20 },
    { x: 1100, y: 400, width: 300, height: 20 },
    { x: 300, y: 300, width: 300, height: 20 },
    { x: 800, y: 200, width: 300, height: 20 },
    { x: 1300, y: 100, width: 300, height: 20 }
];

let coins = platforms.map(platform => ({
    x: platform.x + platform.width / 2,
    y: platform.y - 15, // Slightly above the platform
    size: 30,
    collected: false
}));

let placedTexts = []; // Store placed texts

// Serve static files from the "public" directory
app.use(express.static(__dirname + '/public'));

// Handle Socket.IO connections
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Add a new player
    players[socket.id] = {
        id: socket.id,
        x: 200,
        y: 150,
        color: [Math.random() * 255, Math.random() * 255, Math.random() * 255],
        collectedCoins: []
    };

    // Send the current state to the newly connected player
    socket.emit('currentPlayers', players);
    socket.emit('updateCoins', coins);
    socket.emit('updateTexts', placedTexts);

    // Notify other players about the new player
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // Handle player movement
    socket.on('playerMove', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            socket.broadcast.emit('playerMoved', { id: socket.id, x: data.x, y: data.y });
        }
    });

    // Handle coin collection
    socket.on('coinCollected', (data) => {
        if (coins[data.index] && !coins[data.index].collected) {
            coins[data.index].collected = true;
            players[socket.id].collectedCoins.push(data.index);
            io.emit('coinCollected', data);
        }
    });

    // Handle text placement
    socket.on('newText', (data) => {
        if (placedTexts.length >= 3) placedTexts.shift(); // Keep only the latest 3 texts
        placedTexts.push(data);
        io.emit('newText', data);
    });

    // Handle player disconnection
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

// Start the server
server.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});
