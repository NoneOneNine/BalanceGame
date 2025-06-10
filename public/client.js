const socket = io();

// UI Elements
const joinScreen = document.getElementById("joinScreen");
const lobbyScreen = document.getElementById("lobbyScreen");
const lobbyRoomCode = document.getElementById("lobbyRoomCode");
const gameScreen = document.getElementById("gameScreen");
const gameRoomCode = document.getElementById("gameRoomCode");
const gameContent = document.getElementById("gameContent");
const playersList = document.getElementById("playersList");
const joinButton = document.getElementById("joinButton");
const startGameButton = document.getElementById("startGameButton");

let roomCode = "";
let playerName = "";
let isHost = false;

// Join button click handler
joinButton.onclick = () => {
    roomCode = document.getElementById("roomCodeInput").value.toUpperCase();
    playerName = document.getElementById("playerNameInput").value;

    if (roomCode && playerName) {
        socket.emit("joinRoom", { roomCode, playerName });
    } else {
        alert("Please enter both a room code and your name.");
    }
};

// Update the lobby's list of players
socket.on("roomUpdate", (players) => {
    if (lobbyScreen.style.display === "none") {
        joinScreen.style.display = "none";
        lobbyScreen.style.display = "block";
        lobbyRoomCode.textContent = roomCode;
    }

    playersList.innerHTML = "<h3>Players:</h3>" +
        players.map(p => `<p>${p}</p>`).join("");
});

// Host assignment event
socket.on("hostAssignment", (data) => {
    isHost = data.isHost;
    startGameButton.disabled = !isHost;

    if (isHost) {
        startGameButton.style.display = "inline-block";
    } else {
        startGameButton.style.display = "none";
    }
});

// Start game button click (host only)
startGameButton.onclick = () => {
    if (isHost) {
        socket.emit("startGame", roomCode);
    }
};

// On game started
socket.on("gameStarted", () => {
    lobbyScreen.style.display = "none";
    gameScreen.style.display = "block";
    gameRoomCode.textContent = roomCode;
    gameContent.innerHTML = `<p>Waiting for the first turn to start...</p>`;
});

socket.on("newTurn", ({currentPlayerId, currentPlayerName, question, codeFromServer}) => {
    roomCode = codeFromServer;

    gameContent.innerHTML = `
        <h2>It's ${currentPlayerName}'s turn!</h2>
        <p>${question.question}</p>
        <button id="optionAButton">${question.optionA}</button>
        <button id="optionBButton">${question.optionB}</button>
    `;

    // Disable buttons if it's not your turn
    if (socket.id !== currentPlayerId) {
        document.getElementById("optionAButton").disabled = true;
        document.getElementById("optionBButton").disabled = true;
    } else {
        // If it's your turn, you can pick your answer
        document.getElementById("optionAButton").onclick = () => {
            socket.emit("submitAnswer", { currentPlayerName, roomCode, answer: "A" });
        };
        document.getElementById("optionBButton").onclick = () => {
            socket.emit("submitAnswer", { currentPlayerName, roomCode, answer: "B" });
        };
    }
});

// When it's time for everyone else to guess
socket.on("startGuessing", ({ currentPlayerId, question }) => {
    // Only show this for players who aren't the answering player
    if (socket.id !== currentPlayerId) {
        gameContent.innerHTML = `
            <h2>Guess ${question.question}</h2>
            <button id="guessAButton">Guess: ${question.optionA}</button>
            <button id="guessBButton">Guess: ${question.optionB}</button>
        `;

        // Implement guess button click handlers here later.
        document.getElementById("guessAButton").onclick = () => {
            socket.emit("submitGuess", { guess: 'A' });

        };
        document.getElementById("guessBButton").onclick = () => {
            socket.emit("submitGuess", { guess: 'B' });
        };
    } else {
        gameContent.innerHTML = `<p>Waiting for others to guess your answer...</p>`;
    }
});

socket.on("allGuessesSubmitted", () => {
    if (isHost) {
        gameContent.innerHTML = `
            <h2>All players have made their guesses!</h2>
            <button id="revealButton">Reveal Results</button>
        `;

        document.getElementById("revealButton").onclick = () => {
            socket.emit("revealResults");
        };
    } else {
        gameContent.innerHTML = `<h2>All guesses are in! Waiting for the host to reveal results...</h2>`;
    }
});

socket.on("roundResults", ({ correctAnswer, results }) => {
    let resultHtml = `<h2>Correct Answer: ${correctAnswer}</h2><h3>Results:</h3>`;

    results.forEach(r => {
        resultHtml += `<p>${r.playerName} guessed ${r.guess} — ${r.isCorrect ? '✅' : '❌'}</p>`;
    });

    if (isHost) {
        resultHtml += `<button id="nextRoundButton">Next</button>`;
        gameContent.innerHTML = resultHtml;

        document.getElementById("nextRoundButton").onclick = () => {
            socket.emit("startNextRound");
        };
    } else {
        gameContent.innerHTML = resultHtml;
    }
});

// Error messages
socket.on("errorMessage", (msg) => {
    alert(msg);
});

// Animate the waiting dots
let dotCount = 1;
setInterval(() => {
    const dots = document.getElementById("dots");
    if (dots) {
        dotCount = (dotCount % 3) + 1;
        dots.textContent = ".".repeat(dotCount);
    }
}, 500);
