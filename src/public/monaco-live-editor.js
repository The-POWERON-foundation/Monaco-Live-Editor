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

    this.loading = document.createElement("img"); 
    this.loading.src = "/monaco-live-editor/loading.svg"; 
    this.loading.style = `
        width: 3em; 
        aspect-ratio: 1 / 1; 
    `; 
    this.element.appendChild(this.loading); 

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
        this.monacoEditor.style.display = ""; 
        this.editor.layout(); 

        this.blockChange = true; // Prevent text change events from triggering the socket.io event
        this.editor.setValue(data.text); // Set the editor value

        for (let userID in data.users) {
            let user = data.users[userID];
            this.userJoin(user);
        };
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

            window.onresize = () => {
                this.editor.layout(); 
            }; 
        }
    }, 0); 
}

MonacoLiveEditor.prototype.joinWorkspace = function(workspace) {
    this.joinWorkspaceInterval = setInterval(() => {
        if (window.monaco) {
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

MonacoLiveEditor.prototype.userJoin = function() {}