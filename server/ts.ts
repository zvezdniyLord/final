type List<T> = T[];
type FlourGrams = number;
type WaterGrams = number;
type ErrorHandler = 'Введите положительные число/числа';

type Pizza = {
    flour: FlourGrams;
    water: WaterGrams;
};

function calculatePizza(countPizza: number, hydrationDough: number): Pizza | {error: ErrorHandler} {
    if(countPizza <= 0 || hydrationDough <= 0) {
        return {error: "Введите положительные число/числа"};
    };

    const DOUGH = 0.4 * countPizza;
    const OLIVEOIL = 10;
    const SALT = 7;

    const ALL_INGRIDIENTS = DOUGH + OLIVEOIL + SALT;

    const WEIGHT = 350;
    const H = hydrationDough / 100;

    const flourPerPizza = WEIGHT / (1 + H);
    const waterPerPizza = flourPerPizza * H;

    const totalFlour = (flourPerPizza * countPizza) - ALL_INGRIDIENTS;
    const totalWater = (waterPerPizza * countPizza) - ALL_INGRIDIENTS;

    return {
        flour: totalFlour,
        water: totalWater,
    };
}

const pizza = calculatePizza(2, 55);
console.log(pizza)
