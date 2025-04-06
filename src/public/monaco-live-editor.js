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

require(["vs/editor/editor.main"], () => {
    window.monaco = monaco; 
}); 

/* Load editor style */
let editorStyle = document.createElement("style"); 
editorStyle.innerHTML = `
    @font-face {
        font-family: IBM Plex Sans;
        src: url(/monaco-live-editor/ibm-plex-sans.ttf);
    }
    
    .user-widget {
        color: black; 
        opacity: .8; 
        width: max-content;
        padding-left: 2px; 
        padding-right: 2px; 
        border-radius: 2px; 

        transition: opacity .2s;
    }

    .user-widget:hover {
        opacity: .2;
    }

    .cursor {
        width: 2px !important;
    }

    .selection {
        padding-right: 7px !important;
    }

    .file {
        color: white; 
        font-family: IBM Plex Sans; 

        padding: 0.5em; 
        padding-top: 0.25em; 
        padding-bottom: 0.25em;
        border-radius: 0.25em;

        cursor: pointer; 
        white-space: nowrap;

        color: rgb(220, 220, 220);
    }

    .file img {
        width: 1em; 
        aspect-ratio: 1 / 1; 
        margin-right: 0.5em; 
        vertical-align: -0.15em; 
    }

    .file:hover {
        background: rgb(50, 50, 50); 
    }
`; 
document.head.appendChild(editorStyle); 

function updateFilesystem(element, filesystem) {
    element.innerHTML = ""; // Clear the filesystem

    function sortFilesystem(filesystem) {
        filesystem.sort((a, b) => {
            if (a.type == b.type) {
                return a.name.localeCompare(b.name); // Sort by name
            } else if (a.type == "directory") {
                return -1; // Directories first
            } else {
                return 1; // Files last
            }
        });

        filesystem.forEach((file) => {
            if (file.children) {
                file.children = sortFilesystem(file.children); // Sort children
            }
        });

        return filesystem;
    }

    filesystem = sortFilesystem(filesystem); // Sort the filesystem

    filesystem.forEach((file) => {
        let fileElement = document.createElement("div"); 
        fileElement.className = "file"; 
        element.appendChild(fileElement); 

        let fileThumbnail = document.createElement("img");

        switch (file.type) {
            case "directory":
                fileThumbnail.src = "/monaco-live-editor/file-thumbnails/directory.svg";
                break;
            case "file":
                fileThumbnail.src = "/monaco-live-editor/file-thumbnails/unknown.svg";
                break;
        }

        fileElement.appendChild(fileThumbnail);

        let fileName = document.createElement("span");
        fileName.innerHTML = file.name;
        fileElement.appendChild(fileName);
    }); 
}

function MonacoLiveEditor(parentElement) {
    this.parentElement = parentElement; 

    this.editor = null; // Editor instance
    this.users = {}; // Connected users
    this.blockChange = false; // Block text change events
    this.workspace = ""; // Workspace name
    this.socket = io(); // Connect to socket.io server

    this.element = document.createElement("div"); 
    this.element.style = `
        background: rgb(30, 30, 30); 
        width: 100%; 
        height: 100%; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
    `; 
    this.parentElement.appendChild(this.element); 

    this.loading = document.createElement("div"); 
    this.loading.style = `
        display: flex; 
        flex-direction: column; 
        align-items: center; 
        justify-content: center; 
    `; 
    this.element.appendChild(this.loading); 

    this.loadingImage = document.createElement("img"); 
    this.loadingImage.src = "/monaco-live-editor/loading.svg"; 
    this.loadingImage.style = `
        width: 3em; 
        aspect-ratio: 1 / 1; 
    `; 
    this.loading.appendChild(this.loadingImage); 

    this.loadingText = document.createElement("span"); 
    this.loadingText.innerHTML = "Connecting to server..."; 
    this.loadingText.style = `
        color: white; 
        font-family: Monaco; 
        padding-top: 0.5em; 
    `; 
    this.loading.appendChild(this.loadingText); 

    this.filesystem = document.createElement("div");
    this.filesystem.style = `
        display: none;
        flex-direction: column;
        border-right: 1px solid rgb(100, 100, 100);
        padding: 0.5em; 

        min-width: 200px;
        height: calc(100% - 1em);
    `;
    this.element.appendChild(this.filesystem);

    this.monacoEditor = document.createElement("div"); 
    this.monacoEditor.style = `
        flex: 1; 
        width: 100%; 
        height: 100%; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        display: none;  
    `; 
    this.element.appendChild(this.monacoEditor); 

    this.socket.on("error", (error) => {
        this.onError(error); 
    }); 

    this.socket.on("workspace", (data) => {
        this.loading.style.display = "none"; 
        this.filesystem.style.display = "flex";
        this.monacoEditor.style.display = ""; 

        updateFilesystem(this.filesystem, data.filesystem); // Update the filesystem

        this.editor.layout(); 

        this.blockChange = true; // Prevent text change events from triggering the socket.io event
        this.editor.setValue(data.text); // Set the editor value

        for (let userID in data.users) {
            let user = data.users[userID];
            this.userJoin(user);
        };
    });

    this.socket.on("user-joined", (user) => {
        this.userJoin(user); // Add the new user to the editor
    });

    this.socket.on("user-left", (userID) => {
        let user = this.users[userID];
        this.editor.removeContentWidget(user.widget);
        this.editor.deltaDecorations(user.decorations, []);
        delete this.users[userID];
    });

    this.socket.on("selection", (data) => {
        this.users[data.userID].widget.position.lineNumber = data.selection.endLineNumber;
        this.users[data.userID].widget.position.column = data.selection.endColumn;

        this.editor.removeContentWidget(this.users[data.userID].widget); 
        this.editor.addContentWidget(this.users[data.userID].widget);

        this.changeSeleciton(data.userID, data.selection, data.secondarySelections); // Update the user's selection
    }); 

    this.socket.on("text-change", (data) => {
        this.blockChange = true; // Prevent text change events from triggering the socket.io event
        this.editor.getModel().applyEdits(data.changes); // Apply the text changes
    });

    this.socket.on('disconnect', function() {
        this.socket.reconnect();
    }); 
    
    /* Initialize the editor */
    this.monacoScriptLoadInterval = setInterval(() => {
        if (window.monaco) {
            clearInterval(this.monacoScriptLoadInterval); 

            window.monaco.editor.defineTheme('default', {
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

            window.monaco.editor.setTheme('default'); 

            this.editor = window.monaco.editor.create(this.monacoEditor, {
                fontSize: 15
            }); 

            this.editor.onDidChangeCursorSelection((e) => {
                this.socket.emit("selection", e); // Send selection data to the server
            }); 
        
            this.editor.onDidChangeModelContent((e) => { // Text change
                if (this.blockChange) {
                    this.blockChange = false;
                    return;
                }
                this.socket.emit("text-change", e); // Send text change data to the server
            }); 

            window.onresize = () => {
                this.editor.layout(); 
            }; 
        }
    }, 0); 
}

MonacoLiveEditor.prototype.joinWorkspace = function(workspace) {
    this.joinWorkspaceInterval = setInterval(() => {
        if (this.editor) {
            clearInterval(this.joinWorkspaceInterval); 

            const model = window.monaco.editor.createModel(
                "", // Initial value
                undefined, // Language
                window.monaco.Uri.file(workspace) // File name -> automatically sets the language
            );
                
            this.editor.setModel(model);

            this.socket.emit("join", workspace); // Join the workspace
        }
    }, 0); 
}

MonacoLiveEditor.prototype.onError = function(error) {}

/* New user joins */
MonacoLiveEditor.prototype.userJoin = function(user) {
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

    this.editor.addContentWidget(user.widget);

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
    this.users[user.id] = user;

    if (user.selection) {
        this.changeSeleciton(user.id, user.selection, user.secondarySelections); // Apply the user's selection
    }
}

/* User changes selection */
MonacoLiveEditor.prototype.changeSeleciton = function(userID, selection, secondarySelections) {
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

        this.users[userID].decorations = this.editor.deltaDecorations(this.users[userID].decorations, selectionArray); // Apply the decorations
    } catch (e) {} // Handle invalid selection data
}