let parentElement = document.getElementById("editor"); 
let editor = new MonacoLiveEditor(parentElement); 

let username, password; 
let submit;
let form;

function onLoad() {
    popup = document.getElementById("popup");

    submit.addEventListener("click", (e) => {
        e.preventDefault(); 
        
        username = document.getElementById("username").value;
        password = document.getElementById("password").value;

        popup.style.display = "none";

        editor.joinWorkspace("example-workspace"); 

        editor.sendCustomEvent("login", {
            username: username,
            password: password
        });

        editor.onReceiveCustomEvent = (eventName, params) => {
            if (eventName === "login-fail") {
                alert("Login failed! Please check your username and password."); 
            }
        };

        editor.onError = (error) => {
            alert(error); 
        }; 
    });
}

let loadInterval = setInterval(() => {
    submit = document.getElementById("submit");
    if (submit) {
        clearInterval(loadInterval); 
        onLoad(); 
    }
}, 0); 