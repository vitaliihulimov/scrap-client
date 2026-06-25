require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");

const app = express();

// ====== CORS ======
const allowedOrigins = [
    "https://scrap-metal-app.onrender.com",
    "http://localhost:5173",
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (!allowedOrigins.includes(origin)) {
            return callback(new Error(`CORS policy: origin ${origin} not allowed`), false);
        }
        return callback(null, true);
    },
    credentials: true,
}));

app.use(express.json());

// ====== База даних (PostgreSQL) ======
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

console.log("🐘 Підключення до PostgreSQL...");

// ====== ІНІЦІАЛІЗАЦІЯ ТАБЛИЦЬ ======
const initDB = async () => {
    const client = await pool.connect();
    try {
        // Таблиця metals тепер зберігає поточну ціну напряму — без прив'язки до дати
        await client.query(`
            CREATE TABLE IF NOT EXISTS metals (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                current_price NUMERIC NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS contamination_rates (
                metal_name TEXT PRIMARY KEY,
                rate NUMERIC NOT NULL DEFAULT 0,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                pin TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS invoices (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                created_at TEXT,
                total INTEGER
            );

            CREATE TABLE IF NOT EXISTS invoice_items (
                id SERIAL PRIMARY KEY,
                invoice_id INTEGER,
                metal_id INTEGER,
                weight NUMERIC,
                price NUMERIC,
                sum NUMERIC,
                contamination_rate NUMERIC DEFAULT 0,
                weight_with_contamination NUMERIC DEFAULT 0
            );
        `);

        // Додаємо колонки якщо їх ще нема (для існуючих БД)
        await client.query(`ALTER TABLE metals ADD COLUMN IF NOT EXISTS current_price NUMERIC NOT NULL DEFAULT 0;`).catch(() => { });
        await client.query(`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS contamination_rate NUMERIC DEFAULT 0;`).catch(() => { });
        await client.query(`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS weight_with_contamination NUMERIC DEFAULT 0;`).catch(() => { });

        // Дефолтний користувач
        const userCount = await client.query("SELECT COUNT(*) as count FROM users");
        if (parseInt(userCount.rows[0].count) === 0) {
            await client.query("INSERT INTO users (name, pin) VALUES ($1, $2)", ["Admin", "1234"]);
        }

        // Метали з цінами
        const metalCount = await client.query("SELECT COUNT(*) as count FROM metals");
        if (parseInt(metalCount.rows[0].count) < 64) {
            console.log("📦 Ініціалізуємо метали...");
            await client.query("DELETE FROM metals");

            const metals = [
                [1, "Мідь блеск", 475], [2, "Мідь М1", 475], [3, "Мідь М3", 457],
                [4, "Мідь фосфорна", 10], [5, "Мідна стружка", 424], [6, "Мідна лента", 424],
                [7, "Мідний скрап", 10], [8, "Латунь", 265], [9, "Латунний радіатор", 265],
                [10, "Латунна стружка", 258], [11, "Латунний скрап", 10], [12, "Стакан великий", 275],
                [13, "Стакан маленький", 270], [14, "ОЦС", 303], [15, "БРАЖ", 293],
                [16, "Алюмінієвий провод", 115], [17, "Алюміній піщевий", 113],
                [18, "Алюмінієвий профіль", 98], [19, "Алюмінієві діскі", 98],
                [20, "Алюміній побутовий", 80], [21, "АМГ", 56], [22, "Алюмінієва банка", 70],
                [23, "Алюмінієвий радіатор", 65], [24, "Алюміній самолет", 66],
                [25, "Алюміній военка", 10], [26, "Алюміній моторняк", 82],
                [27, "Алюмінієва стружка", 50], [28, "Алюмінієвий скрап", 10],
                [29, "Нержавейка (10% нікелю)", 32], [30, "Нержавейка (10% Б55)", 42],
                [31, "Нержавейка (9% нікелю)", 10], [32, "Нержавейка (8% нікелю)", 26],
                [33, "Нержавейка (0% нікелю)", 6], [34, "Височка скрап", 10],
                [35, "Нержавіюча стружка (10%)", 20], [36, "Нержавіюча стружка (9%)", 10],
                [37, "Нержавіюча стружка (8%)", 11], [38, "Нержавіючий скрап", 10],
                [39, "Нікель", 10], [40, "Нікель лом", 10],
                [41, "ЦАМ", 66], [42, "Магній", 50], [43, "Цинк", 85],
                [44, "Свинець кабельний", 67], [45, "Свинець звичайний", 65],
                [46, "Свинець шиномонтаж", 10], [47, "АКБ білий", 25], [48, "АКБ чорний", 17],
                [49, "ТНЖ великі", 18], [50, "ТНЖ маленькі", 16], [51, "ТНЖ 4-к", 5],
                [52, "Титан", 85],
                [53, "Бабіт (16)", 10], [54, "Бабіт (82)", 10], [55, "Кремній", 10],
                [56, "Мельхіор", 10], [57, "МН", 10], [58, "Олово", 10], [59, "Припой", 10],
                [60, "Рапід Р6М5", 10], [61, "Рапід Р18", 10], [62, "Вольфрам", 10],
                [63, "Молібден", 10], [64, "Феромолібден", 10], [65, "Ферованадій", 10],
                [66, "Чорний метал", 5.5],
            ];

            for (const [id, name, price] of metals) {
                await client.query(
                    "INSERT INTO metals (id, name, current_price) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING",
                    [id, name, price]
                );
            }
            console.log(`✅ Додано ${metals.length} металів`);
        }

        // Засмічення
        const contCount = await client.query("SELECT COUNT(*) as count FROM contamination_rates");
        if (parseInt(contCount.rows[0].count) === 0) {
            console.log("📦 Ініціалізуємо засмічення...");
            const now = new Date().toISOString();
            const initialRates = {
                "Мідь блеск": 0, "Мідь М1": 0, "Мідь М3": 1, "Мідь фосфорна": 0,
                "Мідна стружка": 1, "Мідна лента": 1, "Мідний скрап": 1,
                "Латунь": 1, "Латунний радіатор": 2, "Латунна стружка": 3,
                "Латунний скрап": 1, "Стакан великий": 1, "Стакан маленький": 1, "ОЦС": 1, "БРАЖ": 1,
                "Алюмінієвий провод": 0.5, "Алюміній піщевий": 0.5, "Алюмінієвий профіль": 0.5,
                "Алюмінієві діскі": 1, "Алюміній побутовий": 1, "АМГ": 2,
                "Алюмінієва банка": 3, "Алюмінієвий радіатор": 3, "Алюміній самолет": 5,
                "Алюміній военка": 25, "Алюміній моторняк": 1, "Алюмінієва стружка": 5,
                "Алюмінієвий скрап": 1,
                "Нержавейка (10% нікелю)": 0.5, "Нержавейка (10% Б55)": 0,
                "Нержавейка (9% нікелю)": 0.5, "Нержавейка (8% нікелю)": 0.5,
                "Нержавейка (0% нікелю)": 0, "Височка скрап": 1,
                "Нержавіюча стружка (10%)": 5, "Нержавіюча стружка (9%)": 5,
                "Нержавіюча стружка (8%)": 5, "Нержавіючий скрап": 1, "Нікель": 0, "Нікель лом": 1,
                "ЦАМ": 3, "Магній": 3, "Цинк": 0,
                "Свинець кабельний": 1, "Свинець звичайний": 1, "Свинець шиномонтаж": 5,
                "АКБ білий": 1, "АКБ чорний": 1, "ТНЖ великі": 3, "ТНЖ маленькі": 3, "ТНЖ 4-к": 3,
                "Титан": 0.5,
                "Бабіт (16)": 1, "Бабіт (82)": 1, "Кремній": 1, "Мельхіор": 1,
                "МН": 1, "Олово": 0, "Припой": 0,
                "Рапід Р6М5": 1, "Рапід Р18": 1, "Вольфрам": 0.5,
                "Молібден": 0.5, "Феромолібден": 1, "Ферованадій": 1,
                "Чорний метал": 0,
            };

            for (const [metalName, rate] of Object.entries(initialRates)) {
                await client.query(
                    "INSERT INTO contamination_rates (metal_name, rate, updated_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
                    [metalName, rate, now]
                );
            }
            console.log(`✅ Додано засмічення`);
        }

        console.log("✅ База даних ініціалізована");
    } finally {
        client.release();
    }
};

// ====== МЕТАЛИ ======
// Повертає поточні ціни — без прив'язки до дати
app.get("/api/metals", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, name, current_price as price FROM metals ORDER BY id"
        );
        res.json(result.rows);
    } catch (err) {
        console.error("❌ /api/metals:", err);
        res.status(500).json({ error: err.message });
    }
});

// Оновити ціну металу — зберігається назавжди, без дати
app.put("/api/metals/:id", async (req, res) => {
    const { id } = req.params;
    const { price } = req.body;

    if (price === undefined || price < 0) return res.status(400).json({ error: "Невірна ціна" });

    try {
        await pool.query(
            "UPDATE metals SET current_price = $1 WHERE id = $2",
            [price, id]
        );
        res.json({ success: true, message: "Ціна оновлена" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ====== ЗАСМІЧЕННЯ ======
app.get("/api/contamination", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM contamination_rates");
        const ratesObject = {};
        result.rows.forEach(r => { ratesObject[r.metal_name] = parseFloat(r.rate); });
        res.json(ratesObject);
    } catch (err) {
        console.error("❌ /api/contamination GET:", err);
        res.status(500).json({ error: err.message });
    }
});

app.put("/api/contamination", async (req, res) => {
    try {
        const rates = req.body;
        const now = new Date().toISOString();

        await pool.query("DELETE FROM contamination_rates");
        for (const [metalName, rate] of Object.entries(rates)) {
            await pool.query(
                "INSERT INTO contamination_rates (metal_name, rate, updated_at) VALUES ($1, $2, $3)",
                [metalName, rate, now]
            );
        }
        res.json({ success: true, message: "Засмічення оновлено", count: Object.keys(rates).length });
    } catch (err) {
        console.error("❌ /api/contamination PUT:", err);
        res.status(500).json({ error: err.message });
    }
});

app.put("/api/contamination/:metalName", async (req, res) => {
    try {
        const metalName = decodeURIComponent(req.params.metalName);
        const { rate } = req.body;
        const now = new Date().toISOString();

        if (rate === undefined || rate < 0 || rate > 100) {
            return res.status(400).json({ error: "Некоректний відсоток. Має бути від 0 до 100" });
        }

        await pool.query(`
            INSERT INTO contamination_rates (metal_name, rate, updated_at) VALUES ($1, $2, $3)
            ON CONFLICT (metal_name) DO UPDATE SET rate = EXCLUDED.rate, updated_at = EXCLUDED.updated_at
        `, [metalName, rate, now]);

        res.json({ success: true, metalName, rate });
    } catch (err) {
        console.error("❌ /api/contamination/:metalName PUT:", err);
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/contamination/:metalName", async (req, res) => {
    try {
        const metalName = decodeURIComponent(req.params.metalName);
        const result = await pool.query(
            "SELECT rate FROM contamination_rates WHERE metal_name = $1",
            [metalName]
        );
        res.json({ metalName, rate: result.rows[0] ? parseFloat(result.rows[0].rate) : 0 });
    } catch (err) {
        console.error("❌ /api/contamination/:metalName GET:", err);
        res.status(500).json({ error: err.message });
    }
});

// ====== НАКЛАДНІ ======
app.post("/api/invoices", async (req, res) => {
    const { userId = 1, items } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ error: "Немає позицій" });

    const createdAt = new Date().toISOString();
    const total = items.reduce((s, i) => s + (Number(i.sum) || 0), 0);

    try {
        const inv = await pool.query(
            "INSERT INTO invoices (user_id, created_at, total) VALUES ($1, $2, $3) RETURNING id",
            [userId, createdAt, total]
        );
        const invoiceId = inv.rows[0].id;

        for (const i of items) {
            const weight = Number(i.weight) || 0;
            if (weight > 0) {
                const contRate = Number(i.contaminationRate) || 0;
                const weightWithCont = Number(i.weightWithContamination) || weight;
                const sum = Number(i.sum) || Math.floor(weightWithCont * i.price);
                await pool.query(
                    "INSERT INTO invoice_items (invoice_id, metal_id, weight, price, sum, contamination_rate, weight_with_contamination) VALUES ($1, $2, $3, $4, $5, $6, $7)",
                    [invoiceId, i.id, weight, i.price, sum, contRate, weightWithCont]
                );
            }
        }

        res.json({ success: true, invoiceId, createdAt, message: "Накладна збережена" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/invoices", async (req, res) => {
    try {
        const invoices = await pool.query("SELECT * FROM invoices ORDER BY created_at DESC");
        const result = [];

        for (const inv of invoices.rows) {
            const items = await pool.query(`
                SELECT ii.id, ii.invoice_id, ii.metal_id, ii.weight, ii.price, ii.sum,
                       ii.contamination_rate as "contaminationRate",
                       ii.weight_with_contamination as "weightWithContamination",
                       m.name
                FROM invoice_items ii
                LEFT JOIN metals m ON ii.metal_id = m.id
                WHERE ii.invoice_id = $1
            `, [inv.id]);
            result.push({ ...inv, items: items.rows });
        }

        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.delete("/api/invoices/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query("DELETE FROM invoice_items WHERE invoice_id = $1", [id]);
        const result = await pool.query("DELETE FROM invoices WHERE id = $1", [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Накладна не знайдена" });
        res.json({ success: true, message: "Накладна видалена" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.delete("/api/invoices", async (req, res) => {
    try {
        await pool.query("DELETE FROM invoice_items");
        await pool.query("DELETE FROM invoices");
        res.json({ success: true, message: "Всі накладні видалені" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ====== PRINT ======
app.post("/api/print", (req, res) => {
    const { invoiceId, items, total } = req.body;
    try {
        let receipt = `НАКЛАДНА №${invoiceId}\nДата: ${new Date().toLocaleString()}\n================================\n`;
        items.forEach(i => {
            const sum = Math.floor((Number(i.weight) || 0) * i.price);
            if (sum > 0) receipt += `${i.name} | ${i.price} грн | ${i.weight} кг | ${sum} грн\n`;
        });
        receipt += "================================\nВсього: " + total + " грн\n\n";
        res.json({ success: true, receiptText: receipt, message: "Текст чеку готовий" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Помилка генерації чеку" });
    }
});

// ====== Health ======
app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "OK",
        service: "scrap-metal-api",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

app.get("/api", (req, res) => {
    res.json({ message: "Scrap Metal API is running", version: "2.0.0" });
});

// ====== React SPA ======
const clientBuildPath = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientBuildPath));
app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
});

// ====== Запуск ======
const PORT = process.env.PORT || 3000;

initDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error("❌ Помилка ініціалізації БД:", err);
        process.exit(1);
    });