const db = require("./db"); // твій sqlite3 або better-sqlite3

const metals = [
  // Мідь та мідні сплави
  { id: 1, name: "Мідь блеск", price: 475 },
  { id: 2, name: "Мідь М1", price: 475 },
  { id: 3, name: "Мідь М3", price: 457 },
  { id: 4, name: "Мідь фосфорна", price: 10 },
  { id: 5, name: "Мідна стружка", price: 424 },
  { id: 6, name: "Мідна лента", price: 424 },
  { id: 7, name: "Мідний скрап", price: 10 },

  // Латунь
  { id: 8, name: "Латунь", price: 265 },
  { id: 9, name: "Латунний радіатор", price: 265 },
  { id: 10, name: "Латунна стружка", price: 258 },
  { id: 11, name: "Латунний скрап", price: 10 },
  { id: 12, name: "Стакан великий", price: 275 },
  { id: 13, name: "Стакан маленький", price: 270 },
  { id: 14, name: "ОЦС", price: 303 },
  { id: 15, name: "БРАЖ", price: 293 },

  // Алюміній
  { id: 16, name: "Алюмінієвий провод", price: 115 },
  { id: 17, name: "Алюміній піщевий", price: 113 },
  { id: 18, name: "Алюмінієвий профіль", price: 98 },
  { id: 19, name: "Алюмінієві діскі", price: 98 },
  { id: 20, name: "Алюміній побутовий", price: 80 },
  { id: 21, name: "АМГ", price: 56 },
  { id: 22, name: "Алюмінієва банка", price: 70 },
  { id: 23, name: "Алюмінієвий радіатор", price: 65 },
  { id: 24, name: "Алюміній самолет", price: 66 },
  { id: 25, name: "Алюміній военка", price: 10 },
  { id: 26, name: "Алюміній моторняк", price: 82 },
  { id: 27, name: "Алюмінієва стружка", price: 50 },
  { id: 28, name: "Алюмінієвий скрап", price: 10 },

  // Нержавіюча сталь
  { id: 29, name: "Нержавейка (10% нікелю)", price: 32 },
  { id: 30, name: "Нержавейка (10% Б55)", price: 42 },
  { id: 31, name: "Нержавейка (9% нікелю)", price: 10 },
  { id: 32, name: "Нержавейка (8% нікелю)", price: 26 },
  { id: 33, name: "Нержавейка (0% нікелю)", price: 6 },
  { id: 34, name: "Височка скрап", price: 10 },
  { id: 35, name: "Нержавіюча стружка (10%)", price: 20 },  // Розділено на три позиції
  { id: 36, name: "Нержавіюча стружка (9%)", price: 10 },
  { id: 37, name: "Нержавіюча стружка (8%)", price: 11 },
  { id: 38, name: "Нержавіючий скрап", price: 10 },
  { id: 39, name: "Нікель", price: 10 },
  { id: 40, name: "Нікель лом", price: 10 },

  // Кольорові метали
  { id: 41, name: "ЦАМ", price: 66 },
  { id: 42, name: "Магній", price: 50 },
  { id: 43, name: "Цинк", price: 85 },

  // Свинець та АКБ
  { id: 44, name: "Свинець кабельний", price: 67 },
  { id: 45, name: "Свинець звичайний", price: 65 },
  { id: 46, name: "Свинець шиномонтаж", price: 10 },
  { id: 47, name: "АКБ білий", price: 25 },
  { id: 48, name: "АКБ чорний", price: 17 },
  { id: 49, name: "ТНЖ великі", price: 18 },
  { id: 50, name: "ТНЖ маленькі", price: 16 },
  { id: 51, name: "ТНЖ 4-к", price: 5 },

  // Рідкісні метали
  { id: 52, name: "Титан", price: 85 },

  // Сплави
  { id: 53, name: "Бабіт (16)", price: 10 },
  { id: 54, name: "Бабіт (82)", price: 10 },
  { id: 55, name: "Кремній", price: 10 },
  { id: 56, name: "Мельхіор", price: 10 },
  { id: 57, name: "МН", price: 10 },
  { id: 58, name: "Олово", price: 10 },
  { id: 59, name: "Припой", price: 10 },

  // Швидкорізи та спецсплави
  { id: 60, name: "Рапід Р6М5", price: 10 },
  { id: 61, name: "Рапід Р18", price: 10 },
  { id: 62, name: "Вольфрам", price: 10 },
  { id: 63, name: "Молібден", price: 10 },
  { id: 64, name: "Феромолібден", price: 10 },
  { id: 65, name: "Ферованадій", price: 10 },

  // Чорний метал
  { id: 66, name: "Чорний метал", price: 5.5 }
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