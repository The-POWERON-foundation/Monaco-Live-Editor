const fs = require("fs"); 
const path = require("path");

let userId = 0; // Increment this for each new user
let workspaces = {}; // Store the workspace data

const SAVE_INTERVAL = 10000; // Save the workspace every 10 seconds
const SHOW_LOG = true; // Show log messages

/*const colors = [  
    '#DDFFAA',
    '#95E0C8',
    '#E18060',
    '#FFCBA4'
]; // Highlight colors*/

const colors = [  
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

module.exports = function(io) {
    io.on("connection", (socket) => {
        if (SHOW_LOG) console.log(`User ${userId} connected`);

        socket.variables = {}; // Create a variables object in the socket
        socket.variables.userId = userId; // Store the user ID in the socket
        
        socket.emit("connected"); // Send connected event to the user
        userId ++; // Increment the user ID 

        socket.on("join", (workspace) => {
            if (SHOW_LOG) console.log(`User ${socket.variables.userId} joined workspace ${workspace}`);

            if (!workspaces[workspace]) { // If the workspace does not exist
                workspaces[workspace] = {
                    users: {},
                    text: fs.readFileSync(path.join(__dirname, "..", "files", workspace), "utf-8"), 
                    lastSave: Date.now()
                }; // Create the workspace
            }

            socket.emit("workspace", workspaces[workspace]); // Send the workspace to the user

            workspaces[workspace].users[socket.variables.userId] = {
                id: socket.variables.userId, 
                color: colors[Math.floor(Math.random() * colors.length)], 
                selection: {}, 
                secondarySelections: []  // Secondary selections for multi-cursor support
            }; // Add the user to the workspace
            socket.variables.workspace = workspace; // Store the workspace in the socket

            io.to(workspace).emit("user-joined", workspaces[workspace].users[socket.variables.userId]); // Send the user-joined event to all users in the workspace
            socket.join(workspace); // Join the workspace room
        });

        socket.on("disconnect", () => {
            if (SHOW_LOG) console.log(`User ${socket.variables.userId} disconnected`);

            io.to(socket.variables.workspace).emit("user-left", socket.variables.userId); // Send the user-left event to all users in the workspace

            if (socket.variables.workspace) { // If the user is in a workspace
                delete workspaces[socket.variables.workspace].users[socket.variables.userId]; // Delete the user from the workspace

                if (Object.keys(workspaces[socket.variables.workspace].users).length == 0) { // If there are no users left in the workspace
                    fs.writeFileSync(path.join(__dirname, "..", "files", socket.variables.workspace), workspaces[socket.variables.workspace].text); // Save the workspace
                    if (SHOW_LOG) console.log(`Workspace ${socket.variables.workspace} saved and closed`);
                    delete workspaces[socket.variables.workspace]; // Delete the workspace
                }
            }
        }); 

        socket.on("selection", (data) => {
            if (!data.selection || !data.secondarySelections) return; // Ignore invalid selection data

            workspaces[socket.variables.workspace].users[socket.variables.userId].selection = data.selection; // Update the user's selection
            workspaces[socket.variables.workspace].users[socket.variables.userId].secondarySelections = data.secondarySelections; // Update the user's secondary selections

            io.to(socket.variables.workspace).except(socket.id).emit("selection", {
                userId: socket.variables.userId,
                selection: workspaces[socket.variables.workspace].users[socket.variables.userId].selection, 
                secondarySelections: workspaces[socket.variables.workspace].users[socket.variables.userId].secondarySelections
            }); // Send the selection update to all users in the workspace
        }); 

        socket.on("text-change", (data) => {
            data.changes.forEach((change) => {
                let start = change.rangeOffset || 0;
                let end = (change.rangeOffset || 0) + (change.rangeLength || 0);
                let text = change.text || ""; 

                workspaces[socket.variables.workspace].text = workspaces[socket.variables.workspace].text.slice(0, start) + text + workspaces[socket.variables.workspace].text.slice(end); // Update the text

            }); // Apply all the changes

            if (Date.now() - workspaces[socket.variables.workspace].lastSave > SAVE_INTERVAL) { // If the workspace has not been saved in the set interval yet
                fs.writeFileSync(path.join(__dirname, "..", "files", socket.variables.workspace), workspaces[socket.variables.workspace].text); // Save the workspace
                workspaces[socket.variables.workspace].lastSave = Date.now(); // Update the last save time
            }

            io.to(socket.variables.workspace).except(socket.id).emit("text-change", data); // Send the text change to all users in the
        }); 
    }); 
}; 