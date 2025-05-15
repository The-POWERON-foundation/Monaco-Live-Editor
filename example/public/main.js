let parentElement = document.getElementById("editor"); 
let editor = new MonacoLiveEditor(parentElement); 

editor.joinWorkspace("example-workspace"); 

editor.onError = (error) => {
    alert(error); 
}; 