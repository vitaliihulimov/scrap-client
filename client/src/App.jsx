import React, { useState, useEffect, useRef, useCallback } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL ?
    `${import.meta.env.VITE_API_URL}/api` :
    'http://localhost:3000/api';

const ADMIN_PASSWORD = "11111";

export default function App() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [invoices, setInvoices] = useState([]);
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [sortAsc, setSortAsc] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [printInvoice, setPrintInvoice] = useState(null);
    const [dailyReportDate, setDailyReportDate] = useState(new Date().toISOString().split('T')[0]);
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [metalPrices, setMetalPrices] = useState([]);
    const [isSavingPrice, setIsSavingPrice] = useState(false);
    const [tempPrices, setTempPrices] = useState({});
    const [contaminationRates, setContaminationRates] = useState({});
    const [tempContamination, setTempContamination] = useState({});
    const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
    const [adminPassword, setAdminPassword] = useState("");
    const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
    const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | ok | error

    const initialItemsRef = useRef([]);

    const roundWeightWithContamination = (weight, contaminationRate) => {
        if (!weight || weight <= 0) return 0;
        const cleanWeight = weight * (1 - contaminationRate / 100);
        if (cleanWeight < 10) {
            // до 10 кг — обрізання до 2 знаків (0.01 кг)
            return Math.floor(cleanWeight * 100) / 100;
        } else {
            // від 10 кг — обрізання до 1 знаку (0.1 кг)
            return Math.floor(cleanWeight * 10) / 10;
        }
    };

    const calculateSum = (weight, price, metalName, contaminationRate) => {
        if (!weight || weight <= 0) return 0;
        const weightWithCont = roundWeightWithContamination(weight, contaminationRate);
        return Math.floor(weightWithCont * price); // завжди обрізання вниз до 1 грн
    };

    const shortenMetalName = (name) => {
        const shortenings = {
            "Мідь блеск": "Мідь бл", "Мідь М1": "Мідь М1", "Мідь М3": "Мідь М3",
            "Мідь фосфорна": "Мідь фос", "Мідна стружка": "Мід стр", "Мідна лента": "Мід лент",
            "Мідний скрап": "Мід скрап", "Латунь": "Латунь", "Латунний радіатор": "Лат рад",
            "Латунна стружка": "Лат стр", "Латунний скрап": "Лат скрап", "Стакан великий": "Стак вел",
            "Стакан маленький": "Стак мал", "ОЦС": "ОЦС", "БРАЖ": "БРАЖ",
            "Алюмінієвий провод": "Ал пров", "Алюміній піщевий": "Ал піщ",
            "Алюмінієвий профіль": "Ал проф", "Алюмінієві діскі": "Ал діск",
            "Алюміній побутовий": "Ал побут", "АМГ": "АМГ", "Алюмінієва банка": "Ал бан",
            "Алюмінієвий радіатор": "Ал рад", "Алюміній самолет": "Ал сам",
            "Алюміній военка": "Ал воєн", "Алюміній моторняк": "Ал мот",
            "Алюмінієва стружка": "Ал стр", "Алюмінієвий скрап": "Ал скрап",
            "Нержавейка (10% нікелю)": "Нерж 10%", "Нержавейка (10% Б55)": "Нерж Б55",
            "Нержавейка (9% нікелю)": "Нерж 9%", "Нержавейка (8% нікелю)": "Нерж 8%",
            "Нержавейка (0% нікелю)": "Нерж 0%", "Височка скрап": "Вис скр",
            "Нержавіюча стружка (10%)": "Нерж стр10%", "Нержавіюча стружка (9%)": "Нерж стр9%",
            "Нержавіюча стружка (8%)": "Нерж стр8%", "Нержавіючий скрап": "Нерж скр",
            "Нікель": "Нікель", "Нікель лом": "Нік лом",
            "ЦАМ": "ЦАМ", "Магній": "Магній", "Цинк": "Цинк",
            "Свинець кабельний": "Св каб", "Свинець звичайний": "Св зв",
            "Свинець шиномонтаж": "Св шин", "АКБ білий": "АКБ біл", "АКБ чорний": "АКБ чор",
            "ТНЖ великі": "ТНЖ вел", "ТНЖ маленькі": "ТНЖ мал", "ТНЖ 4-к": "ТНЖ 4к",
            "Титан": "Титан", "Бабіт (16)": "Баб 16", "Бабіт (82)": "Баб 82",
            "Кремній": "Крем", "Мельхіор": "Мельх", "МН": "МН", "Олово": "Олово",
            "Припой": "Припой", "Рапід Р6М5": "Р6М5", "Рапід Р18": "Р18",
            "Вольфрам": "Вольф", "Молібден": "Моліб", "Феромолібден": "Феромол",
            "Ферованадій": "Ферован", "Чорний метал": "Чорн мет"
        };
        return shortenings[name] || name.substring(0, 8);
    };

    // ====== localStorage тільки для накладних (резервний кеш) ======
    const saveInvoicesToLocalStorage = useCallback((inv) => {
        try { localStorage.setItem('invoices', JSON.stringify(inv)); } catch (e) { }
    }, []);

    const loadInvoicesFromLocalStorage = useCallback(() => {
        try {
            const saved = localStorage.getItem('invoices');
            return saved ? JSON.parse(saved) : null;
        } catch (e) { return null; }
    }, []);

    // ====== Завантаження всіх даних з сервера ======
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // 1. Метали та ціни — тільки з сервера
                const metalsRes = await fetch(`${API_BASE_URL}/metals`);
                if (!metalsRes.ok) throw new Error('Сервер не відповідає');
                const metalsData = await metalsRes.json();

                const formattedData = metalsData.map(m => ({
                    ...m,
                    price: Number(m.price),
                    weight: "",
                    initialPrice: Number(m.price),
                }));

                setItems(formattedData);
                setMetalPrices(formattedData);
                initialItemsRef.current = formattedData;

                // 2. Засмічення — тільки з сервера
                const contRes = await fetch(`${API_BASE_URL}/contamination`);
                if (contRes.ok) {
                    const serverRates = await contRes.json();
                    if (Object.keys(serverRates).length > 0) {
                        setContaminationRates(serverRates);
                    }
                }

                // 3. Накладні — з сервера, fallback до localStorage
                try {
                    const invRes = await fetch(`${API_BASE_URL}/invoices`);
                    if (invRes.ok) {
                        const serverInvoices = await invRes.json();
                        setInvoices(serverInvoices);
                        saveInvoicesToLocalStorage(serverInvoices);
                    } else {
                        throw new Error('invoices error');
                    }
                } catch {
                    const cached = loadInvoicesFromLocalStorage();
                    setInvoices(cached || []);
                }

                setSyncStatus("ok");
            } catch (error) {
                console.error("Помилка завантаження даних з сервера:", error);
                setSyncStatus("error");

                // Fallback — накладні з localStorage
                const cached = loadInvoicesFromLocalStorage();
                setInvoices(cached || []);
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, [saveInvoicesToLocalStorage, loadInvoicesFromLocalStorage]);

    // Оновлення загальної суми
    useEffect(() => {
        const newTotal = items.reduce((acc, item) => {
            const weight = Number(item.weight) || 0;
            const rate = contaminationRates[item.name] || 0;
            return acc + calculateSum(weight, item.price, item.name, rate);
        }, 0);
        setTotal(newTotal);
    }, [items, contaminationRates]);

    // ====== Засмічення ======
    const updateContaminationRate = async (metalName, newRate) => {
        if (newRate < 0 || newRate > 100) {
            alert("Відсоток засмічення має бути від 0 до 100");
            return;
        }
        setContaminationRates(prev => ({ ...prev, [metalName]: newRate }));
        try {
            await fetch(`${API_BASE_URL}/contamination/${encodeURIComponent(metalName)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rate: newRate })
            });
        } catch (error) {
            console.error('Помилка збереження засмічення:', error);
        }
    };

    const updateTempContamination = (metalName, newRate) => {
        setTempContamination(prev => ({ ...prev, [metalName]: newRate }));
    };

    const saveAllContaminationChanges = async () => {
        if (Object.keys(tempContamination).length === 0) {
            alert("Немає змін для збереження");
            return;
        }
        const updatedRates = { ...contaminationRates, ...tempContamination };
        setContaminationRates(updatedRates);
        try {
            const response = await fetch(`${API_BASE_URL}/contamination`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedRates)
            });
            if (response.ok) {
                setTempContamination({});
                alert("✅ Засмічення збережено на сервері!");
            } else {
                alert('❌ Помилка при збереженні');
            }
        } catch {
            alert('⚠️ Сервер недоступний');
        }
    };

    const cancelContaminationChanges = () => {
        setTempContamination({});
    };

    // ====== Ціни ======
    const updateTempPrice = (id, newPrice) => {
        setMetalPrices(prev => prev.map(m => m.id === id ? { ...m, price: newPrice } : m));
        setTempPrices(prev => ({ ...prev, [id]: newPrice }));
    };

    const updateMetalPrice = async (id, newPrice, name) => {
        if (newPrice < 0) { alert("Ціна не може бути від'ємною!"); return; }
        setIsSavingPrice(true);
        try {
            const response = await fetch(`${API_BASE_URL}/metals/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ price: newPrice })
            });
            if (response.ok) {
                // Оновлюємо локальний стан після підтвердження сервера
                setMetalPrices(prev => prev.map(m => m.id === id ? { ...m, price: newPrice, initialPrice: newPrice } : m));
                setItems(prev => prev.map(item => item.id === id ? { ...item, price: newPrice, initialPrice: newPrice } : item));
                initialItemsRef.current = initialItemsRef.current.map(item =>
                    item.id === id ? { ...item, price: newPrice, initialPrice: newPrice } : item
                );
                setTempPrices(prev => { const n = { ...prev }; delete n[id]; return n; });
                alert(`✅ Ціну на ${name} оновлено до ${newPrice} грн/кг`);
            } else {
                alert('❌ Помилка збереження на сервері');
            }
        } catch {
            alert('⚠️ Сервер недоступний');
        } finally {
            setIsSavingPrice(false);
        }
    };

    const updateAllPrices = async () => {
        if (!window.confirm("Зберегти всі змінені ціни на сервері?")) return;
        setIsSavingPrice(true);
        try {
            await Promise.all(
                metalPrices
                    .filter(m => tempPrices[m.id] !== undefined)
                    .map(m => fetch(`${API_BASE_URL}/metals/${m.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ price: m.price })
                    }).catch(() => null))
            );
            const updated = metalPrices.map(m => ({ ...m, initialPrice: m.price }));
            setMetalPrices(updated);
            setItems(prev => prev.map(item => {
                const found = updated.find(m => m.id === item.id);
                return found ? { ...item, price: found.price, initialPrice: found.price } : item;
            }));
            initialItemsRef.current = initialItemsRef.current.map(item => {
                const found = updated.find(m => m.id === item.id);
                return found ? { ...item, price: found.price, initialPrice: found.price } : item;
            });
            setTempPrices({});
            alert("✅ Всі ціни збережено!");
        } catch {
            alert('⚠️ Помилка збереження');
        } finally {
            setIsSavingPrice(false);
        }
    };

    const cancelAllPriceChanges = () => {
        if (!window.confirm("Скасувати всі незбережені зміни цін?")) return;
        // Відновлюємо ціни до поточних серверних (initialPrice)
        setMetalPrices(prev => prev.map(m => ({ ...m, price: m.initialPrice })));
        setTempPrices({});
    };

    const resetToDefaultPrices = async () => {
        if (!window.confirm("Скинути всі ціни до значень з сервера?")) return;
        setIsSavingPrice(true);
        try {
            const res = await fetch(`${API_BASE_URL}/metals`);
            if (res.ok) {
                const data = await res.json();
                const fresh = data.map(m => ({ ...m, price: Number(m.price), initialPrice: Number(m.price), weight: "" }));
                setItems(fresh);
                setMetalPrices(fresh);
                initialItemsRef.current = fresh;
                setTempPrices({});
                alert("✅ Ціни оновлено з сервера!");
            }
        } catch {
            alert('⚠️ Помилка');
        } finally {
            setIsSavingPrice(false);
        }
    };

    // ====== Накладні ======
    const deleteAllInvoices = async () => {
        if (!window.confirm("ВИДАЛИТИ ВСІ НАКЛАДНІ? Цю дію неможливо скасувати!")) return;
        try {
            await fetch(`${API_BASE_URL}/invoices`, { method: 'DELETE' });
            setInvoices([]);
            localStorage.removeItem('invoices');
            alert("✅ Всі накладні видалені!");
        } catch {
            alert('⚠️ Помилка видалення');
        }
    };

    const deleteInvoice = async (invoiceId) => {
        if (!window.confirm("Видалити цю накладну?")) return;
        try {
            await fetch(`${API_BASE_URL}/invoices/${invoiceId}`, { method: 'DELETE' });
            const updated = invoices.filter(inv => inv.id !== invoiceId);
            setInvoices(updated);
            saveInvoicesToLocalStorage(updated);
        } catch {
            alert('⚠️ Помилка видалення');
        }
    };

    const updateWeight = (id, value) => {
        const cleanedValue = value.replace(/[^\d.]/g, '');
        const parts = cleanedValue.split('.');
        const finalValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleanedValue;
        setItems(items.map(i => (i.id === id ? { ...i, weight: finalValue } : i)));
    };

    const updatePrice = (id, value) => {
        const numValue = Number(value);
        if (!isNaN(numValue) && numValue >= 0) {
            setItems(items.map(i => (i.id === id ? { ...i, price: numValue } : i)));
        }
    };

    const resetForm = () => {
        setItems(initialItemsRef.current.map(item => ({
            ...item,
            weight: "",
            price: item.initialPrice,
        })));
    };

    const saveAndPrint = async () => {
        const itemsWithWeight = items.filter(i => {
            const weight = Number(i.weight);
            return !isNaN(weight) && weight > 0;
        });
        if (itemsWithWeight.length === 0) {
            alert("Введіть вагу для хоча б одного металу");
            return;
        }
        setIsSaving(true);
        try {
            const invoiceItems = itemsWithWeight.map(item => {
                const rate = contaminationRates[item.name] || 0;
                const weight = Number(item.weight);
                const weightWithCont = roundWeightWithContamination(weight, rate);
                const sum = Math.floor(weightWithCont * item.price);
                return {
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    weight: weight,
                    weightWithContamination: weightWithCont,
                    contaminationRate: rate,
                    sum: sum
                };
            });

            const invoiceTotal = invoiceItems.reduce((acc, item) => acc + item.sum, 0);
            const newInvoice = { items: invoiceItems, total: invoiceTotal, created_at: new Date().toISOString() };

            const res = await fetch(`${API_BASE_URL}/invoices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newInvoice)
            });

            if (res.ok) {
                const result = await res.json();
                const savedInvoice = { id: result.invoiceId, ...newInvoice };
                const updatedInvoices = [savedInvoice, ...invoices];
                setInvoices(updatedInvoices);
                saveInvoicesToLocalStorage(updatedInvoices);
                viewReceipt(savedInvoice);
                resetForm();
                alert(`Накладна №${result.invoiceId} збережена!`);
            } else {
                throw new Error('Помилка збереження');
            }
        } catch (error) {
            console.error("Помилка збереження накладної:", error);
            alert("⚠️ Не вдалося зберегти накладну. Перевірте з'єднання з сервером.");
        } finally {
            setIsSaving(false);
        }
    };

    // ====== Звіт ======
    const generateDailyReport = () => {
        if (!dailyReportDate) { alert("Виберіть дату"); return; }
        const selectedDate = new Date(dailyReportDate);
        const start = new Date(selectedDate); start.setHours(0, 0, 0, 0);
        const end = new Date(selectedDate); end.setHours(23, 59, 59, 999);

        const dayInvoices = invoices.filter(inv => {
            if (!inv.created_at) return false;
            const d = new Date(inv.created_at);
            return d >= start && d <= end;
        });

        if (dayInvoices.length === 0) {
            alert(`На дату ${selectedDate.toLocaleDateString('uk-UA')} немає накладних`);
            return;
        }

        const allMetals = {};
        initialItemsRef.current.forEach(metal => {
            allMetals[metal.name] = {
                name: metal.name, totalWeight: 0, totalWeightWithCont: 0,
                totalAmount: 0, averagePrice: 0, transactions: [],
                price: metal.price, id: metal.id, hasTransactions: false,
                contaminationRate: contaminationRates[metal.name] || 0
            };
        });

        let totalDayAmount = 0;
        dayInvoices.forEach(invoice => {
            invoice.items.forEach(item => {
                if (allMetals[item.name]) {
                    const weight = Number(item.weight) || 0;
                    const weightWithCont = Number(item.weightWithContamination) || roundWeightWithContamination(Number(weight), Number(item.contaminationRate) || 0);
                    const amount = isFinite(Number(item.sum)) ? Math.abs(Number(item.sum)) : 0;
                    allMetals[item.name].totalWeight += Number(weight);
                    allMetals[item.name].totalWeightWithCont += Number(weightWithCont);
                    allMetals[item.name].totalAmount += Number(amount);
                    allMetals[item.name].hasTransactions = true;
                    allMetals[item.name].transactions.push({ weight, weightWithCont, price: item.price, contaminationRate: item.contaminationRate || 0, amount });
                    totalDayAmount += Number(amount);
                }
            });
        });

        Object.keys(allMetals).forEach(name => {
            const m = allMetals[name];
            if (m.totalWeight > 0) m.averagePrice = Math.round((m.totalAmount / m.totalWeight) * 100) / 100;
        });

        const sortedMetals = Object.values(allMetals).filter(m => m.hasTransactions).sort((a, b) => a.id - b.id);
        console.log('dayInvoices:', dayInvoices);
        console.log('sortedMetals:', sortedMetals);
        console.log('totalDayAmount:', totalDayAmount);
        const safeTotalDayAmount = isFinite(totalDayAmount) ? Math.floor(totalDayAmount) : 0;
        generateReportPDF(selectedDate, sortedMetals, dayInvoices, safeTotalDayAmount);
    };

    const generateReportPDF = (date, metalStats, dayInvoices, totalDayAmount) => {
        console.log('generateReportPDF called', { date, metalStats, dayInvoices, totalDayAmount });
        const printWindow = window.open('', '_blank');
        if (!printWindow) { alert("Дозвольте спливаючі вікна"); return; }
        const reportDateStr = date.toLocaleDateString('uk-UA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Звіт</title>
        <style>
            @page { size: A4; margin: 20mm; }
            body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.4; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
            .header h1 { font-size: 24pt; font-weight: bold; margin: 0 0 10px 0; text-transform: uppercase; }
            .header h2 { font-size: 18pt; font-weight: normal; margin: 5px 0; }
            .summary { margin-bottom: 30px; padding: 20px; background: #f5f5f5; border: 1px solid #000; }
            .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
            .summary-value { font-size: 18pt; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 11pt; }
            th { background: #000; color: white; padding: 10px 5px; text-align: center; border: 1px solid #000; }
            td { border: 1px solid #000; padding: 8px 5px; }
            tr:nth-child(even) { background: #f5f5f5; }
            .total-row { font-weight: bold; background: #e0e0e0 !important; }
            .total-row td { border-top: 2px solid #000; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .number-cell { text-align: right; font-family: 'Courier New', monospace; }
            .signature { margin-top: 50px; padding-top: 20px; border-top: 1px solid #000; display: flex; justify-content: space-between; }
            .signature-line { width: 200px; border-bottom: 1px solid #000; margin-top: 5px; }
            .footer { margin-top: 30px; font-size: 10pt; color: #666; text-align: center; font-style: italic; }
            @media print { .no-print { display: none; } th { background: #000 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style></head><body>
        <div class="no-print" style="text-align:center;margin-bottom:20px;padding:15px;background:#f0f0f0;border:1px solid #ccc;border-radius:5px;">
            <button onclick="window.print()" style="padding:10px 25px;font-size:14px;cursor:pointer;background:#28a745;color:white;border:none;border-radius:4px;margin-right:10px;">🖨️ Друкувати</button>
            <button onclick="window.close()" style="padding:10px 25px;font-size:14px;cursor:pointer;background:#dc3545;color:white;border:none;border-radius:4px;">✕ Закрити</button>
        </div>
        <div class="header"><h1>ЗВІТ ЗА ДЕНЬ</h1><h2>${reportDateStr}</h2></div>
        <div class="summary"><div class="summary-grid">
            <div><strong>Дата звіту:</strong><div>${new Date().toLocaleDateString('uk-UA')}</div></div>
            <div><strong>Накладних:</strong><div class="summary-value">${dayInvoices.length}</div></div>
            <div><strong>Загальна сума:</strong><div class="summary-value">${totalDayAmount.toLocaleString('uk-UA')} грн</div></div>
        </div></div>
        <table><thead><tr>
            <th width="4%">№</th><th width="25%">Найменування</th><th width="5%">Засм.%</th>
            <th width="7%">Ціна</th><th width="8%">Вага (кг)</th><th width="8%">Вага з засм.</th>
            <th width="8%">Сума (грн)</th><th width="5%">К-сть</th><th width="10%">Сер. ціна</th>
        </tr></thead><tbody>
        ${metalStats.map((m, i) => `<tr>
            <td class="text-center">${i + 1}</td><td><strong>${m.name}</strong></td>
            <td class="text-center">${m.contaminationRate}%</td><td class="number-cell">${m.price}</td>
            <td class="number-cell">${m.totalWeight.toFixed(2)}</td><td class="number-cell">${m.totalWeightWithCont.toFixed(2)}</td>
            <td class="number-cell"><strong>${m.totalAmount.toLocaleString('uk-UA')}</strong></td>
            <td class="text-center">${m.transactions.length}</td><td class="number-cell"><strong>${m.averagePrice.toFixed(2)}</strong></td>
        </tr>`).join('')}
        <tr class="total-row">
            <td colspan="4" class="text-right"><strong>РАЗОМ:</strong></td>
            <td class="number-cell"><strong>${metalStats.reduce((s, m) => s + m.totalWeight, 0).toFixed(2)}</strong></td>
            <td class="number-cell"><strong>${metalStats.reduce((s, m) => s + m.totalWeightWithCont, 0).toFixed(2)}</strong></td>
            <td class="number-cell"><strong>${totalDayAmount.toLocaleString('uk-UA')}</strong></td>
            <td class="text-center"><strong>${metalStats.reduce((s, m) => s + m.transactions.length, 0)}</strong></td>
            <td>-</td>
        </tr></tbody></table>
        <div class="signature">
            <div><div>Підпис:</div><div class="signature-line"></div></div>
            <div><div>М.П.</div></div>
            <div><div>Дата:</div><div class="signature-line"></div></div>
        </div>
        <div class="footer">Звіт згенеровано автоматично</div>
        <script>window.onload = () => setTimeout(() => window.print(), 500);</script>
        </body></html>`);
        printWindow.document.close();
    };

    // ====== Чек ======
    const formatReceiptForPrinter = (invoice) => {
        if (!invoice || !invoice.items) return "Помилка: немає даних";
        const maxWidth = 40;
        let receipt = "";
        const title = "НАКЛАДНА";
        receipt += " ".repeat(Math.floor((maxWidth - title.length) / 2)) + title + "\n";
        receipt += "=".repeat(maxWidth) + "\n";
        receipt += `№: ${invoice.id || "---"}\n`;
        const date = invoice.created_at ? new Date(invoice.created_at) : new Date();
        receipt += `Дата: ${date.toLocaleDateString('uk-UA')}\n`;
        receipt += `Час: ${date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}\n`;
        receipt += "-".repeat(maxWidth) + "\n";
        receipt += "МЕТАЛ  %  ЦІНА  ВАГА  ВАГЗ  СУМА\n";
        receipt += "-".repeat(maxWidth) + "\n";
        invoice.items.forEach(item => {
            let name = shortenMetalName(item.name || "Метал");
            if (name.length > 5) name = name.substring(0, 5);
            name = name.padEnd(5, ' ');
            const rate = (item.contaminationRate || 0).toString().padStart(3, ' ');
            const priceStr = Number(item.price || 0) % 1 === 0
                ? Math.floor(item.price || 0).toString().padStart(4, ' ')
                : Number(item.price || 0).toFixed(1).padStart(4, ' ');
            const w = Number(item.weight) || 0;
            const wc = Number(item.weightWithContamination) || 0;
            const weightStr = w.toFixed(w < 10 ? 2 : 1).padStart(5, ' ');
            const weightWithContStr = wc.toFixed(wc < 10 ? 2 : 1).padStart(5, ' ');
            const sumStr = (item.sum || 0).toString().padStart(4, ' ');
            receipt += `${name} ${rate} ${priceStr} ${weightStr} ${weightWithContStr} ${sumStr}\n`;
        });
        receipt += "-".repeat(maxWidth) + "\n";
        receipt += `РАЗОМ:      ${Math.floor(invoice.total || 0)} грн\n`;
        receipt += "=".repeat(maxWidth) + "\n\n";
        receipt += "Підпис:___________\n\nДякуємо!\n";
        return receipt;
    };

    const viewReceipt = (invoice) => {
        if (!invoice) return;
        const receiptText = formatReceiptForPrinter(invoice);
        setPrintInvoice({ ...invoice, receiptText });
    };

    const printToReceiptPrinter = (invoice) => {
        if (!invoice) return;
        const receiptText = formatReceiptForPrinter(invoice);
        const printWindow = window.open('', '_blank');
        if (!printWindow) { alert("Дозвольте спливаючі вікна"); return; }
        printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Чек №${invoice.id}</title>
        <style>
            @media print {
                @page { size: 80mm auto; margin: 2mm !important; }
                body { margin: 0 !important; padding: 2mm !important; width: 76mm !important; font-family: 'Courier New', monospace !important; font-size: 11pt !important; font-weight: 600 !important; line-height: 1.3 !important; color: black !important; }
                .receipt-content { white-space: pre !important; width: 100% !important; font-size: 11pt !important; font-weight: 600 !important; }
                .no-print { display: none !important; }
            }
            body { font-family: 'Courier New', monospace; font-size: 14px; font-weight: 600; line-height: 1.4; padding: 20px; background: #f5f5f5; }
            .receipt-content { white-space: pre; font-family: 'Courier New', monospace; font-size: 14px; font-weight: 600; line-height: 1.4; background: white; padding: 20px; border: 1px solid #ccc; border-radius: 4px; margin: 0 auto; max-width: 400px; }
            .controls { text-align: center; margin: 20px 0; padding: 15px; background: white; border-radius: 8px; }
            button { padding: 10px 20px; margin: 5px; font-size: 16px; cursor: pointer; color: white; border: none; border-radius: 4px; }
        </style></head><body>
        <div class="controls no-print">
            <button style="background:#28a745" onclick="window.print()">🖨️ Друкувати чек</button>
            <button style="background:#dc3545" onclick="window.close()">✕ Закрити</button>
        </div>
        <div class="receipt-content">${receiptText}</div>
        <div class="controls no-print">
            <button style="background:#28a745" onclick="window.print()">🖨️ Друкувати чек</button>
            <button style="background:#dc3545" onclick="window.close()">✕ Закрити</button>
        </div>
        <script>window.addEventListener('load', () => setTimeout(() => window.print(), 500));</script>
        </body></html>`);
        printWindow.document.close();
    };

    const copyReceiptToClipboard = (invoice) => {
        const receiptText = formatReceiptForPrinter(invoice);
        navigator.clipboard.writeText(receiptText)
            .then(() => alert("Текст чеку скопійовано!"))
            .catch(() => {
                const ta = document.createElement('textarea');
                ta.value = receiptText;
                ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.select();
                try { document.execCommand('copy'); alert("Скопійовано!"); } catch { }
                document.body.removeChild(ta);
            });
    };

    const testServerConnection = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/metals`);
            const data = await res.json();
            alert(`✅ Сервер працює! Металів: ${data.length}`);
        } catch {
            alert("❌ Сервер недоступний");
        }
    };

    const filteredInvoices = invoices
        .filter(inv => {
            if (!fromDate && !toDate) return true;
            if (!inv.created_at) return false;
            const d = new Date(inv.created_at); d.setHours(0, 0, 0, 0);
            if (fromDate) { const f = new Date(fromDate); f.setHours(0, 0, 0, 0); if (d < f) return false; }
            if (toDate) { const t = new Date(toDate); t.setHours(23, 59, 59, 999); if (d > t) return false; }
            return true;
        })
        .sort((a, b) => {
            const dA = new Date(a.created_at || 0), dB = new Date(b.created_at || 0);
            return sortAsc ? dB - dA : dA - dB;
        });

    const totalFiltered = filteredInvoices.reduce((sum, i) => sum + (Number(i.total) || 0), 0);

    if (loading) return <div style={{ padding: 40, color: 'white', textAlign: 'center', fontSize: '1.2rem' }}>⏳ Завантаження даних з сервера...</div>;

    const s = { // styles shorthand
        input: { padding: '10px', border: '1px solid #555', borderRadius: '6px', fontSize: '14px', backgroundColor: '#333', color: '#fff', outline: 'none' },
        btn: (bg) => ({ padding: "10px 20px", backgroundColor: bg, color: bg === '#ffc107' ? 'black' : 'white', border: "none", borderRadius: '6px', cursor: "pointer", fontSize: '14px', fontWeight: '500' }),
    };

    return (
        <>
            <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', backgroundColor: '#1a1a1a', minHeight: '100vh', color: '#e0e0e0' }}>
                <h1 style={{ color: '#ffffff', marginBottom: '20px', textAlign: 'center', fontSize: '2.5rem', fontWeight: '300' }}>
                    Система обліку металів
                </h1>

                {/* Статус синхронізації */}
                <div style={{ backgroundColor: syncStatus === 'error' ? '#3a1a1a' : '#1a3a1a', padding: '12px 20px', borderRadius: '8px', marginBottom: '20px', border: `1px solid ${syncStatus === 'error' ? '#dc3545' : '#28a745'}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>{syncStatus === 'error' ? '⚠️' : '🟢'}</span>
                    <div>
                        <div style={{ color: '#ffffff', fontWeight: '500' }}>
                            {syncStatus === 'error' ? 'Сервер недоступний — показано кешовані дані' : 'Дані синхронізовані з сервером'}
                        </div>
                        <div style={{ color: '#aaa', fontSize: '0.85rem' }}>
                            {syncStatus === 'error' ? 'Ціни та засмічення можуть бути застарілими' : 'Ціни та засмічення однакові на всіх пристроях'}
                        </div>
                    </div>
                </div>

                {/* Кнопки */}
                <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button onClick={testServerConnection} style={s.btn('#28a745')}>🔌 Тестувати сервер</button>
                    <button onClick={() => setShowPasswordPrompt(true)} style={s.btn('#ffc107')}>⚙️ Адмін-панель</button>
                    <button onClick={deleteAllInvoices} style={s.btn('#dc3545')}>🗑️ Видалити всі накладні</button>
                </div>

                {/* Пароль */}
                {showPasswordPrompt && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
                        <div style={{ backgroundColor: '#2d2d2d', padding: '30px', borderRadius: '12px', width: '400px', maxWidth: '90%', border: '2px solid #404040' }}>
                            <h3 style={{ color: '#ffffff', marginBottom: '20px', textAlign: 'center' }}>🔐 Введіть пароль</h3>
                            <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)}
                                onKeyPress={e => { if (e.key === 'Enter') { if (adminPassword === ADMIN_PASSWORD) { setIsAdminAuthenticated(true); setShowAdminPanel(true); setShowPasswordPrompt(false); setAdminPassword(""); } else { alert("❌ Невірний пароль!"); setAdminPassword(""); } } }}
                                placeholder="Пароль" autoFocus style={{ ...s.input, width: '100%', marginBottom: '20px', boxSizing: 'border-box' }} />
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                <button onClick={() => { if (adminPassword === ADMIN_PASSWORD) { setIsAdminAuthenticated(true); setShowAdminPanel(true); setShowPasswordPrompt(false); setAdminPassword(""); } else { alert("❌ Невірний пароль!"); setAdminPassword(""); } }} style={s.btn('#28a745')}>Увійти</button>
                                <button onClick={() => { setShowPasswordPrompt(false); setAdminPassword(""); }} style={s.btn('#dc3545')}>Скасувати</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Звіт за день */}
                <div style={{ backgroundColor: '#2d2d2d', padding: '25px', borderRadius: '12px', marginBottom: '30px', border: '1px solid #404040' }}>
                    <h2 style={{ color: '#ffffff', marginBottom: '20px', fontSize: '1.5rem', borderBottom: '2px solid #404040', paddingBottom: '10px' }}>📊 Звіт за день</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                        <div>
                            <span style={{ marginRight: '10px', color: '#e0e0e0' }}>Дата:</span>
                            <input type="date" value={dailyReportDate} onChange={e => setDailyReportDate(e.target.value)} style={{ ...s.input, width: '200px' }} />
                        </div>
                        <button onClick={generateDailyReport} style={{ ...s.btn('#6f42c1'), padding: '12px 25px', fontSize: '15px' }}>📄 Згенерувати звіт</button>
                    </div>
                </div>

                {/* Нова накладна */}
                <div style={{ backgroundColor: '#2d2d2d', padding: '25px', borderRadius: '12px', marginBottom: '30px', border: '1px solid #404040' }}>
                    <h2 style={{ color: '#ffffff', marginBottom: '20px', fontSize: '1.5rem', borderBottom: '2px solid #404040', paddingBottom: '10px' }}>Нова накладна</h2>
                    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #404040' }}>
                        <table width="100%" cellPadding="12" style={{ borderCollapse: 'collapse', backgroundColor: '#242424', minWidth: '1000px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#333333' }}>
                                    {['Метал', 'Ціна / кг', 'Засмічення (%)', 'Вага (кг)', 'Вага з засміченням', 'Сума'].map(h => (
                                        <th key={h} style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #404040', color: '#ffffff', fontWeight: '600' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(i => {
                                    const rate = contaminationRates[i.name] || 0;
                                    const weight = Number(i.weight) || 0;
                                    const weightWithCont = roundWeightWithContamination(weight, rate);
                                    const sum = calculateSum(weight, i.price, i.name, rate);
                                    return (
                                        <tr key={i.id} style={{ borderBottom: '1px solid #404040' }}
                                            onMouseOver={e => e.currentTarget.style.backgroundColor = '#2d2d2d'}
                                            onMouseOut={e => e.currentTarget.style.backgroundColor = '#242424'}>
                                            <td style={{ padding: '15px', color: '#e0e0e0' }}>{i.name}</td>
                                            <td style={{ padding: '15px' }}>
                                                <input type="number" step="0.01" min="0" value={i.price}
                                                    onChange={e => updatePrice(i.id, e.target.value)}
                                                    style={{ ...s.input, width: '100px' }} />
                                            </td>
                                            <td style={{ padding: '15px' }}>
                                                <input type="number" step="0.1" min="0" max="100" value={rate}
                                                    onChange={e => setContaminationRates(prev => ({ ...prev, [i.name]: parseFloat(e.target.value) || 0 }))}
                                                    style={{ ...s.input, width: '80px', border: '1px solid #ffc107' }} />
                                            </td>
                                            <td style={{ padding: '15px' }}>
                                                <input type="text" inputMode="decimal" placeholder="0.0" value={i.weight}
                                                    onChange={e => updateWeight(i.id, e.target.value)}
                                                    style={{ ...s.input, width: '100px' }} />
                                            </td>
                                            <td style={{ padding: '15px', color: '#28a745', fontWeight: 'bold', fontSize: '16px' }}>{weightWithCont.toFixed(2)} кг</td>
                                            <td style={{ padding: '15px', fontWeight: 'bold', color: '#28a745', fontSize: '16px' }}>{sum} грн</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ marginTop: '25px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#333', padding: '20px', borderRadius: '8px', border: '1px solid #404040' }}>
                        <h3 style={{ margin: 0, color: '#ffffff' }}>Всього: <span style={{ color: '#28a745', fontSize: '1.5rem', fontWeight: 'bold' }}>{total} грн</span></h3>
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <button onClick={resetForm} style={{ ...s.btn('#6c757d'), padding: '12px 25px', fontSize: '15px' }}>🔄 Скинути</button>
                            <button onClick={saveAndPrint} disabled={isSaving} style={{ ...s.btn(isSaving ? '#6c757d' : '#007bff'), padding: '12px 25px', fontSize: '15px', cursor: isSaving ? 'not-allowed' : 'pointer' }}>
                                {isSaving ? "⏳ Збереження..." : "💾 Зберегти накладну"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Список накладних */}
                <div style={{ backgroundColor: '#2d2d2d', padding: '25px', borderRadius: '12px', border: '1px solid #404040' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                        <h2 style={{ color: '#ffffff', margin: 0, fontSize: '1.5rem' }}>Всі накладні</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                            <div><span style={{ marginRight: '8px', color: '#e0e0e0' }}>Від:</span><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={s.input} /></div>
                            <div><span style={{ marginRight: '8px', color: '#e0e0e0' }}>По:</span><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={s.input} /></div>
                            <button onClick={() => setSortAsc(!sortAsc)} style={s.btn('#28a745')}>{sortAsc ? '📅 Новіші зверху' : '📅 Старші зверху'}</button>
                        </div>
                    </div>

                    {filteredInvoices.length > 0 ? (
                        <>
                            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #404040' }}>
                                <table width="100%" cellPadding="12" style={{ borderCollapse: 'collapse', backgroundColor: '#242424', minWidth: '700px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#333333' }}>
                                            {['№', 'Дата', 'Сума', 'Позицій', 'Дії'].map(h => (
                                                <th key={h} style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #404040', color: '#ffffff', fontWeight: '600' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredInvoices.map(inv => (
                                            <tr key={inv.id} style={{ borderBottom: '1px solid #404040' }}
                                                onMouseOver={e => e.currentTarget.style.backgroundColor = '#2d2d2d'}
                                                onMouseOut={e => e.currentTarget.style.backgroundColor = '#242424'}>
                                                <td style={{ padding: '15px', fontWeight: 'bold', color: '#ffffff', fontSize: '16px' }}>{inv.id}</td>
                                                <td style={{ padding: '15px', color: '#e0e0e0' }}>{inv.created_at ? new Date(inv.created_at).toLocaleString('uk-UA') : '—'}</td>
                                                <td style={{ padding: '15px', fontWeight: 'bold', color: '#28a745', fontSize: '16px' }}>{Math.floor(inv.total || 0)} грн</td>
                                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                                    <span style={{ backgroundColor: '#333', color: '#fff', padding: '5px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>
                                                        {inv.items ? inv.items.length : 0}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '15px' }}>
                                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                        <button onClick={() => viewReceipt(inv)} style={s.btn('#17a2b8')}>👁️ Перегляд</button>
                                                        <button onClick={() => printToReceiptPrinter(inv)} style={s.btn('#28a745')}>🖨️ Друк</button>
                                                        <button onClick={() => deleteInvoice(inv.id)} style={s.btn('#dc3545')}>🗑️ Видалити</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ marginTop: '25px', backgroundColor: '#333', padding: '20px', borderRadius: '8px', border: '1px solid #404040', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px' }}>
                                <div><div style={{ color: '#fff', fontWeight: '600' }}>Загальна сума:</div><div style={{ color: '#28a745', fontSize: '1.8rem', fontWeight: 'bold' }}>{Math.floor(totalFiltered)} грн</div></div>
                                <div><div style={{ color: '#fff', fontWeight: '600' }}>Накладних:</div><div style={{ color: '#dc3545', fontSize: '1.8rem', fontWeight: 'bold' }}>{filteredInvoices.length}</div></div>
                                <div><div style={{ color: '#fff', fontWeight: '600' }}>Позицій всього:</div><div style={{ color: '#17a2b8', fontSize: '1.8rem', fontWeight: 'bold' }}>{filteredInvoices.reduce((sum, inv) => sum + (inv.items ? inv.items.length : 0), 0)}</div></div>
                            </div>
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#aaa', backgroundColor: '#242424', borderRadius: '8px', border: '2px dashed #404040' }}>
                            <div style={{ fontSize: '64px', marginBottom: '20px', opacity: 0.5 }}>📄</div>
                            <h3 style={{ color: '#ffffff', fontSize: '1.5rem' }}>Немає накладних</h3>
                            <p>{fromDate || toDate ? 'За обраний період не знайдено.' : 'Створіть першу накладну.'}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Адмін-панель */}
            {showAdminPanel && isAdminAuthenticated && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, padding: '20px', overflow: 'auto' }}>
                    <div style={{ backgroundColor: '#2d2d2d', borderRadius: '12px', width: '100%', maxWidth: '1400px', maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '2px solid #404040', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ backgroundColor: '#333', padding: '20px', borderBottom: '2px solid #404040', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                            <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.5rem' }}>⚙️ Адмін-панель — Ціни та засмічення</h3>
                            <button onClick={() => { setShowAdminPanel(false); setIsAdminAuthenticated(false); }} style={s.btn('#dc3545')}>✕ Закрити</button>
                        </div>

                        <div style={{ padding: '25px', overflowY: 'auto', flex: 1 }}>
                            <div style={{ backgroundColor: '#1a3a1a', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #28a745', color: '#e0e0e0' }}>
                                🟢 <strong>Ціни зберігаються на сервері</strong> — зміни відразу видно на всіх пристроях після натискання "Зберегти".
                            </div>

                            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #404040', marginBottom: '25px' }}>
                                <table width="100%" cellPadding="15" style={{ borderCollapse: 'collapse', backgroundColor: '#242424', minWidth: '900px' }}>
                                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#333333', zIndex: 10 }}>
                                        <tr>
                                            {['Метал', 'Засмічення (%)', 'Приклад 100кг', 'Поточна ціна', 'Нова ціна', 'Дія'].map(h => (
                                                <th key={h} style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #404040', color: '#ffffff', fontWeight: '600' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {metalPrices.map(metal => {
                                            const hasPriceChanged = tempPrices[metal.id] !== undefined;
                                            const currentRate = contaminationRates[metal.name] || 0;
                                            const tempRate = tempContamination[metal.name];
                                            const hasContaminationChanged = tempRate !== undefined && tempRate !== currentRate;
                                            const displayRate = tempRate !== undefined ? tempRate : currentRate;
                                            const exampleWeightWithCont = roundWeightWithContamination(100, displayRate);
                                            return (
                                                <tr key={metal.id} style={{ borderBottom: '1px solid #404040', backgroundColor: (hasPriceChanged || hasContaminationChanged) ? '#2a2a2a' : '#242424' }}
                                                    onMouseOver={e => e.currentTarget.style.backgroundColor = '#2d2d2d'}
                                                    onMouseOut={e => e.currentTarget.style.backgroundColor = (hasPriceChanged || hasContaminationChanged) ? '#2a2a2a' : '#242424'}>
                                                    <td style={{ padding: '15px', color: '#ffffff', fontWeight: '500' }}>{metal.name}</td>
                                                    <td style={{ padding: '15px' }}>
                                                        <input type="number" step="0.1" min="0" max="100" value={displayRate}
                                                            onChange={e => updateTempContamination(metal.name, parseFloat(e.target.value) || 0)}
                                                            style={{ ...s.input, width: '80px', border: `2px solid ${hasContaminationChanged ? '#ffc107' : '#555'}`, fontWeight: 'bold' }} />
                                                    </td>
                                                    <td style={{ padding: '15px', color: '#28a745', fontWeight: 'bold' }}>→ {exampleWeightWithCont.toFixed(2)} кг</td>
                                                    <td style={{ padding: '15px', color: '#e0e0e0', fontWeight: 'bold', fontSize: '16px' }}>{metal.initialPrice} грн</td>
                                                    <td style={{ padding: '15px' }}>
                                                        <input type="number" step="0.01" min="0" value={metal.price}
                                                            onChange={e => updateTempPrice(metal.id, Number(e.target.value))}
                                                            style={{ ...s.input, width: '120px', border: `2px solid ${hasPriceChanged ? '#ffc107' : '#555'}`, fontWeight: 'bold' }} />
                                                    </td>
                                                    <td style={{ padding: '15px' }}>
                                                        <button
                                                            onClick={() => {
                                                                if (hasPriceChanged) updateMetalPrice(metal.id, metal.price, metal.name);
                                                                if (hasContaminationChanged) updateContaminationRate(metal.name, tempRate);
                                                                if (hasContaminationChanged) setTempContamination(prev => { const n = { ...prev }; delete n[metal.name]; return n; });
                                                            }}
                                                            disabled={isSavingPrice || (!hasPriceChanged && !hasContaminationChanged)}
                                                            style={{ ...s.btn(isSavingPrice || (!hasPriceChanged && !hasContaminationChanged) ? '#6c757d' : '#28a745'), cursor: (!hasPriceChanged && !hasContaminationChanged) ? 'not-allowed' : 'pointer' }}>
                                                            {(!hasPriceChanged && !hasContaminationChanged) ? '✅ Збережено' : '💾 Зберегти'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                <button onClick={updateAllPrices} disabled={isSavingPrice || Object.keys(tempPrices).length === 0}
                                    style={{ ...s.btn(Object.keys(tempPrices).length === 0 ? '#6c757d' : '#007bff'), padding: '15px 30px', fontSize: '16px', fontWeight: 'bold' }}>
                                    💾 Зберегти всі ціни
                                </button>
                                <button onClick={saveAllContaminationChanges} disabled={isSavingPrice || Object.keys(tempContamination).length === 0}
                                    style={{ ...s.btn(Object.keys(tempContamination).length === 0 ? '#6c757d' : '#ffc107'), padding: '15px 30px', fontSize: '16px', fontWeight: 'bold' }}>
                                    💾 Зберегти все засмічення
                                </button>
                                <button onClick={cancelAllPriceChanges} disabled={Object.keys(tempPrices).length === 0}
                                    style={{ ...s.btn(Object.keys(tempPrices).length === 0 ? '#6c757d' : '#17a2b8'), padding: '15px 30px', fontSize: '16px', fontWeight: 'bold' }}>
                                    ❌ Скасувати зміни цін
                                </button>
                                <button onClick={cancelContaminationChanges} disabled={Object.keys(tempContamination).length === 0}
                                    style={{ ...s.btn(Object.keys(tempContamination).length === 0 ? '#6c757d' : '#dc3545'), padding: '15px 30px', fontSize: '16px', fontWeight: 'bold' }}>
                                    ❌ Скасувати зміни засмічення
                                </button>
                                <button onClick={resetToDefaultPrices} disabled={isSavingPrice}
                                    style={{ ...s.btn('#6f42c1'), padding: '15px 30px', fontSize: '16px', fontWeight: 'bold' }}>
                                    🔄 Оновити з сервера
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Чек */}
            {printInvoice && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
                    <div style={{ backgroundColor: '#2d2d2d', borderRadius: '12px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid #404040' }}>
                        <div style={{ backgroundColor: '#333', padding: '20px', borderBottom: '1px solid #404040', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.3rem' }}>📄 Чек №{printInvoice.id || '---'}</h3>
                            <button onClick={() => setPrintInvoice(null)} style={{ ...s.btn('#dc3545'), borderRadius: '50%', width: '40px', height: '40px', padding: 0, fontSize: '20px' }}>×</button>
                        </div>
                        <div style={{ padding: '30px', maxHeight: 'calc(90vh - 80px)', overflow: 'auto' }}>
                            <div style={{ fontFamily: "'Courier New', monospace", fontSize: '15px', lineHeight: '1.5', whiteSpace: 'pre', backgroundColor: '#242424', padding: '25px', borderRadius: '8px', border: '2px solid #404040', color: '#e0e0e0', maxWidth: '400px', margin: '0 auto' }}>
                                {printInvoice.receiptText || "Немає даних"}
                            </div>
                            <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <button onClick={() => printToReceiptPrinter(printInvoice)} style={{ ...s.btn('#28a745'), padding: '12px 24px', fontSize: '15px', fontWeight: 'bold' }}>🖨️ Друкувати</button>
                                <button onClick={() => copyReceiptToClipboard(printInvoice)} style={{ ...s.btn('#17a2b8'), padding: '12px 24px', fontSize: '15px', fontWeight: 'bold' }}>📋 Копіювати</button>
                                <button onClick={() => setPrintInvoice(null)} style={{ ...s.btn('#6c757d'), padding: '12px 24px', fontSize: '15px' }}>Закрити</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
