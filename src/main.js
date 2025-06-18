const fs = require('fs').promises;
const path = require('path');
const nodemailer = require('nodemailer');

// Fungsi untuk memproses spintax
function parseSpintax(text) {
    const spintaxRegex = /\{([^{}]+)\}/g;
    while (spintaxRegex.test(text)) {
        text = text.replace(spintaxRegex, (match, choices) => {
            const options = choices.split('|');
            return options[Math.floor(Math.random() * options.length)];
        });
    }
    return text;
}

// Fungsi untuk mengkapitalisasi setiap kata
function capitalizeEachWord(str) {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

async function main() {
    try {
        console.log("Skrip dimulai...");

        // --- 1. Membaca semua file yang dibutuhkan ---
        const statePath = path.join(__dirname, '..', 'state.json');
        const keywordPath = path.join(__dirname, '..', 'keyword.txt');
        const emailPath = path.join(__dirname, '..', 'email.txt');
        const articlePath = path.join(__dirname, '..', 'artikel.txt');

        const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
        const keywords = (await fs.readFile(keywordPath, 'utf8')).split('\n').filter(k => k.trim() !== '');
        const bloggerEmail = (await fs.readFile(emailPath, 'utf8')).trim();
        const articleTemplate = await fs.readFile(articlePath, 'utf8');

        // --- 2. LOGIKA BARU: Langsung ambil keyword berikutnya ---
        const nextIndex = state.lastPostedIndex + 1;
        if (nextIndex >= keywords.length) {
            console.log("Semua keyword sudah diposting. Selesai.");
            return; // Hentikan jika semua keyword sudah terpakai
        }

        const keyword = keywords[nextIndex].trim();
        const seoTitle = `5 Ide ${capitalizeEachWord(keyword)} Terbaik Tahun Ini`;
        console.log(`Mempersiapkan posting untuk keyword: "${keyword}"`);

        // --- 3. Membuat Konten dari Template Spintax ---
        let finalArticle = parseSpintax(articleTemplate);
        finalArticle = finalArticle.replace(/%%KEYWORD%%/g, capitalizeEachWord(keyword));
        finalArticle = finalArticle.replace(/%%TITLE%%/g, seoTitle);

        // --- 4. Mengirim Email ke Blogger ---
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        const mailOptions = {
            from: `"Bot Blogger Kamu" <${process.env.SMTP_USER}>`,
            to: bloggerEmail,
            subject: seoTitle,
            html: finalArticle.replace(/\n/g, '<br>')
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email untuk keyword "${keyword}" berhasil dikirim.`);

        // --- 5. Memperbarui State ---
        state.lastPostedIndex = nextIndex;
        await fs.writeFile(statePath, JSON.stringify(state, null, 2));
        console.log(`File state.json berhasil diperbarui. Indeks terakhir sekarang: ${nextIndex}`);

    } catch (error) {
        console.error("Terjadi kesalahan:", error);
        process.exit(1);
    }
}

main();
