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
    console.log(user); 

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
                this.domNode.style.background = user.color
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

    users[user.id] = user;
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
    monaco.editor.setTheme('default')

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

        socket.on("selection", (data) => {
            users[data.userId].widget.position.lineNumber = data.selection.endLineNumber
            users[data.userId].widget.position.column = data.selection.endColumn

            editor.removeContentWidget(users[data.userId].widget); 
            editor.addContentWidget(users[data.userId].widget);
        }); 
    });

    editor.onDidChangeCursorSelection((e) => {
        socket.emit("selection", e); // Send selection data to the server
    }); 
}); 