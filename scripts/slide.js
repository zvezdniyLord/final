const popupImage = document.querySelector(".popup-image");
const popupImage2 = document.querySelector(".popup-image-2");
const popup = document.querySelector(".popup");
const popup2 = document.querySelector(".popup-2");
const closeElement = document.querySelector(".popup-close");
const closeElement2 = document.querySelector(".popup-close-2");
let popupText = document.querySelector('.popup-description');
let popupText2 = document.querySelector('.popup-description-2');
const text = document.querySelectorAll(".visual__p");
const allImages = document.querySelectorAll('.visual__hover');
const allImages2 = document.querySelectorAll(".visual__hover-2");

const visualBlocks = document.querySelectorAll(".visual__blc");

allImages.forEach(image => {
    image.addEventListener("click", () => {
        openImage(image, popup, popupImage, popupText);
    });
});

allImages2.forEach(img => {
    img.addEventListener("click", () => openImage(img, popup2, popupImage2, popupText2));
});

closeElement.addEventListener("click", () => closeModal(popup));
closeElement2.addEventListener("click", () => closeModal(popup2));

const openImage = (newImage, popup, popupImage, popupText) => {
    popup.style.display = "flex";
    popupImage.src = newImage.src;
    popupText.innerHTML = newImage.alt;
};


