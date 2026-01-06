const express = require("express");
const cors = require("cors");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();

// ====== CORS ======
const allowedOrigins = [
    'https://scrap-metal-app.onrender.com',
    'http://localhost:5173'
];

app.use(cors({
    origin: function (origin, callback) {
        // Дозволяємо запити без origin (наприклад, Postman)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = `CORS policy: origin ${origin} not allowed`;
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json());

// ====== База даних ======
const dbPath = process.env.NODE_ENV === 'production'
    ? '/opt/render/project/src/warehouse.db'
    : path.join(__dirname, '..', 'warehouse.db');

console.log('📁 Database path:', dbPath);
const db = new Database(dbPath);

// ====== СПИСОК МЕТАЛІВ ======
app.get("/api/metals", (req, res) => {
    const today = new Date().toISOString().split("T")[0];

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

    const metalCount = db.prepare('SELECT COUNT(*) as count FROM metals').get().count;

    if (metalCount === 0) {
        console.log('🔄 Adding default metals...');
        const metals = [
            ['Мідь', 388],
            ['Латунь', 235],
            ['Радіатор латунний', 210],
            ['Алюміній побутовий', 65],
            ['Алюміній електротехнічний', 80],
            ['Нержавіюча сталь', 45],
            ['Магній', 75],
            ['ЦАМ', 95],
            ['Стружка мідна', 320],
            ['Стружка латунна', 180],
            ['Свинець', 45],
            ['Свинець кабельний', 55],
            ['Акумулятор білий', 20],
            ['Акумулятор чорний', 18],
            ['Титан', 160],
            ['Чорний металобрухт', 8]
        ];

        const insert = db.prepare('INSERT INTO metals (name) VALUES (?)');
        const insertPrice = db.prepare('INSERT INTO daily_prices (metal_id, price, date) VALUES (?, ?, ?)');

        const addMetals = db.transaction(() => {
            metals.forEach(([name, price]) => {
                const result = insert.run(name);
                const metalId = result.lastInsertRowid;
                insertPrice.run(metalId, price, today);
            });
        });

        addMetals();
    }

    const metals = db.prepare(`
        SELECT m.id, m.name,
               COALESCE(dp.price, 0) as price
        FROM metals m
        LEFT JOIN daily_prices dp
          ON m.id = dp.metal_id AND dp.date = ?
        ORDER BY m.id
    `).all(today);

    res.json(metals);
});

// ====== ОНОВЛЕННЯ ЦІНИ ======
app.put("/api/metals/:id", (req, res) => {
    const { id } = req.params;
    const { price } = req.body;
    const today = new Date().toISOString().split("T")[0];

    if (!price || price < 0) return res.status(400).json({ error: "Невірна ціна" });

    try {
        const existing = db.prepare(
            'SELECT * FROM daily_prices WHERE metal_id = ? AND date = ?'
        ).get(id, today);

        if (existing) {
            db.prepare(
                'UPDATE daily_prices SET price = ? WHERE metal_id = ? AND date = ?'
            ).run(price, id, today);
        } else {
            db.prepare(
                'INSERT INTO daily_prices (metal_id, price, date) VALUES (?, ?, ?)'
            ).run(id, price, today);
        }

        res.json({ success: true, message: "Ціна оновлена" });
    } catch (error) {
        console.error("Error updating metal price:", error);
        res.status(500).json({ error: error.message });
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

    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    if (userCount === 0) db.prepare('INSERT INTO users (name, pin) VALUES (?, ?)').run('Admin', '1234');

    try {
        const inv = db.prepare(`
            INSERT INTO invoices (user_id, created_at, total)
            VALUES (?, ?, ?)
        `).run(userId, createdAt, total);

        const invoiceId = inv.lastInsertRowid;

        const stmt = db.prepare(`
            INSERT INTO invoice_items (invoice_id, metal_id, weight, price, sum)
            VALUES (?, ?, ?, ?, ?)
        `);

        items.forEach(i => {
            const sum = Math.floor((Number(i.weight) || 0) * i.price);
            if (sum > 0) stmt.run(invoiceId, i.id, i.weight, i.price, sum);
        });

        res.json({ success: true, invoiceId, createdAt, message: "Накладна збережена" });
    } catch (error) {
        console.error("Error saving invoice:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/invoices", (req, res) => {
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS invoices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                created_at TEXT,
                total INTEGER
            );
        `);

        const invoices = db.prepare(`SELECT * FROM invoices ORDER BY created_at DESC`).all();

        invoices.forEach(invoice => {
            const items = db.prepare(`
                SELECT ii.*, m.name 
                FROM invoice_items ii
                LEFT JOIN metals m ON ii.metal_id = m.id
                WHERE ii.invoice_id = ?
            `).all(invoice.id);
            invoice.items = items;
        });

        res.json(invoices);
    } catch (error) {
        console.error("Error fetching invoices:", error);
        res.status(500).json({ error: error.message });
    }
});

// Видалення
app.delete("/api/invoices/:id", (req, res) => {
    const { id } = req.params;
    try {
        db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(id);
        const result = db.prepare('DELETE FROM invoices WHERE id = ?').run(id);

        if (result.changes === 0) return res.status(404).json({ error: "Накладна не знайдена" });

        res.json({ success: true, message: "Накладна видалена" });
    } catch (error) {
        console.error("Error deleting invoice:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete("/api/invoices", (req, res) => {
    try {
        db.prepare('DELETE FROM invoice_items').run();
        db.prepare('DELETE FROM invoices').run();
        res.json({ success: true, message: "Всі накладні видалені" });
    } catch (error) {
        console.error("Error deleting all invoices:", error);
        res.status(500).json({ error: error.message });
    }
});

// ====== ДРУК ======
app.post("/api/print", (req, res) => {
    const { invoiceId, items, total } = req.body;

    try {
        let receiptText = `НАКЛАДНА №${invoiceId}\nДата: ${new Date().toLocaleString()}\n================================\n`;
        items.forEach(i => {
            const sum = Math.floor((Number(i.weight) || 0) * i.price);
            if (sum > 0) receiptText += `${i.name} | ${i.price} грн | ${i.weight} кг | ${sum} грн\n`;
        });
        receiptText += "================================\nВсього: " + total + " грн\n\n";

        res.json({ success: true, receiptText, message: "Текст чеку готовий" });
    } catch (err) {
        console.error("Print error:", err);
        res.status(500).json({ error: "Помилка генерації чеку" });
    }
});

// ====== React ======
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath));
app.use((req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// ====== Запуск ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Database: ${dbPath}`);
    console.log(`🌐 Open: http://localhost:${PORT}`);
});

// ====== Health check ======
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        service: 'scrap-metal-api',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Root endpoint
app.get('/api', (req, res) => {
    res.json({ message: 'Scrap Metal API is running', version: '1.0.0' });
});
