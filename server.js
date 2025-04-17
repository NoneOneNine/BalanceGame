const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { randomUUID } = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT} http://localhost:${PORT}`));

const rooms = {};
const TOTAL_ROUNDS = 2;

const questions = [
    { a: "be able to fly", b: "be invisible" },
    { a: "have no internet", b: "have no AC/heating" },
    { a: "live in space", b: "live under the sea" },
    { a: "have super strength", b: "have super speed" },
    { a: "eat only pizza", b: "eat only ice cream" },
];

function generateRoomCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("createRoom", () => {
        let code;
        do {
            code = generateRoomCode();
        } while (rooms[code]);

        rooms[code] = {
            players: [],
            host: socket.id,
            turnIndex: 0,
            currentRound: 1,
            currentQuestion: null,
            currentAnswer: null,
            guesses: {},
        };

        socket.join(code);
        socket.emit("roomCreated", { code });
    });

    socket.on("joinRoom", ({ code, name }) => {
        const room = rooms[code];
        if (!room) {
            socket.emit("errorMessage", "Room does not exist.");
            return;
        }

        room.players.push(name);
        socket.join(code);
        socket.emit("roomJoined", { code, players: room.players });
        io.to(code).emit("roomJoined", { code, players: room.players });
    });

    socket.on("startGame", () => {
        const roomCode = Array.from(socket.rooms).find((r) => r !== socket.id);
        const room = rooms[roomCode];
        if (!room) {
            socket.emit("errorMessage", "You're not hosting a room.");
            return;
        }

        room.turnIndex = 0;
        room.currentRound = 1;
        room.guesses = {};
        room.currentAnswer = null;

        const currentPlayer = room.players[room.turnIndex];
        const question = questions[Math.floor(Math.random() * questions.length)];

        room.currentQuestion = question;

        io.to(roomCode).emit("gameStarted");
        io.to(roomCode).emit("turnChanged", { currentPlayer });
        io.to(socket.id).emit("yourTurn", { question });
    });

    socket.on("submitAnswer", ({ choice }) => {
        const roomCode = Array.from(socket.rooms).find(r => r !== socket.id);
        const room = rooms[roomCode];
        if (!room) return;

        room.currentAnswer = choice;
        io.to(roomCode).emit("startGuessing", { question: room.currentQuestion });
    });

    socket.on("submitGuess", ({ guess, name }) => {
        const roomCode = Array.from(socket.rooms).find(r => r !== socket.id);
        const room = rooms[roomCode];
        if (!room) return;

        room.guesses[name] = guess;

        if (Object.keys(room.guesses).length === room.players.length - 1) {
            const correctPlayers = Object.entries(room.guesses)
                .filter(([_, g]) => g === room.currentAnswer)
                .map(([name]) => name);

            io.to(roomCode).emit("revealAnswer", {
                answer: room.currentAnswer,
                correctPlayers,
            });

            setTimeout(() => {
                advanceTurn(roomCode);
            }, 5000);
        }
    });

    function advanceTurn(roomCode) {
        const room = rooms[roomCode];
        if (!room) return;

        room.turnIndex += 1;

        if (room.turnIndex >= room.players.length) {
            room.turnIndex = 0;
            room.currentRound += 1;
        }

        if (room.currentRound > TOTAL_ROUNDS) {
            io.to(roomCode).emit("gameEnded", {
                totalRounds: TOTAL_ROUNDS,
            });
            return;
        }

        room.guesses = {};
        room.currentAnswer = null;

        const currentPlayer = room.players[room.turnIndex];
        const question = questions[Math.floor(Math.random() * questions.length)];
        room.currentQuestion = question;

        io.to(roomCode).emit("turnChanged", { currentPlayer });
        io.to(roomCode).emit("yourTurn", { question });
    }
});
