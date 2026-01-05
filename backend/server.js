const express = require("express");
const cors = require("cors");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
app.use(cors());
app.use(express.json());

// Шлях до бази даних на Render
const dbPath = process.env.NODE_ENV === 'production'
    ? '/opt/render/project/src/warehouse.db'
    : path.join(__dirname, '..', 'warehouse.db');

console.log('📁 Database path:', dbPath);
const db = new Database(dbPath);

// ====== СПИСОК МЕТАЛІВ + ЦІНИ НА СЬОГОДНІ ======
app.get("/api/metals", (req, res) => {
    const today = new Date().toISOString().split("T")[0];

    // Створюємо таблиці, якщо не існують
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

    // Перевіряємо чи є метали
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
            metals.forEach(([name, price], index) => {
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

// ====== ОНОВЛЕННЯ ЦІНИ МЕТАЛУ ======
app.put("/api/metals/:id", (req, res) => {
    const { id } = req.params;
    const { price } = req.body;
    const today = new Date().toISOString().split("T")[0];

    if (!price || price < 0) {
        return res.status(400).json({ error: "Невірна ціна" });
    }

    try {
        // Перевіряємо чи існує ціна на сьогодні
        const existing = db.prepare(
            'SELECT * FROM daily_prices WHERE metal_id = ? AND date = ?'
        ).get(id, today);

        if (existing) {
            // Оновлюємо існуючу ціну
            db.prepare(
                'UPDATE daily_prices SET price = ? WHERE metal_id = ? AND date = ?'
            ).run(price, id, today);
        } else {
            // Додаємо нову ціну
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

// ====== ЗБЕРЕЖЕННЯ НАКЛАДНОЇ ======
app.post("/api/invoices", (req, res) => {
    const { userId = 1, items } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ error: "Немає позицій для збереження" });
    }

    const createdAt = new Date().toISOString();
    const total = Math.floor(
        items.reduce((s, i) => s + (Number(i.weight) || 0) * i.price, 0)
    );

    // Створюємо таблиці, якщо не існують
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

    // Додаємо тестового користувача, якщо немає
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    if (userCount === 0) {
        db.prepare('INSERT INTO users (name, pin) VALUES (?, ?)').run('Admin', '1234');
    }

    try {
        // Додаємо накладну
        const inv = db.prepare(`
            INSERT INTO invoices (user_id, created_at, total)
            VALUES (?, ?, ?)
        `).run(userId, createdAt, total);

        const invoiceId = inv.lastInsertRowid;

        // Додаємо позиції
        const stmt = db.prepare(`
            INSERT INTO invoice_items
            (invoice_id, metal_id, weight, price, sum)
            VALUES (?, ?, ?, ?, ?)
        `);

        items.forEach(i => {
            const sum = Math.floor((Number(i.weight) || 0) * i.price);
            if (sum > 0) {
                stmt.run(invoiceId, i.id, i.weight, i.price, sum);
            }
        });

        res.json({
            success: true,
            invoiceId,
            createdAt,
            message: "Накладна збережена"
        });
    } catch (error) {
        console.error("Error saving invoice:", error);
        res.status(500).json({ error: error.message });
    }
});

// ====== ОТРИМАННЯ ВСІХ НАКЛАДНИХ ======
app.get("/api/invoices", (req, res) => {
    try {
        // Створюємо таблицю, якщо не існує
        db.exec(`
            CREATE TABLE IF NOT EXISTS invoices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                created_at TEXT,
                total INTEGER
            );
        `);

        const invoices = db.prepare(`
            SELECT i.* 
            FROM invoices i
            ORDER BY i.created_at DESC
        `).all();

        // Для кожної накладної отримуємо елементи
        for (let invoice of invoices) {
            const items = db.prepare(`
                SELECT ii.*, m.name 
                FROM invoice_items ii
                LEFT JOIN metals m ON ii.metal_id = m.id
                WHERE ii.invoice_id = ?
            `).all(invoice.id);
            invoice.items = items;
        }

        res.json(invoices);
    } catch (error) {
        console.error("Error fetching invoices:", error);
        res.status(500).json({ error: error.message });
    }
});

// ====== ВИДАЛЕННЯ НАКЛАДНОЇ ======
app.delete("/api/invoices/:id", (req, res) => {
    const { id } = req.params;

    try {
        // Видаляємо спочатку елементи
        db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(id);

        // Потім накладну
        const result = db.prepare('DELETE FROM invoices WHERE id = ?').run(id);

        if (result.changes === 0) {
            return res.status(404).json({ error: "Накладна не знайдена" });
        }

        res.json({ success: true, message: "Накладна видалена" });
    } catch (error) {
        console.error("Error deleting invoice:", error);
        res.status(500).json({ error: error.message });
    }
});

// ====== ВИДАЛЕННЯ ВСІХ НАКЛАДНИХ ======
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

// ====== ДРУК НАКЛАДНОЇ (без реального принтера на Render) ======
app.post("/api/print", async (req, res) => {
    const { invoiceId, items, total } = req.body;

    try {
        // На Render немає фізичних принтерів, тому повертаємо текст для копіювання
        let receiptText = `НАКЛАДНА №${invoiceId}\n`;
        receiptText += `Дата: ${new Date().toLocaleString()}\n`;
        receiptText += "================================\n";

        items.forEach(i => {
            const sum = Math.floor((Number(i.weight) || 0) * i.price);
            if (sum > 0) {
                receiptText += `${i.name} | ${i.price} грн | ${i.weight} кг | ${sum} грн\n`;
            }
        });

        receiptText += "================================\n";
        receiptText += `Всього: ${total} грн\n\n`;

        // Повертаємо текст для копіювання в буфер
        res.json({
            success: true,
            receiptText,
            message: "Текст чеку готовий для копіювання"
        });
    } catch (err) {
        console.error("Print error:", err);
        res.status(500).json({ error: "Помилка генерації чеку" });
    }
});

// ====== СТАТИЧНІ ФАЙЛИ REACT ======
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath));

// React Router - всі інші маршрути на фронтенд
// ВАЖЛИВО: Зірочка без лапок!
app.use((req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// ====== ЗАПУСК СЕРВЕРА ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Database: ${dbPath}`);
    console.log(`🌐 Open: http://localhost:${PORT}`);
});