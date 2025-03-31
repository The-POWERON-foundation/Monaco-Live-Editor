const fs = require("fs"); 
const path = require("path");

let userId = 0; // Increment this for each new user
let workspaces = {}; // Store the workspace data

const colors = [  
    '#DDFFAA',
    '#95E0C8',
    '#E18060',
    '#FFCBA4'
]; // Highlight colors

module.exports = function(io) {
    io.on("connection", (socket) => {
        console.log(`User ${userId} connected`);
        socket.variables = {}; // Create a variables object in the socket
        socket.variables.userId = userId; // Store the user ID in the socket
        
        socket.emit("connected"); // Send connected event to the user
        userId ++; // Increment the user ID 

        socket.on("join", (workspace) => {
            console.log(`User ${socket.variables.userId} joined workspace ${workspace}`);

            if (!workspaces[workspace]) { // If the workspace does not exist
                workspaces[workspace] = {
                    users: {},
                    text: fs.readFileSync(path.join(__dirname, "..", "files", workspace), "utf-8")
                }; // Create the workspace
            }

            workspaces[workspace].users[socket.variables.userId] = {
                id: socket.variables.userId, 
                color: colors[Math.floor(Math.random() * colors.length)], 
                selection: {
                    primarySelection: {
                        startLineNumber: 1,
                        startColumn: 1,
                        endLineNumber: 1,
                        endColumn: 1,
                        selectionStartLineNumber: 1,
                        selectionStartColumn: 1,
                        positionLineNumber: 1,
                        positionColumn: 1
                    },
                    secondarySelections: [], 
                }
            }; // Add the user to the workspace
            socket.variables.workspace = workspace; // Store the workspace in the socket

            socket.emit("workspace", workspaces[workspace]); // Send the workspace to the user
        });

        socket.on("disconnect", () => {
            console.log(`User ${socket.variables.userId} disconnected`);

            if (socket.variables.workspace) { // If the user is in a workspace
                delete workspaces[socket.variables.workspace].users[socket.variables.userId]; // Delete the user from the workspace

                if (workspaces[socket.variables.workspace].users.length == 0) { // If no users are in the workspace
                    delete workspaces[socket.variables.workspace]; // Delete the workspace
                }
            }
        }); 

        socket.on("selection", (data) => {
            workspaces[socket.variables.workspace].users[socket.variables.userId].selection = {
                primarySelection: data.selection, 
                secondarySelections: data.secondarySelections
            }; // Update the user's selection

            console.log(workspaces["test.html"].users); 
        });
    }); 
}; 