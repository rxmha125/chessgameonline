const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");

const server = http.createServer(app);
const io = socket(server);

const chess = new Chess();
let players = {};

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.render("index", { title: "Rx Chess Game" });
});

io.on("connection", (uniquesocket) => {
    console.log("New connection:", uniquesocket.id);

    // Assign roles and notify players
    if (!players.white) {
        players.white = uniquesocket.id;
        uniquesocket.emit("playerRole", "w");

        if (players.black) {
            io.to(players.black).emit("gameStart", { turn: "w" }); // Notify black player
            uniquesocket.emit("gameStart", { turn: "w" }); // Notify white player
        } else {
            uniquesocket.emit("waitingForPlayer");
        }
    } else if (!players.black) {
        players.black = uniquesocket.id;
        uniquesocket.emit("playerRole", "b");
        io.to(players.white).emit("gameStart", { turn: "w" }); // Notify white player
        uniquesocket.emit("gameStart", { turn: "w" }); // Notify black player
    } else {
        uniquesocket.emit("spectatorRole");
    }

    // Handle disconnects
    uniquesocket.on("disconnect", () => {
        console.log("Disconnect:", uniquesocket.id);
        if (uniquesocket.id === players.white) {
            delete players.white;
            if (players.black) {
                io.to(players.black).emit("waitingForPlayer");
            }
        } else if (uniquesocket.id === players.black) {
            delete players.black;
            if (players.white) {
                io.to(players.white).emit("waitingForPlayer");
            }
        }
    });

    // Handle moves
    uniquesocket.on("move", (move) => {
        try {
            const isWhiteTurn = chess.turn() === "w";
            if ((isWhiteTurn && uniquesocket.id !== players.white) ||
                (!isWhiteTurn && uniquesocket.id !== players.black)) {
                console.warn("Invalid player attempted a move:", move);
                uniquesocket.emit("InvalidMove", move);
                return;
            }

            const result = chess.move(move);
            if (result) {
                const nextTurn = chess.turn(); // Determine next player's turn
                io.emit("move", move); // Broadcast the move
                io.emit("boardState", chess.fen()); // Update board state
                io.to(nextTurn === "w" ? players.white : players.black).emit("yourTurn"); // Notify next player
                io.to(nextTurn === "b" ? players.white : players.black).emit("opponentTurn"); // Notify opponent
            } else {
                console.warn("Invalid move:", move);
                uniquesocket.emit("InvalidMove", move);
            }
        } catch (err) {
            console.error("Error processing move:", err);
            uniquesocket.emit("InvalidMove", move);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
