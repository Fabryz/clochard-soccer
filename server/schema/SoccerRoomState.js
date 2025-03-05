const schema = require('@colyseus/schema');
const Schema = schema.Schema;
const MapSchema = schema.MapSchema;
const ArraySchema = schema.ArraySchema;

class Player extends Schema {
  constructor() {
    super();
    this.x = 0;
    this.y = 0;
    this.team = '';
    this.direction = { x: 0, y: 0 };
    this.velocityX = 0;
    this.velocityY = 0;
  }
}

schema.defineTypes(Player, {
  x: 'number',
  y: 'number',
  team: 'string',
  velocityX: 'number',
  velocityY: 'number',
  // Non possiamo usare oggetti complessi direttamente nello schema
  // Useremo velocityX e velocityY per il movimento
});

class Ball extends Schema {
  constructor() {
    super();
    this.x = 0;
    this.y = 0;
    this.velocityX = 0;
    this.velocityY = 0;
  }
}

schema.defineTypes(Ball, {
  x: 'number',
  y: 'number',
  velocityX: 'number',
  velocityY: 'number'
});

class Scores extends Schema {
  constructor() {
    super();
    this.red = 0;
    this.blue = 0;
  }
}

schema.defineTypes(Scores, {
  red: 'number',
  blue: 'number'
});

class SoccerRoomState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.ball = new Ball();
    this.scores = new Scores();
    this.gameState = 'waiting';
    this.countdown = 5;
    this.winner = '';
    this.timeRemaining = 180; // 3 minuti in secondi
  }
}

schema.defineTypes(SoccerRoomState, {
  players: { map: Player },
  ball: Ball,
  scores: Scores,
  gameState: 'string',
  countdown: 'number',
  winner: 'string',
  timeRemaining: 'number'
});

module.exports = {
  SoccerRoomState,
  Player,
  Ball,
  Scores
};
