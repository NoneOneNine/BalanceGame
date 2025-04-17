const socket = io();

const createRoomBtn = document.getElementById("createRoom");
const joinRoomBtn = document.getElementById("joinRoom");
const startGameBtn = document.getElementById("startGame");
const nextTurnBtn = document.getElementById("nextTurn");

const hostCodeDisplay = document.getElementById("hostCode");
const hostControls = document.getElementById("hostControls");
const roomInfoDisplay = document.getElementById("roomInfo");
const gameArea = document.getElementById("gameArea");

createRoomBtn.onclick = () => {
    socket.emit("createRoom");
};

joinRoomBtn.onclick = () => {
    const code = document.getElementById("roomCode").value.toUpperCase();
    const name = document.getElementById("playerName").value;
    socket.emit("joinRoom", { code, name });
};

startGameBtn.onclick = () => {
    socket.emit("startGame");
};

nextTurnBtn.onclick = () => {
    gameArea.innerHTML = "";
    socket.emit("nextTurn");
};

socket.on("roomCreated", ({ code }) => {
    hostCodeDisplay.innerText = `Room Code: ${code}`;
    hostControls.style.display = "block";
});

socket.on("roomJoined", ({ code, players }) => {
    roomInfoDisplay.innerHTML = `<strong>Room ${code}</strong><br>Players:<br>` +
        players.map(p => `• ${p}`).join("<br>");
});

socket.on("gameStarted", () => {
    roomInfoDisplay.innerHTML += "<br><strong>The game has started!</strong>";
    nextTurnBtn.style.display = "inline-block";
});

socket.on("turnChanged", ({ currentPlayer }) => {
    const name = document.getElementById("playerName").value;
    gameArea.innerHTML = `<p><em>${currentPlayer}'s turn</em></p>`;

    if (name === currentPlayer) {
        gameArea.innerHTML += `<p><strong>It's YOUR turn! Please wait for a question...</strong></p>`;
    }
});

socket.on("yourTurn", ({ question }) => {
    gameArea.innerHTML = `
    <h3>Would You Rather...</h3>
    <button onclick="submitAnswer('A')">A) ${question.a}</button><br><br>
    <button onclick="submitAnswer('B')">B) ${question.b}</button>
  `;
});

function submitAnswer(choice) {
    socket.emit("submitAnswer", { choice });
    gameArea.innerHTML = `<p>Waiting for others to guess...</p>`;
}

socket.on("startGuessing", ({ question }) => {
    const name = document.getElementById("playerName").value;
    gameArea.innerHTML = `
    <h3>Guess the player's answer:</h3>
    <button onclick="submitGuess('A')">A) ${question.a}</button><br><br>
    <button onclick="submitGuess('B')">B) ${question.b}</button>
  `;
});

function submitGuess(guess) {
    const name = document.getElementById("playerName").value;
    socket.emit("submitGuess", { guess, name });
    gameArea.innerHTML = `<p>Guess submitted. Waiting for others...</p>`;
}

socket.on("revealAnswer", ({ answer, correctPlayers }) => {
    gameArea.innerHTML = `
    <h3>Answer was: ${answer}</h3>
    <p>Correct guesses:</p>
    <ul>${correctPlayers.map(p => `<li>${p}</li>`).join("")}</ul>
    <p><em>Next round will begin shortly...</em></p>
  `;
});

socket.on("gameEnded", ({ totalRounds }) => {
    gameArea.innerHTML = `
    <h2>🎉 Game Over!</h2>
    <p>All ${totalRounds} rounds are complete.</p>
    <p>Thanks for playing!</p>
  `;
});

socket.on("errorMessage", (msg) => {
    alert(msg);
});
