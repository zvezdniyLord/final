const rotateArrow = document.querySelector(".svg");
const rotateArrowSupport = document.querySelector(".svg-support");

const menuBlockProduct = document.querySelector(".menu__block-product");
const menuBlockSupports = document.querySelector(".menu__block-supports");

const productMobileList = document.querySelector(".product__mobile-list");
const supportsMobileList = document.querySelector(".supports__mobile-list");

menuBlockProduct.addEventListener("click", () => openMobileListComponents(productMobileList, rotateArrow));
menuBlockSupports.addEventListener("click", () => openMobileListComponents(supportsMobileList, rotateArrowSupport));

function openMobileListComponents(handlerClick, iconAnimate) {
    if(handlerClick.classList.contains('mobile-list')) {
        handlerClick.classList.remove('mobile-list');
        handlerClick.classList.add('mobile-list-view');
        iconAnimate.classList.add("rotate-arrow");
    } else {
        handlerClick.classList.remove('mobile-list-view');
        iconAnimate.classList.remove("rotate-arrow");
        handlerClick.classList.add('mobile-list');
    }
}

