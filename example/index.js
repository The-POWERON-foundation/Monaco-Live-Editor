const express = require("express"); 
const expressServer = express();
const http = require("http"); 
const httpServer = http.createServer(expressServer); 
const fs = require("fs");

const path = require("path");
const MonacoLiveEditor = require("../src/index"); // After installing the package, you can replace it with 'monaco-live-editor'

expressServer.use(express.static(path.join(__dirname, "public"))); // Serve static files from the public directory

let userData = JSON.parse(fs.readFileSync(path.join(__dirname, "data/users.json"), "utf8"));

let editor = new MonacoLiveEditor(); 
editor.setShowLog(true); // Show log
editor.setWorkspaceFolder(path.resolve(__dirname, "workspace")); 
editor.setTemplateFolder(path.resolve(__dirname, "template"));

editor.onReceiveCustomEvent = function(socket, eventName, params) {
    if (eventName === "login") {
        let username = params.username;
        let password = params.password;

        if (username === "" || username === "guest") {
            /* Guest login */
            editor.sendCustomEvent(socket, "login-success", 
                {
                    name: userData.guest.name,
                    image: userData.guest.image,
                    color: userData.guest.color,
                    writePermission: userData.guest.writePermission
                }
            );

            socket.variables.writePermission = userData.guest.writePermission; // Store whether the user has write permission
        } else if (userData[username] && userData[username].password === password) {
            editor.sendCustomEvent(socket, "login-success", 
                { 
                    name: userData[username].name, 
                    image: userData[username].image, 
                    color: userData[username].color, 
                    writePermission: userData[username].writePermission
                }
            );

            socket.variables.writePermission = userData[username].writePermission; // Store whether the user has write permission
        } else {
            editor.sendCustomEvent(socket, "login-fail");
        }
    }
}; 

editor.startServer(expressServer, httpServer); 

httpServer.listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
}); 