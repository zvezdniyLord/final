const formLK = document.querySelector("form");

const inputFIO = document.querySelector(".l1").value = localStorage.getItem('fio');
const inputTel = document.querySelector(".l2").value = localStorage.getItem('tel');
const inputPWD = document.querySelector(".l3").value = localStorage.getItem('password');
const inputCompany = document.querySelector(".l4").value = localStorage.getItem('company');
const inputDolgnost = document.querySelector(".l5").value = localStorage.getItem('position');
const inputEmail = document.querySelector(".l6").value = localStorage.getItem('email');
const inputCity = document.querySelector(".l7").value = localStorage.getItem('city');

async function formSend(e) {
    e.preventDefault();
    const inputFIO = document.querySelector(".l1").value;
    const inputTel = document.querySelector(".l2").value;
    const inputPWD = document.querySelector(".l3").value;
    const inputCompany = document.querySelector(".l4").value;
    const inputDolgnost = document.querySelector(".l5").value;
    const inputEmail = document.querySelector(".l6").value;
    //const formData = new FormData(formLK);

    document.querySelector('.btn-save-data').textContent = 'Успешно';

      const response = await fetch('http://localhost:8087/lk/', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: inputFIO,
          password: inputTel,
          company: inputPWD,
          dolgnost: inputCompany,
          email: inputDolgnost,
          country: inputEmail,
          city: 2
        }),
      });
      if (response.ok) {
        const result = await response.json();
        console.log(result);
      } else {
        console.log(`response ne ok`);
        document.querySelector('.btn-save-data').textContent = 'Ошибка';
      }
    }

formLK.addEventListener("submit", formSend);
