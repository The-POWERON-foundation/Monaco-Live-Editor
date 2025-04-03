let parentElement = document.getElementById("editor"); 
let editor = new MonacoLiveEditor(parentElement); 
editor.joinWorkspace("test.js"); 

editor.onError = (error) => {
    alert(error); 
}; 