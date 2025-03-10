const colyseus = require('colyseus');
const { SoccerRoomState, Player, LastScorer } = require('../schema/SoccerRoomState');

class SoccerRoom extends colyseus.Room {
  // Game constants
  static FIELD_WIDTH = 800;
  static FIELD_HEIGHT = 600;
  static GOAL_WIDTH = 20;
  static GOAL_HEIGHT = 150;
  static PLAYER_RADIUS = 20;
  static BALL_RADIUS = 15;
  static MAX_SCORE = 3;
  static COUNTDOWN_SECONDS = 5;
  static PHYSICS_UPDATE_RATE = 1000 / 60; // 60 FPS
  static GAME_DURATION_SECONDS = 180; // 3 minuti

  onCreate(options) {
    console.log('Creating new SoccerRoom:', this.roomId);
    
    // Set max clients to 2
    this.maxClients = 2;
    
    // Initialize state
    this.setState(new SoccerRoomState());
    
    // Initialize ball position
    this.state.ball.x = SoccerRoom.FIELD_WIDTH / 2;
    this.state.ball.y = SoccerRoom.FIELD_HEIGHT / 2;
    this.state.ball.velocityX = 0;
    this.state.ball.velocityY = 0;
    
    // Set initial game state
    this.state.gameState = 'waiting'; // waiting, countdown, playing, finished, playerDisconnected
    this.state.countdown = SoccerRoom.COUNTDOWN_SECONDS;
    this.state.disconnectionCountdown = 0; // Countdown for disconnection
    this.state.winner = '';

    // Handle player input
    this.onMessage('move', (client, data) => {
      // Verifichiamo che il client.sessionId sia una chiave valida
      if (!this.state.players.has(client.sessionId) || this.state.gameState !== 'playing') {
        return;
      }
      
      const player = this.state.players[client.sessionId];
      
      // Verifichiamo che il player sia un oggetto valido
      if (!player || typeof player !== 'object') {
        return;
      }
      
      // Verifichiamo che data.direction sia un oggetto valido
      if (!data.direction || typeof data.direction !== 'object' ||
          typeof data.direction.x !== 'number' || typeof data.direction.y !== 'number') {
        return;
      }
      
      // Store direction in a local variable since it's not part of the schema
      player._direction = {
        x: data.direction.x,
        y: data.direction.y
      };
      
      // Rimuoviamo il log eccessivo
      // console.log(`Player ${client.sessionId} moved with direction: ${JSON.stringify(player._direction)}`);
    });

    // Set up physics update interval
    this.setSimulationInterval(() => this.update(), SoccerRoom.PHYSICS_UPDATE_RATE);
  }

  onJoin(client) {
    console.log(`Player ${client.sessionId} joined room ${this.roomId}`);
    
    // Utilizziamo this.clients per contare i giocatori connessi
    // Questo include il client corrente
    const connectedClients = this.clients.length;
    console.log(`Connected clients: ${connectedClients}`);
    
    // Se abbiamo già 2 giocatori, rifiutiamo la connessione
    if (connectedClients > 2) {
      console.log(`Room ${this.roomId} is full, rejecting player ${client.sessionId}`);
      throw new Error("Room is full");
    }
    
    // Determiniamo il team in base al numero di giocatori
    // Il primo client è il team rosso, il secondo è il team blu
    const isFirstPlayer = connectedClients === 1;
    const team = isFirstPlayer ? 'red' : 'blue';
    
    // Posizione iniziale del giocatore
    const startX = isFirstPlayer ? SoccerRoom.FIELD_WIDTH * 0.25 : SoccerRoom.FIELD_WIDTH * 0.75;
    const startY = SoccerRoom.FIELD_HEIGHT / 2;
    
    console.log(`Assigning player ${client.sessionId} to team ${team}`);
    
    // Creiamo un nuovo giocatore
    const player = new Player();
    player.x = startX;
    player.y = startY;
    player.team = team;
    player.velocityX = 0;
    player.velocityY = 0;
    
    // Aggiungiamo il giocatore allo stato
    this.state.players[client.sessionId] = player;
    
    console.log(`Player ${client.sessionId} joined as ${team} team (player count: ${connectedClients})`);
    
    // Se abbiamo 2 giocatori, iniziamo il countdown
    if (connectedClients === 2) {
      console.log(`Room ${this.roomId} has 2 players, starting countdown`);
      this.state.gameState = 'countdown';
      this.startCountdown();
      
      // Blocchiamo la stanza per impedire ad altri giocatori di unirsi
      this.lock();
    }
  }

  onLeave(client) {
    console.log(`Player ${client.sessionId} left room ${this.roomId}`);
    
    // Store the team of the disconnected player for notification
    let disconnectedTeam = '';
    if (this.state.players[client.sessionId]) {
      disconnectedTeam = this.state.players[client.sessionId].team;
    }
    
    // Remove player from the game state
    delete this.state.players[client.sessionId];
    
    // Contiamo i client rimanenti
    const remainingClients = this.clients.length;
    console.log(`Remaining clients in room ${this.roomId}: ${remainingClients}`);
    
    // If we're in the middle of a game or in game over state and a player disconnects
    if ((this.state.gameState === 'playing' || this.state.gameState === 'gameOver' || this.state.gameState === 'finished' || this.state.gameState === 'countdown') && remainingClients > 0) {
      // Set the game state to playerDisconnected
      this.state.gameState = 'playerDisconnected';
      
      // Broadcast a message about the disconnection
      this.broadcast('playerDisconnected', { team: disconnectedTeam });
      
      // Set a 10-second countdown before closing the room
      this.state.disconnectionCountdown = 10;
      
      // Start the disconnection countdown
      this.startDisconnectionCountdown();
      
      return;
    }
    
    // If no players left or not in a game, reset everything
    this.state.gameState = 'waiting';
    this.state.countdown = SoccerRoom.COUNTDOWN_SECONDS;
    
    // Reset ball position
    this.resetBall();
    
    // Reset scores
    this.state.scores.red = 0;
    this.state.scores.blue = 0;
    
    // Set winner to empty
    this.state.winner = '';
    
    // Sblocchiamo la stanza per consentire a nuovi giocatori di unirsi
    this.unlock();
    
    // Allow this room to be disposed if empty
    if (remainingClients === 0) {
      console.log(`Room ${this.roomId} is empty, disconnecting`);
      this.disconnect();
    }
  }

  startCountdown() {
    const countdownInterval = setInterval(() => {
      this.state.countdown--;
      
      if (this.state.countdown <= 0) {
        clearInterval(countdownInterval);
        this.state.gameState = 'playing';
        console.log('Game started!');
        
        // Inizializziamo lastScorer
        this.state.lastScorer = new LastScorer();
        
        // Iniziamo il timer di gioco quando inizia la partita
        this.startGameTimer();
      }
    }, 1000);
  }
  
  startGameTimer() {
    // Impostiamo il tempo rimanente al valore iniziale
    this.state.timeRemaining = SoccerRoom.GAME_DURATION_SECONDS;
    
    // Creiamo un intervallo che decrementa il tempo ogni secondo
    this.gameTimerInterval = setInterval(() => {
      this.state.timeRemaining--;
      
      // Se il tempo è scaduto, terminiamo la partita
      if (this.state.timeRemaining <= 0) {
        clearInterval(this.gameTimerInterval);
        
        // Determiniamo il vincitore in base al punteggio
        if (this.state.scores.red > this.state.scores.blue) {
          this.state.winner = 'red';
        } else if (this.state.scores.blue > this.state.scores.red) {
          this.state.winner = 'blue';
        } else {
          this.state.winner = 'draw'; // Pareggio
        }
        
        // Cambiamo lo stato del gioco
        this.state.gameState = 'gameOver';
        console.log(`Game over! Winner: ${this.state.winner}`);
      }
    }, 1000);
  }
  
  startDisconnectionCountdown() {
    console.log(`Starting disconnection countdown in room ${this.roomId}`);
    
    // Create an interval that decrements the disconnection countdown every second
    this.disconnectionCountdownInterval = setInterval(() => {
      this.state.disconnectionCountdown--;
      
      // If the countdown reaches zero, close the room
      if (this.state.disconnectionCountdown <= 0) {
        clearInterval(this.disconnectionCountdownInterval);
        
        console.log(`Disconnection countdown finished in room ${this.roomId}, closing room`);
        
        // Broadcast a message that the room is closing
        this.broadcast('roomClosing');
        
        // Disconnect all clients and close the room
        this.disconnect();
      }
    }, 1000);
  }

  update() {
    if (this.state.gameState !== 'playing') return;

    // Update player positions based on their direction
    // Usiamo il metodo forEach di MapSchema per iterare solo sui giocatori reali
    this.state.players.forEach((player, sessionId) => {
      const speed = 5;
      
      // Verifichiamo che il player abbia le proprietà necessarie
      if (typeof player.x !== 'number' || typeof player.y !== 'number') {
        console.log(`Invalid player properties at ${sessionId}:`, player);
        return; // continue nel contesto di forEach
      }
      
      // Initialize _direction if it doesn't exist
      if (!player._direction) {
        player._direction = { x: 0, y: 0 };
      }
      
      // Apply movement based on direction
      player.velocityX = player._direction.x * speed;
      player.velocityY = player._direction.y * speed;
      
      // Update position
      player.x += player.velocityX;
      player.y += player.velocityY;
      
      // Keep player within bounds
      player.x = Math.max(SoccerRoom.PLAYER_RADIUS, Math.min(SoccerRoom.FIELD_WIDTH - SoccerRoom.PLAYER_RADIUS, player.x));
      player.y = Math.max(SoccerRoom.PLAYER_RADIUS, Math.min(SoccerRoom.FIELD_HEIGHT - SoccerRoom.PLAYER_RADIUS, player.y));
    });
    
    // Gestione delle collisioni tra giocatori
    this.handlePlayerCollisions();

    // Update ball physics
    this.updateBall();
    
    // Check for goals
    this.checkGoals();
  }

  updateBall() {
    const ball = this.state.ball;
    
    // Verifichiamo che la palla sia un oggetto valido
    if (!ball || typeof ball !== 'object') {
      console.log('Invalid ball object:', ball);
      return;
    }
    
    // Verifichiamo che la palla abbia le proprietà necessarie
    if (typeof ball.x !== 'number' || typeof ball.y !== 'number' ||
        typeof ball.velocityX !== 'number' || typeof ball.velocityY !== 'number') {
      console.log('Ball has invalid properties:', ball);
      return;
    }
    
    const friction = 0.98; // Ball slows down over time
    
    // Apply friction
    ball.velocityX *= friction;
    ball.velocityY *= friction;
    
    // Update ball position
    ball.x += ball.velocityX;
    ball.y += ball.velocityY;
    
    // Ball collision with field boundaries
    if (ball.x - SoccerRoom.BALL_RADIUS < 0 || ball.x + SoccerRoom.BALL_RADIUS > SoccerRoom.FIELD_WIDTH) {
      // Only bounce off top/bottom if not in goal area
      const isInGoalArea = ball.y > (SoccerRoom.FIELD_HEIGHT - SoccerRoom.GOAL_HEIGHT) / 2 && 
                           ball.y < (SoccerRoom.FIELD_HEIGHT + SoccerRoom.GOAL_HEIGHT) / 2;
      
      if (!isInGoalArea) {
        ball.velocityX *= -0.8; // Bounce with some energy loss
        
        // Adjust position to prevent getting stuck in walls
        if (ball.x < SoccerRoom.FIELD_WIDTH / 2) {
          ball.x = SoccerRoom.BALL_RADIUS;
        } else {
          ball.x = SoccerRoom.FIELD_WIDTH - SoccerRoom.BALL_RADIUS;
        }
      }
    }
    
    if (ball.y - SoccerRoom.BALL_RADIUS < 0 || ball.y + SoccerRoom.BALL_RADIUS > SoccerRoom.FIELD_HEIGHT) {
      ball.velocityY *= -0.8; // Bounce with some energy loss
      
      // Adjust position to prevent getting stuck in walls
      if (ball.y < SoccerRoom.FIELD_HEIGHT / 2) {
        ball.y = SoccerRoom.BALL_RADIUS;
      } else {
        ball.y = SoccerRoom.FIELD_HEIGHT - SoccerRoom.BALL_RADIUS;
      }
    }
    
    // Ball collision with players
    // Usiamo il metodo forEach di MapSchema per iterare solo sui giocatori reali
    this.state.players.forEach((player, sessionId) => {
      // Verifichiamo che il player abbia le proprietà necessarie
      if (typeof player.x !== 'number' || typeof player.y !== 'number') {
        return; // continue nel contesto di forEach
      }
      
      // Calculate distance between ball and player
      const dx = ball.x - player.x;
      const dy = ball.y - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Check for collision
      if (distance < SoccerRoom.BALL_RADIUS + SoccerRoom.PLAYER_RADIUS) {
        // Calculate collision angle
        const angle = Math.atan2(dy, dx);
        
        // Calculate new velocities
        const power = 10; // Kick power
        ball.velocityX = Math.cos(angle) * power;
        ball.velocityY = Math.sin(angle) * power;
        
        // Move ball outside of player to prevent multiple collisions
        const newDistance = SoccerRoom.BALL_RADIUS + SoccerRoom.PLAYER_RADIUS;
        ball.x = player.x + Math.cos(angle) * newDistance;
        ball.y = player.y + Math.sin(angle) * newDistance;
        
        // Registriamo l'ultimo giocatore che ha toccato la palla
        if (!ball.lastTouchedBy) {
          ball.lastTouchedBy = {};
        }
        ball.lastTouchedBy = sessionId;
        console.log(`Ball touched by player: ${sessionId}`);
      }
    });
  }

  handlePlayerCollisions() {
    const players = [];
    
    // Convertiamo la MapSchema in un array per facilitare l'iterazione
    this.state.players.forEach((player, sessionId) => {
      // Aggiungiamo l'id del giocatore all'oggetto per identificarlo
      player._id = sessionId;
      players.push(player);
    });
    
    // Controlliamo le collisioni tra ogni coppia di giocatori
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const player1 = players[i];
        const player2 = players[j];
        
        // Calcoliamo la distanza tra i due giocatori
        const dx = player2.x - player1.x;
        const dy = player2.y - player1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Se la distanza è minore della somma dei raggi, abbiamo una collisione
        const minDistance = SoccerRoom.PLAYER_RADIUS * 2;
        
        if (distance < minDistance) {
          // Calcoliamo la normale della collisione
          const nx = dx / distance;
          const ny = dy / distance;
          
          // Calcoliamo la profondità della penetrazione
          const penetrationDepth = minDistance - distance;
          
          // Spostiamo i giocatori per evitare sovrapposizioni
          const moveX = nx * penetrationDepth * 0.5;
          const moveY = ny * penetrationDepth * 0.5;
          
          // Spostiamo i giocatori in direzioni opposte
          player1.x -= moveX;
          player1.y -= moveY;
          player2.x += moveX;
          player2.y += moveY;
          
          // Calcoliamo la velocità relativa lungo la normale
          const vx = player2.velocityX - player1.velocityX;
          const vy = player2.velocityY - player1.velocityY;
          const vDotN = vx * nx + vy * ny;
          
          // Se i giocatori si stanno allontanando, non applichiamo l'impulso
          if (vDotN > 0) continue;
          
          // Coefficiente di restituzione (elasticità della collisione)
          const restitution = 0.5;
          
          // Calcoliamo l'impulso
          const impulse = -(1 + restitution) * vDotN;
          
          // Applichiamo l'impulso ai giocatori
          player1.velocityX -= impulse * nx;
          player1.velocityY -= impulse * ny;
          player2.velocityX += impulse * nx;
          player2.velocityY += impulse * ny;
        }
      }
    }
  }
  
  checkGoals() {
    const ball = this.state.ball;
    
    // Verifichiamo che la palla sia un oggetto valido
    if (!ball || typeof ball !== 'object') {
      return;
    }
    
    // Verifichiamo che la palla abbia le proprietà necessarie
    if (typeof ball.x !== 'number' || typeof ball.y !== 'number') {
      return;
    }
    
    const goalY = (SoccerRoom.FIELD_HEIGHT - SoccerRoom.GOAL_HEIGHT) / 2;
    const goalYMax = goalY + SoccerRoom.GOAL_HEIGHT;
    
    // Check for left goal (goal nella porta sinistra - porta del team RED)
    if (ball.x - SoccerRoom.BALL_RADIUS <= 0 && ball.y >= goalY && ball.y <= goalYMax) {
      // Troviamo l'ultimo giocatore che ha toccato la palla
      const lastTouchPlayerId = this.state.ball.lastTouchedBy || null;
      let scoringTeam = 'blue'; // Il team blu segna nella porta rossa (sinistra)
      
      // Se abbiamo l'ID dell'ultimo giocatore che ha toccato la palla
      if (lastTouchPlayerId) {
        // Troviamo il team del giocatore
        const scoringPlayer = this.state.players.get(lastTouchPlayerId);
        if (scoringPlayer) {
          // Se un giocatore blu ha toccato per ultimo la palla ed è entrata nella porta sinistra (rossa)
          // è un gol normale, quindi il punto va al team blu
          // Se un giocatore rosso ha toccato per ultimo la palla ed è entrata nella porta sinistra (rossa)
          // è un autogol, quindi il punto va comunque al team blu
          scoringTeam = 'blue';
        }
      }
      
      // Aggiorniamo il punteggio - segna sempre il blu nella porta sinistra
      this.state.scores.blue++;
      
      // Determiniamo se è un autogol o un gol normale
      let isOwnGoal = false;
      if (lastTouchPlayerId) {
        const scoringPlayer = this.state.players.get(lastTouchPlayerId);
        if (scoringPlayer && scoringPlayer.team === 'red') {
          isOwnGoal = true;
          console.log(`Goal for blue team! (Own goal by red player: ${lastTouchPlayerId})`);
        } else {
          console.log(`Goal for blue team! Scored by player: ${lastTouchPlayerId}`);
        }
      } else {
        console.log(`Goal for blue team! Scored by unknown player`);
      }
      
      // Registriamo chi ha segnato
      this.state.lastScorer = new LastScorer();
      this.state.lastScorer.team = scoringTeam;
      this.state.lastScorer.playerId = lastTouchPlayerId;
      
      console.log(`Score: Red ${this.state.scores.red} - Blue ${this.state.scores.blue}`);
      
      this.resetBall();
      this.checkWinner();
    }
    
    // Check for right goal (goal nella porta destra - porta del team BLUE)
    if (ball.x + SoccerRoom.BALL_RADIUS >= SoccerRoom.FIELD_WIDTH && ball.y >= goalY && ball.y <= goalYMax) {
      // Troviamo l'ultimo giocatore che ha toccato la palla
      const lastTouchPlayerId = this.state.ball.lastTouchedBy || null;
      let scoringTeam = 'red'; // Il team rosso segna nella porta blu (destra)
      
      // Se abbiamo l'ID dell'ultimo giocatore che ha toccato la palla
      if (lastTouchPlayerId) {
        // Troviamo il team del giocatore
        const scoringPlayer = this.state.players.get(lastTouchPlayerId);
        if (scoringPlayer) {
          // Se un giocatore rosso ha toccato per ultimo la palla ed è entrata nella porta destra (blu)
          // è un gol normale, quindi il punto va al team rosso
          // Se un giocatore blu ha toccato per ultimo la palla ed è entrata nella porta destra (blu)
          // è un autogol, quindi il punto va comunque al team rosso
          scoringTeam = 'red';
        }
      }
      
      // Aggiorniamo il punteggio - segna sempre il rosso nella porta destra
      this.state.scores.red++;
      
      // Determiniamo se è un autogol o un gol normale
      let isOwnGoal = false;
      if (lastTouchPlayerId) {
        const scoringPlayer = this.state.players.get(lastTouchPlayerId);
        if (scoringPlayer && scoringPlayer.team === 'blue') {
          isOwnGoal = true;
          console.log(`Goal for red team! (Own goal by blue player: ${lastTouchPlayerId})`);
        } else {
          console.log(`Goal for red team! Scored by player: ${lastTouchPlayerId}`);
        }
      } else {
        console.log(`Goal for red team! Scored by unknown player`);
      }
      
      // Registriamo chi ha segnato
      this.state.lastScorer = new LastScorer();
      this.state.lastScorer.team = scoringTeam;
      this.state.lastScorer.playerId = lastTouchPlayerId;
      
      console.log(`Score: Red ${this.state.scores.red} - Blue ${this.state.scores.blue}`);
      
      this.resetBall();
      this.checkWinner();
    }
  }

  resetBall() {
    // Reset ball to center with no velocity
    this.state.ball.x = SoccerRoom.FIELD_WIDTH / 2;
    this.state.ball.y = SoccerRoom.FIELD_HEIGHT / 2;
    this.state.ball.velocityX = 0;
    this.state.ball.velocityY = 0;
    
    // Reset player positions after a goal
    this.resetPlayerPositions();
  }
  
  resetPlayerPositions() {
    // Reset all players to their starting positions
    this.state.players.forEach((player, sessionId) => {
      // Determine if this is the first player (red) or second player (blue)
      const isRedTeam = player.team === 'red';
      
      // Set the starting position based on team
      player.x = isRedTeam ? SoccerRoom.FIELD_WIDTH * 0.25 : SoccerRoom.FIELD_WIDTH * 0.75;
      player.y = SoccerRoom.FIELD_HEIGHT / 2;
      
      // Reset velocity
      player.velocityX = 0;
      player.velocityY = 0;
    });
    
    console.log('Reset player positions after goal');
  }

  checkWinner() {
    // Check if any team has reached the max score
    if (this.state.scores.red >= SoccerRoom.MAX_SCORE) {
      this.endGame('red');
    } else if (this.state.scores.blue >= SoccerRoom.MAX_SCORE) {
      this.endGame('blue');
    }
  }

  endGame(winner) {
    this.state.gameState = 'gameOver';
    this.state.winner = winner;
    
    if (winner === 'draw') {
      console.log(`Game over! It's a draw!`);
    } else {
      console.log(`Game over! ${winner} team wins!`);
    }
    
    // Fermiamo il timer di gioco
    if (this.gameTimerInterval) {
      clearInterval(this.gameTimerInterval);
    }
    
    // Reset the game after a delay
    setTimeout(() => {
      this.resetGame();
    }, 5000);
  }

  resetGame() {
    // Reset scores
    this.state.scores.red = 0;
    this.state.scores.blue = 0;
    
    // Reset ball
    this.resetBall();
    
    // Reset player positions
    // Usiamo il metodo forEach di MapSchema per iterare solo sui giocatori reali
    this.state.players.forEach((player, sessionId) => {
      // Verifichiamo che il player sia un oggetto valido
      if (!player || typeof player !== 'object') {
        console.log(`Invalid player at ${sessionId} during reset`);
        return; // continue nel contesto di forEach
      }
      
      // Verifichiamo che il player abbia le proprietà necessarie
      if (typeof player.team !== 'string') {
        console.log(`Player ${sessionId} has invalid team property:`, player.team);
        return;
      }
      
      player.x = player.team === 'red' ? SoccerRoom.FIELD_WIDTH * 0.25 : SoccerRoom.FIELD_WIDTH * 0.75;
      player.y = SoccerRoom.FIELD_HEIGHT / 2;
      player.velocityX = 0;
      player.velocityY = 0;
      
      // Inizializziamo _direction se non esiste
      if (!player._direction) {
        player._direction = { x: 0, y: 0 };
      } else {
        player._direction.x = 0;
        player._direction.y = 0;
      }
    });
    
    // Reset game state
    this.state.gameState = 'countdown';
    this.state.countdown = SoccerRoom.COUNTDOWN_SECONDS;
    this.state.winner = '';
    
    // Start countdown for new game
    this.startCountdown();
  }
}

module.exports = { SoccerRoom };
