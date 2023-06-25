"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const puppeteer_1 = __importDefault(require("puppeteer"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const zod_1 = __importDefault(require("zod"));
const app = (0, express_1.default)();
app.use(express_1.default.urlencoded({ extended: false }));
app.use(express_1.default.json());
app.use((0, cors_1.default)());
const loginSchema = zod_1.default.object({
    login: zod_1.default.string().min(6).max(255),
    senha: zod_1.default.string().min(6).max(255),
});
app.post("/siga/api/v1", async (req, res) => {
    try {
        const { login, senha } = loginSchema.parse(req.body);
        console.log("opening the browser");
        const browser = await puppeteer_1.default.launch({
            // executablePath: "/usr/bin/chromium-browser",
            headless: false,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        fazerLogin(login, senha, browser)
            .then((usuario) => {
                res.send(usuario);
            })
            .catch((err) => {
                res.send("Ocorreu um erro, verifique o login e a senha!");
                console.log(err);
            })
            .finally(() => {
                console.log("closing the browser");
                browser.close();
            });
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            res.send("Login ou senha inválidos!");
        }
    }
});
app.listen(3333, () => {
    console.log(`Servidor iniciado na porta 3333`);
});
async function fazerLogin(login, senha, browser) {
    const page = await browser.newPage();
    await page.goto("https://siga.cps.sp.gov.br/aluno/login.aspx");
    //wait for 1 second
    await page.waitForFunction(() => {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(resolve);
            }, 1000); // 1000 milliseconds = 1 second
        });
    });
    await page.waitForSelector("#vSIS_USUARIOID", { timeout: 18500 });
    await page.waitForSelector("#vSIS_USUARIOSENHA", { timeout: 18500 });
    await page.type("#vSIS_USUARIOID", login, { delay: 50 });
    await page.type("#vSIS_USUARIOSENHA", senha, { delay: 50 });
    await page.click(".Button");
    await page.waitForNavigation({ timeout: 18500 });
    let nomeAluno = await page.$eval("#span_MPW0041vPRO_PESSOALNOME", (element) => {
        if (element && element.textContent) {
            return element.textContent.trim().replace(/-$/, "");
        }
        return "Nome não encontrado";
    });
    const emailUsuario = await page.$eval("#span_MPW0041vINSTITUCIONALFATEC", (element) => {
        if (element && element.textContent) {
            return element.textContent.trim();
        }
        return "Email não encontrado";
    });
    const raAluno = await page.$eval("#span_MPW0041vACD_ALUNOCURSOREGISTROACADEMICOCURSO", (element) => {
        if (element && element.textContent) {
            return element.textContent.trim();
        }
        return "RA não encontrado";
    });
    const semestreAluno = await page.$eval("#span_MPW0041vACD_ALUNOCURSOCICLOATUAL", (element) => {
        if (element && element.textContent) {
            return element.textContent.trim();
        }
        return "Semestre não encontrado";
    });
    const fotoElement = await page.$('img[width="129"]');
    const fotoAluno = await fotoElement?.evaluate((element) => element.getAttribute("src"));
    await page.goto("https://siga.cps.sp.gov.br/aluno/notasparciais.aspx");
    const notasAluno = [];
    for (let i = 1; i <= 7; i++) {
        const nomeDisciplina = await page.$eval(`#span_vACD_DISCIPLINANOME_000${i}`, (element) => element.textContent?.trim());
        const notaDisciplina = await page.$eval(`#span_vACD_ALUNOHISTORICOITEMMEDIAFINAL_000${i}`, (element) => element.textContent?.trim());
        let estadoDisciplina;
        if (notaDisciplina) {
            if (notaDisciplina === "0" || notaDisciplina === "0,0") {
                estadoDisciplina = "https://i.imgur.com/43IRcGx.png";
            }
            else if (parseFloat(notaDisciplina) >= 6) {
                estadoDisciplina = "https://i.imgur.com/PzHSErR.png";
            }
            else {
                estadoDisciplina = "https://i.imgur.com/RDrgYjV.png";
            }
        }
        notasAluno.push({
            disciplina: nomeDisciplina,
            nota: notaDisciplina,
            estado: estadoDisciplina,
        });
    }
    await page.goto("https://siga.cps.sp.gov.br/aluno/faltasparciais.aspx");
    const faltasAluno = [];
    for (let i = 1; i <= 7; i++) {
        const nomeDisciplina = await page.$eval(`#span_vACD_DISCIPLINANOME_000${i}`, (element) => element.textContent?.trim());
        const presencaDisciplina = await page.$eval(`#span_vPRESENCAS_000${i}`, (element) => element.textContent?.trim());
        const faltaDisciplina = await page.$eval(`#span_vAUSENCIAS_000${i}`, (element) => element.textContent?.trim());
        faltasAluno.push({
            disciplina: nomeDisciplina,
            presenca: presencaDisciplina,
            faltas: faltaDisciplina,
        });
    }
    await browser.close();
    function nome(nomeCompleto) {
        const nomes = nomeCompleto.split(" ");
        const primeiroNome = nomes.shift();
        const segundoNome = nomes.shift();
        const ultimoNome = nomes.pop();
        return `${primeiroNome} ${segundoNome} ${ultimoNome}`;
    }
    return {
        nome: nome(await nomeAluno.trimEnd()),
        foto: fotoAluno?.includes("padrao.jpg")
            ? "https://i.imgur.com/KtL3zzZ.png"
            : fotoAluno,
        email: emailUsuario,
        ra: raAluno,
        semestre: semestreAluno,
        notas: notasAluno,
        faltas: faltasAluno,
    };
}
