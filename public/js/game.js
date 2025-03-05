// Clochard Soccer - Client Game Logic

// Game constants
const FIELD_WIDTH = 800;
const FIELD_HEIGHT = 600;
const GOAL_WIDTH = 20;
const GOAL_HEIGHT = 150;
const PLAYER_RADIUS = 20;
const BALL_RADIUS = 15;

// Game elements
let client;
let room;
let canvas;
let ctx;
let currentPlayerId;
let keyState = {
    w: false,
    a: false,
    s: false,
    d: false
};

// Game assets
const playerSprites = {
    red: new Image(),
    blue: new Image()
};
const ballSprite = new Image();

// Load assets
playerSprites.red.src = '/assets/player_red.svg';
playerSprites.blue.src = '/assets/player_blue.svg';
ballSprite.src = '/assets/ball.svg';

// Verifichiamo che gli sprite siano caricati correttamente
playerSprites.red.onload = () => console.log('Sprite rosso caricato');
playerSprites.red.onerror = () => console.error('Errore nel caricamento dello sprite rosso');
playerSprites.blue.onload = () => console.log('Sprite blu caricato');
playerSprites.blue.onerror = () => console.error('Errore nel caricamento dello sprite blu');
ballSprite.onload = () => console.log('Sprite palla caricato');
ballSprite.onerror = () => console.error('Errore nel caricamento dello sprite palla');

// DOM elements
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const joinButton = document.getElementById('join-button');
const lobbyStatus = document.getElementById('lobby-status');
const countdownContainer = document.getElementById('countdown-container');
const countdownElement = document.getElementById('countdown');
const redScoreElement = document.getElementById('red-score');
const blueScoreElement = document.getElementById('blue-score');
const winnerTextElement = document.getElementById('winner-text');
const playAgainButton = document.getElementById('play-again-button');

// Initialize the game
function init() {
    // Set up canvas
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    
    // Connect to Colyseus server
    connectToServer();
    
    // Set up event listeners
    setupEventListeners();
}

// Connect to Colyseus server
function connectToServer() {
    // Create Colyseus client
    client = new Colyseus.Client('ws://localhost:3030');
    
    // Join button click handler
    joinButton.addEventListener('click', joinGame);
}

// Join the game
async function joinGame() {
    try {
        // First try to join an existing room with available slots
        try {
            room = await client.joinOrCreate('soccer_room');
            console.log('Joined existing room:', room.id);
        } catch (e) {
            // If joining fails (e.g., all rooms are full), create a new room
            console.log('Could not join existing room, creating new one');
            room = await client.create('soccer_room');
            console.log('Created new room:', room.id);
        }
        
        // Store the current player's ID
        currentPlayerId = room.sessionId;
        
        // Update UI
        joinButton.disabled = true;
        joinButton.textContent = 'Connesso';
        lobbyStatus.textContent = 'Connesso! In attesa di un altro giocatore...';
        
        // Set up room event handlers
        setupRoomHandlers();
    } catch (error) {
        console.error('Error joining room:', error);
        lobbyStatus.textContent = 'Errore di connessione. Riprova.';
        joinButton.disabled = false;
    }
}

// Set up room event handlers
function setupRoomHandlers() {
    // Listen for state changes
    room.onStateChange((state) => {
        updateGameState(state);
    });
    
    // Handle when we leave the room
    room.onLeave((code) => {
        console.log('Left room with code:', code);
        
        // Reset UI
        lobbyScreen.classList.remove('hidden');
        gameScreen.classList.add('hidden');
        gameOverScreen.classList.add('hidden');
        
        joinButton.disabled = false;
        joinButton.textContent = 'Entra in partita';
        lobbyStatus.textContent = 'Disconnesso. Clicca per riconnetterti.';
        
        // Clear room reference
        room = null;
    });
    
    // Handle room errors
    room.onError((code, message) => {
        console.error('Room error:', code, message);
        lobbyStatus.textContent = `Errore: ${message}. Riprova.`;
        joinButton.disabled = false;
    });
}

// Update game state based on server state
function updateGameState(state) {
    // Update scores
    redScoreElement.textContent = state.scores.red;
    blueScoreElement.textContent = state.scores.blue;
    
    // Handle different game states
    switch (state.gameState) {
        case 'waiting':
            showLobbyScreen();
            countdownContainer.classList.add('hidden');
            break;
            
        case 'countdown':
            showLobbyScreen();
            countdownContainer.classList.remove('hidden');
            countdownElement.textContent = state.countdown;
            break;
            
        case 'playing':
            showGameScreen();
            break;
            
        case 'finished':
            showGameOverScreen(state.winner);
            break;
    }
    
    // Render the game if we're playing
    if (state.gameState === 'playing' || state.gameState === 'finished') {
        renderGame(state);
    }
}

// Set up event listeners
function setupEventListeners() {
    // Keyboard event listeners
    window.addEventListener('keydown', (e) => {
        handleKeyEvent(e, true);
    });
    
    window.addEventListener('keyup', (e) => {
        handleKeyEvent(e, false);
    });
    
    // Play again button
    playAgainButton.addEventListener('click', () => {
        gameOverScreen.classList.add('hidden');
        lobbyScreen.classList.remove('hidden');
    });
    
    // Game loop
    requestAnimationFrame(gameLoop);
}

// Handle keyboard input
function handleKeyEvent(e, isDown) {
    // Only process input if we're in a game
    if (!room || room.state.gameState !== 'playing') return;
    
    switch (e.key.toLowerCase()) {
        case 'w':
            keyState.w = isDown;
            break;
        case 'a':
            keyState.a = isDown;
            break;
        case 's':
            keyState.s = isDown;
            break;
        case 'd':
            keyState.d = isDown;
            break;
    }
    
    // Send movement input to server
    sendMovementInput();
}

// Send movement input to server
function sendMovementInput() {
    if (!room || !room.state) return;
    
    // Determiniamo se dobbiamo invertire i controlli
    const currentPlayer = room.state.players[currentPlayerId];
    const needToFlip = currentPlayer && currentPlayer.team === 'blue';
    
    // Calculate direction vector
    let direction = {
        x: (keyState.d ? 1 : 0) - (keyState.a ? 1 : 0),
        y: (keyState.s ? 1 : 0) - (keyState.w ? 1 : 0)
    };
    
    // Se la vista è flippata, invertiamo la direzione orizzontale
    if (needToFlip) {
        direction.x = -direction.x;
    }
    
    // Normalize if moving diagonally
    if (direction.x !== 0 && direction.y !== 0) {
        const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
        direction.x /= length;
        direction.y /= length;
    }
    
    // Send to server
    room.send('move', { direction });
}

// Game loop
function gameLoop() {
    // Continue the loop
    requestAnimationFrame(gameLoop);
    
    // If we're in a game and it's playing, send movement input
    if (room && room.state && room.state.gameState === 'playing') {
        sendMovementInput();
    }
}

// Render the game
function renderGame(state) {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Get current player and opponent
    const currentPlayer = state.players[currentPlayerId];
    let opponent = null;
    let opponentId = null;
    
    // Utilizziamo forEach di Colyseus per iterare sui giocatori
    state.players.forEach((player, playerId) => {
        // Ignoriamo le proprietà interne di Colyseus
        if (playerId.startsWith('$')) return;
        
        // Ignoriamo il giocatore corrente
        if (playerId === currentPlayerId) return;
        
        // Abbiamo trovato l'avversario
        if (!opponent) {
            opponent = player;
            opponentId = playerId;
            console.log(`Found opponent: ${playerId}, team: ${player.team}`);
        }
    });
    
    // Determine if we need to flip the view (current player is always on the left)
    const needToFlip = currentPlayer && currentPlayer.team === 'blue';
    
    // Save the current transformation state
    ctx.save();
    
    // If we need to flip, apply the transformation
    if (needToFlip) {
        ctx.translate(FIELD_WIDTH, 0);
        ctx.scale(-1, 1);
    }
    
    // Draw the field
    drawField(needToFlip);
    
    // Draw the goals
    drawGoals(needToFlip);
    
    // Draw the players with correct positions
    if (currentPlayer) {
        drawPlayer(currentPlayer, true, needToFlip);
    }
    
    if (opponent) {
        drawPlayer(opponent, false, needToFlip);
    }
    
    // Draw the ball with correct position
    drawBall(state.ball, needToFlip);
    
    // Restore the original transformation state
    ctx.restore();
}

// Draw the soccer field
function drawField(flipped) {
    // Draw the green field
    ctx.fillStyle = '#2c8c3c';
    ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
    
    // Draw the center line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(FIELD_WIDTH / 2, 0);
    ctx.lineTo(FIELD_WIDTH / 2, FIELD_HEIGHT);
    ctx.stroke();
    
    // Draw the center circle
    ctx.beginPath();
    ctx.arc(FIELD_WIDTH / 2, FIELD_HEIGHT / 2, 70, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw the field border (similar to the screenshot)
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
    
    // Draw team names (as in the screenshot)
    ctx.font = 'bold 48px Arial';
    ctx.fillStyle = '#ffff00';
    ctx.textAlign = 'center';
    
    // If flipped, swap the names
    if (flipped) {
        ctx.fillText('MASSIMO', FIELD_WIDTH * 0.25, 80);
        ctx.fillText('DAVIDE', FIELD_WIDTH * 0.75, 80);
    } else {
        ctx.fillText('DAVIDE', FIELD_WIDTH * 0.25, 80);
        ctx.fillText('MASSIMO', FIELD_WIDTH * 0.75, 80);
    }
}

// Draw the goals
function drawGoals(flipped) {
    const goalY = (FIELD_HEIGHT - GOAL_HEIGHT) / 2;
    
    // Disegniamo le linee di porta con colori più visibili
    ctx.lineWidth = 5;
    
    // Nella vista flippata, il giocatore blu diventa rosso e viceversa
    // Quindi dobbiamo scambiare i colori delle porte
    if (flipped) {
        // Left goal (blue team defends in flipped view)
        ctx.fillStyle = 'rgba(0, 0, 255, 0.3)';
        ctx.fillRect(-GOAL_WIDTH, goalY, GOAL_WIDTH, GOAL_HEIGHT);
        ctx.strokeStyle = '#0000ff';
        ctx.strokeRect(-GOAL_WIDTH, goalY, GOAL_WIDTH, GOAL_HEIGHT);
        
        // Right goal (red team defends in flipped view)
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.fillRect(FIELD_WIDTH, goalY, GOAL_WIDTH, GOAL_HEIGHT);
        ctx.strokeStyle = '#ff0000';
        ctx.strokeRect(FIELD_WIDTH, goalY, GOAL_WIDTH, GOAL_HEIGHT);
        
        // Aggiungiamo indicatori di porta sul campo
        ctx.lineWidth = 3;
        
        // Left goal indicator (blue in flipped view)
        ctx.strokeStyle = '#0000ff';
        ctx.beginPath();
        ctx.moveTo(5, goalY);
        ctx.lineTo(5, goalY + GOAL_HEIGHT);
        ctx.stroke();
        
        // Right goal indicator (red in flipped view)
        ctx.strokeStyle = '#ff0000';
        ctx.beginPath();
        ctx.moveTo(FIELD_WIDTH - 5, goalY);
        ctx.lineTo(FIELD_WIDTH - 5, goalY + GOAL_HEIGHT);
        ctx.stroke();
    } else {
        // Left goal (red team defends in normal view)
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.fillRect(-GOAL_WIDTH, goalY, GOAL_WIDTH, GOAL_HEIGHT);
        ctx.strokeStyle = '#ff0000';
        ctx.strokeRect(-GOAL_WIDTH, goalY, GOAL_WIDTH, GOAL_HEIGHT);
        
        // Right goal (blue team defends in normal view)
        ctx.fillStyle = 'rgba(0, 0, 255, 0.3)';
        ctx.fillRect(FIELD_WIDTH, goalY, GOAL_WIDTH, GOAL_HEIGHT);
        ctx.strokeStyle = '#0000ff';
        ctx.strokeRect(FIELD_WIDTH, goalY, GOAL_WIDTH, GOAL_HEIGHT);
        
        // Aggiungiamo indicatori di porta sul campo
        ctx.lineWidth = 3;
        
        // Left goal indicator (red in normal view)
        ctx.strokeStyle = '#ff0000';
        ctx.beginPath();
        ctx.moveTo(5, goalY);
        ctx.lineTo(5, goalY + GOAL_HEIGHT);
        ctx.stroke();
        
        // Right goal indicator (blue in normal view)
        ctx.strokeStyle = '#0000ff';
        ctx.beginPath();
        ctx.moveTo(FIELD_WIDTH - 5, goalY);
        ctx.lineTo(FIELD_WIDTH - 5, goalY + GOAL_HEIGHT);
        ctx.stroke();
    }
}

// Draw a player
function drawPlayer(player, isCurrentPlayer, flipped) {
    // Choose the correct sprite based on team
    // If flipped, we need to swap the sprites to maintain visual consistency
    let sprite;
    if (flipped) {
        sprite = player.team === 'red' ? playerSprites.blue : playerSprites.red;
    } else {
        sprite = player.team === 'red' ? playerSprites.red : playerSprites.blue;
    }
    
    // Verifichiamo che lo sprite sia caricato
    if (sprite.complete && sprite.naturalHeight !== 0) {
        // Draw player sprite
        ctx.drawImage(
            sprite,
            player.x - PLAYER_RADIUS,
            player.y - PLAYER_RADIUS,
            PLAYER_RADIUS * 2,
            PLAYER_RADIUS * 2
        );
    } else {
        // Se lo sprite non è caricato, disegniamo un cerchio colorato
        ctx.beginPath();
        ctx.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = player.team === 'red' ? '#ff0000' : '#0000ff';
        ctx.fill();
        ctx.closePath();
    }
    
    // Highlight current player
    if (isCurrentPlayer) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(player.x, player.y, PLAYER_RADIUS + 5, 0, Math.PI * 2);
        ctx.stroke();
    }
}

// Draw the ball
function drawBall(ball, flipped) {
    // Draw ball sprite
    ctx.drawImage(
        ballSprite,
        ball.x - BALL_RADIUS,
        ball.y - BALL_RADIUS,
        BALL_RADIUS * 2,
        BALL_RADIUS * 2
    );
}

// Show the lobby screen
function showLobbyScreen() {
    lobbyScreen.classList.remove('hidden');
    gameScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
}

// Show the game screen
function showGameScreen() {
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    gameOverScreen.classList.add('hidden');
}

// Show the game over screen
function showGameOverScreen(winner) {
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    
    // Set winner text with appropriate color
    winnerTextElement.textContent = winner.toUpperCase();
    winnerTextElement.className = winner === 'red' ? 'text-red-500' : 'text-blue-500';
}

// Initialize the game when the page loads
window.addEventListener('load', init);
