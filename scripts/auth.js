const svgAuth = document.querySelector('.svg__auth');
let formAuthPassword = document.querySelector('.form__auth-password');
svgAuth.addEventListener('click', switchTypeInput);

function switchTypeInput() {
    if(formAuthPassword.type === "password") {
        formAuthPassword.type = "text";
    } else {
        formAuthPassword.type = "password";
    }
}

