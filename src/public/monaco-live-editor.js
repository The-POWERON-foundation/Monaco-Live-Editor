const LANGUAGES = {
    "js": "javascript",
    "ts": "typescript",
    "py": "python",
    "java": "java",
    "c": "c",
    "cpp": "cpp",
    "cs": "csharp",
    "rb": "ruby",
    "go": "go",
    "php": "php",
    "html": "html",
    "css": "css",
    "scss": "scss",
    "less": "less",
    "json": "json",
    "xml": "xml",
    "yaml": "yaml",
    "md": "markdown",
    "sh": "shell",
    "bat": "bat",
    "ps1": "powershell",
    "sql": "sql",
    "r": "r",
    "swift": "swift",
    "kt": "kotlin",
    "dart": "dart",
    "lua": "lua",
    "scala": "scala",
    "rs": "rust",
    "pl": "perl",
    "vb": "vb",
    "coffee": "coffeescript",
    "dockerfile": "dockerfile",
    "makefile": "makefile",
    "ini": "ini",
    "tex": "latex",
    "txt": "plaintext"
};   

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
        font-family: Mononoki;
        src: url(/monaco-live-editor/mononoki.otf);
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

    .node-element-container {
        display: flex;
        width: 100%;
    }

    .node-element {
        display: flex;
        flex-direction: column;
        flex: 1;
    }

    .node {
        color: white; 
        font-family: Mononoki; 

        padding: 0.5em; 
        padding-top: 0.25em; 
        padding-bottom: 0.25em;
        border-radius: 0.25em;

        cursor: pointer; 
        white-space: nowrap;

        color: rgb(220, 220, 255);
    }

    .node img {
        width: 1em; 
        aspect-ratio: 1 / 1; 
        margin-right: 0.5em; 
        vertical-align: -0.15em; 
    }

    .node:hover {
        background: rgb(0, 0, 100); 
    }

    .directory-children {
        margin-left: 0.9em; 
        position: relative;
    }

    .directory-children:before {
        content: "";
        height: calc(100% - 1em + 5px);
        position: absolute;
        border-left: 1px solid rgb(50, 50, 150);
    }

    .line {
        width: 1em; 
        height: 1px;
        border-top: 1px solid rgb(50, 50, 150);
        margin-top: calc(1em - 1px); 
    }
`; 
document.head.appendChild(editorStyle); 

function updateDirectoryChildren(element, children, isRoot = false, socket) {
    element.innerHTML = ""; // Clear the children

    children.forEach((node) => {
        let nodeElementContainer = document.createElement("div"); 
        nodeElementContainer.className = "node-element-container"; 
        nodeElementContainer.id = node.path; 
        element.appendChild(nodeElementContainer); 

        nodeElementContainer.addEventListener("click", (e) => {
            e.stopPropagation(); // Prevent the click event from bubbling up to the parent element
        }); 

        if (!isRoot) {
            let line = document.createElement("div"); 
            line.className = "line"; 
            nodeElementContainer.appendChild(line); 
        }

        let nodeElement = document.createElement("div");
        nodeElement.className = "node-element";
        nodeElementContainer.appendChild(nodeElement);

        let selfNodeElement = document.createElement("div");
        selfNodeElement.className = "node";
        nodeElement.appendChild(selfNodeElement);

        if (node.type === "directory") {
            let children = document.createElement("div");
            children.className = "directory-children";
            children.style.display = "none"; // Hide the children by default
            updateDirectoryChildren(children, node.children, false, socket); // Update the children of the directory
            nodeElement.appendChild(children);

            nodeElement.addEventListener("click", (e) => {
                e.stopPropagation(); // Prevent the click event from bubbling up to the parent element

                let children = e.currentTarget.parentElement.querySelector(".directory-children");

                if (children.style.display == "none") {
                    children.style.display = ""; // Show the children
                } else {
                    children.style.display = "none"; // Hide the children
                }
            }); // Add click event to toggle children
        }
        else if (node.type === "file") {
            nodeElement.addEventListener("click", (e) => {
                e.stopPropagation(); // Prevent the click event from bubbling up to the parent element

                socket.emit("open-file", node.path); // Emit the open-file event to the server
            }); // Add click event to open file
        }
        else {
            nodeElement.addEventListener("click", (e) => {
                e.stopPropagation(); // Prevent the click event from bubbling up to the parent element
            }); // Add click event to prevent default behavior
        }

        let nodeThumbnail = document.createElement("img");

        switch (node.type) {
            case "directory":
                nodeThumbnail.src = "/monaco-live-editor/file-thumbnails/directory.svg";
                break;
            case "file":
                nodeThumbnail.src = "/monaco-live-editor/file-thumbnails/unknown.svg";
                break;
        }

        selfNodeElement.appendChild(nodeThumbnail);

        let nodeName = document.createElement("span");
        nodeName.innerHTML = node.name;
        selfNodeElement.appendChild(nodeName);
    }); 
}

function updateFilesystem(element, filesystem, socket) {
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

        filesystem.forEach((node) => {
            if (node.children) {
                node.children = sortFilesystem(node.children); // Sort children
            }
        });

        return filesystem;
    }

    filesystem = sortFilesystem(filesystem); // Sort the filesystem

    updateDirectoryChildren(element, filesystem, true, socket); // Update the filesystem
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
        background: rgb(0, 0, 40); 
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
        font-family: Mononoki; 
        padding-top: 0.5em; 
    `; 
    this.loading.appendChild(this.loadingText); 

    this.filesystem = document.createElement("div");
    this.filesystem.style = `
        display: none;
        flex-direction: column;
        padding: 0.5em; 

        background: rgb(0, 0, 60); 

        user-select: none;

        min-width: 200px;
        height: calc(100% - 1em);
    `;
    this.element.appendChild(this.filesystem);

    this.editorContainer = document.createElement("div"); 
    this.editorContainer.style = `
        display: flex; 
        flex-direction: column; 
        height: 100%; 
        flex: 1; 
        display: none;  
        min-width: 0; /* Prevent overflow */
    `; 
    this.element.appendChild(this.editorContainer);

    /* TODO: Hotbar for quick file access */
    /* this.hotbar = document.createElement("div"); 
    this.hotbar.style = `
        height: 2.5em; 
        background: rgb(0, 0, 80); 

        color: rgb(220, 220, 255); 
        font-size: 0.9em;

        display: flex; 
        align-items: center; 

        user-select: none;
    `;
    this.editorContainer.appendChild(this.hotbar); */

    this.monacoEditor = document.createElement("div"); 
    this.monacoEditor.style = `
        flex: 1; 
        width: 100%; 
        height: 100%; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        min-width: 0; /* Prevent overflow */
    `; 
    this.editorContainer.appendChild(this.monacoEditor); 

    this.socket.on("error", (error) => {
        this.onError(error); 
    }); 

    this.socket.on("workspace", (data) => {
        this.loading.style.display = "none"; 
        this.filesystem.style.display = "flex";
        this.editorContainer.style.display = ""; 

        updateFilesystem(this.filesystem, data.filesystem, this.socket); // Update the filesystem

        this.editor.layout(); 

        for (let userID in data.users) {
            let user = data.users[userID];
            this.userJoin(user);
        };
    });

    this.socket.on("file-opened", (file) => {
        this.blockChange = true; // Prevent text change events from triggering the socket.io event

        let extension = file.name.split(".").pop(); // Get the file extension
        let language = LANGUAGES[extension] || "plaintext"; // Get the file extension

        window.monaco.editor.setModelLanguage(this.editor.getModel(), language); // Set the language of the editor

        this.editor.setValue(file.content); // Set the editor value
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

    this.socket.on("custom-event", (data) => {
        let eventName = data.eventName;
        let params = data.params;

        this.onReceiveCustomEvent(eventName, params); // Handle custom events
    }); 
    
    /* Initialize the editor */
    this.monacoScriptLoadInterval = setInterval(() => {
        if (window.monaco) {
            clearInterval(this.monacoScriptLoadInterval); 

            window.monaco.editor.defineTheme('default', {
                base: 'vs-dark',
                inherit: true,
                colors: {
                    "editor.background": '#000028',
                },
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
            });

            window.monaco.editor.setTheme('default'); 

            this.editor = window.monaco.editor.create(this.monacoEditor, {
                fontFace: "Mononoki", 
                fontSize: 15, 
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

            this.socket.emit("join", { workspace }); // Join the workspace
        }
    }, 0); 
}

MonacoLiveEditor.prototype.saveWorkspace = function() {
    this.socket.emit("save-workspace"); // Emit save workspace event to the server
}

MonacoLiveEditor.prototype.sendCustomEvent = function(eventName, params) {
    this.socket.emit("custom-event", { eventName, params }); // Emit custom event to the server
}

MonacoLiveEditor.prototype.onReceiveCustomEvent = function(eventName, params) {
    /** Handles custom events */
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