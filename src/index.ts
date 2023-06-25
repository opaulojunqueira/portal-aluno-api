import puppeteer from "puppeteer";
import express from "express";
import cors from "cors";
import z from "zod";

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());

const loginSchema = z.object({
  login: z.string().min(6).max(255),
  senha: z.string().min(6).max(255),
});

app.post("/siga/api/v1", (req, res) => {
  try {
    const { login, senha } = loginSchema.parse(req.body);

    fazerLogin(login, senha)
      .then((usuario) => {
        res.send(usuario);
      })
      .catch((err) => {
        res.send("Ocorreu um erro, verifique o login e a senha!");
        console.log(err);
      });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.send("Login ou senha inválidos!");
    }
  }
});

app.listen(3333, () => {
  console.log(`Servidor iniciado na porta 3333`);
});

async function fazerLogin(login: string, senha: string) {
  const browser = await puppeteer.launch({
    // executablePath: "/usr/bin/chromium-browser",
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  await page.goto("https://siga.cps.sp.gov.br/aluno/login.aspx");

  await page.waitForSelector("#vSIS_USUARIOID", { timeout: 18500 });
  await page.waitForSelector("#vSIS_USUARIOSENHA", { timeout: 18500 });

  await page.type("#vSIS_USUARIOID", login, { delay: 50 });
  await page.type("#vSIS_USUARIOSENHA", senha, { delay: 50 });

  await page.click(".Button");

  await page.waitForNavigation({ timeout: 18500 });

  let nomeAluno = await page.$eval(
    "#span_MPW0041vPRO_PESSOALNOME",
    (element) => {
      if (element && element.textContent) {
        return element.textContent.trim().replace(/-$/, "");
      }
      return "Nome não encontrado";
    }
  );

  const emailUsuario = await page.$eval(
    "#span_MPW0041vINSTITUCIONALFATEC",
    (element) => {
      if (element && element.textContent) {
        return element.textContent.trim();
      }
      return "Email não encontrado";
    }
  );

  const raAluno = await page.$eval(
    "#span_MPW0041vACD_ALUNOCURSOREGISTROACADEMICOCURSO",
    (element) => {
      if (element && element.textContent) {
        return element.textContent.trim();
      }
      return "RA não encontrado";
    }
  );

  const semestreAluno = await page.$eval(
    "#span_MPW0041vACD_ALUNOCURSOCICLOATUAL",
    (element) => {
      if (element && element.textContent) {
        return element.textContent.trim();
      }
      return "Semestre não encontrado";
    }
  );
  const fotoElement = await page.$('img[width="129"]');
  const fotoAluno = await fotoElement?.evaluate((element) =>
    element.getAttribute("src")
  );

  await page.goto("https://siga.cps.sp.gov.br/aluno/notasparciais.aspx");

  const notasAluno = [];

  for (let i = 1; i <= 7; i++) {
    const nomeDisciplina = await page.$eval(
      `#span_vACD_DISCIPLINANOME_000${i}`,
      (element) => element.textContent?.trim()
    );
    const notaDisciplina = await page.$eval(
      `#span_vACD_ALUNOHISTORICOITEMMEDIAFINAL_000${i}`,
      (element) => element.textContent?.trim()
    );

    let estadoDisciplina;

    if (notaDisciplina) {
      if (notaDisciplina === "0" || notaDisciplina === "0,0") {
        estadoDisciplina = "https://i.imgur.com/43IRcGx.png";
      } else if (parseFloat(notaDisciplina) >= 6) {
        estadoDisciplina = "https://i.imgur.com/PzHSErR.png";
      } else {
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
    const nomeDisciplina = await page.$eval(
      `#span_vACD_DISCIPLINANOME_000${i}`,
      (element) => element.textContent?.trim()
    );
    const presencaDisciplina = await page.$eval(
      `#span_vPRESENCAS_000${i}`,
      (element) => element.textContent?.trim()
    );
    const faltaDisciplina = await page.$eval(
      `#span_vAUSENCIAS_000${i}`,
      (element) => element.textContent?.trim()
    );

    faltasAluno.push({
      disciplina: nomeDisciplina,
      presenca: presencaDisciplina,
      faltas: faltaDisciplina,
    });
  }

  await browser.close();

  function nome(nomeCompleto: string) {
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
