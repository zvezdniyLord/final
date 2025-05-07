const btnMode = document.querySelector('.btn__list__products-active');
const btnListSelector = document.querySelector('.btn__list-selector');
const listProductsBlocks = document.querySelector('.list__products-blocks');

btnMode.addEventListener('click', openListProducts);
btnListSelector.addEventListener('click', openListProducts);

function openListProducts() {
    if(listProductsBlocks.classList.contains('list__products-blocks')) {
        listProductsBlocks.classList.remove('list__products-blocks');
        btnListSelector.classList.add('rotate');
        listProductsBlocks.classList.add('list__products-blocks-block');
    } else {
        btnListSelector.classList.remove('rotate');
        listProductsBlocks.classList.remove('list__products-blocks-block');
        listProductsBlocks.classList.add('list__products-blocks');
    }
}

