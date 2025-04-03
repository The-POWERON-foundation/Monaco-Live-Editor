let parentElement = document.getElementById("editor"); 
let editor = new MonacoLiveEditor(parentElement); 

function joinWorkspace() {
    let workspace = document.getElementById("workspace").value;
    editor.joinWorkspace(workspace); 
}

editor.onError = (error) => {
    alert(error); 
}; 