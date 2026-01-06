const express = require("express");
const cors = require("cors");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();

/* =====================================================
   CORS — ЄДИНА ПРАВИЛЬНА КОНФІГУРАЦІЯ
   ===================================================== */
const allowedOrigins = [
    "https://scrap-client.onrender.com",
    "http://localhost:5173"
];

app.use(cors({
    origin: (origin, callback) => {
        // дозволяємо запити без origin (Postman, curl)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

/* =====================================================
   DATABASE
   ===================================================== */
const dbPath =
    process.env.NODE_ENV === "production"
        ? "/opt/render/project/src/warehouse.db"
        : path.join(__dirname, "..", "warehouse.db");

console.log("📁 Database path:", dbPath);
const db = new Database(dbPath);

/* =====================================================
   METALS + DAILY PRICES
   ===================================================== */
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

    const metalCount = db
        .prepare("SELECT COUNT(*) as count FROM metals")
        .get().count;

    if (metalCount === 0) {
        const metals = [
            ["Мідь", 388],
            ["Латунь", 235],
            ["Радіатор латунний", 210],
            ["Алюміній побутовий", 65],
            ["Алюміній електротехнічний", 80],
            ["Нержавіюча сталь", 45],
            ["Магній", 75],
            ["ЦАМ", 95],
            ["Стружка мідна", 320],
            ["Стружка латунна", 180],
            ["Свинець", 45],
            ["Свинець кабельний", 55],
            ["Акумулятор білий", 20],
            ["Акумулятор чорний", 18],
            ["Титан", 160],
            ["Чорний металобрухт", 8]
        ];

        const insertMetal = db.prepare(
            "INSERT INTO metals (name) VALUES (?)"
        );
        const insertPrice = db.prepare(
            "INSERT INTO daily_prices (metal_id, price, date) VALUES (?, ?, ?)"
        );

        const trx = db.transaction(() => {
            metals.forEach(([name, price]) => {
                const result = insertMetal.run(name);
                insertPrice.run(result.lastInsertRowid, price, today);
            });
        });

        trx();
    }

    const metals = db
        .prepare(`
            SELECT m.id, m.name,
                   COALESCE(dp.price, 0) as price
            FROM metals m
            LEFT JOIN daily_prices dp
              ON m.id = dp.metal_id AND dp.date = ?
            ORDER BY m.id
        `)
        .all(today);

    res.json(metals);
});

/* =====================================================
   UPDATE METAL PRICE
   ===================================================== */
app.put("/api/metals/:id", (req, res) => {
    const { id } = req.params;
    const { price } = req.body;
    const today = new Date().toISOString().split("T")[0];

    if (price == null || price < 0) {
        return res.status(400).json({ error: "Невірна ціна" });
    }

    const existing = db
        .prepare(
            "SELECT 1 FROM daily_prices WHERE metal_id = ? AND date = ?"
        )
        .get(id, today);

    if (existing) {
        db.prepare(
            "UPDATE daily_prices SET price = ? WHERE metal_id = ? AND date = ?"
        ).run(price, id, today);
    } else {
        db.prepare(
            "INSERT INTO daily_prices (metal_id, price, date) VALUES (?, ?, ?)"
        ).run(id, price, today);
    }

    res.json({ success: true });
});

/* =====================================================
   INVOICES
   ===================================================== */
app.post("/api/invoices", (req, res) => {
    const { userId = 1, items } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ error: "Немає позицій" });
    }

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
    `);

    const createdAt = new Date().toISOString();
    const total = Math.floor(
        items.reduce((s, i) => s + (i.weight || 0) * i.price, 0)
    );

    const inv = db
        .prepare(
            "INSERT INTO invoices (user_id, created_at, total) VALUES (?, ?, ?)"
        )
        .run(userId, createdAt, total);

    const stmt = db.prepare(`
        INSERT INTO invoice_items
        (invoice_id, metal_id, weight, price, sum)
        VALUES (?, ?, ?, ?, ?)
    `);

    items.forEach(i => {
        const sum = Math.floor((i.weight || 0) * i.price);
        if (sum > 0) {
            stmt.run(inv.lastInsertRowid, i.id, i.weight, i.price, sum);
        }
    });

    res.json({ success: true, invoiceId: inv.lastInsertRowid });
});

app.get("/api/invoices", (req, res) => {
    const invoices = db
        .prepare("SELECT * FROM invoices ORDER BY created_at DESC")
        .all();

    invoices.forEach(inv => {
        inv.items = db
            .prepare(`
                SELECT ii.*, m.name
                FROM invoice_items ii
                LEFT JOIN metals m ON m.id = ii.metal_id
                WHERE ii.invoice_id = ?
            `)
            .all(inv.id);
    });

    res.json(invoices);
});

app.delete("/api/invoices/:id", (req, res) => {
    db.prepare("DELETE FROM invoice_items WHERE invoice_id = ?").run(
        req.params.id
    );
    db.prepare("DELETE FROM invoices WHERE id = ?").run(req.params.id);
    res.json({ success: true });
});

/* =====================================================
   HEALTH CHECK
   ===================================================== */
app.get("/api/health", (req, res) => {
    res.json({ status: "OK", uptime: process.uptime() });
});

/* =====================================================
   SERVER
   ===================================================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 API running on port ${PORT}`);
});
