const express = require("express"); 
const expressServer = express();
const http = require("http"); 
const httpServer = http.createServer(expressServer); 

const path = require("path");
const MonacoLiveEditor = require("../src/index"); // After installing the package, you can replace it with '@the-poweron-foundation/monaco-live-editor'

expressServer.use(express.static(path.join(__dirname, "public"))); // Serve static files from the public directory

let editor = new MonacoLiveEditor(); 
editor.setShowLog(true); // Show log
editor.setWorkspaceFolder(path.resolve(__dirname, "workspace")); 
editor.startServer(expressServer, httpServer); 

editor.authenticate = (token, callback) => {
    if (token === "1234") {
        callback(true);
    } else {
        callback(false);
    }
}

httpServer.listen(3000); 