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
        // --- 1. Membaca semua file yang dibutuhkan ---
        const statePath = path.join(__dirname, '..', 'state.json');
        const keywordPath = path.join(__dirname, '..', 'keyword.txt');
        const emailPath = path.join(__dirname, '..', 'email.txt');
        const articlePath = path.join(__dirname, '..', 'artikel.txt');

        const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
        const keywords = (await fs.readFile(keywordPath, 'utf8')).split('\n').filter(k => k.trim() !== '');
        const bloggerEmail = (await fs.readFile(emailPath, 'utf8')).trim();
        const articleTemplate = await fs.readFile(articlePath, 'utf8');

        // --- 2. Validasi Tanggal dan Interval ---
        const now = new Date();
        const startDate = new Date(state.startDate);
        const endDate = new Date(state.endDate);

        if (now < startDate || now > endDate) {
            console.log("Di luar rentang tanggal posting. Skrip dihentikan.");
            return;
        }

        // --- 3. Menentukan Keyword Selanjutnya ---
        const nextIndex = state.lastPostedIndex + 1;
        if (nextIndex >= keywords.length) {
            console.log("Semua keyword sudah diposting. Selesai.");
            return;
        }

        const keyword = keywords[nextIndex].trim();
        const seoTitle = `5 Ide ${capitalizeEachWord(keyword)} Terbaik Tahun Ini`;

        // --- 4. Membuat Konten dari Template Spintax ---
        let finalArticle = parseSpintax(articleTemplate);
        finalArticle = finalArticle.replace(/%%KEYWORD%%/g, capitalizeEachWord(keyword));
        finalArticle = finalArticle.replace(/%%TITLE%%/g, seoTitle);

        // --- 5. Mengirim Email ke Blogger ---
        // Gunakan GitHub Secrets untuk menyimpan kredensial email Anda!
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com', // Ganti dengan host SMTP Anda
            port: 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER, // Variabel dari GitHub Secrets
                pass: process.env.SMTP_PASS  // Variabel dari GitHub Secrets
            }
        });

        const mailOptions = {
            from: `"Bot Blogger Kamu" <${process.env.SMTP_USER}>`,
            to: bloggerEmail,
            subject: seoTitle,
            html: finalArticle.replace(/\n/g, '<br>') // Ubah baris baru menjadi tag <br>
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email untuk keyword "${keyword}" berhasil dikirim ke ${bloggerEmail}`);

        // --- 6. Memperbarui State ---
        state.lastPostedIndex = nextIndex;
        await fs.writeFile(statePath, JSON.stringify(state, null, 2));
        console.log(`File state.json berhasil diperbarui. Indeks terakhir: ${nextIndex}`);

    } catch (error) {
        console.error("Terjadi kesalahan:", error);
        process.exit(1); // Keluar dengan kode error agar GitHub Action gagal
    }
}

main();
