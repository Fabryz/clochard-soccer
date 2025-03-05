# Clochard Soccer

Un gioco di calcio 2D multiplayer ispirato a Hobosoccer, sviluppato con HTML, CSS (Tailwind), JavaScript, Node.js e Colyseus.

## Caratteristiche

- Lobby per la connessione di 2 giocatori
- Countdown di 5 secondi prima dell'inizio della partita
- Campo da calcio 2D visto dall'alto
- Controlli WASD per muovere il personaggio
- Fisica della palla con inerzia
- Server authority per la gestione del gioco
- Client prediction
- Schermata finale quando un giocatore vince

## Requisiti

- Node.js (v14 o superiore)
- npm

## Installazione

1. Clona il repository:
```
git clone https://github.com/fabryz/clochard-soccer.git
cd clochard-soccer
```

2. Installa le dipendenze:
```
npm install
```

3. Avvia il server:
```
npm start
```

4. Apri il browser e vai a:
```
http://localhost:3030
```

## Deployment su Heroku

Per deployare l'applicazione su Heroku:

1. Crea un account su [Heroku](https://heroku.com) se non ne hai già uno
2. Installa Heroku CLI: `npm install -g heroku`
3. Esegui il login: `heroku login`
4. Crea una nuova app Heroku: `heroku create nome-app`
5. Pusha il codice su Heroku: `git push heroku master`
6. Apri l'app: `heroku open`

Nota: Heroku supporta WebSocket, quindi il gioco multiplayer funzionerà correttamente.

5. Per giocare in multiplayer, apri un'altra finestra del browser e vai allo stesso indirizzo.

## Come giocare

- Usa i tasti WASD per muovere il tuo personaggio
- Spingi la palla nella porta avversaria
- Segna 3 gol per vincere la partita

## Struttura del progetto

- `index.js`: Server principale che utilizza Express e Colyseus
- `server/rooms/SoccerRoom.js`: Logica del server per la gestione delle stanze di gioco
- `public/index.html`: Interfaccia utente HTML
- `public/css/style.css`: Stili CSS
- `public/js/game.js`: Logica del client per il rendering e l'input

## Tecnologie utilizzate

- HTML5
- CSS3 (Tailwind CSS)
- JavaScript
- Node.js
- Express
- Colyseus (framework per giochi multiplayer)

## Licenza

MIT
