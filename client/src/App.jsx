import { useState, useEffect, useRef } from "react";

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

    const initialItemsRef = useRef([]);
    const [invoicesLoaded, setInvoicesLoaded] = useState(false);

    const initialTestMetals = [
        { id: 1, name: "Мідь", price: 388, weight: "", initialPrice: 388 },
        { id: 2, name: "Латунь", price: 235, weight: "", initialPrice: 235 },
        { id: 3, name: "Радіатор латунний", price: 210, weight: "", initialPrice: 210 },
        { id: 4, name: "Алюміній побутовий", price: 65, weight: "", initialPrice: 65 },
        { id: 5, name: "Алюміній електротехнічний", price: 80, weight: "", initialPrice: 80 },
        { id: 6, name: "Нержавіюча сталь", price: 45, weight: "", initialPrice: 45 },
        { id: 7, name: "Магній", price: 75, weight: "", initialPrice: 75 },
        { id: 8, name: "ЦАМ", price: 95, weight: "", initialPrice: 95 },
        { id: 9, name: "Стружка мідна", price: 320, weight: "", initialPrice: 320 },
        { id: 10, name: "Стружка латунна", price: 180, weight: "", initialPrice: 180 },
        { id: 11, name: "Свинець", price: 45, weight: "", initialPrice: 45 },
        { id: 12, name: "Свинець кабельний", price: 55, weight: "", initialPrice: 55 },
        { id: 13, name: "Акумулятор білий", price: 20, weight: "", initialPrice: 20 },
        { id: 14, name: "Акумулятор чорний", price: 18, weight: "", initialPrice: 18 },
        { id: 15, name: "Титан", price: 160, weight: "", initialPrice: 160 },
        { id: 16, name: "Чорний металобрухт", price: 8, weight: "", initialPrice: 8 }
    ];

    // Функція для збереження цін в localStorage
    const savePricesToLocalStorage = (prices) => {
        try {
            localStorage.setItem('metalPrices', JSON.stringify(prices));
        } catch (error) {
            console.error("Помилка збереження цін в localStorage:", error);
        }
    };

    // Функція для завантаження цін з localStorage
    const loadPricesFromLocalStorage = () => {
        try {
            const saved = localStorage.getItem('metalPrices');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error("Помилка завантаження цін з localStorage:", error);
        }
        return null;
    };

    // Функція для збереження накладних в localStorage
    const saveInvoicesToLocalStorage = (invoices) => {
        try {
            localStorage.setItem('invoices', JSON.stringify(invoices));
            console.log('Накладні збережено в localStorage:', invoices.length);
        } catch (error) {
            console.error("Помилка збереження накладних в localStorage:", error);
        }
    };

    // Функція для завантаження накладних з localStorage
    const loadInvoicesFromLocalStorage = () => {
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
    };

    // Завантаження даних при першому рендері
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // 1. Завантажуємо метали (спочатку з localStorage, потім з сервера)
                let formattedData;
                const savedPrices = loadPricesFromLocalStorage();

                try {
                    const res = await fetch("http://localhost:3000/metals");
                    if (res.ok) {
                        const data = await res.json();

                        if (savedPrices) {
                            // Використовуємо збережені ціни
                            formattedData = data.map(m => {
                                const savedPrice = savedPrices.find(p => p.id === m.id);
                                return {
                                    ...m,
                                    price: savedPrice ? savedPrice.price : m.price,
                                    weight: "",
                                    initialPrice: savedPrice ? savedPrice.price : m.price
                                };
                            });
                        } else {
                            // Використовуємо ціни з сервера
                            formattedData = data.map(m => ({
                                ...m,
                                weight: "",
                                initialPrice: m.price
                            }));
                        }
                    } else {
                        throw new Error('Сервер не відповідає');
                    }
                } catch (serverError) {
                    console.log("Сервер недоступний, використовуємо тестові дані:", serverError);

                    if (savedPrices) {
                        formattedData = initialTestMetals.map(metal => {
                            const savedPrice = savedPrices.find(p => p.id === metal.id);
                            return {
                                ...metal,
                                price: savedPrice ? savedPrice.price : metal.price,
                                initialPrice: savedPrice ? savedPrice.price : metal.price,
                                defaultPrice: metal.price
                            };
                        });
                    } else {
                        formattedData = initialTestMetals.map(metal => ({
                            ...metal,
                            defaultPrice: metal.price
                        }));
                    }
                }

                setItems(formattedData);
                initialItemsRef.current = formattedData;

                // Завантажуємо ціни для адмін панелі
                loadMetalPrices();

                // 2. Завантажуємо накладні ТІЛЬКИ з localStorage
                const savedInvoices = loadInvoicesFromLocalStorage();
                if (savedInvoices && savedInvoices.length > 0) {
                    console.log('Використовуємо накладні з localStorage');
                    setInvoices(savedInvoices);
                } else {
                    console.log('Немає накладних в localStorage, використовуємо пустий масив');
                    setInvoices([]);
                }

                setInvoicesLoaded(true);
                setLoading(false);

            } catch (error) {
                console.error("Помилка завантаження даних:", error);

                // Завантажуємо тестові дані
                const savedPrices = loadPricesFromLocalStorage();
                let metalsWithDefaults;

                if (savedPrices) {
                    metalsWithDefaults = initialTestMetals.map(metal => {
                        const savedPrice = savedPrices.find(p => p.id === metal.id);
                        return {
                            ...metal,
                            price: savedPrice ? savedPrice.price : metal.price,
                            initialPrice: savedPrice ? savedPrice.price : metal.price,
                            defaultPrice: metal.price
                        };
                    });
                } else {
                    metalsWithDefaults = initialTestMetals.map(metal => ({
                        ...metal,
                        defaultPrice: metal.price
                    }));
                }

                setItems(metalsWithDefaults);
                initialItemsRef.current = metalsWithDefaults;
                setMetalPrices(metalsWithDefaults);

                // Накладні тільки з localStorage
                const savedInvoices = loadInvoicesFromLocalStorage();
                if (savedInvoices && savedInvoices.length > 0) {
                    setInvoices(savedInvoices);
                } else {
                    setInvoices([]);
                }

                setInvoicesLoaded(true);
                setLoading(false);
            }
        };

        loadInitialData();
    }, []);

    useEffect(() => {
        setTotal(Math.floor(items.reduce((acc, i) => acc + (Number(i.weight) || 0) * i.price, 0)));
    }, [items]);

    // Функція для синхронізації накладних з сервером (тільки для читання)
    const syncInvoicesFromServer = async () => {
        try {
            // Ця функція тільки для читання, не для перезапису
            const res = await fetch("http://localhost:3000/invoices");
            if (res.ok) {
                const serverInvoices = await res.json();
                const sortedServerInvoices = serverInvoices.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

                // Отримуємо поточні накладні з localStorage
                const localInvoices = loadInvoicesFromLocalStorage() || [];

                // Знаходимо нові накладні на сервері, яких немає в localStorage
                const newInvoices = sortedServerInvoices.filter(serverInv =>
                    !localInvoices.some(localInv => localInv.id === serverInv.id)
                );

                if (newInvoices.length > 0) {
                    // Додаємо нові накладні до локальних
                    const updatedInvoices = [...newInvoices, ...localInvoices];
                    setInvoices(updatedInvoices);
                    saveInvoicesToLocalStorage(updatedInvoices);
                    console.log('Додано нові накладні з сервера:', newInvoices.length);
                }
            }
        } catch (error) {
            console.error("Помилка синхронізації накладних з сервером:", error);
        }
    };

    // Синхронізація при завантаженні, якщо потрібно
    useEffect(() => {
        if (invoicesLoaded) {
            syncInvoicesFromServer();
        }
    }, [invoicesLoaded]);

    // Функція для завантаження цін металів
    const loadMetalPrices = async () => {
        try {
            const res = await fetch("http://localhost:3000/metals");
            const data = await res.json();

            // Перевіряємо збережені ціни в localStorage
            const savedPrices = loadPricesFromLocalStorage();

            let metalsWithDefaults;
            if (savedPrices) {
                metalsWithDefaults = data.map(metal => {
                    const savedPrice = savedPrices.find(p => p.id === metal.id);
                    return {
                        ...metal,
                        price: savedPrice ? savedPrice.price : metal.price,
                        defaultPrice: metal.price
                    };
                });
            } else {
                metalsWithDefaults = data.map(metal => ({
                    ...metal,
                    defaultPrice: metal.price
                }));
            }

            setMetalPrices(metalsWithDefaults);
        } catch (error) {
            console.error("Помилка завантаження цін:", error);

            const savedPrices = loadPricesFromLocalStorage();
            let metalsWithDefaults;

            if (savedPrices) {
                metalsWithDefaults = initialTestMetals.map(metal => {
                    const savedPrice = savedPrices.find(p => p.id === metal.id);
                    return {
                        ...metal,
                        price: savedPrice ? savedPrice.price : metal.price,
                        defaultPrice: metal.price
                    };
                });
            } else {
                metalsWithDefaults = initialTestMetals.map(metal => ({
                    ...metal,
                    defaultPrice: metal.price
                }));
            }

            setMetalPrices(metalsWithDefaults);
        }
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

            // 2. Оновлюємо на сервері (якщо доступний)
            try {
                const response = await fetch(`http://localhost:3000/metals/${id}`, {
                    method: 'PATCH',
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

            // 2. Оновлюємо кожен метал на сервері (якщо доступний)
            const updatePromises = metalPrices.map(metal =>
                fetch(`http://localhost:3000/metals/${metal.id}`, {
                    method: 'PATCH',
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

            // Оновлюємо на сервері (якщо доступний)
            const updatePromises = resetPrices.map(metal =>
                fetch(`http://localhost:3000/metals/${metal.id}`, {
                    method: 'PATCH',
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

    // Функція для скасування всіх тимчасових змін
    const cancelAllChanges = () => {
        if (!window.confirm("Скасувати всі незбережені зміни?")) {
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
        alert("✅ Всі зміни скасовано!");
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

            // 3. Спроба видалити з сервера (якщо доступний) - НЕ обов'язково, бо ми працюємо з localStorage
            try {
                // Якщо у вас є endpoint для видалення всіх накладних
                await fetch("http://localhost:3000/invoices", {
                    method: 'DELETE',
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
            // 1. Оновлюємо локальний стан
            const updatedInvoices = invoices.filter(inv => inv.id !== invoiceId);
            setInvoices(updatedInvoices);

            // 2. Зберігаємо в localStorage
            saveInvoicesToLocalStorage(updatedInvoices);

            // 3. Спроба видалити з сервера (необов'язково, але для синхронізації)
            try {
                await fetch(`http://localhost:3000/invoices/${invoiceId}`, {
                    method: 'DELETE',
                }).catch(() => {
                    console.log("Не вдалося видалити з сервера, продовжуємо локально");
                });
            } catch (serverError) {
                console.warn("Сервер недоступний:", serverError);
            }

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
            // Генеруємо новий ID для накладної
            const existingIds = invoices.map(inv => inv.id).filter(id => !isNaN(id));
            const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
            const newInvoiceId = maxId + 1;

            const newInvoice = {
                id: newInvoiceId,
                created_at: new Date().toISOString(),
                total: total,
                items: itemsWithWeight.map(item => ({
                    name: item.name,
                    price: item.price,
                    weight: item.weight,
                    sum: Math.floor(Number(item.weight) * item.price)
                }))
            };

            // Додаємо нову накладну до списку
            const updatedInvoices = [newInvoice, ...invoices];
            setInvoices(updatedInvoices);

            // Зберігаємо в localStorage
            saveInvoicesToLocalStorage(updatedInvoices);

            // Спроба зберегти на сервері (необов'язково)
            try {
                await fetch("http://localhost:3000/invoices", {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(newInvoice)
                }).catch(() => {
                    console.log("Не вдалося зберегти на сервері, продовжуємо локально");
                });
            } catch (serverError) {
                console.warn("Сервер недоступний:", serverError);
            }

            viewReceipt(newInvoice);
            resetForm();
            alert(`Накладна №${newInvoice.id} успішно збережена!`);

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

        const metalStats = {};
        let totalDayAmount = 0;

        dayInvoices.forEach(invoice => {
            invoice.items.forEach(item => {
                if (!metalStats[item.name]) {
                    metalStats[item.name] = {
                        totalWeight: 0,
                        totalAmount: 0,
                        price: item.price,
                        transactions: []
                    };
                }

                const weight = Number(item.weight) || 0;
                const amount = item.sum || Math.floor(weight * item.price);

                metalStats[item.name].totalWeight += weight;
                metalStats[item.name].totalAmount += amount;
                metalStats[item.name].transactions.push({
                    weight: weight,
                    price: item.price,
                    amount: amount
                });

                totalDayAmount += amount;
            });
        });

        Object.keys(metalStats).forEach(metalName => {
            const metal = metalStats[metalName];
            if (metal.totalWeight > 0) {
                metal.averagePrice = Math.round((metal.totalAmount / metal.totalWeight) * 100) / 100;
            } else {
                metal.averagePrice = 0;
            }
        });

        const sortedMetals = Object.entries(metalStats)
            .sort(([, a], [, b]) => b.totalAmount - a.totalAmount)
            .map(([name, stats]) => ({
                name,
                ...stats
            }));

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
                        padding: 20px;
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
                    }
                    
                    .summary {
                        margin-bottom: 30px;
                        padding: 20px;
                        background-color: #f5f5f5;
                        border-radius: 5px;
                        border: 1px solid #ddd;
                    }
                    
                    .summary-item {
                        margin: 10px 0;
                        font-size: 14pt;
                    }
                    
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 20px 0;
                        font-size: 11pt;
                    }
                    
                    th {
                        background-color: #2c3e50;
                        color: white;
                        font-weight: bold;
                        padding: 12px 8px;
                        text-align: left;
                        border: 1px solid #ddd;
                    }
                    
                    td {
                        border: 1px solid #ddd;
                        padding: 10px 8px;
                    }
                    
                    tr:nth-child(even) {
                        background-color: #f9f9f9;
                    }
                    
                    .total-row {
                        font-weight: bold;
                        background-color: #e8e8e8;
                    }
                    
                    .signature {
                        margin-top: 50px;
                        padding-top: 20px;
                        border-top: 1px solid #000;
                    }
                    
                    @media print {
                        body {
                            padding: 0;
                        }
                        
                        .no-print {
                            display: none;
                        }
                        
                        .page-break {
                            page-break-after: always;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="no-print" style="text-align: center; margin-bottom: 20px; padding: 20px; background: #f5f5f5;">
                    <button onclick="window.print()" style="padding: 12px 24px; font-size: 16px; cursor: pointer; background: #28a745; color: white; border: none; border-radius: 4px; margin-right: 10px;">
                        🖨️ Друкувати звіт
                    </button>
                    <button onclick="window.close()" style="padding: 12px 24px; font-size: 16px; cursor: pointer; background: #dc3545; color: white; border: none; border-radius: 4px;">
                        Закрити
                    </button>
                </div>
                
                <div class="header">
                    <h1>ЗВІТ ЗА ДЕНЬ</h1>
                    <div style="font-size: 16pt;">${reportDateStr}</div>
                </div>
                
                <div class="summary">
                    <div class="summary-item"><strong>Дата звіту:</strong> ${new Date().toLocaleString('uk-UA')}</div>
                    <div class="summary-item"><strong>Кількість накладних:</strong> ${dayInvoices.length}</div>
                    <div class="summary-item"><strong>Загальна сума витрат:</strong> ${totalDayAmount.toLocaleString('uk-UA')} грн</div>
                </div>
                
                <h2>Статистика по металах</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Метал</th>
                            <th>Вага (кг)</th>
                            <th>Середня ціна (грн/кг)</th>
                            <th>Сума (грн)</th>
                            <th>Кількість транзакцій</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${metalStats.map(metal => `
                            <tr>
                                <td>${metal.name}</td>
                                <td>${metal.totalWeight.toFixed(2)}</td>
                                <td>${metal.averagePrice ? metal.averagePrice.toFixed(2) : '0.00'}</td>
                                <td>${metal.totalAmount.toLocaleString('uk-UA')}</td>
                                <td>${metal.transactions ? metal.transactions.length : 0}</td>
                            </tr>
                        `).join('')}
                        <tr class="total-row">
                            <td><strong>РАЗОМ:</strong></td>
                            <td><strong>${metalStats.reduce((sum, metal) => sum + metal.totalWeight, 0).toFixed(2)}</strong></td>
                            <td></td>
                            <td><strong>${totalDayAmount.toLocaleString('uk-UA')}</strong></td>
                            <td><strong>${metalStats.reduce((sum, metal) => sum + (metal.transactions ? metal.transactions.length : 0), 0)}</strong></td>
                        </tr>
                    </tbody>
                </table>
                
                <div class="signature">
                    <div style="margin-bottom: 10px; font-size: 13pt;">
                        Підпис відповідальної особи: _________________________
                    </div>
                    <div style="font-size: 11pt; color: #666;">
                        Звіт згенеровано автоматично системою обліку металів
                    </div>
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

        receipt += "МЕТАЛ           ЦІНА ВАГА СУМА\n";
        receipt += "-".repeat(maxWidth) + "\n";

        invoice.items.forEach(item => {
            let name = item.name || "Метал";
            if (name.length > 12) {
                name = name.substring(0, 12);
            }
            name = name.padEnd(12, ' ');

            const price = (item.price || 0).toString().padStart(4, ' ');
            const weight = (Number(item.weight) || 0).toFixed(2).padStart(4, ' ');
            const sum = (item.sum || Math.floor(Number(item.weight) * item.price) || 0).toString().padStart(6, ' ');

            receipt += `${name} ${price} ${weight} ${sum}\n`;
        });

        receipt += "=".repeat(maxWidth) + "\n";

        const totalText = "РАЗОМ:";
        const totalAmount = `${invoice.total || 0} грн`;
        const totalLine = totalText.padEnd(maxWidth - totalAmount.length, ' ') + totalAmount;
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

    const printToReceiptPrinter = (invoice) => {
        if (!invoice) {
            alert("Немає даних для друку");
            return;
        }

        const receiptText = formatReceiptForPrinter(invoice);

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

    const copyReceiptToClipboard = (invoice) => {
        if (!invoice) {
            alert("Немає даних для копіювання");
            return;
        }

        const receiptText = formatReceiptForPrinter(invoice);

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

    const viewReceipt = (invoice) => {
        if (!invoice) {
            alert("Немає даних для перегляду");
            return;
        }

        const receiptText = formatReceiptForPrinter(invoice);
        setPrintInvoice({
            ...invoice,
            receiptText: receiptText
        });
    };

    const closePrint = () => {
        setPrintInvoice(null);
    };

    const testServerConnection = async () => {
        try {
            const res = await fetch("http://localhost:3000/metals");
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
                maxWidth: '1000px',
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
                            Дані зберігаються локально
                        </div>
                        <div style={{
                            color: '#aaa',
                            fontSize: '0.9rem'
                        }}>
                            Усі зміни (ціни та накладні) зберігаються в вашому браузері і не зникають при оновленні сторінки.
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
                            minWidth: '600px'
                        }}>
                            <thead>
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
                                    }}>Ціна / кг</th>
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
                                {items.map(i => (
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
                                                step="0.01"
                                                min="0"
                                                value={i.price}
                                                onChange={e => updatePrice(i.id, e.target.value)}
                                                style={{
                                                    width: '120px',
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
                                        <td style={{ padding: '15px' }}>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                placeholder="0.0"
                                                value={i.weight}
                                                onChange={e => updateWeight(i.id, e.target.value)}
                                                style={{
                                                    width: '120px',
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
                                            {Math.floor((Number(i.weight) || 0) * i.price)} грн
                                        </td>
                                    </tr>
                                ))}
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
                                    minWidth: '700px'
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
                                margin: '0 auto'
                            }}>
                                {fromDate || toDate
                                    ? 'За обраний період накладні не знайдено. Спробуйте змінити дати.'
                                    : 'Створіть першу накладну, щоб розпочати роботу.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Адмін панель для зміни цін */}
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
                        maxWidth: '900px',
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
                                ⚙️ Адмін-панель - Зміна цін металів
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
                                    <li>Змініть ціну для кожного металу у відповідному полі</li>
                                    <li>Натисніть "💾 Зберегти" для кожного металу окремо для постійного збереження</li>
                                    <li>💡 <strong>Ціни зберігаються в браузері</strong> та залишаються після оновлення сторінки</li>
                                    <li>Ціни можна скинути до значень за замовчуванням кнопкою "🔄 Скинути до стандартних"</li>
                                    <li>Незбережені зміни можна скасувати кнопкою "❌ Скасувати зміни"</li>
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
                                    minWidth: '700px'
                                }}>
                                    <thead>
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
                                            const hasChanged = tempPrices[metal.id] !== undefined;
                                            const isSaved = metal.price === (metal.defaultPrice || initialTestMetals.find(m => m.id === metal.id)?.price);
                                            return (
                                                <tr key={metal.id} style={{
                                                    borderBottom: '1px solid #404040',
                                                    backgroundColor: hasChanged ? '#2a2a2a' : '#242424',
                                                    transition: 'background-color 0.2s'
                                                }}
                                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2d2d2d'}
                                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = hasChanged ? '#2a2a2a' : '#242424'}
                                                >
                                                    <td style={{
                                                        padding: '15px',
                                                        color: '#ffffff',
                                                        fontWeight: '500',
                                                        fontSize: '15px'
                                                    }}>
                                                        {metal.name}
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
                                                        color: isSaved ? '#6c757d' : '#28a745',
                                                        fontWeight: 'bold',
                                                        fontSize: '16px'
                                                    }}>
                                                        {metal.price} грн/кг
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
                                                                width: '140px',
                                                                padding: '12px',
                                                                border: `2px solid ${hasChanged ? '#ffc107' : '#555'}`,
                                                                borderRadius: '6px',
                                                                fontSize: '15px',
                                                                backgroundColor: hasChanged ? '#3a3a3a' : '#333',
                                                                color: '#fff',
                                                                outline: 'none',
                                                                fontWeight: 'bold'
                                                            }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '15px' }}>
                                                        <button
                                                            onClick={() => updateMetalPrice(metal.id, metal.price, metal.name)}
                                                            disabled={isSavingPrice || isSaved}
                                                            style={{
                                                                padding: "10px 20px",
                                                                backgroundColor: isSavingPrice || isSaved ? '#6c757d' : '#28a745',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                cursor: isSavingPrice || isSaved ? 'not-allowed' : 'pointer',
                                                                fontSize: '14px',
                                                                fontWeight: '500',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                transition: 'all 0.3s'
                                                            }}
                                                            onMouseOver={(e) => {
                                                                if (!isSavingPrice && !isSaved) e.target.style.backgroundColor = '#218838';
                                                            }}
                                                            onMouseOut={(e) => {
                                                                if (!isSavingPrice && !isSaved) e.target.style.backgroundColor = '#28a745';
                                                            }}
                                                        >
                                                            {isSaved ? '✅ Збережено' : '💾 Зберегти'}
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
                                    💾 Зберегти всі зміни
                                </button>

                                <button
                                    onClick={cancelAllChanges}
                                    disabled={isSavingPrice || Object.keys(tempPrices).length === 0}
                                    style={{
                                        padding: "15px 30px",
                                        backgroundColor: isSavingPrice || Object.keys(tempPrices).length === 0 ? '#6c757d' : '#ffc107',
                                        color: 'black',
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
                                        if (!isSavingPrice && Object.keys(tempPrices).length > 0) e.target.style.backgroundColor = '#e0a800';
                                    }}
                                    onMouseOut={(e) => {
                                        if (!isSavingPrice && Object.keys(tempPrices).length > 0) e.target.style.backgroundColor = '#ffc107';
                                    }}
                                >
                                    ❌ Скасувати зміни
                                </button>

                                <button
                                    onClick={resetToDefaultPrices}
                                    disabled={isSavingPrice}
                                    style={{
                                        padding: "15px 30px",
                                        backgroundColor: isSavingPrice ? '#6c757d' : '#17a2b8',
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
                                        if (!isSavingPrice) e.target.style.backgroundColor = '#138496';
                                    }}
                                    onMouseOut={(e) => {
                                        if (!isSavingPrice) e.target.style.backgroundColor = '#17a2b8';
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
                                            Середня ціна:
                                        </div>
                                        <div style={{
                                            color: '#28a745',
                                            fontSize: '1.8rem',
                                            fontWeight: 'bold'
                                        }}>
                                            {metalPrices.length > 0
                                                ? Math.round(metalPrices.reduce((sum, metal) => sum + metal.price, 0) / metalPrices.length)
                                                : 0} грн
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
                                            Статус:
                                        </div>
                                        <div style={{
                                            color: Object.keys(tempPrices).length > 0 ? '#ffc107' : '#28a745',
                                            fontSize: '1.2rem',
                                            fontWeight: 'bold'
                                        }}>
                                            {Object.keys(tempPrices).length > 0 ? 'Є незбережені зміни' : 'Всі зміни збережено'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{
                                marginTop: '20px',
                                padding: '15px',
                                backgroundColor: '#1a1a1a',
                                borderRadius: '6px',
                                borderLeft: '4px solid #17a2b8'
                            }}>
                                <h4 style={{
                                    color: '#ffffff',
                                    marginBottom: '10px',
                                    fontSize: '1rem'
                                }}>
                                    💡 Примітка:
                                </h4>
                                <p style={{
                                    color: '#e0e0e0',
                                    margin: 0,
                                    fontSize: '0.9rem',
                                    lineHeight: '1.5'
                                }}>
                                    Ціни автоматично зберігаються в вашому браузері (localStorage).
                                    Вони залишаться навіть після оновлення сторінки або закриття браузера.
                                    Для повного скидання до стандартних цін використовуйте кнопку "🔄 Скинути до стандартних".
                                </p>
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