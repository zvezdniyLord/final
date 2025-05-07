const express = require("express");
const app = express();
const PORT = 8088;
const router = express.Router();
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");

/*app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());
*/
/*
const transporter = nodemailer.createTransport({
	host: "smtp.yandex.ru",
        port: 587, 
        secure: false,
	auth: {
        	user: "aadavidenkoweb@yandex.ru",
		pass: "vklwygvjagfggohn"
	},
});
*/

app.use(express.json());
app.use('/v1', router);


/*
router.post('/', async (req, res) => {
	const {email, company, message} = req.body;
	const mailOpt = {
		from: "aadavidenkoweb@yandex.ru",
		to: "4neroq4@gmail.com",
		subject: req.body.company,
		text: req.body.message
	};

	await transporter.sendMail(mailOpt, (error, info) => {
		if(error) {
		 console.log(error);
		} 
		res.status(201).json({email, company, message});
	});
	console.log(req.body.email);
});
*/


const arrMail = ["4neroq4@gmail.com", 'aadavidenkoweb@yandex.ru'];

async function sendForm(email, company, msg, name, tel, select) {
	console.log(email, company, msg);
    let secondMail = "";
	if(select === "Техническая поддержка" || select === "Интеграторам" || select === "Запрос документации" ) {
        secondMail = 'aadavidenkoweb@yandex.ru'
    };
    const transporter = await nodemailer.createTransport({
	host: "smtp.yandex.ru",      
	port: 587,      
	secure: false,
	auth: {
		user: "aadavidenkoweb@yandex.ru",
		pass: "vklwygvjagfggohn",
	}
	});
	const mailOption = {
	from: "aadavidenkoweb@yandex.ru",      
	subject: company,
	to: ['4neroq4@gmail.com', secondMail],      
	html: `
	Письмо с сайта scadaint.ru
	Письмо: ${email} ${company} ${msg} ${name} ${tel} ${select}
	`,
	};
	try {
		await transporter.sendMail(mailOption);
		return Promise.resolve("send");
	} catch(error) {
		return Promise.reject(error);
	}
};


router.post("/", async (req, res) => {
	const email = req.body.email;
	const company = req.body.company;
	const message = req.body.message;
	const name = req.body.name;
	const tel = req.body.tel;
	const select = req.body.select;
	try {
	   console.log(select);
	   await sendForm(email, company, message, name, tel, select);  
	   res.status(200).json({email, company, message, name, tel, select});
	} catch(err) {
	 console.log(err)
	}
});

/*
app.post('/v1', async (req, res) => {
	const {email, company, message} = req.body;
	await sendForm(email, company, message);
	res.status(201).json({email});
});
*/
app.listen(PORT, () => console.log(`work on port:${PORT}`));
