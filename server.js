const express = require('express');
const moment = require('moment-timezone');

const app = express();
const PORT = process.env.PORT || 3000;
const data = [];

app.use(express.json());
app.use(express.static('public'));

app.get('/api/stats', (req, res) => {
    const totalData = data.length;
    moment.locale('id');
    const todayStr = moment().tz('Asia/Jakarta').format('D MMMM YYYY');
    const dataHariIni = data.filter(item => {
        if (!item.time_date) return false;
        const itemDateStr = item.time_date.split(', ')[2];
        return itemDateStr === todayStr;
    }).length;
    res.json({ total_data: totalData, data_hari_ini: dataHariIni });
});

app.post('/upload', (req, res) => {
    const { name, wallet, amount } = req.body;
    if (!name || !wallet || !amount) {
        return res.status(400).json({ status: "error", message: "Data tidak lengkap. 'name', 'wallet', dan 'amount' diperlukan." });
    }
    moment.locale('id');
    const timeDateStr = moment().tz('Asia/Jakarta').format('HH:mm:ss, dddd, D MMMM YYYY');
    data.push({ name, wallet, amount, time_date: timeDateStr });
    res.status(201).json({ status: "success", message: "Data berhasil ditambahkan" });
});

app.get('/mutasi.json', (req, res) => {
    res.json(data);
});

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
