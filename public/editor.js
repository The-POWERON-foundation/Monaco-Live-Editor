let editor;
let decorations = {}; 
let contentWidgets = {};

/* Load Monaco Editor */
require.config({
    paths: {
        'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.13.1/min/vs'
    }
});
window.MonacoEnvironment = {
    getWorkerUrl: function (workerId, label) {
        return `data:text/javascriptcharset=utf-8,${encodeURIComponent(`
            self.MonacoEnvironment = {
            baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.13.1/min'
            }
            importScripts('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.13.1/min/vs/base/worker/workerMain.js')
        `)}`; 
    }
}

/* Insert CSS rules for a new user's cursor and selection */
function insertCSS(id, color) {
    let style = document.createElement('style'); 
    style.innerHTML += `.${id} { background-color: ${color} }\n` // Selection design
    style.innerHTML += `
        .${id}one { 
            background: ${color};
            width:2px !important 
        }
    `; // Cursor design

    document.getElementsByTagName('head')[0].appendChild(style); 
}

/* Inserts a new cursor */
function insertWidget(e) {
    contentWidgets[e.id] = {
        domNode: null,
        position: {
            lineNumber: 0,
            column: 0
        },
        getId: function () {
            return 'content.' + e.id
        },
        getDomNode: function () {
            if (!this.domNode) {
                this.domNode = document.createElement('div')
                this.domNode.innerHTML = e.id
                this.domNode.style.background = e.color
                this.domNode.style.color = 'black'
                this.domNode.style.opacity = 0.8
                this.domNode.style.width = 'max-content'
            }
            return this.domNode
        },
        getPosition: function () {
            return {
                position: this.position,
                preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE, monaco.editor.ContentWidgetPositionPreference.BELOW]
            }
        }
    }
}

/* Moves a cursor */
function changeWidgetPosition(e) {
    contentWidgets[e.id].position.lineNumber = e.selection.endLineNumber
    contentWidgets[e.id].position.column = e.selection.endColumn

    editor.removeContentWidget(contentWidgets[e.id])
    editor.addContentWidget(contentWidgets[e.id])
}

/* Changes a selection */
function changeSeleciton(user, selection) {
    let selectionArray = [];

    if (selection.primarySelection.startColumn == selection.primarySelection.endColumn && selection.primarySelection.startLineNumber == selection.primarySelection.endLineNumber) { // If cursor
        selection.primarySelection.endColumn++
        selectionArray.push({
            range: selection.primarySelection,
            options: {
                className: `${user}one`,
                hoverMessage: {
                    value: user
                }
            }
        })

    } else { // If selection
        selectionArray.push({   
            range: selection.primarySelection,
            options: {
                className: user,
                hoverMessage: {
                    value: user
                }
            }
        })
    }

    for (let data of selection.secondarySelections) { // If multiple selections
        if (data.startColumn == data.endColumn && data.startLineNumber == data.endLineNumber) {
            selectionArray.push({
                range: data,
                options: {
                    className: `${user}one`,
                    hoverMessage: {
                        value: user
                    }
                }
            })
        } else {
            selectionArray.push({
                range: data,
                options: {
                    className: user,
                    hoverMessage: {
                        value: user
                    }
                }
            })
        }
    }

    decorations[user] = editor.deltaDecorations(decorations[user] || [], selectionArray);  // Apply change
}

/* Change text in editor */
function changeText(e) {
    editor.getModel().applyEdits(e.changes) // Change content
}

/* Creates a new editor */
require(["vs/editor/editor.main"], function () {
    editor = monaco.editor.create(document.getElementById("editor"), {
        value: "",
        language: "html",
        fontSize: 15,
    }); 

    let workspace = prompt("Enter file name: ");
    let socket = io(); // Connect to the socket.io server

    socket.on("connected", () => {
        socket.emit("join", workspace); // Join the workspace
        socket.on("workspace", (data) => {
            editor.setValue(data.text); // Set the editor value

            console.log(data.users);

            for (let userId in data.users) {
                let user = data.users[userId];

                insertCSS(user.id, user.color); // Insert CSS rules for the user
                insertWidget(user); // Insert the user's cursor
                decorations[user.id] = []; // Create a decorations array for the user
                changeSeleciton(user.id, user.selection); // Change the selection
                changeWidgetPosition(user); // Change the cursor position
            };
        });
    });

    editor.onDidChangeCursorSelection((e) => {
        socket.emit("selection", e); // Send selection data to the server
    }); 
}); 