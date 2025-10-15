let parentElement = document.getElementById("editor"); 
let editor = new MonacoLiveEditor(parentElement); 

function joinWorkspace() {
    let workspace = document.getElementById("workspace").value;
    editor.joinWorkspace(workspace); 

    // Show a prompt to enter the token
    let token = prompt('Enter the token for write permissions (in the example, the token is "1234" without quotes):');
    editor.authenticate(token); 
}

editor.onError = (error) => {
    alert(error); 
}; 