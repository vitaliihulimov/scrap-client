const db = require("./db"); // твій sqlite3 або better-sqlite3

const metals = [
  // Мідь та мідні сплави
  { id: 1, name: "Мідь блеск", price: 388 },
  { id: 2, name: "Мідь М1", price: 388 },
  { id: 3, name: "Мідь М3", price: 388 },
  { id: 4, name: "Мідь фосфорна", price: 388 },
  { id: 5, name: "Мідна стружка", price: 320 },
  { id: 6, name: "Мідна лента", price: 380 },
  { id: 7, name: "Мідний скрап", price: 350 },

  // Латунь
  { id: 8, name: "Латунь", price: 235 },
  { id: 9, name: "Латунний радіатор", price: 210 },
  { id: 10, name: "Латунна стружка", price: 180 },
  { id: 11, name: "Латунний скрап", price: 220 },
  { id: 12, name: "Стакан великий", price: 230 },
  { id: 13, name: "Стакан маленький", price: 230 },
  { id: 14, name: "ОЦС", price: 220 },
  { id: 15, name: "БРАЖ", price: 220 },

  // Алюміній
  { id: 16, name: "Алюмінієвий провод", price: 70 },
  { id: 17, name: "Алюміній піщевий", price: 65 },
  { id: 18, name: "Алюмінієвий профіль", price: 65 },
  { id: 19, name: "Алюмінієві діскі", price: 60 },
  { id: 20, name: "Алюміній побутовий", price: 55 },
  { id: 21, name: "АМГ", price: 75 },
  { id: 22, name: "Алюмінієва банка", price: 50 },
  { id: 23, name: "Алюмінієвий радіатор", price: 65 },
  { id: 24, name: "Алюміній самолет", price: 85 },
  { id: 25, name: "Алюміній военка", price: 95 },
  { id: 26, name: "Алюміній моторняк", price: 75 },
  { id: 27, name: "Алюмінієва стружка", price: 45 },
  { id: 28, name: "Алюмінієвий скрап", price: 50 },

  // Нержавіюча сталь
  { id: 29, name: "Нержавейка (10% нікелю)", price: 90 },
  { id: 30, name: "Нержавейка (10% Б55)", price: 90 },
  { id: 31, name: "Нержавейка (9% нікелю)", price: 85 },
  { id: 32, name: "Нержавейка (8% нікелю)", price: 80 },
  { id: 33, name: "Нержавейка (0% нікелю)", price: 45 },
  { id: 34, name: "Височка скрап", price: 70 },
  { id: 35, name: "Нержавіюча стружка (10%)", price: 60 },  // Розділено на три позиції
  { id: 36, name: "Нержавіюча стружка (9%)", price: 60 },
  { id: 37, name: "Нержавіюча стружка (8%)", price: 60 },
  { id: 38, name: "Нержавіючий скрап", price: 65 },
  { id: 39, name: "Нікель", price: 350 },
  { id: 40, name: "Нікель лом", price: 320 },

  // Кольорові метали
  { id: 41, name: "ЦАМ", price: 95 },
  { id: 42, name: "Магній", price: 75 },
  { id: 43, name: "Цинк", price: 50 },

  // Свинець та АКБ
  { id: 44, name: "Свинець кабельний", price: 55 },
  { id: 45, name: "Свинець звичайний", price: 45 },
  { id: 46, name: "Свинець шиномонтаж", price: 45 },
  { id: 47, name: "АКБ білий", price: 20 },
  { id: 48, name: "АКБ чорний", price: 18 },
  { id: 49, name: "ТНЖ великі", price: 25 },
  { id: 50, name: "ТНЖ маленькі", price: 25 },
  { id: 51, name: "ТНЖ 4-к", price: 25 },

  // Рідкісні метали
  { id: 52, name: "Титан", price: 160 },

  // Сплави
  { id: 53, name: "Бабіт (16)", price: 120 },
  { id: 54, name: "Бабіт (82)", price: 140 },
  { id: 55, name: "Кремній", price: 80 },
  { id: 56, name: "Мельхіор", price: 200 },
  { id: 57, name: "МН", price: 200 },
  { id: 58, name: "Олово", price: 300 },
  { id: 59, name: "Припой", price: 280 },

  // Швидкорізи та спецсплави
  { id: 60, name: "Рапід Р6М5", price: 150 },
  { id: 61, name: "Рапід Р18", price: 180 },
  { id: 62, name: "Вольфрам", price: 400 },
  { id: 63, name: "Молібден", price: 350 },
  { id: 64, name: "Феромолібден", price: 250 },
  { id: 65, name: "Ферованадій", price: 220 },

  // Чорний метал
  { id: 66, name: "Чорний метал", price: 8 }
];

// Додаємо метали у таблицю metals, якщо ще нема
const insertMetal = db.prepare("INSERT OR IGNORE INTO metals (id, name) VALUES (?, ?)");
metals.forEach((m) => insertMetal.run(m.id, m.name));

// Сьогоднішня дата
const today = new Date().toISOString().split("T")[0];

// Додаємо ціни у daily_prices
const insertPrice = db.prepare(`
  INSERT OR REPLACE INTO daily_prices (metal_id, date, price)
  VALUES (?, ?, ?)
`);

metals.forEach((m) => {
  insertPrice.run(m.id, today, m.price);
});

console.log(`✅ Додано ${metals.length} металів з сьогоднішніми цінами`);