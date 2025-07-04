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

        if (userData[username] && userData[username].password === password) {
            editor.sendCustomEvent(socket, "login-success");
        } else {
            editor.sendCustomEvent(socket, "login-fail");
        }
    }
}; 

editor.startServer(expressServer, httpServer); 

httpServer.listen(80); 