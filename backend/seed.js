const db = require("./db"); // твій sqlite3 або better-sqlite3

const metals = [
  { name: "Мідь", price: 388 },
  { name: "Латунь", price: 235 },
  { name: "Радіатор латунний", price: 210 },
  { name: "Алюміній побутовий", price: 65 },
  { name: "Алюміній електротехнічний", price: 80 },
  { name: "Нержавіюча сталь", price: 45 },
  { name: "Магній", price: 75 },
  { name: "ЦАМ", price: 95 },
  { name: "Стружка мідна", price: 320 },
  { name: "Стружка латунна", price: 180 },
  { name: "Свинець", price: 45 },
  { name: "Свинець кабельний", price: 55 },
  { name: "Акумулятор білий", price: 20 },
  { name: "Акумулятор чорний", price: 18 },
  { name: "Титан", price: 160 },
  { name: "Чорний металобрухт", price: 8 }
];

// Додаємо метали у таблицю metals, якщо ще нема
const insertMetal = db.prepare("INSERT OR IGNORE INTO metals (id, name) VALUES (?, ?)");
metals.forEach((m, i) => insertMetal.run(i + 1, m.name));

// Сьогоднішня дата
const today = new Date().toISOString().split("T")[0];

// Додаємо ціни у daily_prices
const insertPrice = db.prepare(`
  INSERT OR REPLACE INTO daily_prices (metal_id, date, price)
  VALUES (?, ?, ?)
`);

metals.forEach((m, i) => {
  insertPrice.run(i + 1, today, m.price);
});

console.log("✅ Базові метали і сьогоднішні ціни додані");
