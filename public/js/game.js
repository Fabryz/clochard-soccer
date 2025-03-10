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

// Animazione goal
let goalAnimation = {
    active: false,
    startTime: 0,
    duration: 3000, // 3 secondi
    text: 'GOAL!'
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
playerSprites.red.onload = () => console.log('Red player sprite loaded');
playerSprites.red.onerror = () => console.error('Error loading red player sprite');
playerSprites.blue.onload = () => console.log('Blue player sprite loaded');
playerSprites.blue.onerror = () => console.error('Error loading blue player sprite');
ballSprite.onload = () => console.log('Ball sprite loaded');
ballSprite.onerror = () => console.error('Error loading ball sprite');

// DOM elements
const domElements = {
    initialized: false,
    lobbyScreen: null,
    gameScreen: null,
    gameOverScreen: null,
    joinButton: null,
    lobbyStatus: null,
    connectionStatus: null,
    countdownContainer: null,
    countdownElement: null,
    timeRemainingElement: null,
    winnerTextElement: null,
    playAgainButton: null,
    disconnectionOverlay: null,
    disconnectionCountdown: null,
    disconnectionMessage: null
};

// Initialize the game
function init() {
    // Initialize DOM elements
    domElements.lobbyScreen = document.getElementById('lobby-screen');
    domElements.gameScreen = document.getElementById('game-screen');
    domElements.gameOverScreen = document.getElementById('game-over-screen');
    domElements.joinButton = document.getElementById('join-button');
    domElements.lobbyStatus = document.getElementById('lobby-status');
    domElements.connectionStatus = document.getElementById('connection-status');
    domElements.countdownContainer = document.getElementById('countdown-container');
    domElements.countdownElement = document.getElementById('countdown');
    domElements.timeRemainingElement = document.getElementById('time-remaining');
    domElements.winnerTextElement = document.getElementById('winner-text');
    domElements.playAgainButton = document.getElementById('play-again-button');
    domElements.disconnectionOverlay = document.getElementById('disconnection-overlay');
    domElements.disconnectionCountdown = document.getElementById('disconnection-countdown');
    domElements.disconnectionMessage = document.getElementById('disconnection-message');
    domElements.initialized = true;
    
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
    // Determine server URL based on environment
    const isProduction = window.location.hostname !== 'localhost';
    let serverUrl = 'ws://localhost:3030';
    
    if (isProduction) {
        // Use secure WebSocket in production (Heroku)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        serverUrl = `${protocol}//${host}`;
    }
    
    console.log(`Connecting to server: ${serverUrl}`);
    client = new Colyseus.Client(serverUrl);
    
    // Join button click handler
    if (domElements.initialized && domElements.joinButton) {
        domElements.joinButton.addEventListener('click', joinGame);
    }
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
        if (domElements.initialized) {
            domElements.joinButton.classList.add('hidden');
            if (domElements.connectionStatus) domElements.connectionStatus.classList.remove('hidden');
            domElements.lobbyStatus.textContent = 'Connected! Waiting for another player...';
        }
        
        // Set up room event handlers
        setupRoomHandlers();
    } catch (error) {
        console.error('Error joining room:', error);
        if (domElements.initialized) {
            if (domElements.lobbyStatus) domElements.lobbyStatus.textContent = 'Connection error. Try again.';
            if (domElements.joinButton) domElements.joinButton.disabled = false;
        }
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
        
        if (domElements.initialized) {
            // Reset UI
            if (domElements.lobbyScreen) domElements.lobbyScreen.classList.remove('hidden');
            if (domElements.gameScreen) domElements.gameScreen.classList.add('hidden');
            if (domElements.gameOverScreen) domElements.gameOverScreen.classList.add('hidden');
            
            // Nascondi il countdown container
            if (domElements.countdownContainer) {
                domElements.countdownContainer.classList.add('hidden');
            }
            
            // Remove disconnection overlay if it exists
            if (domElements.disconnectionOverlay) {
                domElements.disconnectionOverlay.style.display = 'none';
            }
        }
        
        // Show join button and hide connection status
        if (domElements.initialized) {
            domElements.joinButton.classList.remove('hidden');
            if (domElements.connectionStatus) domElements.connectionStatus.classList.add('hidden');
            domElements.lobbyStatus.textContent = 'Disconnected. Click to reconnect.';
        }
        
        // Clear room reference
        room = null;
        
        // Restart game loop if it was stopped
        requestAnimationFrame(gameLoop);
    });
    
    // Handle room errors
    room.onError((code, message) => {
        console.error('Room error:', code, message);
        if (domElements.initialized) {
            if (domElements.lobbyStatus) domElements.lobbyStatus.textContent = `Error: ${message}. Try again.`;
            if (domElements.joinButton) domElements.joinButton.disabled = false;
        }
    });
    
    // Handle player disconnection
    room.onMessage('playerDisconnected', (message) => {
        console.log('Opponent disconnected:', message);
        
        // Show disconnection message
        const disconnectedTeam = message.team;
        showDisconnectionMessage(disconnectedTeam);
    });
    
    // Handle room closing
    room.onMessage('roomClosing', () => {
        console.log('Room is closing');
        // The room will automatically disconnect us, which will trigger onLeave
    });
}

// Variabili per tenere traccia dei punteggi precedenti
let prevRedScore = 0;
let prevBlueScore = 0;

// Update game state based on server state
function updateGameState(state) {
    
    // Controlla se c'è stato un goal (confrontando i punteggi precedenti con quelli attuali)
    if (room && room.state) {
        if (state.scores.red > prevRedScore || state.scores.blue > prevBlueScore) {
            // Attiva l'animazione del goal
            goalAnimation.active = true;
            goalAnimation.startTime = Date.now();
            
            // Determiniamo se è un autogol o un gol normale
            if (state.lastScorer) {
                const currentPlayerId = room.sessionId;
                const scoringTeam = state.lastScorer.team;
                const scoringPlayerId = state.lastScorer.playerId;
                
                console.log(`Goal info - Scoring team: ${scoringTeam}, Scoring player ID: ${scoringPlayerId}`);
                console.log(`Current player ID: ${currentPlayerId}`);
                
                // Verifichiamo se è un autogol
                if (scoringPlayerId) {
                    const playerTeam = room.state.players[scoringPlayerId].team;
                    const isOwnGoal = playerTeam !== scoringTeam;
                    
                    if (isOwnGoal) {
                        goalAnimation.text = 'AUTOGOAL!'; // Tutti vedono "OWN GOAL!" in caso di autogol
                    } else {
                        goalAnimation.text = 'GOAL!'; // Tutti vedono "GOAL!" in caso di gol normale
                    }
                } else {
                    goalAnimation.text = 'GOAL!';
                }
            } else {
                // Fallback nel caso in cui lastScorer non sia disponibile
                goalAnimation.text = 'GOAL!';
            }
            
            // Aggiorniamo i punteggi precedenti
            prevRedScore = state.scores.red;
            prevBlueScore = state.scores.blue;
        }
    }
    
    // Aggiorniamo il timer
    if (state.timeRemaining !== undefined && domElements.initialized && domElements.timeRemainingElement) {
        const minutes = Math.floor(state.timeRemaining / 60);
        const seconds = state.timeRemaining % 60;
        domElements.timeRemainingElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // Handle different game states
    switch (state.gameState) {
        case 'waiting':
            showLobbyScreen();
            if (domElements.initialized && domElements.countdownContainer) {
                domElements.countdownContainer.classList.add('hidden');
            }
            break;
            
        case 'countdown':
            showLobbyScreen();
            if (domElements.initialized && domElements.countdownContainer) {
                domElements.countdownContainer.classList.remove('hidden');
            }
            // Assicuriamoci che il countdown venga aggiornato correttamente
            if (state.countdown !== undefined && domElements.initialized && domElements.countdownElement) {
                domElements.countdownElement.textContent = state.countdown;
                console.log('Countdown updated:', state.countdown);
            }
            break;
            
        case 'playing':
            showGameScreen();
            break;
            
        case 'gameOver':
            showGameOverScreen(state.winner);
            break;
            
        case 'finished':
            showGameOverScreen(state.winner);
            break;
            
        case 'playerDisconnected':
            if (domElements.initialized) {
                // Update the disconnection countdown in the UI
                if (domElements.disconnectionCountdown) {
                    domElements.disconnectionCountdown.textContent = state.disconnectionCountdown;
                }
                
                // Assicurati che l'overlay di disconnessione sia visibile
                if (domElements.disconnectionOverlay) {
                    domElements.disconnectionOverlay.style.display = 'flex';
                    
                    // Nascondi gli altri schermi
                    if (domElements.lobbyScreen) domElements.lobbyScreen.classList.add('hidden');
                    if (domElements.gameScreen) domElements.gameScreen.classList.add('hidden');
                    if (domElements.gameOverScreen) domElements.gameOverScreen.classList.add('hidden');
                }
            }
            break;
    }
    
    // Render the game if we're playing, in countdown, or game is over
    // Non renderizziamo il gioco se un giocatore si è disconnesso
    if ((state.gameState === 'playing' || state.gameState === 'gameOver' || state.gameState === 'finished' || state.gameState === 'countdown') && state.gameState !== 'playerDisconnected') {
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
    
    if (domElements.initialized) {
        // Play again button
        if (domElements.playAgainButton) {
            domElements.playAgainButton.addEventListener('click', () => {
                if (domElements.gameOverScreen) domElements.gameOverScreen.classList.add('hidden');
                if (domElements.lobbyScreen) domElements.lobbyScreen.classList.remove('hidden');
            });
        }
    }
    
    // Game loop
    requestAnimationFrame(gameLoop);
}

// Handle keyboard input
function handleKeyEvent(e, isDown) {
    // Only process input if we're in a game and not in playerDisconnected state
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
    if (!room || !room.state || room.state.gameState === 'playerDisconnected') return;
    
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
    // If we're in a disconnected state, don't continue the loop
    if (room && room.state && room.state.gameState === 'playerDisconnected') {
        // Don't continue the loop
        return;
    }
    
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
    
    // Se siamo in fase di countdown, mostriamo solo il campo e il countdown
    if (state.gameState === 'countdown') {
        // Determine if the view should be flipped based on the player's team
        let flipped = false;
        if (room.sessionId && room.state.players[room.sessionId]) {
            flipped = room.state.players[room.sessionId].team === 'blue';
        }
        
        // Disegniamo il campo
        drawField(flipped);
        
        // Disegniamo il countdown al centro del campo
        ctx.save();
        
        // Resettiamo completamente la trasformazione per il testo
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset alla matrice di trasformazione
        
        ctx.font = 'bold 120px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(state.countdown, canvas.width / 2, canvas.height / 2);
        
        ctx.restore();
        return;
    }
    
    // Aggiorniamo l'animazione del goal se attiva
    updateGoalAnimation();
    
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
    
    // Aggiorniamo l'animazione del goal (sempre in primo piano)
    updateGoalAnimation();
}

// Draw the soccer field
function drawField(flipped) {
    // Draw the green field
    ctx.fillStyle = '#2c8c3c';
    ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
    
    // Set white lines style
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    
    // Draw the center line
    ctx.beginPath();
    ctx.moveTo(FIELD_WIDTH / 2, 0);
    ctx.lineTo(FIELD_WIDTH / 2, FIELD_HEIGHT);
    ctx.stroke();
    
    // Draw the center circle
    ctx.beginPath();
    ctx.arc(FIELD_WIDTH / 2, FIELD_HEIGHT / 2, 70, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw the field border
    ctx.beginPath();
    ctx.rect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
    ctx.stroke();
    
    // Draw penalty areas
    const penaltyAreaWidth = 150;
    const penaltyAreaHeight = 300;
    const penaltyAreaY = (FIELD_HEIGHT - penaltyAreaHeight) / 2;
    
    // Left penalty area
    ctx.beginPath();
    ctx.rect(0, penaltyAreaY, penaltyAreaWidth, penaltyAreaHeight);
    ctx.stroke();
    
    // Right penalty area
    ctx.beginPath();
    ctx.rect(FIELD_WIDTH - penaltyAreaWidth, penaltyAreaY, penaltyAreaWidth, penaltyAreaHeight);
    ctx.stroke();
    
    // Draw goal lines
    const goalY = (FIELD_HEIGHT - GOAL_HEIGHT) / 2;
    
    // Left goal line
    ctx.beginPath();
    ctx.moveTo(0, goalY);
    ctx.lineTo(0, goalY + GOAL_HEIGHT);
    ctx.stroke();
    
    // Right goal line
    ctx.beginPath();
    ctx.moveTo(FIELD_WIDTH, goalY);
    ctx.lineTo(FIELD_WIDTH, goalY + GOAL_HEIGHT);
    ctx.stroke();
    
    // Salviamo il contesto prima di disegnare il testo
    ctx.save();
    
    // Resettiamo la trasformazione per il testo (in modo che non sia flippato)
    if (flipped) {
        ctx.translate(FIELD_WIDTH, 0);
        ctx.scale(-1, 1);
    }
    
    // Disegniamo i nomi dei team sul campo
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Determiniamo il team del giocatore corrente
    const currentPlayerTeam = room && room.sessionId && room.state.players[room.sessionId] ? 
        room.state.players[room.sessionId].team : 'red';
    
    // Determiniamo quale punteggio mostrare a sinistra e a destra
    let leftScore, rightScore;
    if (currentPlayerTeam === 'red') {
        // Il giocatore rosso vede il suo punteggio a sinistra
        leftScore = room.state.scores.red;
        rightScore = room.state.scores.blue;
    } else {
        // Il giocatore blu vede il suo punteggio a sinistra
        leftScore = room.state.scores.blue;
        rightScore = room.state.scores.red;
    }
    
    // Nome team a sinistra (sempre YOU)
    ctx.fillStyle = '#ff0000';
    ctx.fillText('YOU', FIELD_WIDTH / 4, 30);
    
    // Nome team a destra (sempre OPPONENT)
    ctx.fillStyle = '#0000ff';
    ctx.fillText('OPPONENT', FIELD_WIDTH * 3 / 4, 30);
    
    // Aggiungiamo i punteggi sotto i nomi dei team
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(leftScore, FIELD_WIDTH / 4, 60);
    ctx.fillText(rightScore, FIELD_WIDTH * 3 / 4, 60);
    
    // Ripristiniamo il contesto
    ctx.restore();
    
    // Non mostriamo più i nomi dei giocatori
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

// Update and draw goal animation
function updateGoalAnimation() {
    if (!goalAnimation.active) return;
    
    const elapsedTime = Date.now() - goalAnimation.startTime;
    const progress = Math.min(elapsedTime / goalAnimation.duration, 1);
    
    // Se l'animazione è finita, disattiviamola
    if (progress >= 1) {
        goalAnimation.active = false;
        return;
    }
    
    // Salviamo lo stato corrente del canvas
    ctx.save();
    
    // Calcoliamo le dimensioni dell'animazione
    // La dimensione aumenta fino a metà dell'animazione, poi diminuisce
    const scale = progress < 0.5 
        ? 1 + progress * 3 
        : 4 - (progress - 0.5) * 6;
    
    // Calcoliamo l'opacità (parte al massimo e poi sfuma)
    const opacity = 1 - Math.pow(progress, 2);
    
    // Impostiamo lo stile del testo
    ctx.font = `bold ${Math.floor(70 * scale)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Disegniamo l'ombra
    ctx.fillStyle = `rgba(0, 0, 0, ${opacity * 0.5})`;
    ctx.fillText(goalAnimation.text, FIELD_WIDTH / 2 + 3, FIELD_HEIGHT / 2 + 3);
    
    // Disegniamo il testo con un gradiente
    const gradient = ctx.createLinearGradient(
        FIELD_WIDTH / 2 - 100, 
        FIELD_HEIGHT / 2 - 50, 
        FIELD_WIDTH / 2 + 100, 
        FIELD_HEIGHT / 2 + 50
    );
    gradient.addColorStop(0, `rgba(255, 255, 0, ${opacity})`);
    gradient.addColorStop(0.5, `rgba(255, 165, 0, ${opacity})`);
    gradient.addColorStop(1, `rgba(255, 0, 0, ${opacity})`);
    
    ctx.fillStyle = gradient;
    ctx.fillText(goalAnimation.text, FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
    
    // Ripristiniamo lo stato del canvas
    ctx.restore();
}

// Show the lobby screen
function showLobbyScreen() {
    if (!domElements.initialized) return;
    
    if (domElements.lobbyScreen) domElements.lobbyScreen.classList.remove('hidden');
    if (domElements.gameScreen) domElements.gameScreen.classList.add('hidden');
    if (domElements.gameOverScreen) domElements.gameOverScreen.classList.add('hidden');
    
    // Nascondi il countdown container di default
    // (verrà mostrato solo quando lo stato del gioco è 'countdown')
    if (domElements.countdownContainer) {
        domElements.countdownContainer.classList.add('hidden');
    }
}

// Show the game screen
function showGameScreen() {
    if (!domElements.initialized) return;
    
    if (domElements.lobbyScreen) domElements.lobbyScreen.classList.add('hidden');
    if (domElements.gameScreen) domElements.gameScreen.classList.remove('hidden');
    if (domElements.gameOverScreen) domElements.gameOverScreen.classList.add('hidden');
}

// Show the game over screen
function showGameOverScreen(winner) {
    if (!domElements.initialized) return;
    
    if (domElements.lobbyScreen) domElements.lobbyScreen.classList.add('hidden');
    if (domElements.gameScreen) domElements.gameScreen.classList.add('hidden');
    if (domElements.gameOverScreen) domElements.gameOverScreen.classList.remove('hidden');
    
    // Determiniamo il team del giocatore corrente
    const currentPlayerTeam = room && room.sessionId && room.state.players[room.sessionId] ? 
        room.state.players[room.sessionId].team : 'red';
    
    // Set winner text with appropriate color
    if (!domElements.initialized || !domElements.winnerTextElement) return;
    
    if (winner === 'draw') {
        domElements.winnerTextElement.textContent = 'IT\'S A DRAW!';
        domElements.winnerTextElement.className = 'text-yellow-500';
    } else {
        // Verifichiamo se il giocatore ha vinto o perso
        const playerWon = winner === currentPlayerTeam;
        
        if (playerWon) {
            domElements.winnerTextElement.textContent = 'YOU WIN!';
            domElements.winnerTextElement.className = 'text-green-500';
        } else {
            domElements.winnerTextElement.textContent = 'YOU LOSE!';
            domElements.winnerTextElement.className = 'text-red-500';
        }
    }
}

// Show disconnection message
function showDisconnectionMessage(disconnectedTeam) {
    if (!domElements.initialized) return;
    
    // Create disconnection overlay if it doesn't exist
    if (!domElements.disconnectionOverlay) {
        domElements.disconnectionOverlay = document.createElement('div');
        domElements.disconnectionOverlay.id = 'disconnection-overlay';
        domElements.disconnectionOverlay.style.position = 'fixed';
        domElements.disconnectionOverlay.style.top = '0';
        domElements.disconnectionOverlay.style.left = '0';
        domElements.disconnectionOverlay.style.width = '100%';
        domElements.disconnectionOverlay.style.height = '100%';
        domElements.disconnectionOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        domElements.disconnectionOverlay.style.color = 'white';
        domElements.disconnectionOverlay.style.display = 'flex';
        domElements.disconnectionOverlay.style.flexDirection = 'column';
        domElements.disconnectionOverlay.style.justifyContent = 'center';
        domElements.disconnectionOverlay.style.alignItems = 'center';
        domElements.disconnectionOverlay.style.zIndex = '1000';
        domElements.disconnectionOverlay.style.fontFamily = 'Arial, sans-serif';
        document.body.appendChild(domElements.disconnectionOverlay);
        
        // Create message element
        domElements.disconnectionMessage = document.createElement('div');
        domElements.disconnectionMessage.id = 'disconnection-message';
        domElements.disconnectionMessage.style.fontSize = '24px';
        domElements.disconnectionMessage.style.marginBottom = '20px';
        domElements.disconnectionOverlay.appendChild(domElements.disconnectionMessage);
        
        // Create countdown element
        domElements.disconnectionCountdown = document.createElement('div');
        domElements.disconnectionCountdown.id = 'disconnection-countdown';
        domElements.disconnectionCountdown.style.fontSize = '48px';
        domElements.disconnectionCountdown.style.fontWeight = 'bold';
        domElements.disconnectionOverlay.appendChild(domElements.disconnectionCountdown);
        
        // Create info element
        const infoElement = document.createElement('div');
        infoElement.style.fontSize = '18px';
        infoElement.style.marginTop = '20px';
        infoElement.textContent = 'Returning to lobby...';
        domElements.disconnectionOverlay.appendChild(infoElement);
    }
    
    // Update message based on disconnected team
    if (domElements.disconnectionMessage) {
        if (disconnectedTeam === 'red') {
            domElements.disconnectionMessage.textContent = 'Red player disconnected!';
            domElements.disconnectionMessage.style.color = '#ff4136';
        } else if (disconnectedTeam === 'blue') {
            domElements.disconnectionMessage.textContent = 'Blue player disconnected!';
            domElements.disconnectionMessage.style.color = '#0074d9';
        } else {
            domElements.disconnectionMessage.textContent = 'Opponent disconnected!';
            domElements.disconnectionMessage.style.color = '#ffffff';
        }
    }
    
    // Inizializza il countdown a 10 secondi
    if (room && room.state && domElements.disconnectionCountdown) {
        domElements.disconnectionCountdown.textContent = room.state.disconnectionCountdown || 10;
    }
    
    // Nascondi gli altri schermi
    if (domElements.lobbyScreen) domElements.lobbyScreen.classList.add('hidden');
    if (domElements.gameScreen) domElements.gameScreen.classList.add('hidden');
    if (domElements.gameOverScreen) domElements.gameOverScreen.classList.add('hidden');
    
    // Show the overlay
    if (domElements.disconnectionOverlay) domElements.disconnectionOverlay.style.display = 'flex';
}

// Initialize the game when the page loads
window.addEventListener('load', init);
