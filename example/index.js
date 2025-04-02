const express = require("express")
const server = express();
const path = require("path");
const MonacoLiveEditor = require("../src/index"); // After installing the package, you can replace it with '@the-poweron-foundation/monaco-live-editor'

server.use(express.static(path.join(__dirname, "public"))); // Serve static files from the public directory

let editor = new MonacoLiveEditor(server, path.resolve(__dirname, "workspace")); // Initialize MonacoLiveEditor with the server and workspace folder
editor.setShowLog(true); // Enable log messages
editor.startServer(80); // Start the server