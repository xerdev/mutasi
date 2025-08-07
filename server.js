// Import modul yang diperlukan
const express = require('express');
const fs = require('fs').promises; // Menggunakan fs/promises untuk async/await
const path = require('path');
const moment = require('moment-timezone');

// Inisialisasi aplikasi Express
const app = express();
const PORT = process.env.PORT || 3000; // Gunakan port 3000

const JSON_FILE_PATH = path.join(__dirname, 'mutasi.json');

// --- Middleware ---
// Middleware untuk parsing body request sebagai JSON
app.use(express.json());
// Middleware untuk menyajikan file statis dari folder 'public' (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));


// --- Helper Functions ---

/**
 * Membaca data dari file mutasi.json secara asynchronous.
 * @returns {Promise<Array>} Sebuah promise yang resolve dengan array data mutasi.
 */
async function getMutasiData() {
    try {
        await fs.access(JSON_FILE_PATH); // Cek apakah file ada
        const data = await fs.readFile(JSON_FILE_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        // Jika file tidak ada atau ada error parsing, kembalikan array kosong.
        if (error.code === 'ENOENT') {
            return []; // File not found
        }
        console.error("Error reading or parsing mutasi.json:", error);
        return [];
    }
}

/**
 * Menyimpan data ke file mutasi.json secara asynchronous.
 * @param {Array} data Data yang akan disimpan.
 */
async function saveMutasiData(data) {
    try {
        await fs.writeFile(JSON_FILE_PATH, JSON.stringify(data, null, 4), 'utf-8');
    } catch (error) {
        console.error("Error writing to mutasi.json:", error);
    }
}


// --- Rute API ---

// Rute untuk halaman utama (/) akan otomatis dilayani oleh express.static

/**
 * Rute GET /api/stats
 * Memberikan data statistik untuk ditampilkan di frontend.
 */
app.get('/api/stats', async (req, res) => {
    const mutasiData = await getMutasiData();
    const totalData = mutasiData.length;

    // Set locale moment ke Bahasa Indonesia untuk nama hari dan bulan
    moment.locale('id'); 
    const todayStr = moment().tz('Asia/Jakarta').format('D MMMM YYYY');

    const dataHariIni = mutasiData.filter(item => {
        if (!item.time_date) return false;
        // Ekstrak tanggal dari format "22:00:17, Kamis, 8 Agustus 2025"
        const itemDateStr = item.time_date.split(', ')[2];
        return itemDateStr === todayStr;
    }).length;

    res.json({
        total_data: totalData,
        data_hari_ini: dataHariIni
    });
});

/**
 * Rute POST /upload
 * Menerima data baru dan menyimpannya ke mutasi.json.
 */
app.post('/upload', async (req, res) => {
    const { name, wallet, amount } = req.body;

    // Validasi input
    if (!name || !wallet || !amount) {
        return res.status(400).json({
            status: "error",
            message: "Data tidak lengkap. 'name', 'wallet', dan 'amount' diperlukan."
        });
    }

    // Set locale moment ke Bahasa Indonesia
    moment.locale('id');
    // Format tanggal dan waktu sesuai permintaan di zona waktu Asia/Jakarta
    const timeDateStr = moment().tz('Asia/Jakarta').format('HH:mm:ss, dddd, D MMMM YYYY');

    const newEntry = {
        name,
        wallet,
        amount,
        time_date: timeDateStr
    };

    const mutasiData = await getMutasiData();
    mutasiData.push(newEntry);
    await saveMutasiData(mutasiData);

    res.status(201).json({
        status: "success",
        message: "Data berhasil ditambahkan"
    });
});

/**
 * Rute GET /mutasi.json
 * Menampilkan konten dari file mutasi.json.
 */
app.get('/mutasi.json', async (req, res) => {
    const data = await getMutasiData();
    res.json(data);
});


// --- Menjalankan Server ---
app.listen(PORT, async () => {
    // Pastikan file mutasi.json ada saat server pertama kali jalan
    try {
        await fs.access(JSON_FILE_PATH);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await saveMutasiData([]); // Buat file kosong jika tidak ada
        }
    }
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
