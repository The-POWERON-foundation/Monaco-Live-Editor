const fs = require("fs"); 
const path = require("path");
const socketIO = require("socket.io");
const express = require("express");
const http = require("http");

function isValidFilename(workspaceFolder, filename) {
    if (!filename) return false; // Reject empty filenames
    if (filename.length > 255) return false; // Reject filenames longer than 255 characters

    const safePattern = /^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9]+)?$/; // Allow letters, numbers, -, _, and extensions
    if (!safePattern.test(filename)) {
        return false; // Reject filenames with special characters or spaces
    }

    // Normalize and check if the resolved path stays inside the allowed directory
    const safeDirectory = path.resolve(workspaceFolder); 
    const resolvedPath = path.resolve(safeDirectory, filename);

    return resolvedPath.startsWith(safeDirectory); // Prevent directory traversal
}

function MonacoLiveEditor(expressServer, folder) {
    this.expressServer = expressServer; // Store the express server instance
    this.server = null; // Store the server instance
    this.workspaceFolder = folder; // Set the workspace folder

    this.userID = 0; // Increment this for each new user
    this.workspaces = {}; // Store the workspace data

    this.showLog = false; // Don't show log messages by default
    this.colors = [
        'rgba(255, 0, 0, opacity)',
        'rgba(255, 127, 0, opacity)',
        'rgba(255, 255, 0, opacity)',
        'rgba(255, 0, 127, opacity)',
        'rgba(255, 0, 255, opacity)',
        'rgba(0, 255, 0, opacity)',
        'rgba(127, 255, 0, opacity)',
        'rgba(0, 255, 127, opacity)',
        'rgba(0, 255, 255, opacity)',
        'rgba(0, 0, 255, opacity)',
        'rgba(127, 0, 255, opacity)',
        'rgba(0, 127, 255, opacity)',
    ]; // Highlight colors

    this.io = null; // Socket.IO server instance
}

MonacoLiveEditor.prototype.setShowLog = function(showLog) {
    this.showLog = showLog; // Set whether to show log messages
}

MonacoLiveEditor.prototype.startServer = function(port) {
    this.server = http.createServer(this.expressServer); // Create an HTTP server with the express server
    this.io = socketIO(this.server); // Initialize Socket.IO with the server
    this.expressServer.use("/monaco-editor", express.static(path.join(__dirname, "../node_modules/monaco-editor"))); // Serve Monaco Editor files
    this.expressServer.use("/monaco-live-editor", express.static(path.join(__dirname, "scripts"))); // Serve monaco-live-editor files

    if (this.showLog) console.log("MonacoLiveEditor: Server started"); // Log server start

    this.io.on("connection", (socket) => {
        if (this.showLog) console.log(`MonacoLiveEditor: User ${this.userID} connected`);

        socket.variables = {}; // Create a variables object in the socket
        socket.variables.userID = this.userID; // Store the user ID in the socket
        
        socket.emit("connected"); // Send connected event to the user
        this.userID ++; // Increment the user ID 

        socket.on("join", (workspace) => {
            /* Sanitize filename */
            if (!isValidFilename(this.workspaceFolder, workspace)) { // If the workspace name is not valid
                socket.emit("error", "Invalid workspace name"); // Send error message to the user
                return; // Exit the function
            }

            let filename = path.join(this.workspaceFolder, workspace); // Get the workspace file path

            if (!fs.existsSync(filename)) { // If the workspace file does not exist
                fs.writeFileSync(filename, ""); // Create the workspace file
                if (this.showLog) console.log(`MonacoLiveEditor: User ${socket.variables.userID} created workspace ${workspace}`);
            }
            else {
                if (this.showLog) console.log(`MonacoLiveEditor: User ${socket.variables.userID} joined workspace ${workspace}`);
            }

            if (!this.workspaces[workspace]) { // If the workspace does not exist
                this.workspaces[workspace] = {
                    users: {},
                    text: fs.readFileSync(filename, "utf-8"), 
                    lastSave: Date.now()
                }; // Create the workspace
            }

            socket.emit("workspace", this.workspaces[workspace]); // Send the workspace to the user

            this.workspaces[workspace].users[socket.variables.userID] = {
                id: socket.variables.userID, 
                color: this.colors[Math.floor(Math.random() * this.colors.length)], 
                selection: {}, 
                secondarySelections: []  // Secondary selections for multi-cursor support
            }; // Add the user to the workspace
            socket.variables.workspace = workspace; // Store the workspace in the socket

            this.io.to(workspace).emit("user-joined", this.workspaces[workspace].users[socket.variables.userID]); // Send the user-joined event to all users in the workspace
            socket.join(workspace); // Join the workspace room
        });

        socket.on("disconnect", () => {
            if (this.showLog) console.log(`MonacoLiveEditor: User ${socket.variables.userID} disconnected`);

            this.io.to(socket.variables.workspace).emit("user-left", socket.variables.userID); // Send the user-left event to all users in the workspace

            if (socket.variables.workspace) { // If the user is in a workspace
                delete this.workspaces[socket.variables.workspace].users[socket.variables.userID]; // Delete the user from the workspace

                if (Object.keys(this.workspaces[socket.variables.workspace].users).length == 0) { // If there are no users left in the workspace
                    fs.writeFileSync(path.join(this.workspaceFolder, socket.variables.workspace), this.workspaces[socket.variables.workspace].text); // Save the workspace
                    if (this.showLog) console.log(`MonacoLiveEditor: Workspace ${socket.variables.workspace} saved and closed`);
                    delete this.workspaces[socket.variables.workspace]; // Delete the workspace
                }
            }
        }); 

        socket.on("selection", (data) => {
            if (!data.selection || !data.secondarySelections) return; // Ignore invalid selection data

            this.workspaces[socket.variables.workspace].users[socket.variables.userID].selection = data.selection; // Update the user's selection
            this.workspaces[socket.variables.workspace].users[socket.variables.userID].secondarySelections = data.secondarySelections; // Update the user's secondary selections

            this.io.to(socket.variables.workspace).except(socket.id).emit("selection", {
                userID: socket.variables.userID,
                selection: this.workspaces[socket.variables.workspace].users[socket.variables.userID].selection, 
                secondarySelections: this.workspaces[socket.variables.workspace].users[socket.variables.userID].secondarySelections
            }); // Send the selection update to all users in the workspace
        }); 

        socket.on("text-change", (data) => {
            data.changes.forEach((change) => {
                let start = change.rangeOffset || 0;
                let end = (change.rangeOffset || 0) + (change.rangeLength || 0);
                let text = change.text || ""; 

                this.workspaces[socket.variables.workspace].text = this.workspaces[socket.variables.workspace].text.slice(0, start) + text + this.workspaces[socket.variables.workspace].text.slice(end); // Update the text

            }); // Apply all the changes

            /*if (Date.now() - this.workspaces[socket.variables.workspace].lastSave > SAVE_INTERVAL) { // If the workspace has not been saved in the set interval yet
                fs.writeFileSync(path.join(__dirname, "..", "files", socket.variables.workspace), this.workspaces[socket.variables.workspace].text); // Save the workspace
                this.workspaces[socket.variables.workspace].lastSave = Date.now(); // Update the last save time
            }*/

            this.io.to(socket.variables.workspace).except(socket.id).emit("text-change", data); // Send the text change to all users in the
        }); 
    }); 

    this.server.listen(port || 80); // Start the server on the specified port or default to 80
}

module.exports = MonacoLiveEditor; // Export the MonacoLiveEditor class