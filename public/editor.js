let editor; // Editor instance
let users = {}; // Connected users

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

function changeSeleciton(userId, selection, secondarySelections) {
    var selectionArray = []
    if (selection.startColumn == selection.endColumn && selection.startLineNumber == selection.endLineNumber) { //if cursor - 커서일 때
        selection.endColumn++
        selectionArray.push({
            range: selection,
            options: {
                className: `user-${userId}-cursor cursor`,
                hoverMessage: {
                    value: "User " + userId
                }
            }
        })

    } else {    //if selection - 여러개를 선택했을 때
        selectionArray.push({   
            range: selection,
            options: {
                className: `user-${userId}-selection selection`,
                hoverMessage: {
                    value: "User " + userId
                }
            }
        })
    }
    for (let data of secondarySelections) {       //if select multi - 여러개를 선택했을 때
        if (data.startColumn == data.endColumn && data.startLineNumber == data.endLineNumber) {
            selectionArray.push({
                range: data,
                options: {
                    className: `user-${userId}-cursor cursor`,
                    hoverMessage: {
                        value: "User " + userId
                    }
                }
            })
        } else
            selectionArray.push({
                range: data,
                options: {
                    className: `user-${userId}-selection selection`,
                    hoverMessage: {
                        value: "User " + userId
                    }
                }
            })
    }
    users[userId].decorations = editor.deltaDecorations(users[userId].decorations, selectionArray); // Apply the decorations
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
        value: "",
        language: "javascript",
        fontSize: 15,
    }); 

    let workspace = prompt("Enter file name: ");
    let socket = io(); // Connect to the socket.io server

    socket.on("connected", () => {
        socket.emit("join", workspace); // Join the workspace

        socket.on("workspace", (data) => {
            editor.setValue(data.text); // Set the editor value

            for (let userId in data.users) {
                let user = data.users[userId];
                userJoin(user);
            };
        });

        socket.on("user-joined", (user) => {
            userJoin(user); // Add the new user to the editor
        });

        socket.on("user-left", (userId) => {
            let user = users[userId];
            editor.removeContentWidget(user.widget);
            editor.deltaDecorations(user.decorations, []);
            delete users[userId];
        });

        socket.on("selection", (data) => {
            users[data.userId].widget.position.lineNumber = data.selection.endLineNumber;
            users[data.userId].widget.position.column = data.selection.endColumn;

            editor.removeContentWidget(users[data.userId].widget); 
            editor.addContentWidget(users[data.userId].widget);

            changeSeleciton(data.userId, data.selection, data.secondarySelections); // Update the user's selection
        }); 
    });

    editor.onDidChangeCursorSelection((e) => {
        socket.emit("selection", e); // Send selection data to the server
    }); 
}); 