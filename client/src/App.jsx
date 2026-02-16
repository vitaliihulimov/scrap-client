import React, { useState, useEffect, useRef, useCallback } from "react";

// Конфігурація API - автоматично визначає URL для production/development
const API_BASE_URL = import.meta.env.VITE_API_URL ?
    `${import.meta.env.VITE_API_URL}/api` :
    'http://localhost:3000/api';

// Початкові відсотки засмічення для кожного металу
const initialContaminationRates = {
    // Мідь та мідні сплави
    "Мідь блеск": 0,
    "Мідь М1": 0,
    "Мідь М3": 1,
    "Мідь фосфорна": 0,
    "Мідна стружка": 1,
    "Мідна лента": 1,
    "Мідний скрап": 1,

    // Латунь
    "Латунь": 1,
    "Латунний радіатор": 2,
    "Латунна стружка": 3,
    "Латунний скрап": 1,
    "Стакан великий": 1,
    "Стакан маленький": 1,
    "ОЦС": 1,
    "БРАЖ": 1,

    // Алюміній
    "Алюмінієвий провод": 0.5,
    "Алюміній піщевий": 0.5,
    "Алюмінієвий профіль": 0.5,
    "Алюмінієві діскі": 1,
    "Алюміній побутовий": 1,
    "АМГ": 2,
    "Алюмінієва банка": 3,
    "Алюмінієвий радіатор": 3,
    "Алюміній самолет": 5,
    "Алюміній военка": 25,
    "Алюміній моторняк": 1,
    "Алюмінієва стружка": 5,
    "Алюмінієвий скрап": 1,

    // Нержавіюча сталь
    "Нержавейка (10% нікелю)": 0.5,
    "Нержавейка (10% Б55)": 0,
    "Нержавейка (9% нікелю)": 0.5,
    "Нержавейка (8% нікелю)": 0.5,
    "Нержавейка (0% нікелю)": 0.5,
    "Височка скрап": 1,
    "Нержавіюча стружка (10 9 8)": 0.5,
    "Нержавіючий скрап": 1,
    "Нікель": 0,
    "Нікель лом": 1,

    // Кольорові метали
    "ЦАМ": 3,
    "Магній": 3,
    "Цинк": 0,

    // Свинець та АКБ
    "Свинець кабельний": 1,
    "Свинець звичайний": 1,
    "Свинець шиномонтаж": 0,
    "АКБ білий": 1,
    "АКБ чорний": 1,
    "ТНЖ великі": 3,
    "ТНЖ маленькі": 3,
    "ТНЖ 4-к": 3,

    // Рідкісні метали
    "Титан": 0.5,

    // Сплави
    "Кремній": 1,
    "Мельхіор": 1,
    "МН": 1,
    "Олово": 0,
    "Припой": 0
};

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
    const [contaminationRates, setContaminationRates] = useState(initialContaminationRates);
    const [tempContamination, setTempContamination] = useState({});

    const initialItemsRef = useRef([]);
    const [invoicesLoaded, setInvoicesLoaded] = useState(false);

    // Функція для округлення ціни з урахуванням типу металу
    const roundPrice = (price, metalName) => {
        if (metalName === "Чорний метал") {
            // Округлення до 1 десяткового знаку для чорного металу
            return Math.round(price * 10) / 10;
        } else {
            // Округлення до цілого числа для всіх інших
            return Math.round(price);
        }
    };

    // Функція для округлення ціни вниз (до меншого цілого) з урахуванням типу металу
    const roundPriceDown = (price, metalName) => {
        if (metalName === "Чорний метал") {
            // Для чорного металу округлення до 1 десяткового знаку вниз
            return Math.floor(price * 10) / 10;
        } else {
            // Для всіх інших металів округлення вниз до цілого числа
            return Math.floor(price);
        }
    };

    // Функція для розрахунку ціни з урахуванням засмічення
    const calculatePriceWithContamination = (metalName, originalPrice, customRate = null) => {
        const rate = customRate !== null ? customRate : (contaminationRates[metalName] || 0);

        // Розрахунок ціни після засмічення
        const priceAfterContamination = originalPrice * (1 - rate / 100);

        // Округлення вниз згідно з правилами
        return roundPriceDown(priceAfterContamination, metalName);
    };

    // Функція для розрахунку суми (вага * ціна з засміченням)
    const calculateSum = (weight, price, metalName, contaminationRate) => {
        if (!weight || weight <= 0) return 0;
        const priceWithCont = calculatePriceWithContamination(metalName, price, contaminationRate);
        return Math.floor(weight * priceWithCont);
    };

    // ОНОВЛЕНІ тестові метали з вашим списком
    const initialTestMetals = [
        // Мідь та мідні сплави
        { id: 1, name: "Мідь блеск", price: 388, weight: "", initialPrice: 388 },
        { id: 2, name: "Мідь М1", price: 388, weight: "", initialPrice: 388 },
        { id: 3, name: "Мідь М3", price: 388, weight: "", initialPrice: 388 },
        { id: 4, name: "Мідь фосфорна", price: 388, weight: "", initialPrice: 388 },
        { id: 5, name: "Мідна стружка", price: 320, weight: "", initialPrice: 320 },
        { id: 6, name: "Мідна лента", price: 380, weight: "", initialPrice: 380 },
        { id: 7, name: "Мідний скрап", price: 350, weight: "", initialPrice: 350 },

        // Латунь
        { id: 8, name: "Латунь", price: 235, weight: "", initialPrice: 235 },
        { id: 9, name: "Латунний радіатор", price: 210, weight: "", initialPrice: 210 },
        { id: 10, name: "Латунна стружка", price: 180, weight: "", initialPrice: 180 },
        { id: 11, name: "Латунний скрап", price: 220, weight: "", initialPrice: 220 },
        { id: 12, name: "Стакан великий", price: 230, weight: "", initialPrice: 230 },
        { id: 13, name: "Стакан маленький", price: 230, weight: "", initialPrice: 230 },
        { id: 14, name: "ОЦС", price: 220, weight: "", initialPrice: 220 },
        { id: 15, name: "БРАЖ", price: 220, weight: "", initialPrice: 220 },

        // Алюміній
        { id: 16, name: "Алюмінієвий провод", price: 70, weight: "", initialPrice: 70 },
        { id: 17, name: "Алюміній піщевий", price: 65, weight: "", initialPrice: 65 },
        { id: 18, name: "Алюмінієвий профіль", price: 65, weight: "", initialPrice: 65 },
        { id: 19, name: "Алюмінієві діскі", price: 60, weight: "", initialPrice: 60 },
        { id: 20, name: "Алюміній побутовий", price: 55, weight: "", initialPrice: 55 },
        { id: 21, name: "АМГ", price: 75, weight: "", initialPrice: 75 },
        { id: 22, name: "Алюмінієва банка", price: 50, weight: "", initialPrice: 50 },
        { id: 23, name: "Алюмінієвий радіатор", price: 65, weight: "", initialPrice: 65 },
        { id: 24, name: "Алюміній самолет", price: 85, weight: "", initialPrice: 85 },
        { id: 25, name: "Алюміній военка", price: 95, weight: "", initialPrice: 95 },
        { id: 26, name: "Алюміній моторняк", price: 75, weight: "", initialPrice: 75 },
        { id: 27, name: "Алюмінієва стружка", price: 45, weight: "", initialPrice: 45 },
        { id: 28, name: "Алюмінієвий скрап", price: 50, weight: "", initialPrice: 50 },

        // Нержавіюча сталь
        { id: 29, name: "Нержавейка (10% нікелю)", price: 90, weight: "", initialPrice: 90 },
        { id: 30, name: "Нержавейка (10% Б55)", price: 90, weight: "", initialPrice: 90 },
        { id: 31, name: "Нержавейка (9% нікелю)", price: 85, weight: "", initialPrice: 85 },
        { id: 32, name: "Нержавейка (8% нікелю)", price: 80, weight: "", initialPrice: 80 },
        { id: 33, name: "Нержавейка (0% нікелю)", price: 45, weight: "", initialPrice: 45 },
        { id: 34, name: "Височка скрап", price: 70, weight: "", initialPrice: 70 },
        { id: 35, name: "Нержавіюча стружка (10 9 8)", price: 60, weight: "", initialPrice: 60 },
        { id: 36, name: "Нержавіючий скрап", price: 65, weight: "", initialPrice: 65 },
        { id: 37, name: "Нікель", price: 350, weight: "", initialPrice: 350 },
        { id: 38, name: "Нікель лом", price: 320, weight: "", initialPrice: 320 },

        // Кольорові метали
        { id: 39, name: "ЦАМ", price: 95, weight: "", initialPrice: 95 },
        { id: 40, name: "Магній", price: 75, weight: "", initialPrice: 75 },
        { id: 41, name: "Цинк", price: 50, weight: "", initialPrice: 50 },

        // Свинець та АКБ
        { id: 42, name: "Свинець кабельний", price: 55, weight: "", initialPrice: 55 },
        { id: 43, name: "Свинець звичайний", price: 45, weight: "", initialPrice: 45 },
        { id: 44, name: "Свинець шиномонтаж", price: 45, weight: "", initialPrice: 45 },
        { id: 45, name: "АКБ білий", price: 20, weight: "", initialPrice: 20 },
        { id: 46, name: "АКБ чорний", price: 18, weight: "", initialPrice: 18 },
        { id: 47, name: "ТНЖ великі", price: 25, weight: "", initialPrice: 25 },
        { id: 48, name: "ТНЖ маленькі", price: 25, weight: "", initialPrice: 25 },
        { id: 49, name: "ТНЖ 4-к", price: 25, weight: "", initialPrice: 25 },

        // Рідкісні метали
        { id: 50, name: "Титан", price: 160, weight: "", initialPrice: 160 },

        // Сплави
        { id: 51, name: "Бабіт (16)", price: 120, weight: "", initialPrice: 120 },
        { id: 52, name: "Бабіт (82)", price: 140, weight: "", initialPrice: 140 },
        { id: 53, name: "Кремній", price: 80, weight: "", initialPrice: 80 },
        { id: 54, name: "Мельхіор", price: 200, weight: "", initialPrice: 200 },
        { id: 55, name: "МН", price: 200, weight: "", initialPrice: 200 },
        { id: 56, name: "Олово", price: 300, weight: "", initialPrice: 300 },
        { id: 57, name: "Припой", price: 280, weight: "", initialPrice: 280 },

        // Швидкорізи та спецсплави
        { id: 58, name: "Рапід Р6М5", price: 150, weight: "", initialPrice: 150 },
        { id: 59, name: "Рапід Р18", price: 180, weight: "", initialPrice: 180 },
        { id: 60, name: "Вольфрам", price: 400, weight: "", initialPrice: 400 },
        { id: 61, name: "Молібден", price: 350, weight: "", initialPrice: 350 },
        { id: 62, name: "Феромолібден", price: 250, weight: "", initialPrice: 250 },
        { id: 63, name: "Ферованадій", price: 220, weight: "", initialPrice: 220 },

        // Чорний метал
        { id: 64, name: "Чорний метал", price: 8, weight: "", initialPrice: 8 }
    ];

    // Функція для очищення localStorage
    const clearLocalStorage = () => {
        try {
            localStorage.removeItem('metalPrices');
            localStorage.removeItem('contaminationRates');
            console.log('Очищено localStorage');
        } catch (error) {
            console.error("Помилка очищення localStorage:", error);
        }
    };

    // Функція для збереження цін в localStorage
    const savePricesToLocalStorage = useCallback((prices) => {
        try {
            localStorage.setItem('metalPrices', JSON.stringify(prices));
        } catch (error) {
            console.error("Помилка збереження цін в localStorage:", error);
        }
    }, []);

    // Функція для збереження відсотків засмічення в localStorage
    const saveContaminationRatesToLocalStorage = useCallback((rates) => {
        try {
            localStorage.setItem('contaminationRates', JSON.stringify(rates));
        } catch (error) {
            console.error("Помилка збереження відсотків засмічення в localStorage:", error);
        }
    }, []);

    // Функція для завантаження цін з localStorage
    const loadPricesFromLocalStorage = useCallback(() => {
        try {
            const saved = localStorage.getItem('metalPrices');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error("Помилка завантаження цін з localStorage:", error);
        }
        return null;
    }, []);

    // Функція для завантаження відсотків засмічення з localStorage
    const loadContaminationRatesFromLocalStorage = useCallback(() => {
        try {
            const saved = localStorage.getItem('contaminationRates');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error("Помилка завантаження відсотків засмічення з localStorage:", error);
        }
        return null;
    }, []);

    // Функція для збереження накладних в localStorage
    const saveInvoicesToLocalStorage = useCallback((invoices) => {
        try {
            localStorage.setItem('invoices', JSON.stringify(invoices));
            console.log('Накладні збережено в localStorage:', invoices.length);
        } catch (error) {
            console.error("Помилка збереження накладних в localStorage:", error);
        }
    }, []);

    // Функція для завантаження накладних з localStorage
    const loadInvoicesFromLocalStorage = useCallback(() => {
        try {
            const saved = localStorage.getItem('invoices');
            if (saved) {
                const parsed = JSON.parse(saved);
                console.log('Накладні завантажено з localStorage:', parsed.length);
                return parsed;
            }
        } catch (error) {
            console.error("Помилка завантаження накладних з localStorage:", error);
        }
        return null;
    }, []);

    // Завантаження даних при першому рендері
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // Завантажуємо відсотки засмічення з localStorage
                const savedRates = loadContaminationRatesFromLocalStorage();
                if (savedRates) {
                    setContaminationRates(savedRates);
                }

                // 1. Завантажуємо метали з сервера
                let formattedData;

                try {
                    const res = await fetch(`${API_BASE_URL}/metals`);
                    if (res.ok) {
                        const data = await res.json();
                        console.log('Метали з сервера:', data);

                        // Використовуємо дані з сервера
                        formattedData = data.map(m => ({
                            ...m,
                            weight: "",
                            initialPrice: m.price
                        }));
                    } else {
                        throw new Error('Сервер не відповідає');
                    }
                } catch (serverError) {
                    console.log("Сервер недоступний, використовуємо тестові дані:", serverError);
                    // Використовуємо тестові дані
                    formattedData = initialTestMetals.map(metal => ({
                        ...metal,
                        defaultPrice: metal.price
                    }));
                }

                setItems(formattedData);
                initialItemsRef.current = formattedData;

                // Завантажуємо ціни для адмін панелі
                setMetalPrices(formattedData);

                // 2. Завантажуємо накладні з сервера або localStorage
                try {
                    const res = await fetch(`${API_BASE_URL}/invoices`);
                    if (res.ok) {
                        const serverInvoices = await res.json();
                        console.log('Накладні з сервера:', serverInvoices.length);

                        // Перераховуємо всі накладні з правильним округленням
                        const processedInvoices = serverInvoices.map(inv => {
                            const processedItems = inv.items.map(item => {
                                const rate = item.contaminationRate || contaminationRates[item.name] || 0;

                                // Розраховуємо правильну ціну з засміченням
                                let priceWithCont;
                                if (item.name === "Чорний метал") {
                                    priceWithCont = Math.floor(item.price * (1 - rate / 100) * 10) / 10;
                                } else {
                                    priceWithCont = Math.floor(item.price * (1 - rate / 100));
                                }

                                // Розраховуємо правильну суму
                                const weight = Number(item.weight) || 0;
                                const correctSum = Math.floor(weight * priceWithCont);

                                return {
                                    ...item,
                                    contaminationRate: rate,
                                    priceWithContamination: priceWithCont,
                                    sum: correctSum
                                };
                            });

                            // Перераховуємо загальну суму
                            const correctTotal = processedItems.reduce((acc, item) => acc + item.sum, 0);

                            return {
                                ...inv,
                                items: processedItems,
                                total: correctTotal
                            };
                        });

                        setInvoices(processedInvoices);
                        saveInvoicesToLocalStorage(processedInvoices);
                    } else {
                        // Якщо сервер не відповідає, беремо з localStorage
                        const savedInvoices = loadInvoicesFromLocalStorage();
                        if (savedInvoices && savedInvoices.length > 0) {
                            console.log('Використовуємо накладні з localStorage');

                            // Перераховуємо всі накладні з правильним округленням
                            const processedInvoices = savedInvoices.map(inv => {
                                const processedItems = inv.items.map(item => {
                                    const rate = item.contaminationRate || contaminationRates[item.name] || 0;

                                    // Розраховуємо правильну ціну з засміченням
                                    let priceWithCont;
                                    if (item.name === "Чорний метал") {
                                        priceWithCont = Math.floor(item.price * (1 - rate / 100) * 10) / 10;
                                    } else {
                                        priceWithCont = Math.floor(item.price * (1 - rate / 100));
                                    }

                                    // Розраховуємо правильну суму
                                    const weight = Number(item.weight) || 0;
                                    const correctSum = Math.floor(weight * priceWithCont);

                                    return {
                                        ...item,
                                        contaminationRate: rate,
                                        priceWithContamination: priceWithCont,
                                        sum: correctSum
                                    };
                                });

                                // Перераховуємо загальну суму
                                const correctTotal = processedItems.reduce((acc, item) => acc + item.sum, 0);

                                return {
                                    ...inv,
                                    items: processedItems,
                                    total: correctTotal
                                };
                            });

                            setInvoices(processedInvoices);
                            // Зберігаємо оновлені накладні назад в localStorage
                            saveInvoicesToLocalStorage(processedInvoices);
                        } else {
                            console.log('Немає накладних, використовуємо пустий масив');
                            setInvoices([]);
                        }
                    }
                } catch (invoiceError) {
                    console.log("Не вдалося завантажити накладні з сервера:", invoiceError);
                    const savedInvoices = loadInvoicesFromLocalStorage();
                    if (savedInvoices && savedInvoices.length > 0) {
                        // Перераховуємо всі накладні з правильним округленням
                        const processedInvoices = savedInvoices.map(inv => {
                            const processedItems = inv.items.map(item => {
                                const rate = item.contaminationRate || contaminationRates[item.name] || 0;

                                // Розраховуємо правильну ціну з засміченням
                                let priceWithCont;
                                if (item.name === "Чорний метал") {
                                    priceWithCont = Math.floor(item.price * (1 - rate / 100) * 10) / 10;
                                } else {
                                    priceWithCont = Math.floor(item.price * (1 - rate / 100));
                                }

                                // Розраховуємо правильну суму
                                const weight = Number(item.weight) || 0;
                                const correctSum = Math.floor(weight * priceWithCont);

                                return {
                                    ...item,
                                    contaminationRate: rate,
                                    priceWithContamination: priceWithCont,
                                    sum: correctSum
                                };
                            });

                            // Перераховуємо загальну суму
                            const correctTotal = processedItems.reduce((acc, item) => acc + item.sum, 0);

                            return {
                                ...inv,
                                items: processedItems,
                                total: correctTotal
                            };
                        });

                        setInvoices(processedInvoices);
                    } else {
                        setInvoices([]);
                    }
                }

                setInvoicesLoaded(true);
                setLoading(false);

            } catch (error) {
                console.error("Помилка завантаження даних:", error);

                // Завантажуємо тестові дані
                const metalsWithDefaults = initialTestMetals.map(metal => ({
                    ...metal,
                    defaultPrice: metal.price
                }));

                setItems(metalsWithDefaults);
                initialItemsRef.current = metalsWithDefaults;
                setMetalPrices(metalsWithDefaults);

                // Накладні тільки з localStorage
                const savedInvoices = loadInvoicesFromLocalStorage();
                if (savedInvoices && savedInvoices.length > 0) {
                    // Перераховуємо всі накладні з правильним округленням
                    const processedInvoices = savedInvoices.map(inv => {
                        const processedItems = inv.items.map(item => {
                            const rate = item.contaminationRate || contaminationRates[item.name] || 0;

                            // Розраховуємо правильну ціну з засміченням
                            let priceWithCont;
                            if (item.name === "Чорний метал") {
                                priceWithCont = Math.floor(item.price * (1 - rate / 100) * 10) / 10;
                            } else {
                                priceWithCont = Math.floor(item.price * (1 - rate / 100));
                            }

                            // Розраховуємо правильну суму
                            const weight = Number(item.weight) || 0;
                            const correctSum = Math.floor(weight * priceWithCont);

                            return {
                                ...item,
                                contaminationRate: rate,
                                priceWithContamination: priceWithCont,
                                sum: correctSum
                            };
                        });

                        // Перераховуємо загальну суму
                        const correctTotal = processedItems.reduce((acc, item) => acc + item.sum, 0);

                        return {
                            ...inv,
                            items: processedItems,
                            total: correctTotal
                        };
                    });

                    setInvoices(processedInvoices);
                } else {
                    setInvoices([]);
                }

                setInvoicesLoaded(true);
                setLoading(false);
            }
        };

        loadInitialData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Оновлення загальної суми
    useEffect(() => {
        const newTotal = items.reduce((acc, item) => {
            const weight = Number(item.weight) || 0;
            const rate = contaminationRates[item.name] || 0;
            return acc + calculateSum(weight, item.price, item.name, rate);
        }, 0);
        setTotal(newTotal);
    }, [items, contaminationRates]);

    // Функція для синхронізації накладних з сервером
    const syncInvoicesFromServer = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/invoices`);
            if (res.ok) {
                const serverInvoices = await res.json();

                // Перераховуємо всі накладні з правильним округленням
                const processedInvoices = serverInvoices.map(inv => {
                    const processedItems = inv.items.map(item => {
                        const rate = item.contaminationRate || contaminationRates[item.name] || 0;

                        // Розраховуємо правильну ціну з засміченням
                        let priceWithCont;
                        if (item.name === "Чорний метал") {
                            priceWithCont = Math.floor(item.price * (1 - rate / 100) * 10) / 10;
                        } else {
                            priceWithCont = Math.floor(item.price * (1 - rate / 100));
                        }

                        // Розраховуємо правильну суму
                        const weight = Number(item.weight) || 0;
                        const correctSum = Math.floor(weight * priceWithCont);

                        return {
                            ...item,
                            contaminationRate: rate,
                            priceWithContamination: priceWithCont,
                            sum: correctSum
                        };
                    });

                    // Перераховуємо загальну суму
                    const correctTotal = processedItems.reduce((acc, item) => acc + item.sum, 0);

                    return {
                        ...inv,
                        items: processedItems,
                        total: correctTotal
                    };
                });

                console.log('Накладні після перерахунку:', processedInvoices);
                setInvoices(processedInvoices);
                saveInvoicesToLocalStorage(processedInvoices);
            }
        } catch (error) {
            console.error("Помилка синхронізації накладних з сервером:", error);
        }
    }, [saveInvoicesToLocalStorage, contaminationRates]);

    // Синхронізація при завантаженні
    useEffect(() => {
        if (invoicesLoaded) {
            syncInvoicesFromServer();
        }
    }, [invoicesLoaded, syncInvoicesFromServer]);

    // Функція для оновлення відсотка засмічення
    const updateContaminationRate = (metalName, newRate) => {
        if (newRate < 0 || newRate > 100) {
            alert("Відсоток засмічення має бути від 0 до 100");
            return;
        }

        setContaminationRates(prev => {
            const updated = { ...prev, [metalName]: newRate };
            saveContaminationRatesToLocalStorage(updated);
            return updated;
        });
    };

    // Функція для тимчасової зміни засмічення в адмін-панелі
    const updateTempContamination = (metalName, newRate) => {
        setTempContamination(prev => ({
            ...prev,
            [metalName]: newRate
        }));
    };

    // Функція для збереження всіх змін засмічення
    const saveAllContaminationChanges = () => {
        if (Object.keys(tempContamination).length === 0) {
            alert("Немає змін для збереження");
            return;
        }

        setContaminationRates(prev => {
            const updated = { ...prev, ...tempContamination };
            saveContaminationRatesToLocalStorage(updated);
            return updated;
        });

        setTempContamination({});
        alert("✅ Всі зміни засмічення збережено!");
    };

    // Функція для скасування змін засмічення
    const cancelContaminationChanges = () => {
        setTempContamination({});
        alert("❌ Зміни скасовано");
    };

    // Функція для оновлення ціни металу
    const updateMetalPrice = async (id, newPrice, name) => {
        if (newPrice < 0) {
            alert("Ціна не може бути від'ємною!");
            return;
        }

        setIsSavingPrice(true);

        try {
            // 1. Зберігаємо в localStorage
            const updatedPrices = metalPrices.map(metal =>
                metal.id === id ? { ...metal, price: newPrice, defaultPrice: newPrice } : metal
            );
            setMetalPrices(updatedPrices);
            savePricesToLocalStorage(updatedPrices);

            // 2. Оновлюємо на сервері
            try {
                const response = await fetch(`${API_BASE_URL}/metals/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ price: newPrice })
                });

                if (!response.ok) {
                    console.warn("Не вдалося оновити ціну на сервері, але збережено локально");
                }
            } catch (serverError) {
                console.warn("Сервер недоступний, ціна збережена локально:", serverError);
            }

            // 3. Оновлюємо локальний стан форми
            setItems(prev => prev.map(item =>
                item.id === id ? { ...item, price: newPrice, initialPrice: newPrice } : item
            ));

            // 4. Оновлюємо initialItemsRef
            initialItemsRef.current = initialItemsRef.current.map(item =>
                item.id === id ? { ...item, price: newPrice, initialPrice: newPrice } : item
            );

            // 5. Очищаємо tempPrices для цього металу
            setTempPrices(prev => {
                const newTemp = { ...prev };
                delete newTemp[id];
                return newTemp;
            });

            alert(`✅ Ціну на ${name} оновлено до ${newPrice} грн/кг (збережено)`);
        } catch (error) {
            console.error("Помилка оновлення ціни:", error);
            alert("Помилка оновлення ціни");
        } finally {
            setIsSavingPrice(false);
        }
    };

    // Функція для тимчасової зміни ціни (без збереження)
    const updateTempPrice = (id, newPrice) => {
        setMetalPrices(prev => prev.map(metal =>
            metal.id === id ? { ...metal, price: newPrice } : metal
        ));

        setTempPrices(prev => ({
            ...prev,
            [id]: newPrice
        }));
    };

    // Функція для масового оновлення всіх цін
    const updateAllPrices = async () => {
        if (!window.confirm("Ви впевнені, що хочете оновити всі ціни? Це оновить початкові ціни у всіх формах.")) {
            return;
        }

        setIsSavingPrice(true);

        try {
            // 1. Зберігаємо всі ціни в localStorage
            savePricesToLocalStorage(metalPrices);

            // 2. Оновлюємо кожен метал на сервері
            const updatePromises = metalPrices.map(metal =>
                fetch(`${API_BASE_URL}/metals/${metal.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ price: metal.price })
                }).catch(error => {
                    console.warn(`Не вдалося оновити ціну для металу ${metal.id}:`, error);
                    return null;
                })
            );

            await Promise.all(updatePromises);

            // 3. Оновлюємо локальний стан
            const updatedItems = metalPrices.map(metal => ({
                ...metal,
                weight: "",
                initialPrice: metal.price,
                defaultPrice: metal.price
            }));

            setItems(updatedItems);
            initialItemsRef.current = updatedItems;

            // 4. Скидаємо tempPrices
            setTempPrices({});

            alert("✅ Всі ціни оновлено та збережено!");
        } catch (error) {
            console.error("Помилка оновлення цін:", error);

            // Все одно зберігаємо в localStorage
            savePricesToLocalStorage(metalPrices);

            const updatedItems = metalPrices.map(metal => ({
                ...metal,
                weight: "",
                initialPrice: metal.price,
                defaultPrice: metal.price
            }));

            setItems(updatedItems);
            initialItemsRef.current = updatedItems;
            setTempPrices({});

            alert("✅ Всі ціни оновлено локально!");
        } finally {
            setIsSavingPrice(false);
        }
    };

    // Функція для скидання цін до значень за замовчуванням
    const resetToDefaultPrices = async () => {
        if (!window.confirm("Ви впевнені, що хочете скинути всі ціни до значень за замовчуванням?")) {
            return;
        }

        setIsSavingPrice(true);

        try {
            // Отримуємо оригінальні ціни з initialTestMetals
            const resetPrices = initialTestMetals.map(metal => ({
                ...metal,
                defaultPrice: metal.price
            }));

            // Зберігаємо в localStorage
            savePricesToLocalStorage(resetPrices);
            setMetalPrices(resetPrices);

            // Оновлюємо на сервері
            const updatePromises = resetPrices.map(metal =>
                fetch(`${API_BASE_URL}/metals/${metal.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ price: metal.price })
                }).catch(error => {
                    console.warn(`Не вдалося скинути ціну для металу ${metal.id}:`, error);
                    return null;
                })
            );

            await Promise.all(updatePromises);

            // Оновлюємо локальний стан
            const resetItems = resetPrices.map(metal => ({
                ...metal,
                weight: "",
                initialPrice: metal.price
            }));

            setItems(resetItems);
            initialItemsRef.current = resetItems;
            setTempPrices({});

            alert("✅ Ціни скинуто до значень за замовчуванням!");
        } catch (error) {
            console.error("Помилка скидання цін:", error);

            // Все одно скидаємо локально
            const resetPrices = initialTestMetals.map(metal => ({
                ...metal,
                defaultPrice: metal.price
            }));

            savePricesToLocalStorage(resetPrices);
            setMetalPrices(resetPrices);

            const resetItems = resetPrices.map(metal => ({
                ...metal,
                weight: "",
                initialPrice: metal.price
            }));

            setItems(resetItems);
            initialItemsRef.current = resetItems;
            setTempPrices({});

            alert("✅ Ціни скинуто локально до значень за замовчуванням!");
        } finally {
            setIsSavingPrice(false);
        }
    };

    // Функція для скасування всіх тимчасових змін цін
    const cancelAllPriceChanges = () => {
        if (!window.confirm("Скасувати всі незбережені зміни цін?")) {
            return;
        }

        // Завантажуємо збережені ціни з localStorage
        const savedPrices = loadPricesFromLocalStorage();
        if (savedPrices) {
            const restoredPrices = savedPrices.map(price => ({
                ...price,
                defaultPrice: initialTestMetals.find(m => m.id === price.id)?.price || price.price
            }));
            setMetalPrices(restoredPrices);
        } else {
            // Якщо немає збережених цін, відновлюємо до initialTestMetals
            const restoredPrices = initialTestMetals.map(metal => ({
                ...metal,
                defaultPrice: metal.price
            }));
            setMetalPrices(restoredPrices);
        }

        setTempPrices({});
        alert("✅ Всі зміни цін скасовано!");
    };

    // Функція для видалення всіх накладних
    const deleteAllInvoices = async () => {
        if (!window.confirm("ВИ ВПЕВНЕНІ, ЩО ХОЧЕТЕ ВИДАЛИТИ ВСІ НАКЛАДНІ?\n\nЦю дію НЕМОЖЛИВО скасувати! Буде видалено всі дані про накладні.")) {
            return;
        }

        try {
            // 1. Очищаємо localStorage
            localStorage.removeItem('invoices');

            // 2. Очищаємо стан
            setInvoices([]);

            // 3. Видаляємо з сервера
            try {
                await fetch(`${API_BASE_URL}/invoices`, {
                    method: 'DELETE',
                }).then(res => {
                    if (res.ok) {
                        console.log("Всі накладні видалені з сервера");
                    }
                }).catch(() => {
                    console.log("Не вдалося видалити з сервера, продовжуємо локально");
                });
            } catch (serverError) {
                console.warn("Сервер недоступний:", serverError);
            }

            alert("✅ Всі накладні успішно видалені!");
        } catch (error) {
            console.error("Помилка при видаленні всіх накладних:", error);
            alert("Помилка при видаленні накладних.");
        }
    };

    // Функція для видалення накладної
    const deleteInvoice = async (invoiceId) => {
        if (!window.confirm("Ви впевнені, що хочете видалити цю накладну? Цю дію неможливо скасувати.")) {
            return;
        }

        try {
            // 1. Видаляємо з сервера
            try {
                await fetch(`${API_BASE_URL}/invoices/${invoiceId}`, {
                    method: 'DELETE',
                });
            } catch (serverError) {
                console.warn("Не вдалося видалити з сервера:", serverError);
            }

            // 2. Оновлюємо локальний стан
            const updatedInvoices = invoices.filter(inv => inv.id !== invoiceId);
            setInvoices(updatedInvoices);

            // 3. Зберігаємо в localStorage
            saveInvoicesToLocalStorage(updatedInvoices);

            alert("Накладна успішно видалена!");
        } catch (error) {
            console.error("Помилка при видаленні накладної:", error);
            alert("Помилка при видаленні накладної.");
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
            price: item.initialPrice
        })));
    };

    const saveAndPrint = async () => {
        const itemsWithWeight = items.filter(i => {
            const weight = Number(i.weight);
            return !isNaN(weight) && weight > 0;
        });

        if (itemsWithWeight.length === 0) {
            alert("Будь ласка, введіть вагу для хоча б одного металу");
            return;
        }

        setIsSaving(true);

        try {
            // Створюємо об'єкт накладної з правильними даними (ті самі розрахунки що й у viewReceipt)
            const invoiceItems = itemsWithWeight.map(item => {
                const rate = contaminationRates[item.name] || 0;

                // Розраховуємо ціну з засміченням з округленням вниз
                const priceAfterCont = item.price * (1 - rate / 100);
                let priceWithCont;
                if (item.name === "Чорний метал") {
                    priceWithCont = Math.floor(priceAfterCont * 10) / 10;
                } else {
                    priceWithCont = Math.floor(priceAfterCont);
                }

                const weight = Number(item.weight);
                const sum = Math.floor(weight * priceWithCont);

                return {
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    priceWithContamination: priceWithCont,
                    contaminationRate: rate,
                    weight: weight,
                    sum: sum
                };
            });

            const invoiceTotal = invoiceItems.reduce((acc, item) => acc + item.sum, 0);

            const newInvoice = {
                items: invoiceItems,
                total: invoiceTotal
            };

            console.log("Збереження накладної:", newInvoice); // Для перевірки

            // Зберігаємо на сервері
            try {
                const res = await fetch(`${API_BASE_URL}/invoices`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(newInvoice)
                });

                if (res.ok) {
                    const result = await res.json();

                    // Оновлюємо список накладних
                    await syncInvoicesFromServer();

                    viewReceipt({
                        id: result.invoiceId,
                        created_at: result.createdAt,
                        total: invoiceTotal,
                        items: invoiceItems
                    });

                    resetForm();
                    alert(`Накладна №${result.invoiceId} успішно збережена!`);
                } else {
                    throw new Error('Помилка збереження');
                }
            } catch (serverError) {
                console.warn("Не вдалося зберегти на сервері:", serverError);

                // Локальне збереження
                const existingIds = invoices.map(inv => inv.id).filter(id => !isNaN(id));
                const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
                const newInvoiceId = maxId + 1;

                const localInvoice = {
                    id: newInvoiceId,
                    created_at: new Date().toISOString(),
                    total: invoiceTotal,
                    items: invoiceItems
                };

                const updatedInvoices = [localInvoice, ...invoices];
                setInvoices(updatedInvoices);
                saveInvoicesToLocalStorage(updatedInvoices);

                viewReceipt(localInvoice);
                resetForm();
                alert(`Накладна №${newInvoiceId} збережена локально!`);
            }

        } catch (error) {
            console.error("Помилка при збереженні накладної:", error);
            alert("Помилка при збереженні накладної. Спробуйте ще раз.");
        } finally {
            setIsSaving(false);
        }
    };

    // Функція для генерації звіту за день
    const generateDailyReport = () => {
        if (!dailyReportDate) {
            alert("Будь ласка, виберіть дату для звіту");
            return;
        }

        const selectedDate = new Date(dailyReportDate);
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        const dayInvoices = invoices.filter(inv => {
            if (!inv.created_at) return false;
            const invoiceDate = new Date(inv.created_at);
            return invoiceDate >= startOfDay && invoiceDate <= endOfDay;
        });

        if (dayInvoices.length === 0) {
            alert(`На дату ${selectedDate.toLocaleDateString('uk-UA')} немає накладних`);
            return;
        }

        // Створюємо об'єкт з усіма металами
        const allMetals = {};
        initialItemsRef.current.forEach(metal => {
            allMetals[metal.name] = {
                name: metal.name,
                totalWeight: 0,
                totalAmount: 0,
                averagePrice: 0,
                transactions: [],
                price: metal.price,
                id: metal.id,
                hasTransactions: false,
                contaminationRate: contaminationRates[metal.name] || 0,
                priceWithContamination: calculatePriceWithContamination(metal.name, metal.price)
            };
        });

        // Збираємо статистику по накладних
        let totalDayAmount = 0;

        dayInvoices.forEach(invoice => {
            invoice.items.forEach(item => {
                if (allMetals[item.name]) {
                    const weight = Number(item.weight) || 0;
                    const amount = item.sum || 0;

                    allMetals[item.name].totalWeight += weight;
                    allMetals[item.name].totalAmount += amount;
                    allMetals[item.name].hasTransactions = true;
                    allMetals[item.name].transactions.push({
                        weight: weight,
                        price: item.price,
                        priceWithContamination: item.priceWithContamination || calculatePriceWithContamination(item.name, item.price, item.contaminationRate),
                        contaminationRate: item.contaminationRate || 0,
                        amount: amount
                    });

                    totalDayAmount += amount;
                }
            });
        });

        // Розраховуємо середню ціну для металів з транзакціями
        Object.keys(allMetals).forEach(metalName => {
            const metal = allMetals[metalName];
            if (metal.totalWeight > 0) {
                metal.averagePrice = Math.round((metal.totalAmount / metal.totalWeight) * 100) / 100;
            }
        });

        // Сортуємо метали за ID і фільтруємо тільки з транзакціями
        const sortedMetals = Object.values(allMetals)
            .filter(metal => metal.hasTransactions)
            .sort((a, b) => a.id - b.id);

        generateReportPDF(selectedDate, sortedMetals, dayInvoices, totalDayAmount);
    };

    // Функція для генерації PDF звіту
    const generateReportPDF = (date, metalStats, dayInvoices, totalDayAmount) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert("Дозвольте спливаючі вікна для друку звіту");
            return;
        }

        const reportDateStr = date.toLocaleDateString('uk-UA', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Фільтруємо тільки метали з транзакціями
        const metalsWithTransactions = metalStats.filter(m => m.hasTransactions);

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Звіт за ${reportDateStr}</title>
            <style>
                @page {
                    size: A4;
                    margin: 20mm;
                }
                
                body {
                    font-family: 'Times New Roman', Times, serif;
                    font-size: 12pt;
                    line-height: 1.4;
                    color: #000;
                    margin: 0;
                    padding: 0;
                }
                
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 2px solid #000;
                    padding-bottom: 15px;
                }
                
                .header h1 {
                    font-size: 24pt;
                    font-weight: bold;
                    margin: 0 0 10px 0;
                    text-transform: uppercase;
                }
                
                .header h2 {
                    font-size: 18pt;
                    font-weight: normal;
                    margin: 5px 0;
                }
                
                .summary {
                    margin-bottom: 30px;
                    padding: 20px;
                    background-color: #f5f5f5;
                    border: 1px solid #000;
                }
                
                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 15px;
                }
                
                .summary-item {
                    font-size: 12pt;
                }
                
                .summary-item strong {
                    font-size: 14pt;
                    display: block;
                    margin-bottom: 5px;
                    color: #000;
                }
                
                .summary-value {
                    font-size: 18pt;
                    font-weight: bold;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                    font-size: 11pt;
                }
                
                th {
                    background-color: #000;
                    color: white;
                    font-weight: bold;
                    padding: 10px 5px;
                    text-align: center;
                    border: 1px solid #000;
                    font-size: 11pt;
                    text-transform: uppercase;
                }
                
                td {
                    border: 1px solid #000;
                    padding: 8px 5px;
                }
                
                tr.metal-row {
                    background-color: #ffffff;
                }
                
                tr.metal-row:nth-child(even) {
                    background-color: #f5f5f5;
                }
                
                tr.total-row {
                    font-weight: bold;
                    background-color: #e0e0e0;
                }
                
                tr.total-row td {
                    border-top: 2px solid #000;
                    font-size: 12pt;
                }
                
                .text-right {
                    text-align: right;
                }
                
                .text-center {
                    text-align: center;
                }
                
                .number-cell {
                    text-align: right;
                    font-family: 'Courier New', monospace;
                }
                
                .signature {
                    margin-top: 50px;
                    padding-top: 20px;
                    border-top: 1px solid #000;
                    display: flex;
                    justify-content: space-between;
                }
                
                .signature-line {
                    width: 200px;
                    border-bottom: 1px solid #000;
                    margin-top: 5px;
                }
                
                .footer {
                    margin-top: 30px;
                    font-size: 10pt;
                    color: #666;
                    text-align: center;
                    font-style: italic;
                }
                
                @media print {
                    .no-print {
                        display: none;
                    }
                    
                    body {
                        padding: 0;
                    }
                    
                    .summary {
                        background-color: #f5f5f5;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    
                    th {
                        background-color: #000 !important;
                        color: white !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
            </style>
        </head>
        <body>
            <div class="no-print" style="text-align: center; margin-bottom: 20px; padding: 15px; background: #f0f0f0; border: 1px solid #ccc; border-radius: 5px;">
                <button onclick="window.print()" style="padding: 10px 25px; font-size: 14px; cursor: pointer; background: #28a745; color: white; border: none; border-radius: 4px; margin-right: 10px;">
                    🖨️ Друкувати звіт
                </button>
                <button onclick="window.close()" style="padding: 10px 25px; font-size: 14px; cursor: pointer; background: #dc3545; color: white; border: none; border-radius: 4px;">
                    ✕ Закрити
                </button>
            </div>
            
            <div class="header">
                <h1>ЗВІТ ЗА ДЕНЬ</h1>
                <h2>${reportDateStr}</h2>
            </div>
            
            <div class="summary">
                <div class="summary-grid">
                    <div class="summary-item">
                        <strong>Дата звіту:</strong>
                        <div>${new Date().toLocaleDateString('uk-UA')}</div>
                        <div>${new Date().toLocaleTimeString('uk-UA')}</div>
                    </div>
                    <div class="summary-item">
                        <strong>Кількість накладних:</strong>
                        <div class="summary-value">${dayInvoices.length}</div>
                    </div>
                    <div class="summary-item">
                        <strong>Загальна сума:</strong>
                        <div class="summary-value">${totalDayAmount.toLocaleString('uk-UA')} грн</div>
                    </div>
                </div>
            </div>

            ${metalsWithTransactions.length > 0 ? `
                <table>
                    <thead>
                        <tr>
                            <th width="4%">№</th>
                            <th width="25%">Найменування металу</th>
                            <th width="6%">Засм.%</th>
                            <th width="8%">Ціна (грн)</th>
                            <th width="8%">Ціна з засм.</th>
                            <th width="8%">Вага (кг)</th>
                            <th width="8%">Сума (грн)</th>
                            <th width="8%">К-сть</th>
                            <th width="10%">Середня ціна</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${metalsWithTransactions.map((metal, index) => `
                            <tr class="metal-row">
                                <td class="text-center">${index + 1}</td>
                                <td><strong>${metal.name}</strong></td>
                                <td class="text-center">${metal.contaminationRate}%</td>
                                <td class="number-cell">${metal.price}</td>
                                <td class="number-cell">${metal.priceWithContamination}</td>
                                <td class="number-cell">${metal.totalWeight.toFixed(2)}</td>
                                <td class="number-cell"><strong>${metal.totalAmount.toLocaleString('uk-UA')}</strong></td>
                                <td class="text-center">${metal.transactions.length}</td>
                                <td class="number-cell"><strong>${metal.averagePrice.toFixed(2)}</strong></td>
                            </tr>
                        `).join('')}
                        
                        <tr class="total-row">
                            <td colspan="5" class="text-right"><strong>РАЗОМ:</strong></td>
                            <td class="number-cell"><strong>${metalsWithTransactions.reduce((sum, m) => sum + m.totalWeight, 0).toFixed(2)}</strong></td>
                            <td class="number-cell"><strong>${totalDayAmount.toLocaleString('uk-UA')}</strong></td>
                            <td class="text-center"><strong>${metalsWithTransactions.reduce((sum, m) => sum + m.transactions.length, 0)}</strong></td>
                            <td class="number-cell"><strong>-</strong></td>
                        </tr>
                    </tbody>
                </table>
            ` : `
                <div style="text-align: center; padding: 50px; border: 1px solid #000; margin: 20px 0;">
                    <p style="font-size: 16pt;">За обраний період немає транзакцій</p>
                </div>
            `}

            <div class="signature">
                <div>
                    <div>Підпис відповідальної особи:</div>
                    <div class="signature-line"></div>
                </div>
                <div>
                    <div>М.П.</div>
                </div>
                <div>
                    <div>Дата:</div>
                    <div class="signature-line"></div>
                </div>
            </div>
            
            <div class="footer">
                Звіт згенеровано автоматично системою обліку металів
            </div>
            
            <script>
                window.onload = function() {
                    setTimeout(() => {
                        window.print();
                    }, 500);
                };
            </script>
        </body>
        </html>
    `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const formatReceiptForPrinter = (invoice) => {
        if (!invoice || !invoice.items) {
            return "Помилка: немає даних для друку";
        }

        const maxWidth = 40;

        let receipt = "";

        const title = "НАКЛАДНА";
        const titlePadding = Math.floor((maxWidth - title.length) / 2);
        receipt += " ".repeat(titlePadding) + title + "\n";

        receipt += "=".repeat(maxWidth) + "\n";

        receipt += `№: ${invoice.id || "---"}\n`;
        const date = invoice.created_at ? new Date(invoice.created_at) : new Date();
        receipt += `Дата: ${date.toLocaleDateString('uk-UA')}\n`;
        receipt += `Час: ${date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}\n`;

        receipt += "-".repeat(maxWidth) + "\n";

        receipt += "МЕТАЛ   ЗАСМ  ЦІНА ЦЗ  ВАГА     СУМА\n";
        receipt += "-".repeat(maxWidth) + "\n";

        invoice.items.forEach(item => {
            let name = item.name || "Метал";
            if (name.length > 8) {
                name = name.substring(0, 8);
            }
            name = name.padEnd(8, ' ');

            // Отримуємо відсоток засмічення
            const rate = item.contaminationRate || 0;

            // Отримуємо ціну з засміченням
            const priceWithCont = item.priceWithContamination || item.price;

            const rateStr = rate.toString().padStart(2, ' ');
            const priceStr = (item.price || 0).toString().padStart(4, ' ');
            const priceWithContStr = priceWithCont.toString().padStart(4, ' ');
            const weightStr = (Number(item.weight) || 0).toFixed(2).padStart(4, ' ');
            const sumStr = (item.sum || 0).toString().padStart(6, ' ');

            receipt += `${name} ${rateStr}% ${priceStr} ${priceWithContStr} ${weightStr} ${sumStr}\n`;
        });

        receipt += "=".repeat(maxWidth) + "\n";

        const totalText = "РАЗОМ:";
        const totalAmount = `${invoice.total || 0} грн`;
        const totalLine = totalText.padEnd(10) + totalAmount.padStart(27);
        receipt += totalLine + "\n";

        receipt += "=".repeat(maxWidth) + "\n";

        receipt += "\n";
        receipt += "Підпис клієнта: ___________\n";
        receipt += "Підпис продавця: ___________\n";
        receipt += "\n";
        receipt += "Дякуємо!\n";
        receipt += "\n\n\n";

        return receipt;
    };

    // Функція для перегляду чеку
    const viewReceipt = (invoice) => {
        if (!invoice) {
            alert("Немає даних для перегляду");
            return;
        }

        // Перераховуємо всі елементи накладної з правильним округленням
        const itemsWithCorrectData = invoice.items.map(item => {
            const rate = item.contaminationRate || contaminationRates[item.name] || 0;

            // Розраховуємо правильну ціну з засміченням
            let priceWithCont;
            if (item.name === "Чорний метал") {
                priceWithCont = Math.floor(item.price * (1 - rate / 100) * 10) / 10;
            } else {
                priceWithCont = Math.floor(item.price * (1 - rate / 100));
            }

            // Розраховуємо правильну суму
            const weight = Number(item.weight) || 0;
            const correctSum = Math.floor(weight * priceWithCont);

            return {
                ...item,
                contaminationRate: rate,
                priceWithContamination: priceWithCont,
                sum: correctSum
            };
        });

        // Перераховуємо загальну суму
        const correctTotal = itemsWithCorrectData.reduce((acc, item) => acc + item.sum, 0);

        const receiptText = formatReceiptForPrinter({
            ...invoice,
            items: itemsWithCorrectData,
            total: correctTotal
        });

        setPrintInvoice({
            ...invoice,
            items: itemsWithCorrectData,
            total: correctTotal,
            receiptText: receiptText
        });
    };

    // Функція для друку чеку
    const printToReceiptPrinter = (invoice) => {
        if (!invoice) {
            alert("Немає даних для друку");
            return;
        }

        // Перераховуємо всі елементи накладної з правильним округленням
        const itemsWithCorrectData = invoice.items.map(item => {
            const rate = item.contaminationRate || contaminationRates[item.name] || 0;

            // Розраховуємо правильну ціну з засміченням
            let priceWithCont;
            if (item.name === "Чорний метал") {
                priceWithCont = Math.floor(item.price * (1 - rate / 100) * 10) / 10;
            } else {
                priceWithCont = Math.floor(item.price * (1 - rate / 100));
            }

            // Розраховуємо правильну суму
            const weight = Number(item.weight) || 0;
            const correctSum = Math.floor(weight * priceWithCont);

            return {
                ...item,
                contaminationRate: rate,
                priceWithContamination: priceWithCont,
                sum: correctSum
            };
        });

        // Перераховуємо загальну суму
        const correctTotal = itemsWithCorrectData.reduce((acc, item) => acc + item.sum, 0);

        const receiptText = formatReceiptForPrinter({
            ...invoice,
            items: itemsWithCorrectData,
            total: correctTotal
        });

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert("Дозвольте спливаючі вікна для цього сайту.");
            return;
        }

        printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Чек №${invoice.id}</title>
            <style>
                @media print {
                    @page {
                        size: 80mm auto;
                        margin: 2mm !important;
                    }
                    
                    body {
                        margin: 0 !important;
                        padding: 2mm !important;
                        width: 76mm !important;
                        max-width: 76mm !important;
                        font-family: 'Courier New', Courier, monospace !important;
                        font-size: 10pt !important;
                        line-height: 1.2 !important;
                        color: black !important;
                        background: white !important;
                        -webkit-print-color-adjust: exact !important;
                    }
                    
                    .receipt-content {
                        white-space: pre !important;
                        word-wrap: break-word !important;
                        overflow-wrap: break-word !important;
                        width: 100% !important;
                        max-width: 76mm !important;
                        font-size: 10pt !important;
                        line-height: 1.2 !important;
                    }
                    
                    .no-print {
                        display: none !important;
                    }
                }
                
                body {
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 14px;
                    line-height: 1.4;
                    padding: 20px;
                    background: #f5f5f5;
                    margin: 0;
                }
                
                .receipt-content {
                    white-space: pre;
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 14px;
                    line-height: 1.4;
                    background: white;
                    padding: 20px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    margin: 0 auto;
                    max-width: 400px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    overflow-x: auto;
                }
                
                .controls {
                    text-align: center;
                    margin: 20px 0;
                    padding: 15px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                
                button {
                    padding: 10px 20px;
                    margin: 5px;
                    font-size: 16px;
                    cursor: pointer;
                    background: #007bff;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    transition: background 0.3s;
                }
                
                button:hover {
                    background: #0056b3;
                }
                
                .print-btn {
                    background: #28a745;
                }
                
                .print-btn:hover {
                    background: #218838;
                }
                
                .close-btn {
                    background: #dc3545;
                }
                
                .close-btn:hover {
                    background: #c82333;
                }
            </style>
        </head>
        <body>
            <div class="controls no-print">
                <h3 style="margin: 0 0 15px 0;">Чек №${invoice.id}</h3>
                <p style="margin: 0 0 15px 0; color: #666;">Ширина: 80 мм (40 символів)</p>
                <button class="print-btn" onclick="window.print()">🖨️ Друкувати чек</button>
                <button class="close-btn" onclick="window.close()">✕ Закрити</button>
            </div>
            
            <div class="receipt-content">
${receiptText}
            </div>
            
            <div class="controls no-print">
                <button class="print-btn" onclick="window.print()">🖨️ Друкувати чек</button>
                <button class="close-btn" onclick="window.close()">✕ Закрити</button>
            </div>
            
            <script>
                window.addEventListener('load', function() {
                    setTimeout(function() {
                        window.print();
                    }, 500);
                });
            </script>
        </body>
        </html>
    `);

        printWindow.document.close();
    };

    // Функція для копіювання чеку в буфер
    const copyReceiptToClipboard = (invoice) => {
        if (!invoice) {
            alert("Немає даних для копіювання");
            return;
        }

        // Перераховуємо всі елементи накладної з правильним округленням
        const itemsWithCorrectData = invoice.items.map(item => {
            const rate = item.contaminationRate || contaminationRates[item.name] || 0;

            // Розраховуємо правильну ціну з засміченням
            let priceWithCont;
            if (item.name === "Чорний метал") {
                priceWithCont = Math.floor(item.price * (1 - rate / 100) * 10) / 10;
            } else {
                priceWithCont = Math.floor(item.price * (1 - rate / 100));
            }

            // Розраховуємо правильну суму
            const weight = Number(item.weight) || 0;
            const correctSum = Math.floor(weight * priceWithCont);

            return {
                ...item,
                contaminationRate: rate,
                priceWithContamination: priceWithCont,
                sum: correctSum
            };
        });

        // Перераховуємо загальну суму
        const correctTotal = itemsWithCorrectData.reduce((acc, item) => acc + item.sum, 0);

        const receiptText = formatReceiptForPrinter({
            ...invoice,
            items: itemsWithCorrectData,
            total: correctTotal
        });

        navigator.clipboard.writeText(receiptText)
            .then(() => {
                alert("Текст чеку скопійовано в буфер обміну!");
            })
            .catch(err => {
                console.error('Помилка копіювання: ', err);

                const textArea = document.createElement('textarea');
                textArea.value = receiptText;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select();

                try {
                    const successful = document.execCommand('copy');
                    if (successful) {
                        alert("Текст чеку скопійовано в буфер обміну!");
                    }
                } catch (err) {
                    console.error('Помилка копіювання: ', err);
                }

                document.body.removeChild(textArea);
            });
    };

    const closePrint = () => {
        setPrintInvoice(null);
    };

    const testServerConnection = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/metals`);
            const data = await res.json();
            alert(`Сервер працює! Отримано ${data.length} металів`);
        } catch (error) {
            console.error("Тест не пройшов:", error);
            alert("Не вдалося підключитися до серверу. Використовуються локальні дані.");
        }
    };

    const filteredInvoices = invoices
        .filter(inv => {
            if (!fromDate && !toDate) return true;

            if (!inv.created_at) return false;

            const invoiceDate = new Date(inv.created_at);
            invoiceDate.setHours(0, 0, 0, 0);

            if (fromDate) {
                const from = new Date(fromDate);
                from.setHours(0, 0, 0, 0);
                if (invoiceDate < from) return false;
            }

            if (toDate) {
                const to = new Date(toDate);
                to.setHours(23, 59, 59, 999);
                if (invoiceDate > to) return false;
            }

            return true;
        })
        .sort((a, b) => {
            const dateA = new Date(a.created_at || 0);
            const dateB = new Date(b.created_at || 0);
            return sortAsc ? dateB - dateA : dateA - dateB;
        });

    const totalFiltered = filteredInvoices.reduce((sum, i) => sum + (i.total || 0), 0);

    if (loading) return <div style={{ padding: 20, color: 'white' }}>Завантаження даних...</div>;

    return (
        <>
            <div style={{
                padding: '20px',
                maxWidth: '1400px',
                margin: '0 auto',
                backgroundColor: '#1a1a1a',
                minHeight: '100vh',
                color: '#e0e0e0'
            }}>
                <h1 style={{
                    color: '#ffffff',
                    marginBottom: '20px',
                    textAlign: 'center',
                    fontSize: '2.5rem',
                    fontWeight: '300'
                }}>Система обліку металів</h1>

                {/* Кнопки управління вгорі */}
                <div style={{
                    marginBottom: '20px',
                    display: 'flex',
                    gap: '10px',
                    flexWrap: 'wrap',
                    justifyContent: 'center'
                }}>
                    <button
                        onClick={testServerConnection}
                        style={{
                            padding: "10px 20px",
                            backgroundColor: "#28a745",
                            color: "white",
                            border: "none",
                            borderRadius: '6px',
                            cursor: "pointer",
                            fontSize: '14px',
                            fontWeight: '500',
                            transition: 'all 0.3s'
                        }}
                        onMouseOver={(e) => e.target.style.backgroundColor = '#218838'}
                        onMouseOut={(e) => e.target.style.backgroundColor = '#28a745'}
                    >
                        🔌 Тестувати сервер
                    </button>

                    <button
                        onClick={() => setShowAdminPanel(true)}
                        style={{
                            padding: "10px 20px",
                            backgroundColor: "#ffc107",
                            color: "black",
                            border: "none",
                            borderRadius: '6px',
                            cursor: "pointer",
                            fontSize: '14px',
                            fontWeight: '500',
                            transition: 'all 0.3s'
                        }}
                        onMouseOver={(e) => e.target.style.backgroundColor = '#e0a800'}
                        onMouseOut={(e) => e.target.style.backgroundColor = '#ffc107'}
                    >
                        ⚙️ Адмін-панель
                    </button>

                    <button
                        onClick={deleteAllInvoices}
                        style={{
                            padding: "10px 20px",
                            backgroundColor: "#dc3545",
                            color: "white",
                            border: "none",
                            borderRadius: '6px',
                            cursor: "pointer",
                            fontSize: '14px',
                            fontWeight: '500',
                            transition: 'all 0.3s'
                        }}
                        onMouseOver={(e) => e.target.style.backgroundColor = '#c82333'}
                        onMouseOut={(e) => e.target.style.backgroundColor = '#dc3545'}
                    >
                        🗑️ Видалити всі накладні
                    </button>
                </div>

                {/* Інформація про збереження */}
                <div style={{
                    backgroundColor: '#2d2d2d',
                    padding: '15px',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    border: '1px solid #404040',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <div style={{
                        color: '#28a745',
                        fontSize: '24px'
                    }}>
                        💾
                    </div>
                    <div>
                        <div style={{
                            color: '#ffffff',
                            fontWeight: '500',
                            marginBottom: '5px'
                        }}>
                            Дані зберігаються локально та на сервері
                        </div>
                        <div style={{
                            color: '#aaa',
                            fontSize: '0.9rem'
                        }}>
                            Усі зміни синхронізуються з сервером та зберігаються в вашому браузері.
                        </div>
                    </div>
                </div>

                {/* Блок звітів за день */}
                <div style={{
                    backgroundColor: '#2d2d2d',
                    padding: '25px',
                    borderRadius: '12px',
                    marginBottom: '30px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                    border: '1px solid #404040'
                }}>
                    <h2 style={{
                        color: '#ffffff',
                        marginBottom: '20px',
                        fontSize: '1.5rem',
                        borderBottom: '2px solid #404040',
                        paddingBottom: '10px'
                    }}>📊 Звіт за день</h2>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '15px',
                        flexWrap: 'wrap',
                        marginBottom: '20px'
                    }}>
                        <div>
                            <span style={{
                                marginRight: '10px',
                                fontWeight: '500',
                                color: '#e0e0e0'
                            }}>Дата звіту:</span>
                            <input
                                type="date"
                                value={dailyReportDate}
                                onChange={e => setDailyReportDate(e.target.value)}
                                style={{
                                    padding: '10px',
                                    border: '1px solid #555',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    backgroundColor: '#333',
                                    color: '#fff',
                                    outline: 'none',
                                    width: '200px'
                                }}
                            />
                        </div>

                        <button
                            onClick={generateDailyReport}
                            style={{
                                padding: "12px 25px",
                                backgroundColor: '#6f42c1',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '15px',
                                fontWeight: '500',
                                transition: 'all 0.3s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                            onMouseOver={(e) => e.target.style.backgroundColor = '#5a32a3'}
                            onMouseOut={(e) => e.target.style.backgroundColor = '#6f42c1'}
                        >
                            📄 Згенерувати звіт за день
                        </button>
                    </div>

                    <div style={{
                        color: '#aaa',
                        fontSize: '0.9rem',
                        lineHeight: '1.5'
                    }}>
                        <p><strong>Звіт включатиме:</strong></p>
                        <ul style={{ margin: '10px 0 0 20px' }}>
                            <li>Загальну кількість накладних за обраний день</li>
                            <li>Детальну статистику по кожному металу (вага, середня ціна, сума)</li>
                            <li>Загальну суму витрат за день</li>
                            <li>Кількість транзакцій по кожному металу</li>
                            <li>Відсотки засмічення та ціни з урахуванням засмічення</li>
                        </ul>
                    </div>
                </div>

                {/* Форма для нової накладної */}
                <div style={{
                    backgroundColor: '#2d2d2d',
                    padding: '25px',
                    borderRadius: '12px',
                    marginBottom: '30px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                    border: '1px solid #404040'
                }}>
                    <h2 style={{
                        color: '#ffffff',
                        marginBottom: '20px',
                        fontSize: '1.5rem',
                        borderBottom: '2px solid #404040',
                        paddingBottom: '10px'
                    }}>Нова накладна</h2>

                    <div style={{
                        overflowX: 'auto',
                        marginBottom: '20px',
                        borderRadius: '8px',
                        border: '1px solid #404040'
                    }}>
                        <table width="100%" cellPadding="12" style={{
                            borderCollapse: 'collapse',
                            backgroundColor: '#242424',
                            minWidth: '1200px'
                        }}>
                            <thead style={{
                                position: 'sticky',
                                top: 0,
                                backgroundColor: '#333333',
                                zIndex: 10
                            }}>
                                <tr style={{ backgroundColor: '#333333' }}>
                                    <th style={{
                                        padding: '15px',
                                        textAlign: 'left',
                                        borderBottom: '2px solid #404040',
                                        color: '#ffffff',
                                        fontWeight: '600'
                                    }}>Метал</th>
                                    <th style={{
                                        padding: '15px',
                                        textAlign: 'left',
                                        borderBottom: '2px solid #404040',
                                        color: '#ffffff',
                                        fontWeight: '600'
                                    }}>Засмічення (%)</th>
                                    <th style={{
                                        padding: '15px',
                                        textAlign: 'left',
                                        borderBottom: '2px solid #404040',
                                        color: '#ffffff',
                                        fontWeight: '600'
                                    }}>Ціна / кг</th>
                                    <th style={{
                                        padding: '15px',
                                        textAlign: 'left',
                                        borderBottom: '2px solid #404040',
                                        color: '#ffffff',
                                        fontWeight: '600'
                                    }}>Ціна з засміченням</th>
                                    <th style={{
                                        padding: '15px',
                                        textAlign: 'left',
                                        borderBottom: '2px solid #404040',
                                        color: '#ffffff',
                                        fontWeight: '600'
                                    }}>Вага (кг)</th>
                                    <th style={{
                                        padding: '15px',
                                        textAlign: 'left',
                                        borderBottom: '2px solid #404040',
                                        color: '#ffffff',
                                        fontWeight: '600'
                                    }}>Сума</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(i => {
                                    const currentRate = contaminationRates[i.name] || 0;
                                    const priceWithCont = calculatePriceWithContamination(i.name, i.price, currentRate);
                                    const weight = Number(i.weight) || 0;
                                    const sum = calculateSum(weight, i.price, i.name, currentRate);

                                    return (
                                        <tr key={i.id} style={{
                                            borderBottom: '1px solid #404040',
                                            transition: 'background-color 0.2s'
                                        }}
                                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2d2d2d'}
                                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#242424'}
                                        >
                                            <td style={{
                                                padding: '15px',
                                                color: '#e0e0e0'
                                            }}>{i.name}</td>
                                            <td style={{ padding: '15px' }}>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="0"
                                                    max="100"
                                                    value={currentRate}
                                                    onChange={(e) => {
                                                        const newRate = parseFloat(e.target.value) || 0;
                                                        updateContaminationRate(i.name, newRate);
                                                    }}
                                                    style={{
                                                        width: '80px',
                                                        padding: '10px',
                                                        border: '1px solid #ffc107',
                                                        borderRadius: '6px',
                                                        fontSize: '14px',
                                                        backgroundColor: '#333',
                                                        color: '#fff',
                                                        outline: 'none',
                                                        fontWeight: 'bold'
                                                    }}
                                                />
                                            </td>
                                            <td style={{ padding: '15px' }}>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={i.price}
                                                    onChange={e => updatePrice(i.id, e.target.value)}
                                                    style={{
                                                        width: '100px',
                                                        padding: '10px',
                                                        border: '1px solid #555',
                                                        borderRadius: '6px',
                                                        fontSize: '14px',
                                                        backgroundColor: '#333',
                                                        color: '#fff',
                                                        outline: 'none'
                                                    }}
                                                />
                                            </td>
                                            <td style={{
                                                padding: '15px',
                                                color: '#28a745',
                                                fontWeight: 'bold',
                                                fontSize: '16px'
                                            }}>
                                                {priceWithCont} грн
                                            </td>
                                            <td style={{ padding: '15px' }}>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder="0.0"
                                                    value={i.weight}
                                                    onChange={e => updateWeight(i.id, e.target.value)}
                                                    style={{
                                                        width: '100px',
                                                        padding: '10px',
                                                        border: '1px solid #555',
                                                        borderRadius: '6px',
                                                        fontSize: '14px',
                                                        backgroundColor: '#333',
                                                        color: '#fff',
                                                        outline: 'none'
                                                    }}
                                                />
                                            </td>
                                            <td style={{
                                                padding: '15px',
                                                fontWeight: 'bold',
                                                color: '#28a745',
                                                fontSize: '16px'
                                            }}>
                                                {sum} грн
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div style={{
                        marginTop: '25px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: '#333',
                        padding: '20px',
                        borderRadius: '8px',
                        border: '1px solid #404040'
                    }}>
                        <div>
                            <h3 style={{
                                margin: '0',
                                color: '#ffffff',
                                fontSize: '1.2rem'
                            }}>Всього: <span style={{
                                color: '#28a745',
                                fontSize: '1.5rem',
                                fontWeight: 'bold'
                            }}>{total} грн</span></h3>
                            <p style={{
                                margin: '5px 0 0 0',
                                color: '#aaa',
                                fontSize: '0.9rem'
                            }}>Сума поточної накладної</p>
                        </div>
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <button
                                style={{
                                    padding: "12px 25px",
                                    backgroundColor: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '15px',
                                    fontWeight: '500',
                                    transition: 'all 0.3s'
                                }}
                                onClick={resetForm}
                                onMouseOver={(e) => e.target.style.backgroundColor = '#5a6268'}
                                onMouseOut={(e) => e.target.style.backgroundColor = '#6c757d'}
                            >
                                🔄 Скинути форму
                            </button>
                            <button
                                style={{
                                    padding: "12px 25px",
                                    fontSize: '15px',
                                    backgroundColor: isSaving ? '#6c757d' : '#007bff',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: isSaving ? 'not-allowed' : 'pointer',
                                    fontWeight: '500',
                                    transition: 'all 0.3s'
                                }}
                                onClick={saveAndPrint}
                                disabled={isSaving}
                                onMouseOver={(e) => {
                                    if (!isSaving) e.target.style.backgroundColor = '#0056b3';
                                }}
                                onMouseOut={(e) => {
                                    if (!isSaving) e.target.style.backgroundColor = '#007bff';
                                }}
                            >
                                {isSaving ? "⏳ Збереження..." : "💾 Зберегти накладну"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Список всіх накладних */}
                <div style={{
                    backgroundColor: '#2d2d2d',
                    padding: '25px',
                    borderRadius: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                    border: '1px solid #404040'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '20px',
                        flexWrap: 'wrap',
                        gap: '15px'
                    }}>
                        <h2 style={{
                            color: '#ffffff',
                            margin: '0',
                            fontSize: '1.5rem'
                        }}>Всі накладні</h2>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '15px',
                            flexWrap: 'wrap'
                        }}>
                            <div>
                                <span style={{
                                    marginRight: '8px',
                                    fontWeight: '500',
                                    color: '#e0e0e0'
                                }}>Від:</span>
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={e => setFromDate(e.target.value)}
                                    style={{
                                        padding: '10px',
                                        border: '1px solid #555',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        backgroundColor: '#333',
                                        color: '#fff',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                            <div>
                                <span style={{
                                    marginRight: '8px',
                                    fontWeight: '500',
                                    color: '#e0e0e0'
                                }}>По:</span>
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={e => setToDate(e.target.value)}
                                    style={{
                                        padding: '10px',
                                        border: '1px solid #555',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        backgroundColor: '#333',
                                        color: '#fff',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                            <button
                                onClick={() => setSortAsc(!sortAsc)}
                                style={{
                                    padding: "10px 20px",
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    transition: 'all 0.3s'
                                }}
                                onMouseOver={(e) => e.target.style.backgroundColor = '#218838'}
                                onMouseOut={(e) => e.target.style.backgroundColor = '#28a745'}
                            >
                                {sortAsc ? '📅 Новіші зверху' : '📅 Старші зверху'}
                            </button>
                        </div>
                    </div>

                    {filteredInvoices.length > 0 ? (
                        <>
                            <div style={{
                                overflowX: 'auto',
                                borderRadius: '8px',
                                border: '1px solid #404040'
                            }}>
                                <table width="100%" cellPadding="12" style={{
                                    borderCollapse: 'collapse',
                                    backgroundColor: '#242424',
                                    minWidth: '800px'
                                }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#333333' }}>
                                            <th style={{
                                                padding: '15px',
                                                textAlign: 'left',
                                                borderBottom: '2px solid #404040',
                                                color: '#ffffff',
                                                fontWeight: '600'
                                            }}>№</th>
                                            <th style={{
                                                padding: '15px',
                                                textAlign: 'left',
                                                borderBottom: '2px solid #404040',
                                                color: '#ffffff',
                                                fontWeight: '600'
                                            }}>Дата</th>
                                            <th style={{
                                                padding: '15px',
                                                textAlign: 'left',
                                                borderBottom: '2px solid #404040',
                                                color: '#ffffff',
                                                fontWeight: '600'
                                            }}>Сума</th>
                                            <th style={{
                                                padding: '15px',
                                                textAlign: 'left',
                                                borderBottom: '2px solid #404040',
                                                color: '#ffffff',
                                                fontWeight: '600'
                                            }}>Позицій</th>
                                            <th style={{
                                                padding: '15px',
                                                textAlign: 'left',
                                                borderBottom: '2px solid #404040',
                                                color: '#ffffff',
                                                fontWeight: '600'
                                            }}>Дії</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredInvoices.map(inv => (
                                            <tr key={inv.id} style={{
                                                borderBottom: '1px solid #404040',
                                                transition: 'background-color 0.2s'
                                            }}
                                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2d2d2d'}
                                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#242424'}
                                            >
                                                <td style={{
                                                    padding: '15px',
                                                    fontWeight: 'bold',
                                                    color: '#ffffff',
                                                    fontSize: '16px'
                                                }}>{inv.id}</td>
                                                <td style={{
                                                    padding: '15px',
                                                    color: '#e0e0e0'
                                                }}>
                                                    {inv.created_at ? new Date(inv.created_at).toLocaleString('uk-UA') : 'Немає дати'}
                                                </td>
                                                <td style={{
                                                    padding: '15px',
                                                    fontWeight: 'bold',
                                                    color: '#28a745',
                                                    fontSize: '16px'
                                                }}>{inv.total || 0} грн</td>
                                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        backgroundColor: '#333',
                                                        color: '#ffffff',
                                                        padding: '5px 12px',
                                                        borderRadius: '20px',
                                                        fontSize: '13px',
                                                        fontWeight: 'bold',
                                                        minWidth: '40px'
                                                    }}>
                                                        {inv.items ? inv.items.length : 0}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '15px' }}>
                                                    <div style={{
                                                        display: 'flex',
                                                        gap: '10px',
                                                        flexWrap: 'wrap'
                                                    }}>
                                                        <button
                                                            onClick={() => viewReceipt(inv)}
                                                            style={{
                                                                padding: "8px 16px",
                                                                backgroundColor: '#17a2b8',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                cursor: 'pointer',
                                                                fontSize: '13px',
                                                                fontWeight: '500',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                transition: 'all 0.3s'
                                                            }}
                                                            onMouseOver={(e) => e.target.style.backgroundColor = '#138496'}
                                                            onMouseOut={(e) => e.target.style.backgroundColor = '#17a2b8'}
                                                        >
                                                            👁️ Перегляд
                                                        </button>
                                                        <button
                                                            onClick={() => printToReceiptPrinter(inv)}
                                                            style={{
                                                                padding: "8px 16px",
                                                                backgroundColor: '#28a745',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                cursor: 'pointer',
                                                                fontSize: '13px',
                                                                fontWeight: '500',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                transition: 'all 0.3s'
                                                            }}
                                                            onMouseOver={(e) => e.target.style.backgroundColor = '#218838'}
                                                            onMouseOut={(e) => e.target.style.backgroundColor = '#28a745'}
                                                        >
                                                            🖨️ Друк
                                                        </button>
                                                        <button
                                                            onClick={() => deleteInvoice(inv.id)}
                                                            style={{
                                                                padding: "8px 16px",
                                                                backgroundColor: '#dc3545',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                cursor: 'pointer',
                                                                fontSize: '13px',
                                                                fontWeight: '500',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                transition: 'all 0.3s'
                                                            }}
                                                            onMouseOver={(e) => e.target.style.backgroundColor = '#c82333'}
                                                            onMouseOut={(e) => e.target.style.backgroundColor = '#dc3545'}
                                                        >
                                                            🗑️ Видалити
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {filteredInvoices.length > 0 && (
                                <div style={{
                                    marginTop: '25px',
                                    backgroundColor: '#333',
                                    padding: '20px',
                                    borderRadius: '8px',
                                    border: '1px solid #404040',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '15px'
                                }}>
                                    <div>
                                        <div style={{
                                            color: '#ffffff',
                                            fontSize: '1.1rem',
                                            fontWeight: '600',
                                            marginBottom: '5px'
                                        }}>
                                            Загальна сума за період:
                                        </div>
                                        <div style={{
                                            color: '#28a745',
                                            fontSize: '1.8rem',
                                            fontWeight: 'bold'
                                        }}>
                                            {totalFiltered} грн
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{
                                            color: '#ffffff',
                                            fontSize: '1.1rem',
                                            fontWeight: '600',
                                            marginBottom: '5px'
                                        }}>
                                            Кількість накладних:
                                        </div>
                                        <div style={{
                                            color: '#dc3545',
                                            fontSize: '1.8rem',
                                            fontWeight: 'bold'
                                        }}>
                                            {filteredInvoices.length}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{
                                            color: '#ffffff',
                                            fontSize: '1.1rem',
                                            fontWeight: '600',
                                            marginBottom: '5px'
                                        }}>
                                            Загальна кількість позицій:
                                        </div>
                                        <div style={{
                                            color: '#17a2b8',
                                            fontSize: '1.8rem',
                                            fontWeight: 'bold'
                                        }}>
                                            {filteredInvoices.reduce((sum, inv) => sum + (inv.items ? inv.items.length : 0), 0)}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{
                            textAlign: 'center',
                            padding: '60px 20px',
                            color: '#aaa',
                            backgroundColor: '#242424',
                            borderRadius: '8px',
                            marginTop: '20px',
                            border: '2px dashed #404040'
                        }}>
                            <div style={{
                                fontSize: '64px',
                                marginBottom: '20px',
                                opacity: '0.5'
                            }}>📄</div>
                            <h3 style={{
                                margin: '0 0 15px 0',
                                color: '#ffffff',
                                fontSize: '1.5rem'
                            }}>Немає накладних</h3>
                            <p style={{
                                margin: '0',
                                fontSize: '1rem',
                                maxWidth: '400px',
                                marginInline: 'auto'
                            }}>
                                {fromDate || toDate
                                    ? 'За обраний період накладні не знайдено. Спробуйте змінити дати.'
                                    : 'Створіть першу накладну, щоб розпочати роботу.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Адмін панель для зміни цін та засмічення */}
            {showAdminPanel && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.95)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 2000,
                    padding: '20px',
                    overflow: 'auto'
                }}>
                    <div style={{
                        backgroundColor: '#2d2d2d',
                        borderRadius: '12px',
                        width: '100%',
                        maxWidth: '1400px',
                        maxHeight: '90vh',
                        overflow: 'hidden',
                        position: 'relative',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                        border: '2px solid #404040',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div style={{
                            backgroundColor: '#333',
                            padding: '20px',
                            borderBottom: '2px solid #404040',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexShrink: 0
                        }}>
                            <h3 style={{
                                margin: 0,
                                color: '#ffffff',
                                fontSize: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px'
                            }}>
                                ⚙️ Адмін-панель - Зміна цін та засмічення
                            </h3>
                            <button
                                onClick={() => setShowAdminPanel(false)}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#dc3545',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    transition: 'all 0.3s'
                                }}
                                onMouseOver={(e) => e.target.style.backgroundColor = '#c82333'}
                                onMouseOut={(e) => e.target.style.backgroundColor = '#dc3545'}
                            >
                                ✕ Закрити
                            </button>
                        </div>

                        <div style={{
                            padding: '25px',
                            overflowY: 'auto',
                            flex: 1
                        }}>
                            <div style={{
                                backgroundColor: '#242424',
                                padding: '20px',
                                borderRadius: '8px',
                                marginBottom: '20px',
                                border: '1px solid #404040'
                            }}>
                                <h4 style={{
                                    color: '#ffffff',
                                    marginBottom: '15px',
                                    fontSize: '1.2rem'
                                }}>
                                    📝 Інструкція:
                                </h4>
                                <ul style={{
                                    color: '#e0e0e0',
                                    margin: 0,
                                    paddingLeft: '20px',
                                    lineHeight: '1.6'
                                }}>
                                    <li>Змініть ціну або відсоток засмічення для кожного металу у відповідних полях</li>
                                    <li>Натисніть "💾 Зберегти" для кожного металу окремо для постійного збереження</li>
                                    <li>Для масового збереження змін засмічення використовуйте кнопки внизу</li>
                                    <li>💡 <strong>Всі дані зберігаються в браузері та на сервері</strong></li>
                                </ul>
                            </div>

                            <div style={{
                                overflowX: 'auto',
                                marginBottom: '25px',
                                borderRadius: '8px',
                                border: '1px solid #404040'
                            }}>
                                <table width="100%" cellPadding="15" style={{
                                    borderCollapse: 'collapse',
                                    backgroundColor: '#242424',
                                    minWidth: '1400px'
                                }}>
                                    <thead style={{
                                        position: 'sticky',
                                        top: 0,
                                        backgroundColor: '#333333',
                                        zIndex: 10
                                    }}>
                                        <tr style={{ backgroundColor: '#333333' }}>
                                            <th style={{
                                                padding: '15px',
                                                textAlign: 'left',
                                                borderBottom: '2px solid #404040',
                                                color: '#ffffff',
                                                fontWeight: '600'
                                            }}>Метал</th>
                                            <th style={{
                                                padding: '15px',
                                                textAlign: 'left',
                                                borderBottom: '2px solid #404040',
                                                color: '#ffffff',
                                                fontWeight: '600'
                                            }}>Засмічення (%)</th>
                                            <th style={{
                                                padding: '15px',
                                                textAlign: 'left',
                                                borderBottom: '2px solid #404040',
                                                color: '#ffffff',
                                                fontWeight: '600'
                                            }}>Стандартна ціна</th>
                                            <th style={{
                                                padding: '15px',
                                                textAlign: 'left',
                                                borderBottom: '2px solid #404040',
                                                color: '#ffffff',
                                                fontWeight: '600'
                                            }}>Поточна ціна</th>
                                            <th style={{
                                                padding: '15px',
                                                textAlign: 'left',
                                                borderBottom: '2px solid #404040',
                                                color: '#ffffff',
                                                fontWeight: '600'
                                            }}>Ціна з засміченням</th>
                                            <th style={{
                                                padding: '15px',
                                                textAlign: 'left',
                                                borderBottom: '2px solid #404040',
                                                color: '#ffffff',
                                                fontWeight: '600'
                                            }}>Нова ціна</th>
                                            <th style={{
                                                padding: '15px',
                                                textAlign: 'left',
                                                borderBottom: '2px solid #404040',
                                                color: '#ffffff',
                                                fontWeight: '600'
                                            }}>Дія</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {metalPrices.map(metal => {
                                            const hasPriceChanged = tempPrices[metal.id] !== undefined;
                                            const isPriceSaved = metal.price === (metal.defaultPrice || initialTestMetals.find(m => m.id === metal.id)?.price);
                                            const currentRate = contaminationRates[metal.name] || 0;
                                            const tempRate = tempContamination[metal.name];
                                            const hasContaminationChanged = tempRate !== undefined && tempRate !== currentRate;
                                            const priceWithCont = calculatePriceWithContamination(
                                                metal.name,
                                                metal.price,
                                                tempRate !== undefined ? tempRate : currentRate
                                            );

                                            return (
                                                <tr key={metal.id} style={{
                                                    borderBottom: '1px solid #404040',
                                                    backgroundColor: (hasPriceChanged || hasContaminationChanged) ? '#2a2a2a' : '#242424',
                                                    transition: 'background-color 0.2s'
                                                }}
                                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2d2d2d'}
                                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = (hasPriceChanged || hasContaminationChanged) ? '#2a2a2a' : '#242424'}
                                                >
                                                    <td style={{
                                                        padding: '15px',
                                                        color: '#ffffff',
                                                        fontWeight: '500',
                                                        fontSize: '15px'
                                                    }}>
                                                        {metal.name}
                                                    </td>
                                                    <td style={{ padding: '15px' }}>
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            min="0"
                                                            max="100"
                                                            value={tempRate !== undefined ? tempRate : currentRate}
                                                            onChange={(e) => {
                                                                const newRate = parseFloat(e.target.value) || 0;
                                                                updateTempContamination(metal.name, newRate);
                                                            }}
                                                            style={{
                                                                width: '80px',
                                                                padding: '12px',
                                                                border: `2px solid ${hasContaminationChanged ? '#ffc107' : '#555'}`,
                                                                borderRadius: '6px',
                                                                fontSize: '15px',
                                                                backgroundColor: hasContaminationChanged ? '#3a3a3a' : '#333',
                                                                color: '#fff',
                                                                outline: 'none',
                                                                fontWeight: 'bold'
                                                            }}
                                                        />
                                                    </td>
                                                    <td style={{
                                                        padding: '15px',
                                                        color: '#6c757d',
                                                        fontWeight: '500',
                                                        fontSize: '15px',
                                                        textDecoration: 'line-through'
                                                    }}>
                                                        {metal.defaultPrice || initialTestMetals.find(m => m.id === metal.id)?.price} грн
                                                    </td>
                                                    <td style={{
                                                        padding: '15px',
                                                        color: isPriceSaved ? '#6c757d' : '#28a745',
                                                        fontWeight: 'bold',
                                                        fontSize: '16px'
                                                    }}>
                                                        {metal.price} грн
                                                    </td>
                                                    <td style={{
                                                        padding: '15px',
                                                        color: '#28a745',
                                                        fontWeight: 'bold',
                                                        fontSize: '16px'
                                                    }}>
                                                        {priceWithCont} грн
                                                    </td>
                                                    <td style={{ padding: '15px' }}>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={metal.price}
                                                            onChange={(e) => {
                                                                const newPrice = Number(e.target.value);
                                                                updateTempPrice(metal.id, newPrice);
                                                            }}
                                                            style={{
                                                                width: '120px',
                                                                padding: '12px',
                                                                border: `2px solid ${hasPriceChanged ? '#ffc107' : '#555'}`,
                                                                borderRadius: '6px',
                                                                fontSize: '15px',
                                                                backgroundColor: hasPriceChanged ? '#3a3a3a' : '#333',
                                                                color: '#fff',
                                                                outline: 'none',
                                                                fontWeight: 'bold'
                                                            }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '15px' }}>
                                                        <button
                                                            onClick={() => {
                                                                updateMetalPrice(metal.id, metal.price, metal.name);
                                                                if (tempRate !== undefined) {
                                                                    updateContaminationRate(metal.name, tempRate);
                                                                }
                                                            }}
                                                            disabled={isSavingPrice || (!hasPriceChanged && !hasContaminationChanged)}
                                                            style={{
                                                                padding: "10px 20px",
                                                                backgroundColor: isSavingPrice || (!hasPriceChanged && !hasContaminationChanged) ? '#6c757d' : '#28a745',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                cursor: isSavingPrice || (!hasPriceChanged && !hasContaminationChanged) ? 'not-allowed' : 'pointer',
                                                                fontSize: '14px',
                                                                fontWeight: '500',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                transition: 'all 0.3s'
                                                            }}
                                                            onMouseOver={(e) => {
                                                                if (!isSavingPrice && (hasPriceChanged || hasContaminationChanged)) e.target.style.backgroundColor = '#218838';
                                                            }}
                                                            onMouseOut={(e) => {
                                                                if (!isSavingPrice && (hasPriceChanged || hasContaminationChanged)) e.target.style.backgroundColor = '#28a745';
                                                            }}
                                                        >
                                                            {isPriceSaved && !hasContaminationChanged ? '✅ Збережено' : '💾 Зберегти'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{
                                display: 'flex',
                                gap: '15px',
                                justifyContent: 'center',
                                flexWrap: 'wrap',
                                marginTop: '30px'
                            }}>
                                <button
                                    onClick={updateAllPrices}
                                    disabled={isSavingPrice || Object.keys(tempPrices).length === 0}
                                    style={{
                                        padding: "15px 30px",
                                        backgroundColor: isSavingPrice || Object.keys(tempPrices).length === 0 ? '#6c757d' : '#007bff',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: isSavingPrice || Object.keys(tempPrices).length === 0 ? 'not-allowed' : 'pointer',
                                        fontSize: '16px',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'all 0.3s'
                                    }}
                                    onMouseOver={(e) => {
                                        if (!isSavingPrice && Object.keys(tempPrices).length > 0) e.target.style.backgroundColor = '#0056b3';
                                    }}
                                    onMouseOut={(e) => {
                                        if (!isSavingPrice && Object.keys(tempPrices).length > 0) e.target.style.backgroundColor = '#007bff';
                                    }}
                                >
                                    💾 Зберегти всі зміни цін
                                </button>

                                <button
                                    onClick={saveAllContaminationChanges}
                                    disabled={isSavingPrice || Object.keys(tempContamination).length === 0}
                                    style={{
                                        padding: "15px 30px",
                                        backgroundColor: isSavingPrice || Object.keys(tempContamination).length === 0 ? '#6c757d' : '#ffc107',
                                        color: 'black',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: isSavingPrice || Object.keys(tempContamination).length === 0 ? 'not-allowed' : 'pointer',
                                        fontSize: '16px',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'all 0.3s'
                                    }}
                                    onMouseOver={(e) => {
                                        if (!isSavingPrice && Object.keys(tempContamination).length > 0) e.target.style.backgroundColor = '#e0a800';
                                    }}
                                    onMouseOut={(e) => {
                                        if (!isSavingPrice && Object.keys(tempContamination).length > 0) e.target.style.backgroundColor = '#ffc107';
                                    }}
                                >
                                    💾 Зберегти всі зміни засмічення
                                </button>

                                <button
                                    onClick={cancelAllPriceChanges}
                                    disabled={isSavingPrice || Object.keys(tempPrices).length === 0}
                                    style={{
                                        padding: "15px 30px",
                                        backgroundColor: isSavingPrice || Object.keys(tempPrices).length === 0 ? '#6c757d' : '#17a2b8',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: isSavingPrice || Object.keys(tempPrices).length === 0 ? 'not-allowed' : 'pointer',
                                        fontSize: '16px',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'all 0.3s'
                                    }}
                                    onMouseOver={(e) => {
                                        if (!isSavingPrice && Object.keys(tempPrices).length > 0) e.target.style.BackgroundColor = '#138496';
                                    }}
                                    onMouseOut={(e) => {
                                        if (!isSavingPrice && Object.keys(tempPrices).length > 0) e.target.style.backgroundColor = '#17a2b8';
                                    }}
                                >
                                    ❌ Скасувати зміни цін
                                </button>

                                <button
                                    onClick={cancelContaminationChanges}
                                    disabled={isSavingPrice || Object.keys(tempContamination).length === 0}
                                    style={{
                                        padding: "15px 30px",
                                        backgroundColor: isSavingPrice || Object.keys(tempContamination).length === 0 ? '#6c757d' : '#dc3545',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: isSavingPrice || Object.keys(tempContamination).length === 0 ? 'not-allowed' : 'pointer',
                                        fontSize: '16px',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'all 0.3s'
                                    }}
                                    onMouseOver={(e) => {
                                        if (!isSavingPrice && Object.keys(tempContamination).length > 0) e.target.style.backgroundColor = '#c82333';
                                    }}
                                    onMouseOut={(e) => {
                                        if (!isSavingPrice && Object.keys(tempContamination).length > 0) e.target.style.backgroundColor = '#dc3545';
                                    }}
                                >
                                    ❌ Скасувати зміни засмічення
                                </button>

                                <button
                                    onClick={resetToDefaultPrices}
                                    disabled={isSavingPrice}
                                    style={{
                                        padding: "15px 30px",
                                        backgroundColor: isSavingPrice ? '#6c757d' : '#6f42c1',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: isSavingPrice ? 'not-allowed' : 'pointer',
                                        fontSize: '16px',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'all 0.3s'
                                    }}
                                    onMouseOver={(e) => {
                                        if (!isSavingPrice) e.target.style.backgroundColor = '#5a32a3';
                                    }}
                                    onMouseOut={(e) => {
                                        if (!isSavingPrice) e.target.style.backgroundColor = '#6f42c1';
                                    }}
                                >
                                    🔄 Скинути до стандартних
                                </button>
                            </div>

                            <div style={{
                                marginTop: '30px',
                                padding: '20px',
                                backgroundColor: '#333',
                                borderRadius: '8px',
                                border: '1px solid #404040'
                            }}>
                                <h4 style={{
                                    color: '#ffffff',
                                    marginBottom: '10px',
                                    fontSize: '1.1rem'
                                }}>
                                    📊 Статистика:
                                </h4>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                    gap: '15px'
                                }}>
                                    <div style={{
                                        backgroundColor: '#242424',
                                        padding: '15px',
                                        borderRadius: '6px',
                                        border: '1px solid #404040'
                                    }}>
                                        <div style={{
                                            color: '#aaa',
                                            fontSize: '0.9rem',
                                            marginBottom: '5px'
                                        }}>
                                            Кількість металів:
                                        </div>
                                        <div style={{
                                            color: '#ffffff',
                                            fontSize: '1.8rem',
                                            fontWeight: 'bold'
                                        }}>
                                            {metalPrices.length}
                                        </div>
                                    </div>
                                    <div style={{
                                        backgroundColor: '#242424',
                                        padding: '15px',
                                        borderRadius: '6px',
                                        border: '1px solid #404040'
                                    }}>
                                        <div style={{
                                            color: '#aaa',
                                            fontSize: '0.9rem',
                                            marginBottom: '5px'
                                        }}>
                                            Змінено цін:
                                        </div>
                                        <div style={{
                                            color: '#ffc107',
                                            fontSize: '1.8rem',
                                            fontWeight: 'bold'
                                        }}>
                                            {Object.keys(tempPrices).length}
                                        </div>
                                    </div>
                                    <div style={{
                                        backgroundColor: '#242424',
                                        padding: '15px',
                                        borderRadius: '6px',
                                        border: '1px solid #404040'
                                    }}>
                                        <div style={{
                                            color: '#aaa',
                                            fontSize: '0.9rem',
                                            marginBottom: '5px'
                                        }}>
                                            Змінено засмічення:
                                        </div>
                                        <div style={{
                                            color: '#17a2b8',
                                            fontSize: '1.8rem',
                                            fontWeight: 'bold'
                                        }}>
                                            {Object.keys(tempContamination).length}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Модальне вікно для перегляду чеку */}
            {printInvoice && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000,
                    padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: '#2d2d2d',
                        borderRadius: '12px',
                        width: '100%',
                        maxWidth: '500px',
                        maxHeight: '90vh',
                        overflow: 'hidden',
                        position: 'relative',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                        border: '1px solid #404040'
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: '15px',
                            right: '15px',
                            zIndex: 1001
                        }}>
                            <button
                                onClick={closePrint}
                                style={{
                                    padding: '10px',
                                    backgroundColor: '#dc3545',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '50%',
                                    cursor: 'pointer',
                                    width: '40px',
                                    height: '40px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '20px',
                                    boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                                    transition: 'all 0.3s'
                                }}
                                onMouseOver={(e) => e.target.style.backgroundColor = '#c82333'}
                                onMouseOut={(e) => e.target.style.backgroundColor = '#dc3545'}
                            >
                                ×
                            </button>
                        </div>

                        <div style={{
                            backgroundColor: '#333',
                            padding: '20px',
                            borderBottom: '1px solid #404040'
                        }}>
                            <h3 style={{
                                margin: '0',
                                textAlign: 'center',
                                color: '#ffffff',
                                fontSize: '1.3rem'
                            }}>
                                📄 Чек №{printInvoice.id || '---'}
                            </h3>
                        </div>

                        <div style={{
                            padding: '30px',
                            maxHeight: 'calc(90vh - 150px)',
                            overflow: 'auto'
                        }}>
                            <div style={{
                                fontFamily: "'Courier New', Courier, monospace",
                                fontSize: '15px',
                                lineHeight: '1.5',
                                whiteSpace: 'pre',
                                backgroundColor: '#242424',
                                padding: '25px',
                                borderRadius: '8px',
                                border: '2px solid #404040',
                                margin: '0 auto',
                                color: '#e0e0e0',
                                boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)',
                                maxWidth: '400px'
                            }}>
                                {printInvoice.receiptText || "Немає даних для відображення"}
                            </div>

                            <div style={{
                                marginTop: '25px',
                                display: 'flex',
                                justifyContent: 'center',
                                gap: '12px',
                                flexWrap: 'wrap'
                            }}>
                                <button
                                    onClick={() => printToReceiptPrinter(printInvoice)}
                                    style={{
                                        padding: "12px 24px",
                                        backgroundColor: '#28a745',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '15px',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'background-color 0.2s'
                                    }}
                                    onMouseOver={(e) => e.target.style.backgroundColor = '#218838'}
                                    onMouseOut={(e) => e.target.style.backgroundColor = '#28a745'}
                                >
                                    <span>🖨️</span> Друкувати чек
                                </button>
                                <button
                                    onClick={() => copyReceiptToClipboard(printInvoice)}
                                    style={{
                                        padding: "12px 24px",
                                        backgroundColor: '#17a2b8',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '15px',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'background-color 0.2s'
                                    }}
                                    onMouseOver={(e) => e.target.style.backgroundColor = '#138496'}
                                    onMouseOut={(e) => e.target.style.backgroundColor = '#17a2b8'}
                                >
                                    <span>📋</span> Копіювати текст
                                </button>
                                <button
                                    onClick={closePrint}
                                    style={{
                                        padding: "12px 24px",
                                        backgroundColor: '#6c757d',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '15px',
                                        transition: 'background-color 0.2s'
                                    }}
                                    onMouseOver={(e) => e.target.style.backgroundColor = '#5a6268'}
                                    onMouseOut={(e) => e.target.style.backgroundColor = '#6c757d'}
                                >
                                    Закрити
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}