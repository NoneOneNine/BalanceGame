const socket = io();

// UI Elements
const startScreen = document.getElementById("startScreen");
const joinScreen = document.getElementById("joinScreen");
const lobbyScreen = document.getElementById("lobbyScreen");
const lobbyRoomCode = document.getElementById("lobbyRoomCode");
const gameScreen = document.getElementById("gameScreen");
const gameRoomCode = document.getElementById("gameRoomCode");
const gameContent = document.getElementById("gameContent");
const endScreen = document.getElementById("endScreen");
const endContent = document.getElementById("endContent");
const playersList = document.getElementById("playersList");
const createButton = document.getElementById("createButton");
const joinRoom = document.getElementById("joinRoom");
const joinButton = document.getElementById("joinButton");
const startGameButton = document.getElementById("startGameButton");

let roomCode = "";
let playerName = "";
let isHost = false;
let hasGuessed = false;

// When "Create Room" is clicked
createButton.onclick = () => {
    playerName = document.getElementById("playerNameInput").value;

    if (playerName) {
        socket.emit("createRoom", { playerName });
    } else {
        alert("Please enter your name first.");
    }
};

joinRoom.onclick = () => {
    startScreen.style.display = "none";
    joinScreen.style.display = "block";
};

// Join button click handler
joinButton.onclick = () => {
    roomCode = document.getElementById("roomCodeInput").value.toUpperCase();
    playerName = document.getElementById("getPlayer").value;

    if (roomCode && playerName) {
        socket.emit("joinRoom", { roomCode, playerName });
    } else {
        alert("Please enter both a room code and your name.");
    }
};

// When the server confirms the new room
socket.on("roomCreated", ({ newRoomCode, players }) => {
    isHost = true;
    roomCode = newRoomCode;

    startScreen.style.display = "none";
    lobbyScreen.style.display = "block";
    lobbyRoomCode.textContent = roomCode;

    playersList.innerHTML = "<h3>Players:</h3>" +
        players.map(p => `<p>${p}</p>`).join("");

    startGameButton.style.display = "inline-block";
    startGameButton.disabled = false;
});

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
socket.on("startGuessing", ({ roomCode, currentPlayerId, question }) => {
    hasGuessed = false;  // Reset the flag for this new round

    // Only show this for players who aren't the answering player
    if (socket.id !== currentPlayerId) {
        gameContent.innerHTML = `
            <h2>What was the correct answer?</h2>
            <h2>${question.question}</h2>
            <button id="guessAButton">Guess: ${question.optionA}</button>
            <button id="guessBButton">Guess: ${question.optionB}</button>
        `;

        const disableGuessButtons = () => {
            document.getElementById("guessAButton").disabled = true;
            document.getElementById("guessBButton").disabled = true;
        };

        // Implement guess button click handlers here later.
        document.getElementById("guessAButton").onclick = () => {
            if (!hasGuessed) {
                hasGuessed = true;
                socket.emit("submitGuess", { roomCode, guess: 'A' });
                disableGuessButtons();
            }
        };
        document.getElementById("guessBButton").onclick = () => {
            if (!hasGuessed) {
                hasGuessed = true;
                socket.emit("submitGuess", { roomCode, guess: 'B' });
                disableGuessButtons();
            }
        };
    } else {
        gameContent.innerHTML = `<p>Waiting for others to guess your answer...</p>`;
    }
});

socket.on("allGuessesSubmitted", (roomCode) => {
    if (isHost) {
        gameContent.innerHTML = `
            <h2>All players have made their guesses!</h2>
            <button id="revealButton">Reveal Results</button>
        `;

        document.getElementById("revealButton").onclick = () => {
            socket.emit("revealResults", roomCode);
        };
    } else {
        gameContent.innerHTML = `<h2>All guesses are in! Waiting for the host to reveal results...</h2>`;
    }
});

socket.on("roundResults", ({ roomCode, currentPlayerName, correctAnswerText, results }) => {
    let resultHtml = `<h2>${currentPlayerName} said: ${correctAnswerText}</h2><h3>Results:</h3>`;

    results.forEach(r => {
        resultHtml += `<p>${r.playerName} — ${r.isCorrect ? '✅' : '❌'}</p>`;
    });

    if (isHost) {
        resultHtml += `<button id="nextRoundButton">Next</button>`;
        gameContent.innerHTML = resultHtml;

        document.getElementById("nextRoundButton").onclick = () => {
            socket.emit("startNextRound", roomCode);
        };
    } else {
        gameContent.innerHTML = resultHtml;
    }
});

// Announce game over once the game is done
socket.on("gameOver", ({roomCode}) => {
    gameScreen.style.display = "none";
    endScreen.style.display = "block";

    if (isHost) {
        endContent.innerHTML = `
            <h2>Time to reveal the winner!</h2>
            <button id="showFinalScore">Results</button>
        `;
    } else {
        endContent.innerHTML = `
            <h2>Time to reveal the winner!</h2>
        `;
    }

    document.getElementById("showFinalScore").onclick = () => {
        socket.emit("revealScoreboard", {roomCode});
    };
});

// Display scoreboard
socket.on("scoreBoard", ({ finalScores }) => {
    endContent.innerHTML = `
        <h2>🏆 Final Results 🏆</h2>
        <ul>
          ${finalScores}
        </ul>
        <button onclick="window.location.reload()">Play Again</button>
    `;
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

// Prevents players from swipe refresh on mobile
let touchStartY = 0;

window.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) return;
    touchStartY = e.touches[0].clientY;
});

window.addEventListener("touchmove", function (e) {
    const touchY = e.touches[0].clientY;
    const touchDeltaY = touchY - touchStartY;

    if (window.scrollY === 0 && touchDeltaY > 0) {
        e.preventDefault();  // Prevent swipe down refresh
    }
}, { passive: false });
