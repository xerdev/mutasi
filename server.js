const express = require('express');
const moment = require('moment-timezone');

const app = express();
const PORT = process.env.PORT || 3000;
const data = [];

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


async function getMutasiData() {
    return data;
}

async function saveMutasiData(newData) {
    data.length = 0;
    data.push(...newData);
}

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
    const mutasiData = await getMutasiData();
    mutasiData.push(newEntry);
    await saveMutasiData(mutasiData);
    res.status(201).json({
        status: "success",
        message: "Data berhasil ditambahkan"
    });
});

app.get('/mutasi.json', async (req, res) => {
    const mutasiData = await getMutasiData();
    res.json(mutasiData);
});

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
