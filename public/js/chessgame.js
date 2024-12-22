const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");
const turnIndicator = document.getElementById("turn-indicator");

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;

// Render the chessboard
const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = "";
    board.forEach((row, rowIndex) => {
        row.forEach((square, squareIndex) => {
            const squareElement = document.createElement("div");
            squareElement.classList.add(
                "square",
                (rowIndex + squareIndex) % 2 === 0 ? "light" : "dark"
            );

            squareElement.dataset.row = rowIndex;
            squareElement.dataset.col = squareIndex;

            if (square) {
                const pieceElement = document.createElement("div");
                pieceElement.classList.add(
                    "piece",
                    square.color === "w" ? "white" : "black"
                );
                pieceElement.innerText = getPieceUnicode(square);
                pieceElement.draggable = playerRole === square.color;

                pieceElement.addEventListener("dragstart", (e) => {
                    if (pieceElement.draggable) {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: rowIndex, col: squareIndex };
                        e.dataTransfer.setData("text/plain", "");
                    }
                });

                pieceElement.addEventListener("dragend", () => {
                    draggedPiece = null;
                    sourceSquare = null;
                });

                squareElement.appendChild(pieceElement);
            }

            squareElement.addEventListener("dragover", (e) => e.preventDefault());

            squareElement.addEventListener("drop", (e) => {
                e.preventDefault();
                if (draggedPiece) {
                    const targetSquare = {
                        row: parseInt(squareElement.dataset.row),
                        col: parseInt(squareElement.dataset.col),
                    };
                    handleMove(sourceSquare, targetSquare);
                }
            });

            boardElement.appendChild(squareElement);
        });
    });

    // Flip board for black player
    if (playerRole === "b") {
        boardElement.classList.add("flipped");
    } else {
        boardElement.classList.remove("flipped");
    }
};

// Handle move attempt
const handleMove = (source, target) => {
    const move = {
        from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
        to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
        promotion: "q", // Default promotion to queen
    };

    // Validate move locally
    const result = chess.move(move);
    if (result) {
        chess.undo(); // Undo locally to prevent double-processing
        socket.emit("move", move);
    } else {
        console.warn("Invalid move attempted:", move);
        alert("Invalid move!");
    }
};

// Get Unicode for pieces
const getPieceUnicode = (piece) => {
    const chessPieces = {
        p: "♟️", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
        P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔",
    };
    return chessPieces[piece.type] || "";
};

// Update turn indicator
const updateTurnIndicator = () => {
    if (!playerRole) {
        turnIndicator.textContent = "Spectator Mode";
        return;
    }
    const currentTurn = chess.turn();
    turnIndicator.textContent = currentTurn === playerRole ? "Your Turn" : "Opponent's Turn";
};

// Socket Events
socket.on("playerRole", (role) => {
    playerRole = role;
    renderBoard();
    turnIndicator.textContent = "Waiting for opponent...";
});

socket.on("waitingForPlayer", () => {
    turnIndicator.textContent = "Waiting for opponent...";
});

socket.on("gameStart", ({ turn }) => {
    turnIndicator.textContent = turn === "w" ? "Your Turn" : "Opponent's Turn";
});

socket.on("move", (move) => {
    chess.move(move);
    renderBoard();
    updateTurnIndicator();
});

socket.on("yourTurn", () => {
    turnIndicator.textContent = "Your Turn";
});

socket.on("opponentTurn", () => {
    turnIndicator.textContent = "Opponent's Turn";
});

renderBoard();
