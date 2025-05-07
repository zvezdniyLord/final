document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("form");
    form.addEventListener("submit", formSend);
  
    async function formSend(e) {
      e.preventDefault();
  
      let error = formValidate(form);
      const formData = new FormData(form);
  
      if (error === 0) {
        try {
          const payload = {
            email: form.querySelector('[name="email"]').value,
            company: form.querySelector('[name="company"]').value,
            message: form.querySelector('[name="message"]').value,
            tel: form.querySelector('[name="tel"]').value,
            select: form.querySelector('[name="select"]').value,
            name: form.querySelector('[name="name"]').value,
          };
  
          const response = await fetch("./php.php", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
  
          if (response.ok) {
            const result = await response.json();
            console.log("Form submitted successfully:", result);
            alertSendForm(
              form.querySelector(".btn__product-submit"),
              "Сообщение отправлено"
            );
            form.reset();
          } else {
            throw new Error(`Server responded with status: ${response.status}`);
          }
        } catch (err) {
          console.log(response);
          console.error("Form submission error:", err);
          alertSendForm(form.querySelector(".btn__product-submit"), "Ошибка");
        }
  
        setTimeout(() => {
          alertSendForm(
            form.querySelector(".btn__product-submit"),
            "Отправить запрос"
          );
        }, 1500);
      }
    }
  });
  
  function formValidate(form) {
    let error = 0;
    const requiredFields = form.querySelectorAll("[required]");
    const captchaInput = form.querySelector(".form__captcha-input");
    const warning = form.querySelector(".captcha__warning");
    const captchaChar = form.querySelector(".captcha__char")?.innerHTML;
  
    // Validate required fields
    requiredFields.forEach((field) => {
      if (!field.value.trim()) {
        error++;
        field.classList.add("error");
      } else {
        field.classList.remove("error");
      }
    });
  
    // Validate captcha
    if (captchaInput && captchaChar) {
      if (captchaInput.value !== captchaChar) {
        error++;
        warning.style.display = "block";
        captchaInput.value = "";
      } else {
        warning.style.display = "none";
      }
    }
  
    return error;
  }
  
  function alertSendForm(element, value) {
    if (element) {
      element.value = value;
    }
  }
  
  function createCaptcha(text) {
    if (typeof text !== "string") return;
  
    const inputText = document.querySelector(".form__captcha-target");
    if (!inputText) return;
  
    const maxIndex = parseInt(inputText.dataset.value) || 8;
    const randomIndex = Math.floor(Math.random() * maxIndex);
  
    const innerHTML = inputText.innerHTML;
    const newInnerHTML =
      innerHTML.substring(0, randomIndex) +
      `<span class='captcha__char'>${innerHTML.charAt(randomIndex)}</span>` +
      innerHTML.substring(randomIndex + 1);
  
    inputText.innerHTML = newInnerHTML;
  }
  
  // Initialize captcha
  createCaptcha("e");
  
  // Initialize abort controller
  let controller = new AbortController();
  