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
                [1, "Мідь блеск", 388],
                [2, "Мідь М1", 388],
                [3, "Мідь М3", 388],
                [4, "Мідь фосфорна", 388],
                [5, "Мідна стружка", 320],
                [6, "Мідна лента", 380],
                [7, "Мідний скрап", 350],

                // Латунь
                [8, "Латунь", 235],
                [9, "Латунний радіатор", 210],
                [10, "Латунна стружка", 180],
                [11, "Латунний скрап", 220],
                [12, "Стакан великий", 230],
                [13, "Стакан маленький", 230],
                [14, "ОЦС", 220],
                [15, "БРАЖ", 220],

                // Алюміній
                [16, "Алюмінієвий провод", 70],
                [17, "Алюміній піщевий", 65],
                [18, "Алюмінієвий профіль", 65],
                [19, "Алюмінієві діскі", 60],
                [20, "Алюміній побутовий", 55],
                [21, "АМГ", 75],
                [22, "Алюмінієва банка", 50],
                [23, "Алюмінієвий радіатор", 65],
                [24, "Алюміній самолет", 85],
                [25, "Алюміній военка", 95],
                [26, "Алюміній моторняк", 75],
                [27, "Алюмінієва стружка", 45],
                [28, "Алюмінієвий скрап", 50],

                // Нержавіюча сталь
                [29, "Нержавейка (10% нікелю)", 90],
                [30, "Нержавейка (10% Б55)", 90],
                [31, "Нержавейка (9% нікелю)", 85],
                [32, "Нержавейка (8% нікелю)", 80],
                [33, "Нержавейка (0% нікелю)", 45],
                [34, "Височка скрап", 70],
                [35, "Нержавіюча стружка (10 9 8)", 60],
                [36, "Нержавіючий скрап", 65],
                [37, "Нікель", 350],
                [38, "Нікель лом", 320],

                // Кольорові метали
                [39, "ЦАМ", 95],
                [40, "Магній", 75],
                [41, "Цинк", 50],

                // Свинець та АКБ
                [42, "Свинець кабельний", 55],
                [43, "Свинець звичайний", 45],
                [44, "Свинець шиномонтаж", 45],
                [45, "АКБ білий", 20],
                [46, "АКБ чорний", 18],
                [47, "ТНЖ великі", 25],
                [48, "ТНЖ маленькі", 25],
                [49, "ТНЖ 4-к", 25],

                // Рідкісні метали
                [50, "Титан", 160],

                // Сплави
                [51, "Бабіт (16)", 120],
                [52, "Бабіт (82)", 140],
                [53, "Кремній", 80],
                [54, "Мельхіор", 200],
                [55, "МН", 200],
                [56, "Олово", 300],
                [57, "Припой", 280],

                // Швидкорізи та спецсплави
                [58, "Рапід Р6М5", 150],
                [59, "Рапід Р18", 180],
                [60, "Вольфрам", 400],
                [61, "Молібден", 350],
                [62, "Феромолібден", 250],
                [63, "Ферованадій", 220],

                // Чорний метал
                [64, "Чорний метал", 8]
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