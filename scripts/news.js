const newsBlock = document.querySelector('.news__blocks');
const inputFile = document.querySelector('.input-file').value;
const inputTitle = document.querySelector(".input-title").value
const inputText = document.querySelector(".input-text").value
const btnCreate = document.querySelector(".btn-create");

btnCreate.addEventListener("click", (inputFile, inputTitle, inputText) => console.log(inputFile, inputTitle, inputText));

const createNews = (img, title, text) => {
    newsBlock.insertAdjacentHTML("beforeend", 
    `
    <div class="news-hover">
         <div class="news__block">
            <picture>
                <img loading="lazy" class="news__block-image" src="${img}" alt="баннер">
            </picture>
            <h3 class="news__block-title">${title}</h3>
            <p class="news__block-text" style="margin-top: 0.7rem">${text}</p>
            <p class="news__block-text">${new Date().getDate()} 0${new Date().getMonth()} ${new Date().getFullYear()}</p>
        </div>
    </div>
    `
    );
    console.log(title, text);
    return news;
};

createNews("../media/alrosa.svg", "Заголовок новости", 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Quam nihil veniam aut perferendis molestias? Molestias, excepturi, nobis corrupti ea repudiandae delectus rem aliquid maiores aperiam veniam sunt, soluta eum cum?');
createNews("../media/eset.png", "Заголовок новости", 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Quam nihil veniam aut perferendis molestias? Molestias, excepturi, nobis corrupti ea repudiandae delectus rem aliquid maiores aperiam veniam sunt, soluta eum cum?');
createNews("../media/alt-linux.png", "Заголовок новости", 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Quam nihil veniam aut perferendis molestias? Molestias, excepturi, nobis corrupti ea repudiandae delectus rem aliquid maiores aperiam veniam sunt, soluta eum cum?');