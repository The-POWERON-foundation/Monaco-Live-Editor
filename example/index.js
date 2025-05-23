const express = require("express"); 
const expressServer = express();
const http = require("http"); 
const httpServer = http.createServer(expressServer); 

const path = require("path");
const MonacoLiveEditor = require("../src/index"); // After installing the package, you can replace it with 'monaco-live-editor'

expressServer.use(express.static(path.join(__dirname, "public"))); // Serve static files from the public directory

let editor = new MonacoLiveEditor(); 
editor.setShowLog(true); // Show log
editor.setWorkspaceFolder(path.resolve(__dirname, "workspace")); 
editor.setTemplateFolder(path.resolve(__dirname, "template"));
editor.startServer(expressServer, httpServer); 

httpServer.listen(80); 