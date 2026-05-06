const express = require("express");
const app = express();

app.use(express.static(__dirname));

app.get("/:room", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`✅ Node server running on http://localhost:${PORT}`);
});

const io = require("socket.io")(server, {
  cors: { origin: "*" }
});

const rooms = {};

io.on("connection", socket => {

  socket.on("join-room", ({ roomId, peerId, username }) => {
    socket.join(roomId);

    if (!rooms[roomId]) rooms[roomId] = [];

    // Send existing users to the newcomer
    rooms[roomId].forEach(user => {
      socket.emit("user-connected", user);
    });

    const userObj = { peerId, username };
    if (!rooms[roomId].find(u => u.peerId === peerId)) {
      rooms[roomId].push(userObj);
    }

    socket.roomId = roomId;
    socket.peerId = peerId;

    socket.to(roomId).emit("user-connected", userObj);
    emitParticipants(roomId);
  });

  // MESSAGE SYSTEM
  // data = { peerId, text, tts }
  // Broadcast to everyone else in the room
  socket.on("send-message", data => {
    socket.to(socket.roomId).emit("receive-message", data);
  });

  function leaveRoom() {
    const roomId = socket.roomId;
    const peerId = socket.peerId;

    if (roomId && rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter(u => u.peerId !== peerId);
      socket.to(roomId).emit("user-disconnected", peerId);
      emitParticipants(roomId);
    }
  }

  socket.on("leave-room", leaveRoom);
  socket.on("disconnect", leaveRoom);

  function emitParticipants(roomId) {
    const count = rooms[roomId] ? rooms[roomId].length : 0;
    io.to(roomId).emit("participants-count", count);
  }
});