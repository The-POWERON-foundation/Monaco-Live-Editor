let editor; // Editor instance
let users = {}; // Connected users
let blockChange = false; // Block text change events
let workspace = ""; // Workspace name
let socket = io(); // Connect to the socket.io server

/* Load Monaco Editor */
require.config({
    paths: {
        'vs': `${window.location.protocol}//${window.location.host}/monaco-editor/min/vs`
    }
});
window.MonacoEnvironment = {
    getWorkerUrl: function (workerId, label) {
        return `data:text/javascriptcharset=utf-8,${encodeURIComponent(`
            self.MonacoEnvironment = {
                baseUrl: '${window.location.protocol}//${window.location.host}/monaco-editor/min'
            }
            importScripts('${window.location.protocol}//${window.location.host}/monaco-editor/min/vs/base/worker/workerMain.js')
        `)}`; 
    }
}

/* User join event */
function userJoin(user) {
    user.widget = {
        domNode: null,
        position: {
            lineNumber: user.selection.endLineNumber || 0,
            column: user.selection.endColumn || 0
        },
        getId: function () {
            return 'content.' + user.id
        },
        getDomNode: function () {
            if (!this.domNode) {
                this.domNode = document.createElement('div')
                this.domNode.innerText = "User " + user.id
                this.domNode.style.background = user.color.replace("opacity", "1")
                this.domNode.className = 'user-widget'
            }
            return this.domNode
        },
        getPosition: function () {
            return {
                position: this.position,
                preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE, monaco.editor.ContentWidgetPositionPreference.BELOW]
            }
        }
    }; 

    editor.addContentWidget(user.widget);

    /* Adds styles for user's cursor and selection */
    let style = document.createElement('style');
    style.innerHTML = `
        .user-${user.id}-cursor {
            background: ${user.color.replace("opacity", "1")} !important;
        }
        
        .user-${user.id}-selection {
            background: ${user.color.replace("opacity", "0.3")};
        }
    `; 
    document.head.appendChild(style);

    user.decorations = [];
    users[user.id] = user;

    if (user.selection) {
        changeSeleciton(user.id, user.selection, user.secondarySelections); // Apply the user's selection
    }
}

/* User changes selection */
function changeSeleciton(userID, selection, secondarySelections) {
    try {
        let selectionArray = []; 

        if (selection.startColumn == selection.endColumn && selection.startLineNumber == selection.endLineNumber) { // If cursor
            selection.endColumn ++;
            selectionArray.push({
                range: selection,
                options: {
                    className: `user-${userID}-cursor cursor`,
                    hoverMessage: {
                        value: "User " + userID
                    }
                }
            });
        } 
        else { // If selection
            selectionArray.push({   
                range: selection,
                options: {
                    className: `user-${userID}-selection selection`,
                    hoverMessage: {
                        value: "User " + userID
                    }
                }
            });
        }

        for (let data of secondarySelections) { // If multiple cursors/selections
            if (data.startColumn == data.endColumn && data.startLineNumber == data.endLineNumber) {
                selectionArray.push({
                    range: data,
                    options: {
                        className: `user-${userID}-cursor cursor`,
                        hoverMessage: {
                            value: "User " + userID
                        }
                    }
                });
            }
            else {
                selectionArray.push({
                    range: data,
                    options: {
                        className: `user-${userID}-selection selection`,
                        hoverMessage: {
                            value: "User " + userID
                        }
                    }
                });
            }
        }

        users[userID].decorations = editor.deltaDecorations(users[userID].decorations, selectionArray); // Apply the decorations
    } catch (e) {} // Handle invalid selection data
}

/* Join a workspace */
function joinWorkspace() {
    workspace = prompt("Enter file name: ");

    const model = monaco.editor.createModel(
        "", // Initial value
        undefined, // Language
        monaco.Uri.file(workspace) // File name -> automatically sets the language
    );
      
    editor.setModel(model);

    socket.emit("join", workspace); // Join the workspace

    socket.on("error", (error) => {
        alert(error); // Show error message
    }); 

    socket.on("workspace", (data) => {
        document.getElementById("intro").style.display = "none"; // Hide the intro screen

        blockChange = true; // Prevent text change events from triggering the socket.io event
        editor.setValue(data.text); // Set the editor value

        for (let userID in data.users) {
            let user = data.users[userID];
            userJoin(user);
        };
    });
}

/* Creates a new editor */
require(["vs/editor/editor.main"], function () {
    monaco.editor.defineTheme('default', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            {
                token: "identifier",
                foreground: "9CDCFE"
            },
            {
                token: "identifier.function",
                foreground: "DCDCAA"
            },
            {
                token: "type",
                foreground: "1AAFB0"
            }
        ],
        colors: {}
    });

    monaco.editor.setTheme('default'); 

    editor = monaco.editor.create(document.getElementById("editor"), {
        fontSize: 15,
    }); 

    // socket.on("connected", () => {});

    socket.on("user-joined", (user) => {
        userJoin(user); // Add the new user to the editor
    });

    socket.on("user-left", (userID) => {
        let user = users[userID];
        editor.removeContentWidget(user.widget);
        editor.deltaDecorations(user.decorations, []);
        delete users[userID];
    });

    socket.on("selection", (data) => {
        users[data.userID].widget.position.lineNumber = data.selection.endLineNumber;
        users[data.userID].widget.position.column = data.selection.endColumn;

        editor.removeContentWidget(users[data.userID].widget); 
        editor.addContentWidget(users[data.userID].widget);

        changeSeleciton(data.userID, data.selection, data.secondarySelections); // Update the user's selection
    }); 

    socket.on("text-change", (data) => {
        blockChange = true; // Prevent text change events from triggering the socket.io event
        editor.getModel().applyEdits(data.changes); // Apply the text changes
    });

    socket.on('disconnect', function() {
        socket.reconnect();
    }); 

    editor.onDidChangeCursorSelection((e) => {
        socket.emit("selection", e); // Send selection data to the server
    }); 

    editor.onDidChangeModelContent((e) => { // Text change
        if (blockChange) {
            blockChange = false;
            return;
        }
        console.log(e); 
        socket.emit("text-change", e); // Send text change data to the server
    }); 
}); 

window.onresize = function (){
    editor.layout();
};