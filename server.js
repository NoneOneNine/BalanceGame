const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Skip middleware
app.use((req, res, next) => {
    res.setHeader("ngrok-skip-browser-warning", "true");
    next();
});

app.use(express.static("public"));

const PORT =  process.env.PORT || 3000;

// Start server
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

const questions = [
    { question: "Would you rather live without music OR without movies?", optionA: "Without music", optionB: "Without movies" },
    { question: "Would you rather be perfectly fine without eating OR perfectly fine without sleeping?", optionA: "No need for food", optionB: "No need for sleep" },
    { question: "Would you rather lose the ability to speak OR lose the ability to hear?", optionA: "No speaking", optionB: "No hearing" },
    { question: "Would you rather be the best singer in the world OR the best dancer in the world?", optionA: "Best singer", optionB: "Best dancer" },
    { question: "Would you rather take amazing selfies but look terrible in all other photos OR be photogenic everywhere except your selfies?", optionA: "Amazing selfies", optionB: "Photogenic everywhere else" },
    { question: "Would you rather win $10,000 OR your friend wins $100,000?", optionA: "Win 10K", optionB: "Friend wins 100K" },
    { question: "Would you rather be the funniest person in the room OR the smartest person in the room?", optionA: "Funniest", optionB: "Smartest" },
    { question: "Would you rather your church know all your text messages OR see your entire photo gallery?", optionA: "Messages", optionB: "Photos" },
    { question: "Would you rather never interact with people in-person OR electronically/online?", optionA: "In-person", optionB: "Electronically/online" },
    { question: "Would you rather have more money OR have more time?", optionA: "Money", optionB: "Time" },
    { question: "Would you rather be a master of all instruments OR a master of all sports?", optionA: "All instruments", optionB: "All sports" },
    { question: "Would you rather have a personal maid OR a personal chef?", optionA: "Personal maid", optionB: "Personal chef" },
    { question: "Would you rather get punished for a crime you did not commit OR someone else get credit for one of your major accomplishments?", optionA: "Punishment", optionB: "No credit" },
    { question: "Would you rather see a year into the future OR change a past life event? (both only once)", optionA: "See the future", optionB: "Change the past" },
    { question: "Would you rather spend the next 6 months: meeting people non-stop OR meet nobody?", optionA: "Meet people non-stop", optionB: "Meet nobody" },
    { question: "Would you rather have your dream job OR your dream house?", optionA: "Dream job", optionB: "Dream house" },
    { question: "(Think of your favourite food) Would you rather be required to eat it for every meal OR never eat it again?", optionA: "Every meal", optionB: "Never again" },
];

// Generate a random 4-letter room code
function generateRoomCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Room generation
const roomCode = generateRoomCode();
console.log(`Room created: ${roomCode}`);
room = {
    code: roomCode,
    players: [],
    hostId: null,
    playersWhoAnswered: [],
    usedQuestions: [],
    started: false,
    currentPlayerId: null,
    currentQuestion: null,
    currentAnswer: null,
    points: {},
    guesses: {}
};

// Socket.io event handling
io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Joining a room
    socket.on("joinRoom", ({ roomCode, playerName }) => {
        if (room.code === roomCode) {
            room.players.push({ id: socket.id, name: playerName });
            room.points[socket.id] = 0;

            socket.join(roomCode);
            console.log(`${playerName} joined room ${roomCode}`);
            console.log("Number of players connected:", room.players.length);

            // If this is the first player, assign them as host
            if (room.players.length === 1) {
                room.hostId = socket.id;
            }

            // Update the list of players in the room
            const players = room.players.map(p => p.name);
            io.to(roomCode).emit("roomUpdate", players);

            // Tell this client whether they're the host
            io.to(socket.id).emit("hostAssignment", {   // Hopefully this doesn't result in an error
                isHost: socket.id === room.hostId
            });
        } else {
            socket.emit("errorMessage", "Invalid room code.");
        }
    });

    // Host starting the game
    socket.on("startGame", (roomCode) => {
        if (room) {
            if (socket.id === room.hostId) {
                room.started = true;
                io.to(roomCode).emit("gameStarted");
                console.log(`Game in room ${roomCode} started.`);

                startNewTurn(roomCode);
            } else {
                socket.emit("errorMessage", "Only the host can start the game.");
            }
        }
    });

    // Player submitting their answer
    socket.on("submitAnswer", ({ currentPlayerName, roomCode, answer }) => {
        room.currentAnswer = answer;
        room.guesses= {};
        console.log(`${currentPlayerName} answered: ${answer}`);

        // Notify other players it's time to guess
        io.to(roomCode).emit("startGuessing", {
            currentPlayerId: room.currentPlayerId,
            question: room.currentQuestion,
        });
    });

    socket.on("submitGuess", ({ guess }) => {
        room.guesses[socket.id] = guess;
        console.log(`Player ${socket.id} guessed: ${guess} in room ${room.code}`);

        // Check if all non-current players have guessed
        const numNonCurrentPlayers = room.players.length - 1;
        if (Object.keys(room.guesses).length === numNonCurrentPlayers) {
            io.to(room.code).emit("allGuessesSubmitted");
        }
    });

    socket.on("revealResults", () => {
        const currentPlayerName = room.players.find(player => player.id === room.currentPlayerId)?.name;
        const correctAnswer = room.currentAnswer;
        const correctAnswerText = room.currentQuestion["option" + correctAnswer];
        const results = [];

        for (const [playerId, guess] of Object.entries(room.guesses)) {
            const isCorrect = guess === correctAnswer;
            if (isCorrect) {
                room.points[playerId] = (room.points[playerId] || 0) + 1;
            }

            const playerObj = room.players.find(p => p.id === playerId);
            const playerName = playerObj ? playerObj.name : "Unknown";

            results.push({
                playerId,
                playerName,
                guess,
                isCorrect
            });
        }

        io.to(room.code).emit("roundResults", { currentPlayerName, correctAnswerText, results });

        // Clear for the next round
        room.guesses = {};
    });

    socket.on("startNextRound", () => {
        // If everyone answered once, the game is over
        if (room.playersWhoAnswered.length >= room.players.length) {
            console.log("Game over");
            io.to(room.code).emit("gameOver", {});
        } else {
            // Call your function to select the next player and send the new turn
            startNewTurn(room.code);
        }
    });

    socket.on("revealScoreboard", ({}) => {
        const finalScores = room.players.map(p => ({
            name: p.name,
            score: room.points[p.id] || 0
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

        io.to(room.code).emit("scoreBoard", { finalScores: scoreListHtml });
    });

    // Disconnection handler (optional for now)
    socket.on("disconnect", () => {
        // Remove player from room's player list
        room.players = room.players.filter((p) => p.id !== socket.id);
        console.log("A user disconnected:", socket.id);
        console.log("Number of players connected:", room.players.length);

        // // Broadcast updated player list to the room
        // io.to(roomCode).emit("updatePlayers", room.players);
    });
});

// Function to start a new turn
function startNewTurn(code) {
    // Pick a random player for the turn
    const currentPlayer = getNextAnsweringPlayer();

    // Pick a random question
    const question = getRandomQuestion();

    // Store current turn state
    room.currentPlayerId = currentPlayer.id;
    room.currentQuestion = question;
    room.currentAnswer = null;

    console.log(`New turn for player ${currentPlayer.name} in room ${code}.`);

    // Broadcast turn info and question
    io.to(code).emit("newTurn", {
        currentPlayerId: currentPlayer.id,
        currentPlayerName: currentPlayer.name,
        question: question,
        codeFromServer: code
    });
}

function getNextAnsweringPlayer() {
    const availablePlayers = room.players.filter(p =>
        !room.playersWhoAnswered.includes(p.id)
    );

    // If everyone has answered, reset the list
    if (availablePlayers.length === 0) {
        room.playersWhoAnswered = [];
        return getNextAnsweringPlayer();
    }

    // Pick a random player from those who haven't answered yet
    const randomIndex = Math.floor(Math.random() * availablePlayers.length);
    const selectedPlayer = availablePlayers[randomIndex];

    room.playersWhoAnswered.push(selectedPlayer.id);
    return selectedPlayer;
}

function getRandomQuestion() {
    const availableQuestions = questions.filter((_, index) =>
        !room.usedQuestions.includes(index)
    );

    // If no available questions, reset
    if (availableQuestions.length === 0) {
        room.usedQuestions = [];
        return getRandomQuestion();
    }

    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    const selectedQuestion = availableQuestions[randomIndex];

    // Track the index of the question relative to the primary questions array
    const realIndex = questions.indexOf(selectedQuestion);
    room.usedQuestions.push(realIndex);

    return selectedQuestion;
}