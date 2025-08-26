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
                alert("Login failed! Please check your username and password or try logging in as a guest (no password)."); 
                location.reload();
                return; 
            }

            if (eventName === "login-success") {
                document.getElementById("taskbar").style.display = ""; // Show taskbar

                document.getElementById("image").src = params.image;
                document.getElementById("name").textContent = params.name;
                document.getElementById("name").style.color = `rgb(${params.color.join(",")})`;
                document.getElementById("rights").textContent = params.writePermission ? "full" : "read";
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