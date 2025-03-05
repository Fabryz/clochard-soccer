# Clochard Soccer - Requisiti

## Panoramica
Ricreare Hobosoccer come applicazione web multiplayer. Il gioco è un simulatore di calcio 2D visto dall'alto dove due giocatori controllano ciascuno un personaggio cercando di segnare nella porta avversaria.

## Tecnologie
- HTML
- CSS (Tailwind)
- JavaScript
- Node.js
- Colyseus (per il multiplayer)

## Requisiti Funzionali

### Lobby
- [  ] Creare una lobby dove i giocatori possono connettersi
- [  ] Limitare a massimo 2 giocatori per partita
- [  ] Mostrare un countdown di 5 secondi prima dell'inizio della partita quando 2 giocatori sono connessi

### Gameplay
- [  ] Campo da calcio 2D visto dall'alto
- [  ] Ogni giocatore controlla un personaggio
- [  ] Il giocatore corrente è sempre visualizzato a sinistra del campo
- [  ] L'avversario è visualizzato a destra del campo
- [  ] Punteggio iniziale 0-0
- [  ] La partita termina quando un giocatore segna 3 gol
- [  ] Controlli WASD per muovere il personaggio
- [  ] La palla deve avere fisica con inerzia
- [  ] Implementare server authority per la gestione del gioco
- [  ] Implementare client prediction se possibile

### UI/UX
- [  ] Mostrare il punteggio corrente
- [  ] Visualizzare i nomi dei giocatori
- [  ] Mostrare una schermata finale quando un giocatore vince

### Tecnici
- [  ] Struttura client-server
- [  ] Sincronizzazione in tempo reale
- [  ] Gestione delle disconnessioni
- [  ] Ottimizzazione delle performance
