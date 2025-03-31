const express = require("express");
const app = express(); // Start an Express server
const server = require("http").createServer(app); 
const path = require("path"); 
const socketIo = require("socket.io"); 
const io = socketIo(server); // Start a socket.io server

require("./scripts/editor-backend")(io); // Import the editor backend

app.use(express.static(path.join(__dirname, "public"))); // Serve static files from the public directory

server.listen(80, () => {
    console.log("Server listening on port 80"); 
}); 