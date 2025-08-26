const fs = require("fs"); 
const path = require("path");
const socketIO = require("socket.io");
const express = require("express");
const process = require("process");

const root = process.cwd(); // Get the current working directory

function isValidWorkspaceName(workspaceFolder, workspaceName) {
    if (!workspaceName) return false; // Reject empty filenames
    if (workspaceName.length > 255) return false; // Reject workspace names longer than 255 characters

    const safePattern = /^[a-zA-Z0-9_/.-]+$/; // Allow letters, numbers, -, _ and /
    if (!safePattern.test(workspaceName)) {
        console.log("Rejected safe pattern"); 
        return false; // Reject workspace names with special characters or spaces
    }

    // Normalize and check if the resolved path stays inside the allowed directory
    const safeDirectory = path.resolve(workspaceFolder); 
    const resolvedPath = path.resolve(safeDirectory, workspaceName);

    return resolvedPath.startsWith(safeDirectory); // Prevent directory traversal
}

function loadWorkspace(workspacePath, additionalPath) {
    let filesystem = []; // Store files in the workspace

    fs.readdirSync(path.join(workspacePath, additionalPath)).forEach((file) => {
        let filePathFull = path.join(workspacePath, additionalPath, file); // Get the file path
        let fileStat = fs.lstatSync(filePathFull); // Get the file stats
        let filePath = path.join(additionalPath, file); // Get the file path relative to the workspace

        if (fileStat.isDirectory()) { // If the file is a directory
            filesystem.push({ // Create a directory object
                name: file, // Set the file name
                type: "directory", // Set the file type to directory
                path: filePath, // Set the file path
                children: loadWorkspace(workspacePath, filePath) // Recursively load the directory
            });
        }

        else if (fileStat.isFile()) { // If the file is a file
            filesystem.push({ // Create a file object
                name: file, // Set the file name
                type: "file", // Set the file type to file
                path: filePath, // Set the file path
                content: fs.readFileSync(filePathFull, "utf-8"), // Read the file content
                users: [] // Store the IDs of the users who have the file open
            });
        }

        else if (fileStat.isSymbolicLink()) { // If the file is a symbolic link
            filesystem.push({ // Create a symbolic link object
                name: file, // Set the file name
                type: "symlink", // Set the file type to symlink
                path: filePath, // Set the file path
                target: fs.readlinkSync(filePath), // Read the symbolic link target
            });
        }

        else { // If the file is not a file or directory or a symbolic link
            filesystem.push({ // Create a file object
                name: file, // Set the file name
                type: "unknown", // Set the file type to unknown
                path: filePath, // Set the file path
            });
        }
    });

    return filesystem; // Return the loaded files
}

function saveWorkspace(workspacePath, workspace) {
    for (let i = 0; i < workspace.length; i ++) { // Loop through the workspace files
        let file = workspace[i]; // Get the file
        let filePath = path.join(workspacePath, file.name); // Get the file path

        if (file.type === "directory") { // If the file is a directory
            fs.mkdirSync(filePath, { recursive: true }); // Create the directory
            saveWorkspace(filePath, file.children); // Recursively save the directory
        } else if (file.type === "file") { // If the file is a file
            fs.writeFileSync(filePath, file.content || ""); // Write the file content
        } else if (file.type === "symlink") { // If the file is a symbolic link
            fs.symlinkSync(file.target, filePath); // Create the symbolic link
        }
    }
}

function MonacoLiveEditor() {
    this.expressServer = null; // Store the express server instance
    this.httpServer = null; // Store the HTTP server instance
    this.workspaceFolder = null; // Set the workspace folder
    this.templateFolder = null; // Set the template folder

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

MonacoLiveEditor.prototype.setWorkspaceFolder = function(path) {
    this.workspaceFolder = path;
}

MonacoLiveEditor.prototype.setTemplateFolder = function(path) {
    this.templateFolder = path; // Set the template folder
}

MonacoLiveEditor.prototype.setShowLog = function(showLog) {
    this.showLog = showLog; // Set whether to show log messages
}

MonacoLiveEditor.prototype.requestConnect = function(params) {
    /** 
     * This function is called when a user requests joining a workspace. 
     * If the function returns true, the user is allowed to join the workspace.
     * Otherwise, the user is denied access.
     */

    return true; // Allow all users to join the workspace by default
}

MonacoLiveEditor.prototype.onReceiveCustomEvent = function(socket, eventName, params) {
    /**
     * This function is called when a custom event is emitted by the user.
     * The eventName is the name of the event, and params is an object with the parameters of the event.
     * You can use this function to handle custom events in your application (for example login)
     */
}

MonacoLiveEditor.prototype.sendCustomEvent = function(socket, eventName, params) {
    socket.emit("custom-event", { // Send a custom event to the user
        eventName: eventName, // Set the event name
        params: params // Set the parameters of the event
    });
    
    if (this.showLog) console.log(`MonacoLiveEditor: Sent custom event ${eventName} to user ${socket.variables.userID}`, params); // Log the event
}

MonacoLiveEditor.prototype.startServer = function(expressServer, httpServer) {
    if (!this.workspaceFolder) {
        throw "Must set workspace folder before starting server"; 
    }

    this.expressServer = expressServer; 
    this.httpServer = httpServer; 

    this.io = socketIO(this.httpServer); // Initialize Socket.IO with the server

    if (fs.existsSync(path.join(root, "/node_modules/monaco-editor"))) {
        this.expressServer.use("/monaco-editor", express.static(path.join(root, "/node_modules/monaco-editor"))); // Serve Monaco Editor files
    } else {
        this.expressServer.use("/monaco-editor", express.static(path.join(__dirname, "../node_modules/monaco-editor"))); // Serve Monaco Editor files
    }

    this.expressServer.use("/monaco-live-editor", express.static(path.join(__dirname, "public"))); // Serve monaco-live-editor files

    if (this.showLog) console.log("MonacoLiveEditor: Server started"); // Log server start

    this.io.on("connection", (socket) => {
        if (this.showLog) console.log(`MonacoLiveEditor: User ${this.userID} connected`);

        socket.variables = {}; // Create a variables object in the socket
        socket.variables.userID = this.userID; // Store the user ID in the socket
        socket.variables.writePermission = false; // Store whether the user has write permission, false by default
        
        socket.emit("connected"); // Send connected event to the user
        this.userID ++; // Increment the user ID 

        socket.on("join", (params) => {
            let workspace = params.workspace; // Get the workspace name from the parameters

            /* Sanitize workspace name */
            if (!isValidWorkspaceName(this.workspaceFolder, workspace)) { // If the workspace name is not valid
                socket.emit("error", "Invalid workspace name"); // Send error message to the user
                return; // Exit the function
            }

            if (this.requestConnect(params) === false) { // If the user is not allowed to join the workspace
                socket.emit("error", "Access denied"); // Send error message to the user
                return; // Exit the function
            }

            let workspacePath = path.join(this.workspaceFolder, workspace); // Get the workspace path

            if (!fs.existsSync(workspacePath)) { // If the workspace folder does not exist
                fs.mkdirSync(workspacePath, { recursive: true }); // Create the workspace folder
                // fs.writeFileSync(path.join(workspacePath, "README.md"), "# Welcome to your new workspace!\n\nThis is a README file for your new workspace."); // Create a README file
                
                if (fs.existsSync(this.templateFolder)) { // If the template folder exists
                    /* Copy the template folder to the workspace */
                    fs.cpSync(this.templateFolder, workspacePath, { recursive: true }, (err) => { // Copy the template folder to the workspace
                        if (err) {
                            socket.emit("error", "Error copying template folder"); // Send error message to the user
                            return; // Exit the function
                        }
                    });
                }

                if (this.showLog) console.log(`MonacoLiveEditor: User ${socket.variables.userID} created workspace ${workspace}`);
            }
            else {
                if (this.showLog) console.log(`MonacoLiveEditor: User ${socket.variables.userID} joined workspace ${workspace}`);
            }

            if (!this.workspaces[workspace]) { // If the workspace does not exist
                this.workspaces[workspace] = {
                    users: {},
                    filesystem: {}, // Store files in the workspace
                    lastSave: Date.now()
                }; // Create the workspace

                this.workspaces[workspace].filesystem = loadWorkspace(workspacePath, ""); // Load files from the workspace folder
            }

            socket.emit("workspace", this.workspaces[workspace]); // Send the workspace to the user
            socket.variables.workspace = workspace; // Store the workspace in the socket

            this.io.to("Workspace " + workspace).emit("user-joined", this.workspaces[workspace].users[socket.variables.userID]); // Send the user-joined event to all users in the workspace
            socket.join("Workspace " + workspace); // Join the workspace room
        });

        socket.on("open-file", (path) => {
            path = path.replace(/\\/g, "/"); // Normalize the path to use forward slashes
            let pathSplited = path.split("/"); // Split the path by slashes

            function findFile(filesystem, pathSplited) {
                let file = filesystem.find((file) => file.name === pathSplited[0]); // Find the file in the filesystem

                if (!file) return null; // If the file is not found, return null

                if (pathSplited.length === 1) { // If the path has only one element
                    return file; // Return the file
                } else if (file.type === "directory") { // If the file is a directory
                    return findFile(file.children, pathSplited.slice(1)); // Recursively search in the directory
                } else {
                    return null; // If the file is not a directory, return null
                }
            }

            let file = findFile(this.workspaces[socket.variables.workspace].filesystem, pathSplited); // Find the file in the workspace
            
            if (!file) { // If the file is not found
                socket.emit("error", "File not found"); // Send error message to the user
                return; // Exit the function
            }
            else {
                if (socket.variables.currentFile) {
                    /* Disconnect from the previous file room */
                    socket.leave("Workspace " + socket.variables.workspace + " - File " + socket.variables.currentFile.path);
                    this.io.to("Workspace " + socket.variables.workspace).emit("user-left-file", socket.variables.userID); // Send the user-left-file event to all users in the workspace
                    if (this.showLog) console.log(`MonacoLiveEditor: User ${socket.variables.userID} closed file ${socket.variables.currentFile.path} in workspace ${socket.variables.workspace}`);
                
                    /* Remove the user's ID from the previous file */
                    const index = socket.variables.currentFile.users.indexOf(socket.variables.userID);
                    if (index > -1) {
                        socket.variables.currentFile.users.splice(index, 1); // Remove the user from the file
                    }
                }
                
                file.users.push(socket.variables.userID); // Add the user to the file
                socket.emit("file-opened", file); // Send the opened file to the user
                socket.variables.currentFile = file; // Store the current file in the socket

                /* Join the file room */
                socket.join(["Workspace " + socket.variables.workspace, "Workspace " + socket.variables.workspace + " - File " + file.path]); // Join the file room
                this.io.to("Workspace " + socket.variables.workspace).emit("user-joined-file", socket.variables.userID); // Send the user-joined-file event to all users in the workspace
                if (this.showLog) console.log(`MonacoLiveEditor: User ${socket.variables.userID} opened file ${file.path} in workspace ${socket.variables.workspace}`);
            }
        });

        socket.on("save-workspace", () => {
            if (!socket.variables.workspace) {
                socket.emit("error", "You are not in a workspace"); // Send error message to the user
                return; // Exit the function
            }

            if (!socket.variables.writePermission) {
                socket.emit("error", "You don't have write permission"); // Send error message to the user
                return; // Exit the function
            }

            if (this.showLog) console.log(`MonacoLiveEditor: User ${socket.variables.userID} saved workspace ${socket.variables.workspace}`); // Log the save event

            saveWorkspace(path.join(this.workspaceFolder, socket.variables.workspace), this.workspaces[socket.variables.workspace].filesystem); // Save the workspace
        }); 

        socket.on("disconnect", () => {
            if (this.showLog) console.log(`MonacoLiveEditor: User ${socket.variables.userID} disconnected`);

            this.io.to("Workspace " + socket.variables.workspace).emit("user-left", socket.variables.userID); // Send the user-left event to all users in the workspace

            if (socket.variables.workspace) { // If the user is in a workspace
                delete this.workspaces[socket.variables.workspace].users[socket.variables.userID]; // Delete the user from the workspace

                if (Object.keys(this.workspaces[socket.variables.workspace].users).length == 0) { // If there are no users left in the workspace
                    saveWorkspace(path.join(this.workspaceFolder, socket.variables.workspace), this.workspaces[socket.variables.workspace].filesystem); // Save the workspace
                    if (this.showLog) console.log(`MonacoLiveEditor: Workspace ${socket.variables.workspace} saved and closed`);
                    delete this.workspaces[socket.variables.workspace]; // Delete the workspace
                }
            }
        }); 

        socket.on("custom-event", (data) => {
            let eventName = data.eventName; // Get the event name from the data
            let params = data.params || {}; // Get the parameters from the data, or an empty object if not provided

            if (this.showLog) console.log(`MonacoLiveEditor: User ${socket.variables.userID} emitted custom event ${eventName}`, params); // Log the event

            this.onReceiveCustomEvent(socket, eventName, params); // Call the custom event handler
        }); 
    }); 
}

module.exports = MonacoLiveEditor; // Export the MonacoLiveEditor class