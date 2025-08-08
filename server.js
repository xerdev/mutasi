// Import modul yang diperlukan
const express = require('express');
const path = require('path');
const moment = require('moment-timezone');
// Import Vercel KV SDK
const { kv } = require('@vercel/kv');

// Inisialisasi aplikasi Express
const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


// --- Helper Functions (Menggunakan Vercel KV) ---

/**
 * Mengambil data dari Vercel KV.
 * @returns {Promise<Array>} Sebuah promise yang resolve dengan array data mutasi.
 */
async function getMutasiData() {
    // Mengambil data dari KV store dengan kunci 'mutasi_data'
    // Jika kunci tidak ada, akan mengembalikan null, jadi kita ganti dengan []
    const data = await kv.get('mutasi_data');
    return data || [];
}

/**
 * Menyimpan data ke Vercel KV.
 * @param {Array} data Data yang akan disimpan.
 */
async function saveMutasiData(data) {
    // Menyimpan data ke KV store dengan kunci 'mutasi_data'
    await kv.set('mutasi_data', data);
}


// --- Rute API (Logika tetap sama, hanya helper function yang berubah) ---

app.get('/api/stats', async (req, res) => {
    const mutasiData = await getMutasiData();
    const totalData = mutasiData.length;

    moment.locale('id');
    const todayStr = moment().tz('Asia/Jakarta').format('D MMMM YYYY');

    const dataHariIni = mutasiData.filter(item => {
        if (!item.time_date) return false;
        const itemDateStr = item.time_date.split(', ')[2];
        return itemDateStr === todayStr;
    }).length;

    res.json({
        total_data: totalData,
        data_hari_ini: dataHariIni
    });
});

app.post('/upload', async (req, res) => {
    const { name, wallet, amount } = req.body;

    if (!name || !wallet || !amount) {
        return res.status(400).json({
            status: "error",
            message: "Data tidak lengkap. 'name', 'wallet', dan 'amount' diperlukan."
        });
    }

    moment.locale('id');
    const timeDateStr = moment().tz('Asia/Jakarta').format('HH:mm:ss, dddd, D MMMM YYYY');

    const newEntry = { name, wallet, amount, time_date: timeDateStr };

    // Proses: Ambil data lama, tambahkan entri baru, simpan kembali
    const mutasiData = await getMutasiData();
    mutasiData.push(newEntry);
    await saveMutasiData(mutasiData); // Menyimpan array yang sudah diperbarui

    res.status(201).json({
        status: "success",
        message: "Data berhasil ditambahkan"
    });
});

app.get('/mutasi.json', async (req, res) => {
    const data = await getMutasiData();
    res.json(data);
});


// --- Menjalankan Server ---
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
