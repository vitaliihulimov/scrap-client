const Database = require('better-sqlite3');
const db = new Database('warehouse.db');

console.log('Початкова кількість:',
    db.prepare('SELECT COUNT(*) as count FROM invoices').get().count);

// Видалити все
db.transaction(() => {
    db.prepare('DELETE FROM invoice_items').run();
    db.prepare('DELETE FROM invoices').run();
})();

console.log('Після видалення:',
    db.prepare('SELECT COUNT(*) as count FROM invoices').get().count);

db.close();
console.log('✅ Готово!');