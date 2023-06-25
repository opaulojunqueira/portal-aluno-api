const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.post('/siga/api/v1', (req, res) => {
    const { login, senha } = req.body;

    fazerLogin(login, senha)
        .then(usuario => {
            res.send(usuario);
        })
        .catch(err => {
            res.send('Ocorreu um erro, tente novamente mais tarde!');
        });
});

app.listen(9091, () => {
    console.log(`Servidor iniciado na porta 9091`);
});

async function fazerLogin(login, senha) {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    await page.goto('https://siga.cps.sp.gov.br/aluno/login.aspx');

    await page.type('#vSIS_USUARIOID', login);
    await page.type('#vSIS_USUARIOSENHA', senha);

    await page.click('.Button');

    await page.waitForNavigation({ timeout: 18500 });

    const nomeAluno = await page.$eval('#span_MPW0041vPRO_PESSOALNOME', element => element.textContent.trim().replace(/-$/, ''));
    const emailUsuario = await page.$eval('#span_MPW0041vINSTITUCIONALFATEC', element => element.textContent.trim());
    const raAluno = await page.$eval('#span_MPW0041vACD_ALUNOCURSOREGISTROACADEMICOCURSO', element => element.textContent.trim());
    const semestreAluno = await page.$eval('#span_MPW0041vACD_ALUNOCURSOCICLOATUAL', element => element.textContent.trim());
    const fotoElement = await page.$('img[width="129"]');
    const fotoAluno = await fotoElement.evaluate(element => element.getAttribute('src'));

    await page.goto('https://siga.cps.sp.gov.br/aluno/notasparciais.aspx');

    const notasAluno = [];

    for (let i = 1; i <= 7; i++) {
        const nomeDisciplina = await page.$eval(`#span_vACD_DISCIPLINANOME_000${i}`, element => element.textContent.trim());
        const notaDisciplina = await page.$eval(`#span_vACD_ALUNOHISTORICOITEMMEDIAFINAL_000${i}`, element => element.textContent.trim());
        let estadoDisciplina;

        if (notaDisciplina === '0' || notaDisciplina === '0,0') {
            estadoDisciplina = 'https://i.imgur.com/43IRcGx.png';
        } else if (parseFloat(notaDisciplina) >= 6) {
            estadoDisciplina = 'https://i.imgur.com/PzHSErR.png';
        } else {
            estadoDisciplina = 'https://i.imgur.com/RDrgYjV.png';
        }

        notasAluno.push({
            disciplina: nomeDisciplina,
            nota: notaDisciplina,
            estado: estadoDisciplina
        });
    }

    await page.goto('https://siga.cps.sp.gov.br/aluno/faltasparciais.aspx');

    const faltasAluno = [];

    for (let i = 1; i <= 7; i++) {
        const nomeDisciplina = await page.$eval(`#span_vACD_DISCIPLINANOME_000${i}`, element => element.textContent.trim());
        const presencaDisciplina = await page.$eval(`#span_vPRESENCAS_000${i}`, element => element.textContent.trim());
        const faltaDisciplina = await page.$eval(`#span_vAUSENCIAS_000${i}`, element => element.textContent.trim());

        faltasAluno.push({
            disciplina: nomeDisciplina,
            presenca: presencaDisciplina,
            faltas: faltaDisciplina
        });
    }

    await browser.close();

    function nome(nomeCompleto) {
        const nomes = nomeCompleto.split(' ');
        const primeiroNome = nomes.shift();
        const segundoNome = nomes.shift();
        const ultimoNome = nomes.pop();

        return (`${primeiroNome} ${segundoNome} ${ultimoNome}`)
    }

    return {
        nome: nome(await nomeAluno.trimEnd()),
        foto: fotoAluno.includes('padrao.jpg') ? 'https://i.imgur.com/KtL3zzZ.png' : fotoAluno,
        email: emailUsuario,
        ra: raAluno,
        semestre: semestreAluno,
        notas: notasAluno,
        faltas: faltasAluno,
    };
}
