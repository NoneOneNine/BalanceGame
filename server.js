const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

// Start server
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

// Load questions from a JSON file
const fetch = require("node-fetch");

async function loadQuestions() {
    const res = await fetch("https://raw.githubusercontent.com/NoneOneNine/BalanceGame/refs/heads/main/questions.json");
    return await res.json();
}

const questions = await loadQuestions();

// Generate a random 4-letter room code
function generateRoomCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

const rooms = {};

// Socket.io event handling
io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Creating a room
    socket.on("createRoom", ({ playerName }) => {
        const newRoomCode = generateRoomCode();
        socket.join(newRoomCode);

        // Room initialization
        rooms[newRoomCode] = {
            hostId: socket.id,
            players: [{ id: socket.id, name: playerName }],
            playersWhoAnswered: [],
            usedQuestions: [],
            started: false,
            currentPlayerId: null,
            currentQuestion: null,
            currentAnswer: null,
            points: {},
            guesses: {}
        };
        console.log(`Room created: ${newRoomCode}`);
        console.log(rooms);

        // Inform creator about their new room
        io.to(socket.id).emit("roomCreated", {
            newRoomCode,
            players: rooms[newRoomCode].players.map(p => p.name)
        });
    });


    // Joining a room
    socket.on("joinRoom", ({ roomCode, playerName }) => {
        if (rooms[roomCode]) {
            rooms[roomCode].players.push({ id: socket.id, name: playerName });
            rooms[roomCode].points[socket.id] = 0;

            socket.join(roomCode);
            console.log(`${playerName} joined room ${roomCode}`);
            console.log("Number of players connected:", rooms[roomCode].players.length);

            // Update the list of players in the room
            const players = rooms[roomCode].players.map(p => p.name);
            io.to(roomCode).emit("roomUpdate", players);

            // Tell this client whether they're the host
            io.to(socket.id).emit("hostAssignment", {
                isHost: socket.id === rooms[roomCode].hostId
            });
        } else {
            socket.emit("errorMessage", "Invalid room code.");
        }
    });

    // Host starting the game
    socket.on("startGame", (roomCode) => {
        if (rooms[roomCode]) {
            if (socket.id === rooms[roomCode].hostId) {     // Check if the host is trying to start the game
                if (rooms[roomCode].players.length > 1) {   // At least 2 players are required to start the game
                    rooms[roomCode].started = true;
                    io.to(roomCode).emit("gameStarted", {roomCode});
                    console.log(`Game in room ${roomCode} started.`);

                    startNewTurn(roomCode);
                } else {
                    socket.emit("errorMessage", "Not enough players to start the game.");
                    console.log("Not enough players to start the game.");
                }
            } else {
                socket.emit("errorMessage", "Only the host can start the game.");
            }
        }
    });

    // Players submitting their answers
    socket.on("submitAnswer", ({ currentPlayerName, roomCode, answer }) => {
        rooms[roomCode].currentAnswer = answer;
        rooms[roomCode].guesses = {};
        console.log(`${currentPlayerName} answered: ${answer}`);

        // Notify other players it's time to guess
        io.to(roomCode).emit("startGuessing", {
            roomCode,
            currentPlayerId: rooms[roomCode].currentPlayerId,
            question: rooms[roomCode].currentQuestion,
        });
    });

    socket.on("submitGuess", ({ roomCode, guess }) => {
        rooms[roomCode].guesses[socket.id] = guess;
        console.log(`Player ${socket.id} guessed: ${guess} in room ${roomCode}`);

        // Check if all non-current players have guessed
        const numNonCurrentPlayers = rooms[roomCode].players.length - 1;
        if (Object.keys(rooms[roomCode].guesses).length === numNonCurrentPlayers) {
            io.to(roomCode).emit("allGuessesSubmitted", roomCode);     // Keep an eye out for what this does (could potentially be rooms[roomCode]
        }
    });

    socket.on("revealResults", (roomCode) => {
        const currentPlayerName = rooms[roomCode].players.find(player => player.id === rooms[roomCode].currentPlayerId)?.name;
        const correctAnswer = rooms[roomCode].currentAnswer;
        const correctAnswerText = rooms[roomCode].currentQuestion["option" + correctAnswer];
        const results = [];

        for (const [playerId, guess] of Object.entries(rooms[roomCode].guesses)) {
            const isCorrect = guess === correctAnswer;
            if (isCorrect) {
                rooms[roomCode].points[playerId] = (rooms[roomCode].points[playerId] || 0) + 1;
            }

            const playerObj = rooms[roomCode].players.find(p => p.id === playerId);
            const playerName = playerObj ? playerObj.name : "Unknown";

            results.push({
                playerId,
                playerName,
                guess,
                isCorrect
            });
        }

        io.to(roomCode).emit("roundResults", { roomCode, currentPlayerName, correctAnswerText, results });

        // Clear for the next round
        rooms[roomCode].guesses = {};
    });

    socket.on("startNextRound", (roomCode) => {
        // If everyone answered once, the game is over
        if (rooms[roomCode].playersWhoAnswered.length >= rooms[roomCode].players.length) {
            console.log("Game over");
            io.to(roomCode).emit("gameOver", {roomCode});
        } else {
            // Call your function to select the next player and send the new turn
            startNewTurn(roomCode);
        }
    });

    socket.on("revealScoreboard", ({roomCode}) => {
        const finalScores = rooms[roomCode].players.map(p => ({
            name: p.name,
            score: rooms[roomCode].points[p.id] || 0
        }));

        // Sort descending by score
        finalScores.sort((a, b) => b.score - a.score);

        const medals = ["🥇", "🥈", "🥉"];
        let scoreToMedal = {};
        let currentMedalIndex = 0;
        let lastScore = null;
        let playersAtCurrentRank = 0;

        for (let i = 0; i < finalScores.length; i++) {
            const player = finalScores[i];

            if (player.score !== lastScore) {
                // Advance medal index by number of players at the previous rank
                currentMedalIndex += playersAtCurrentRank;
                playersAtCurrentRank = 1;

                if (currentMedalIndex < medals.length) {
                    scoreToMedal[player.score] = medals[currentMedalIndex];
                } else {
                    scoreToMedal[player.score] = "";
                }

                lastScore = player.score;
            } else {
                // Same score as last, stay on current medal
                playersAtCurrentRank++;
            }
        }

        const scoreListHtml = finalScores.map(player => {
            const medal = scoreToMedal[player.score];
            return `<li>${medal} ${player.name}: ${player.score}</li>`;
        }).join("");

        io.to(roomCode).emit("scoreBoard", { finalScores: scoreListHtml });
    });

    // Disconnection handler (optional for now)
    // socket.on("disconnect", () => {
    //     // Remove player from room's player list
    //     rooms[roomCode].players = rooms[roomCode].players.filter((p) => p.id !== socket.id);
    //     console.log("A user disconnected:", socket.id);
    //     console.log("Number of players connected:", rooms[roomCode].players.length);
    // });
});

// Function to start a new turn
function startNewTurn(code) {
    // Pick a random player for the turn
    const currentPlayer = getNextAnsweringPlayer(code);

    // Pick a random question
    const question = getRandomQuestion(code);

    // Store current turn state
    rooms[code].currentPlayerId = currentPlayer.id;
    rooms[code].currentQuestion = question;
    rooms[code].currentAnswer = null;

    console.log(`New turn for player ${currentPlayer.name} in room ${code}.`);

    // Broadcast turn info and question
    io.to(code).emit("newTurn", {
        currentPlayerId: currentPlayer.id,
        currentPlayerName: currentPlayer.name,
        question: question,
        codeFromServer: code
    });
}

function getNextAnsweringPlayer(code) {
    const availablePlayers = rooms[code].players.filter(p =>
        !rooms[code].playersWhoAnswered.includes(p.id)
    );

    // If everyone has answered, reset the list
    if (availablePlayers.length === 0) {
        rooms[code].playersWhoAnswered = [];
        return getNextAnsweringPlayer(code);
    }

    // Pick a random player from those who haven't answered yet
    const randomIndex = Math.floor(Math.random() * availablePlayers.length);
    const selectedPlayer = availablePlayers[randomIndex];

    rooms[code].playersWhoAnswered.push(selectedPlayer.id);
    return selectedPlayer;
}

function getRandomQuestion(code) {
    const availableQuestions = questions.filter((_, index) =>
        !rooms[code].usedQuestions.includes(index)
    );

    // If no available questions, reset
    if (availableQuestions.length === 0) {
        rooms[code].usedQuestions = [];
        return getRandomQuestion(code);
    }

    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    const selectedQuestion = availableQuestions[randomIndex];

    // Track the index of the question relative to the primary questions array
    const realIndex = questions.indexOf(selectedQuestion);
    rooms[code].usedQuestions.push(realIndex);

    return selectedQuestion;
}