// Player information
let player = {
    x: 50, // Start near the left side
    y: 800 - 60 - 30, // Start near the bottom (canvas height - groundHeight - player.radius)
    vx: 0,
    vy: 0,
    radius: 30, // Enlarged player radius
    color: [Math.random() * 255, Math.random() * 255, Math.random() * 255],
    onGround: false,
    deformation: 0, 
    collectedCoins: [] 
};

let otherPlayers = {}; // Other players
let socket; // Socket.IO client

// Global variables
let gravity = 0.5; // Gravity
let isJumping = false;
let groundHeight = 60; // Increased ground height for larger canvas

// Platform
let platforms = [
    { x: 200, y: 600, width: 300, height: 20 },
    { x: 600, y: 500, width: 300, height: 20 },
    { x: 1100, y: 400, width: 300, height: 20 },
    { x: 300, y: 300, width: 300, height: 20 },
    { x: 800, y: 200, width: 300, height: 20 },
    { x: 1300, y: 100, width: 300, height: 20 }
];

// Coin 
let coins = [];
let coinRotationFrame = 0; // Frame counter for coin rotation animation

// Text
let inputBox;
let placedTexts = [];
let isTyping = false; // Indicates whether the player is typing

function setup() {
    createCanvas(1600, 800); 

    // Input box
    inputBox = createInput('');
    inputBox.position(10, 10); 
    inputBox.size(300, 40); // Increased size for better usability
    inputBox.input(() => isTyping = true); // Typing begins

    textFont("Arial"); // Set the font to Arial

    // Set coins at the center of each platform
    coins = platforms.map(platform => ({
        x: platform.x + platform.width / 2,
        y: platform.y - 15, // Slightly above the platform
        size: 30,
        collected: false
    }));

    // Connect to the server
    socket = io();

    // Handle incoming data from the server
    socket.on('currentPlayers', (players) => {
        otherPlayers = players;
    });

    socket.on('newPlayer', (newPlayer) => {
        otherPlayers[newPlayer.id] = newPlayer;
    });

    socket.on('playerMoved', (data) => {
        if (otherPlayers[data.id]) {
            otherPlayers[data.id].x = data.x;
            otherPlayers[data.id].y = data.y;
        }
    });

    socket.on('playerDisconnected', (id) => {
        delete otherPlayers[id];
    });

    socket.on('updateCoins', (serverCoins) => {
        coins = serverCoins;
    });

    socket.on('coinCollected', (data) => {
        coins[data.index].collected = true;
    });

    socket.on('newText', (textObj) => {
        placedTexts.push(textObj);
    });
}

function draw() {
    background(200);

    // Update coin rotation frame
    coinRotationFrame += 0.1;

    // Draw the ground
    fill(100, 200, 100);
    rect(0, height - groundHeight, width, groundHeight);

    // Draw the platforms
    for (let platform of platforms) {
        fill(150);
        rect(platform.x, platform.y, platform.width, platform.height);
    }

    // Draw the coins with horizontal rotation
    for (let coin of coins) {
        if (!coin.collected) {
            let scaleX = abs(sin(coinRotationFrame)) * 0.8 + 0.2; // Horizontal squash
            let scaleY = 1; // Keep height constant
            fill(255, 215, 0);
            ellipse(
                coin.x,
                coin.y,
                coin.size * scaleX, // Width scales with rotation
                coin.size * scaleY  // Height remains constant
            );
        }
    }

    // Draw other players
    for (let id in otherPlayers) {
        if (id !== socket.id) {
            let otherPlayer = otherPlayers[id];
            fill(200);
            ellipse(otherPlayer.x, otherPlayer.y, player.radius * 2);
        }
    }

    // Draw collected coins
    for (let i = 0; i < player.collectedCoins.length; i++) {
        let offset = (i + 1) * -15; // Arrange them in a line
        fill(255, 215, 0);
        ellipse(player.x, player.y + offset - player.radius, 15); 
    }

    // Draw texts
    for (let textObj of placedTexts) {
        fill(50);
        textAlign(CENTER, CENTER); // Center the text alignment
        textSize(20); // Enlarged text size
        text(textObj.content, textObj.x, textObj.y);
    }

    // Display typing indicator
    if (isTyping) {
        fill(255);
        stroke(0);
        ellipse(player.x, player.y - player.radius - 40, 80, 40); // Speech bubble
        fill(0);
        textSize(16);
        textAlign(CENTER, CENTER);
        text("Typing...", player.x, player.y - player.radius - 40);
    }

    // Draw instructions
    fill(0);
    textSize(16);
    textAlign(LEFT, TOP);
    text("Use 'A' and 'D' to move, 'W' to jump.\nNeed extra platforms? Type your text in the input box!( •̀ ω •́ )y Only three texts are allowed. The earliest one will be removed.", 10, 60);

    // Update player state only if not typing
    if (!isTyping) {
        updatePlayer();
    }

    // Draw the player
    fill(player.color);
    let deformationX = 1 + player.deformation; 
    let deformationY = 1 - player.deformation; 
    ellipse(
        player.x,
        player.y,
        player.radius * 2 * deformationX, // Width
        player.radius * 2 * deformationY  // Height
    );

    // Emit player movement to the server
    socket.emit('playerMove', { id: socket.id, x: player.x, y: player.y });
}

function updatePlayer() {
    // Apply gravity
    player.vy += gravity;

    // Update position
    player.x += player.vx;
    player.y += player.vy;

    // Check for collisions with platforms
    player.onGround = false;

    for (let platform of platforms) {
        handleCircularCollision(platform);
    }

    // Check for collisions with placed texts (treat as platforms)
    for (let textObj of placedTexts) {
        let textPlatform = {
            x: textObj.x - textWidthMeasure(textObj.content) / 2,
            y: textObj.y - 10, // Adjust for text height
            width: textWidthMeasure(textObj.content),
            height: 20 // Match text size
        };
        handleCircularCollision(textPlatform);
    }

    // Check for collisions with coins
    for (let coin of coins) {
        if (!coin.collected) {
            let d = dist(player.x, player.y, coin.x, coin.y); 
            if (d < player.radius + coin.size / 2 && player.collectedCoins.length < 3) {
                socket.emit('coinCollected', { index: coins.indexOf(coin) });
                coin.collected = true; 
                player.collectedCoins.push(coin); 
            }
        }
    }

    // Check for collisions with the ground (treat it as a flat platform)
    if (player.y + player.radius >= height - groundHeight) {
        player.y = height - groundHeight - player.radius;
        player.vy = 0;
        player.onGround = true;
        isJumping = false;

        // Calculate elastic deformation upon landing
        if (player.deformation === 0) {
            player.deformation = 0.3; // Set maximum deformation value
        }
    }

    // Gradually restore deformation
    if (player.onGround) {
        player.deformation = lerp(player.deformation, 0, 0.2); 
    } else {
        player.deformation = 0; 
    }

    // JUST FOR PLAYTEST, within the screen
    if (player.x < 0) player.x = 0;
    if (player.x > width) player.x = width;
}

// Handle circular collision with platforms
function handleCircularCollision(platform) {
    let nearestX = constrain(player.x, platform.x, platform.x + platform.width);
    let nearestY = constrain(player.y, platform.y, platform.y + platform.height);
    let distance = dist(player.x, player.y, nearestX, nearestY);

    if (distance < player.radius) {
        // Resolve collision
        let overlap = player.radius - distance;
        let angle = atan2(player.y - nearestY, player.x - nearestX);

        player.x += cos(angle) * overlap;
        player.y += sin(angle) * overlap;

        // Adjust velocity based on direction
        if (abs(sin(angle)) > 0.5) {
            player.vy = 0;
            player.onGround = true;
            isJumping = false;

            // Calculate elastic deformation upon landing
            if (player.deformation === 0) {
                player.deformation = 0.3;
            }
        } else {
            player.vx = 0;
        }
    }
}

// Measure text width
function textWidthMeasure(content) {
    textSize(20); // Match the enlarged text size
    return textWidth(content);
}

// Click
function mousePressed() {
    let content = inputBox.value();
    if (content) {
        if (placedTexts.length >= 3) {
            placedTexts.shift(); // Remove the oldest text
        }
        // Correctly place the text so the position matches the mouse click
        placedTexts.push({ x: mouseX, y: mouseY, content });
        inputBox.value(''); 
        socket.emit('newText', { x: mouseX, y: mouseY, content });
        isTyping = false; // End typing state
    }
}

function keyPressed() {
    if (!isTyping) { // Only allow movement if not typing
        if (key === 'A' || key === 'a') {
            player.vx = -3;
        } else if (key === 'D' || key === 'd') {
            player.vx = 3;
        } else if ((key === 'W' || key === 'w') && player.onGround && !isJumping) {
            player.vy = -12; 
            isJumping = true;
        }
    }
}

function keyReleased() {
    if (!isTyping && (key === 'A' || key === 'a' || key === 'D' || key === 'd')) {
        player.vx = 0;
    }
}
