const express = require("express");
const cors = require("cors");
const db = require("./db");
const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;

const app = express();
app.use(cors());
app.use(express.json());

// ====== СПИСОК МЕТАЛІВ + ЦІНИ НА СЬОГОДНІ ======
app.get("/metals", (req, res) => {
    const today = new Date().toISOString().split("T")[0];
    const metals = db.prepare(`
    SELECT m.id, m.name,
           IFNULL(dp.price, 0) as price
    FROM metals m
    LEFT JOIN daily_prices dp
      ON m.id = dp.metal_id AND dp.date = ?
    ORDER BY m.id
  `).all(today);

    res.json(metals);
});

// ====== ЗБЕРЕЖЕННЯ НАКЛАДНОЇ ======
app.post("/invoice", (req, res) => {
    const { userId, items } = req.body;
    const createdAt = new Date().toISOString();
    const total = Math.floor(
        items.reduce((s, i) => s + (Number(i.weight) || 0) * i.price, 0)
    );

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
        if (sum > 0) stmt.run(invoiceId, i.id, i.weight, i.price, sum);
    });

    res.json({ success: true, invoiceId, createdAt });
});

app.get("/invoices", (req, res) => {
    const invoices = db.prepare(`
    SELECT id, created_at, total
    FROM invoices
    ORDER BY id DESC
  `).all();
    res.json(invoices);
});

// Друк накладної через Thermal Printer
app.post("/print", async (req, res) => {
    const { invoiceId, items, total } = req.body;

    // Налаштування принтера
    let printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,     // або STAR, якщо у тебе STAR
        interface: 'printer:POS58'    // назва твого локального принтера
    });

    try {
        for (let copy = 1; copy <= 2; copy++) {
            printer.println(`Накладна №${invoiceId} (копія ${copy})`);
            printer.println(`Дата: ${new Date().toLocaleString()}`);
            printer.println("--------------------------------");

            // Друкуємо таблицю
            items.forEach(i => {
                const sum = Math.floor((Number(i.weight) || 0) * i.price);
                if (sum > 0) {
                    printer.println(`${i.name} | ${i.price} грн | ${i.weight} кг | ${sum} грн`);
                }
            });

            printer.println("--------------------------------");
            printer.println(`Всього: ${total} грн`);
            printer.println("\n\n"); // проміжок для обрізки
        }

        await printer.execute(); // друк
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Помилка друку" });
    }
});



app.listen(3000, () => console.log("✅ Server running on http://localhost:3000"));
