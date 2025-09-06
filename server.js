// Import modul yang diperlukan
const express = require('express');
const path = require('path');
const moment = require('moment-timezone');
const { kv } = require('@vercel/kv');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


// --- Helper Functions ---

/**
 * Mengubah input amount menjadi angka yang valid
 * @param {string|number} amount - Input amount yang bisa berupa "1.000", "1k", "1.000.000", dll
 * @returns {number} - Angka yang sudah dikonversi
 */
function parseAmount(amount) {
    if (typeof amount === 'number') {
        return amount;
    }
    
    let amountStr = String(amount).toLowerCase().trim();
    
    // Handle format "k" (ribuan)
    if (amountStr.includes('k')) {
        const numPart = amountStr.replace('k', '').replace(/\./g, '');
        const num = parseFloat(numPart);
        return isNaN(num) ? 0 : num * 1000;
    }
    
    // Handle format "m" (jutaan)
    if (amountStr.includes('m')) {
        const numPart = amountStr.replace('m', '').replace(/\./g, '');
        const num = parseFloat(numPart);
        return isNaN(num) ? 0 : num * 1000000;
    }
    
    // Handle format dengan titik sebagai pemisah ribuan (1.000, 1.000.000, dll)
    // Hapus semua titik dan konversi ke number
    const cleanAmount = amountStr.replace(/\./g, '');
    const num = parseFloat(cleanAmount);
    
    return isNaN(num) ? 0 : num;
}

/**
 * Mengambil data mutasi dari Vercel KV.
 * @returns {Promise<Array>}
 */
async function getMutasiData() {
    const data = await kv.get('mutasi_data');
    return data || [];
}

/**
 * Menyimpan data mutasi ke Vercel KV.
 * @param {Array} data
 */
async function saveMutasiData(data) {
    await kv.set('mutasi_data', data);
}

/**
 * Mengambil metadata (seperti tanggal reset terakhir) dari Vercel KV.
 * @returns {Promise<Object>}
 */
async function getMetaData() {
    const meta = await kv.get('app_metadata');
    return meta || { lastResetDate: null };
}

/**
 * Menyimpan metadata ke Vercel KV.
 * @param {Object} meta
 */
async function saveMetaData(meta) {
    await kv.set('app_metadata', meta);
}


// --- Rute API ---

// Rute untuk mendapatkan statistik
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
        data_hari_ini: dataHariIni,
        // Kita kirim jumlah data sebagai representasi penggunaan storage
        storage_usage: totalData 
    });
});

// Rute untuk mengunggah data baru
app.post('/upload', async (req, res) => {
    const { amount, bank } = req.body;

    if (amount === undefined || amount === null || !bank) {
        return res.status(400).json({ status: "error", message: "Data tidak lengkap." });
    }

    // Pastikan amount adalah number dan proses menjadi integer
    if (typeof amount !== 'number' || isNaN(amount)) {
        return res.status(400).json({ status: "error", message: "Amount harus berupa angka." });
    }

    const parsedAmount = parseAmount(amount);
    
    if (parsedAmount <= 0) {
        return res.status(400).json({ status: "error", message: "Amount harus lebih dari 0." });
    }

    moment.locale('id');
    const timeDateStr = moment().tz('Asia/Jakarta').format('HH:mm:ss, dddd, D MMMM YYYY');

    // Menambahkan 'type: "CR"' pada setiap entri baru dengan amount yang sudah diparsing
    const newEntry = { amount: parsedAmount, bank, type: "CR", time_date: timeDateStr };

    const mutasiData = await getMutasiData();
    mutasiData.push(newEntry);
    await saveMutasiData(mutasiData);

    res.status(201).json({ 
        status: "success", 
        message: "Data berhasil ditambahkan"
    });
});

// Rute untuk menampilkan data mentah
app.get('/mutasi.json', async (req, res) => {
    const data = await getMutasiData();
    res.json(data);
});

// Rute BARU untuk mereset data secara manual
app.post('/api/reset', async (req, res) => {
    try {
        await saveMutasiData([]); // Mengosongkan data
        await saveMetaData({ lastResetDate: moment().toISOString() }); // Set tanggal reset
        res.status(200).json({ status: 'success', message: 'Semua data berhasil direset.' });
    } catch (error) {
        console.error("Error resetting data:", error);
        res.status(500).json({ status: 'error', message: 'Gagal mereset data.' });
    }
});


// --- Rute untuk Vercel Cron Job ---

// Endpoint ini akan dipanggil oleh Vercel setiap hari
app.get('/api/cron/reset-data', async (req, res) => {
    const meta = await getMetaData();
    const { lastResetDate } = meta;

    // Jika belum pernah direset, set tanggal hari ini dan keluar
    if (!lastResetDate) {
        await saveMetaData({ lastResetDate: moment().toISOString() });
        return res.status(200).send('Tanggal reset awal telah diatur.');
    }

    const now = moment();
    const lastReset = moment(lastResetDate);
    const daysSinceLastReset = now.diff(lastReset, 'days');

    // Cek apakah sudah 15 hari atau lebih
    if (daysSinceLastReset >= 15) {
        await saveMutasiData([]); // Reset data
        await saveMetaData({ lastResetDate: now.toISOString() }); // Perbarui tanggal reset
        console.log(`AUTO RESET: Data direset karena sudah ${daysSinceLastReset} hari.`);
        return res.status(200).send(`Data berhasil direset otomatis setelah ${daysSinceLastReset} hari.`);
    }

    console.log(`AUTO RESET CHECK: Belum 15 hari. Baru ${daysSinceLastReset} hari sejak reset terakhir.`);
    return res.status(200).send(`Belum waktunya reset. Baru ${daysSinceLastReset} hari.`);
});


// --- Menjalankan Server ---
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
