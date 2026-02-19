const express = require("express");
const cors = require("cors");
const path = require("path");
const Database = require("better-sqlite3");
const fs = require('fs');

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

// ====== База даних ======
const dbPath = process.env.NODE_ENV === "production"
    ? "/opt/render/project/src/warehouse.db"
    : path.join(__dirname, "..", "warehouse.db");

console.log("📁 Database path:", dbPath);

// Видаляємо стару базу даних якщо вона існує (тільки для розробки)
if (process.env.NODE_ENV !== "production" && fs.existsSync(dbPath)) {
    console.log("🗑️ Видаляємо стару базу даних...");
    fs.unlinkSync(dbPath);
    console.log("✅ Стару базу даних видалено");
}

const db = new Database(dbPath);

// ====== ФУНКЦІЯ ІНІЦІАЛІЗАЦІЇ ЗАСМІЧЕННЯ ======
const initializeContaminationRates = () => {
    try {
        // Створюємо таблицю для засмічення
        db.exec(`
            CREATE TABLE IF NOT EXISTS contamination_rates (
                metal_name TEXT PRIMARY KEY,
                rate REAL NOT NULL DEFAULT 0,
                updated_at TEXT
            );
        `);

        // Перевіряємо чи є дані
        const count = db.prepare("SELECT COUNT(*) as count FROM contamination_rates").get().count;

        if (count === 0) {
            console.log("📦 Додаємо початкові відсотки засмічення...");

            const now = new Date().toISOString();
            const insert = db.prepare(
                "INSERT INTO contamination_rates (metal_name, rate, updated_at) VALUES (?, ?, ?)"
            );

            const initialRates = {
                // Мідь та мідні сплави
                "Мідь блеск": 0,
                "Мідь М1": 0,
                "Мідь М3": 1,
                "Мідь фосфорна": 0,
                "Мідна стружка": 1,
                "Мідна лента": 1,
                "Мідний скрап": 1,

                // Латунь
                "Латунь": 1,
                "Латунний радіатор": 2,
                "Латунна стружка": 3,
                "Латунний скрап": 1,
                "Стакан великий": 1,
                "Стакан маленький": 1,
                "ОЦС": 1,
                "БРАЖ": 1,

                // Алюміній
                "Алюмінієвий провод": 0.5,
                "Алюміній піщевий": 0.5,
                "Алюмінієвий профіль": 0.5,
                "Алюмінієві діскі": 1,
                "Алюміній побутовий": 1,
                "АМГ": 2,
                "Алюмінієва банка": 3,
                "Алюмінієвий радіатор": 3,
                "Алюміній самолет": 5,
                "Алюміній военка": 25,
                "Алюміній моторняк": 1,
                "Алюмінієва стружка": 5,
                "Алюмінієвий скрап": 1,

                // Нержавіюча сталь
                "Нержавейка (10% нікелю)": 0.5,
                "Нержавейка (10% Б55)": 0,
                "Нержавейка (9% нікелю)": 0.5,
                "Нержавейка (8% нікелю)": 0.5,
                "Нержавейка (0% нікелю)": 0,
                "Височка скрап": 1,
                "Нержавіюча стружка (10%)": 5,
                "Нержавіюча стружка (9%)": 5,
                "Нержавіюча стружка (8%)": 5,
                "Нержавіючий скрап": 1,
                "Нікель": 0,
                "Нікель лом": 1,

                // Кольорові метали
                "ЦАМ": 3,
                "Магній": 3,
                "Цинк": 0,

                // Свинець та АКБ
                "Свинець кабельний": 1,
                "Свинець звичайний": 1,
                "Свинець шиномонтаж": 5,
                "АКБ білий": 1,
                "АКБ чорний": 1,
                "ТНЖ великі": 3,
                "ТНЖ маленькі": 3,
                "ТНЖ 4-к": 3,

                // Рідкісні метали
                "Титан": 0.5,

                // Сплави
                "Бабіт (16)": 1,
                "Бабіт (82)": 1,
                "Кремній": 1,
                "Мельхіор": 1,
                "МН": 1,
                "Олово": 0,
                "Припой": 0,

                // Швидкорізи та спецсплави
                "Рапід Р6М5": 1,
                "Рапід Р18": 1,
                "Вольфрам": 0.5,
                "Молібден": 0.5,
                "Феромолібден": 1,
                "Ферованадій": 1,

                // Чорний метал
                "Чорний метал": 0,
            };

            for (const [metalName, rate] of Object.entries(initialRates)) {
                insert.run(metalName, rate, now);
            }

            console.log(`✅ Додано ${Object.keys(initialRates).length} відсотків засмічення`);
        }
    } catch (err) {
        console.error("❌ Помилка ініціалізації засмічення:", err);
    }
};

// ====== МЕТАЛИ ======
app.get("/api/metals", (req, res) => {
    try {
        const today = new Date().toISOString().split("T")[0];

        // Створюємо таблиці
        db.exec(`
            CREATE TABLE IF NOT EXISTS metals (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE
            );
            CREATE TABLE IF NOT EXISTS daily_prices (
                metal_id INTEGER,
                price INTEGER,
                date TEXT,
                PRIMARY KEY (metal_id, date)
            );
        `);

        const metalCount = db.prepare("SELECT COUNT(*) as count FROM metals").get().count;

        // Якщо таблиця порожня або там менше ніж 64 метали - додаємо всі метали
        if (metalCount < 64) {
            console.log("🔄 Очищаємо старі метали...");
            db.exec("DELETE FROM daily_prices");
            db.exec("DELETE FROM metals");

            // ОНОВЛЕНИЙ список металів
            const metals = [
                // Мідь та мідні сплави
                [1, "Мідь блеск", 475],
                [2, "Мідь М1", 475],
                [3, "Мідь М3", 457],
                [4, "Мідь фосфорна", 10],
                [5, "Мідна стружка", 424],
                [6, "Мідна лента", 424],
                [7, "Мідний скрап", 10],

                // Латунь
                [8, "Латунь", 265],
                [9, "Латунний радіатор", 265],
                [10, "Латунна стружка", 258],
                [11, "Латунний скрап", 10],
                [12, "Стакан великий", 275],
                [13, "Стакан маленький", 270],
                [14, "ОЦС", 303],
                [15, "БРАЖ", 293],

                // Алюміній
                [16, "Алюмінієвий провод", 115],
                [17, "Алюміній піщевий", 113],
                [18, "Алюмінієвий профіль", 98],
                [19, "Алюмінієві діскі", 98],
                [20, "Алюміній побутовий", 80],
                [21, "АМГ", 56],
                [22, "Алюмінієва банка", 70],
                [23, "Алюмінієвий радіатор", 65],
                [24, "Алюміній самолет", 66],
                [25, "Алюміній военка", 10],
                [26, "Алюміній моторняк", 82],
                [27, "Алюмінієва стружка", 50],
                [28, "Алюмінієвий скрап", 10],

                // Нержавіюча сталь
                [29, "Нержавейка (10% нікелю)", 32],
                [30, "Нержавейка (10% Б55)", 42],
                [31, "Нержавейка (9% нікелю)", 10],
                [32, "Нержавейка (8% нікелю)", 26],
                [33, "Нержавейка (0% нікелю)", 6],
                [34, "Височка скрап", 10],
                [35, "Нержавіюча стружка (10%)", 20],
                [36, "Нержавіюча стружка (9%)", 10],
                [37, "Нержавіюча стружка (8%)", 11],
                [38, "Нержавіючий скрап", 10],
                [39, "Нікель", 10],
                [40, "Нікель лом", 10],

                // Кольорові метали
                [41, "ЦАМ", 66],
                [42, "Магній", 50],
                [43, "Цинк", 85],

                // Свинець та АКБ
                [44, "Свинець кабельний", 67],
                [45, "Свинець звичайний", 65],
                [46, "Свинець шиномонтаж", 10],
                [47, "АКБ білий", 25],
                [48, "АКБ чорний", 17],
                [49, "ТНЖ великі", 18],
                [50, "ТНЖ маленькі", 16],
                [51, "ТНЖ 4-к", 5],

                // Рідкісні метали
                [52, "Титан", 85],

                // Сплави
                [53, "Бабіт (16)", 10],
                [54, "Бабіт (82)", 10],
                [55, "Кремній", 10],
                [56, "Мельхіор", 10],
                [57, "МН", 10],
                [58, "Олово", 10],
                [59, "Припой", 10],

                // Швидкорізи та спецсплави
                [60, "Рапід Р6М5", 10],
                [61, "Рапід Р18", 10],
                [62, "Вольфрам", 10],
                [63, "Молібден", 10],
                [64, "Феромолібден", 10],
                [65, "Ферованадій", 10],

                // Чорний метал
                [66, "Чорний метал", 5.5]
            ];

            console.log(`📦 Додаємо ${metals.length} металів...`);

            const insert = db.prepare("INSERT INTO metals (id, name) VALUES (?, ?)");
            const insertPrice = db.prepare("INSERT INTO daily_prices (metal_id, price, date) VALUES (?, ?, ?)");

            const addMetals = db.transaction(() => {
                metals.forEach(([id, name, price]) => {
                    insert.run(id, name);
                    insertPrice.run(id, price, today);
                });
            });

            addMetals();
            console.log(`✅ Додано ${metals.length} металів до бази даних`);
        }

        const metals = db.prepare(`
            SELECT m.id, m.name, COALESCE(dp.price, 0) as price
            FROM metals m
            LEFT JOIN daily_prices dp
              ON m.id = dp.metal_id AND dp.date = ?
            ORDER BY m.id
        `).all(today);

        console.log(`📊 Відправляємо ${metals.length} металів`);

        // Ініціалізуємо засмічення після металів
        initializeContaminationRates();

        res.json(metals);
    } catch (err) {
        console.error("❌ Помилка в /api/metals:", err);
        res.status(500).json({ error: err.message });
    }
});

app.put("/api/metals/:id", (req, res) => {
    const { id } = req.params;
    const { price } = req.body;
    const today = new Date().toISOString().split("T")[0];

    if (!price || price < 0) return res.status(400).json({ error: "Невірна ціна" });

    try {
        const existing = db.prepare("SELECT * FROM daily_prices WHERE metal_id = ? AND date = ?").get(id, today);
        if (existing) {
            db.prepare("UPDATE daily_prices SET price = ? WHERE metal_id = ? AND date = ?").run(price, id, today);
        } else {
            db.prepare("INSERT INTO daily_prices (metal_id, price, date) VALUES (?, ?, ?)").run(id, price, today);
        }
        res.json({ success: true, message: "Ціна оновлена" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ====== ЗАСМІЧЕННЯ ======

// Отримати всі відсотки засмічення
app.get("/api/contamination", (req, res) => {
    try {
        // Перевіряємо чи є таблиця
        db.exec(`
            CREATE TABLE IF NOT EXISTS contamination_rates (
                metal_name TEXT PRIMARY KEY,
                rate REAL NOT NULL DEFAULT 0,
                updated_at TEXT
            );
        `);

        const rates = db.prepare("SELECT * FROM contamination_rates").all();

        // Конвертуємо в об'єкт { metalName: rate, ... }
        const ratesObject = {};
        rates.forEach(r => {
            ratesObject[r.metal_name] = r.rate;
        });

        console.log('📊 Завантажено засмічення з БД:', Object.keys(ratesObject).length);
        res.json(ratesObject);
    } catch (err) {
        console.error("❌ Помилка отримання засмічення:", err);
        res.status(500).json({ error: err.message });
    }
});

// Оновити всі відсотки засмічення
app.put("/api/contamination", (req, res) => {
    try {
        const rates = req.body; // Об'єкт { "Мідь блеск": 0, "Чорний метал": 3, ... }
        const now = new Date().toISOString();

        // Перевіряємо чи є таблиця
        db.exec(`
            CREATE TABLE IF NOT EXISTS contamination_rates (
                metal_name TEXT PRIMARY KEY,
                rate REAL NOT NULL DEFAULT 0,
                updated_at TEXT
            );
        `);

        // Очищаємо таблицю
        db.prepare("DELETE FROM contamination_rates").run();

        // Вставляємо нові дані
        const insert = db.prepare(
            "INSERT INTO contamination_rates (metal_name, rate, updated_at) VALUES (?, ?, ?)"
        );

        const insertMany = db.transaction((items) => {
            for (const [metalName, rate] of Object.entries(items)) {
                insert.run(metalName, rate, now);
            }
        });

        insertMany(rates);

        console.log('✅ Збережено засмічення в БД:', Object.keys(rates).length);
        res.json({
            success: true,
            message: "Відсотки засмічення оновлено",
            count: Object.keys(rates).length
        });
    } catch (err) {
        console.error("❌ Помилка збереження засмічення:", err);
        res.status(500).json({ error: err.message });
    }
});

// Оновити засмічення для одного металу
app.put("/api/contamination/:metalName", (req, res) => {
    try {
        const metalName = decodeURIComponent(req.params.metalName);
        const { rate } = req.body;
        const now = new Date().toISOString();

        if (rate === undefined || rate < 0 || rate > 100) {
            return res.status(400).json({
                error: "Некоректний відсоток. Має бути від 0 до 100"
            });
        }

        // Перевіряємо чи є таблиця
        db.exec(`
            CREATE TABLE IF NOT EXISTS contamination_rates (
                metal_name TEXT PRIMARY KEY,
                rate REAL NOT NULL DEFAULT 0,
                updated_at TEXT
            );
        `);

        // Вставляємо або оновлюємо
        const result = db.prepare(`
            INSERT INTO contamination_rates (metal_name, rate, updated_at) 
            VALUES (?, ?, ?)
            ON CONFLICT(metal_name) 
            DO UPDATE SET rate = excluded.rate, updated_at = excluded.updated_at
        `).run(metalName, rate, now);

        console.log(`✅ Оновлено засмічення для "${metalName}": ${rate}%`);
        res.json({
            success: true,
            message: `Засмічення для "${metalName}" оновлено до ${rate}%`,
            metalName,
            rate
        });
    } catch (err) {
        console.error("❌ Помилка оновлення засмічення:", err);
        res.status(500).json({ error: err.message });
    }
});

// Отримати засмічення для конкретного металу
app.get("/api/contamination/:metalName", (req, res) => {
    try {
        const metalName = decodeURIComponent(req.params.metalName);

        const rate = db.prepare(
            "SELECT rate FROM contamination_rates WHERE metal_name = ?"
        ).get(metalName);

        res.json({
            metalName,
            rate: rate ? rate.rate : 0
        });
    } catch (err) {
        console.error("❌ Помилка отримання засмічення:", err);
        res.status(500).json({ error: err.message });
    }
});

// ====== НАКЛАДНІ ======
app.post("/api/invoices", (req, res) => {
    const { userId = 1, items } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ error: "Немає позицій" });

    const createdAt = new Date().toISOString();
    const total = Math.floor(items.reduce((s, i) => s + (Number(i.weight) || 0) * i.price, 0));

    db.exec(`
        CREATE TABLE IF NOT EXISTS invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            created_at TEXT,
            total INTEGER
        );
        CREATE TABLE IF NOT EXISTS invoice_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_id INTEGER,
            metal_id INTEGER,
            weight REAL,
            price INTEGER,
            sum INTEGER
        );
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            pin TEXT NOT NULL UNIQUE
        );
    `);

    const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
    if (userCount === 0) db.prepare("INSERT INTO users (name, pin) VALUES (?, ?)").run("Admin", "1234");

    try {
        const inv = db.prepare("INSERT INTO invoices (user_id, created_at, total) VALUES (?, ?, ?)").run(userId, createdAt, total);
        const invoiceId = inv.lastInsertRowid;

        const stmt = db.prepare("INSERT INTO invoice_items (invoice_id, metal_id, weight, price, sum) VALUES (?, ?, ?, ?, ?)");
        items.forEach(i => {
            const sum = Math.floor((Number(i.weight) || 0) * i.price);
            if (sum > 0) stmt.run(invoiceId, i.id, i.weight, i.price, sum);
        });

        res.json({ success: true, invoiceId, createdAt, message: "Накладна збережена" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/invoices", (req, res) => {
    try {
        const invoices = db.prepare("SELECT * FROM invoices ORDER BY created_at DESC").all();
        invoices.forEach(inv => {
            inv.items = db.prepare(`
                SELECT ii.*, m.name 
                FROM invoice_items ii
                LEFT JOIN metals m ON ii.metal_id = m.id
                WHERE ii.invoice_id = ?
            `).all(inv.id);
        });
        res.json(invoices);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.delete("/api/invoices/:id", (req, res) => {
    const { id } = req.params;
    try {
        db.prepare("DELETE FROM invoice_items WHERE invoice_id = ?").run(id);
        const result = db.prepare("DELETE FROM invoices WHERE id = ?").run(id);
        if (result.changes === 0) return res.status(404).json({ error: "Накладна не знайдена" });
        res.json({ success: true, message: "Накладна видалена" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.delete("/api/invoices", (req, res) => {
    try {
        db.prepare("DELETE FROM invoice_items").run();
        db.prepare("DELETE FROM invoices").run();
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

// ====== Root API ======
app.get("/api", (req, res) => {
    res.json({ message: "Scrap Metal API is running", version: "1.0.0" });
});

// ====== React SPA ======
const clientBuildPath = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientBuildPath));
app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
});

// ====== Запуск сервера ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Database: ${dbPath}`);
});