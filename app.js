document.addEventListener("DOMContentLoaded", () => {
    // -------------------
    // 1. إعداد المتغيرات الرئيسية وقاعدة البيانات
    // -------------------
    let db;
    // هذه هي "الذاكرة المؤقتة" أو "مصدر الحقيقة" للتطبيق بعد تحميله
    let expensesList = [];
    // متغيرات جديدة لتتبع حالة التعديل
    let editMode = false;
    let currentEditId = null;

    const request = indexedDB.open("SharedExpensesDB", 3);

    request.onerror = function () {
        console.error("فشل فتح قاعدة بيانات IndexedDB");
        showAlert("❌ حدث خطأ كبير في قاعدة البيانات!", "error");
    };

    request.onsuccess = function (event) {
        db = event.target.result;
        // عند فتح التطبيق، نقوم بتحميل البيانات من قاعدة البيانات إلى الذاكرة مرة واحدة
        loadInitialData();
    };

    request.onupgradeneeded = function (event) {
        db = event.target.result;
        let store;
        if (!db.objectStoreNames.contains("expenses")) {
            store = db.createObjectStore("expenses", { keyPath: "id" });
        } else {
            store = event.target.transaction.objectStore("expenses");
        }

        if (!store.indexNames.contains("type")) {
            store.createIndex("type", "type", { unique: false });
        }
        if (store.indexNames.contains("details")) {
            store.deleteIndex("details");
        }
    };

    // -------------------
    // 2. تخزين عناصر الـ DOM
    // -------------------
    const expenseForm = document.getElementById("expenseForm");
    const expenseTypeSelect = document.getElementById("expenseType");
    const expenseFieldsContainer = document.getElementById("expenseFieldsContainer");
    const totalLabel = document.getElementById("totalLabel");
    const expenseTableBody = document.getElementById("expenseTableBody");
    const totalsContainer = document.getElementById("totals");
    const youPaidSummary = document.querySelector(".you-paid");
    const partnerPaidSummary = document.querySelector(".partner-paid");
    const differenceAmountSummary = document.querySelector(".difference-amount");
    const resetBtn = document.getElementById("resetBtn");
    const dateInput = document.getElementById("date");
    const exportBtn = document.getElementById("exportBtn");
    const submitBtn = expenseForm.querySelector('button[type="submit"]'); // استهداف زر الإضافة/الحفظ

    // -------------------
    // 3. كائن الإعدادات المركزي (لا تغيير هنا)
    // -------------------
    const expenseTypeConfig = {
        food: { displayName: 'مواد غذائية', fields: `<div class="expense-type-fields"><div class="field-group"><label for="weight">الوزن (كجم)</label><input type="number" id="weight" min="0.01" step="0.01" value="1.00" required></div><div class="field-group"><label for="pricePerKilo">سعر الكيلو (د.ل)</label><input type="number" id="pricePerKilo" min="0.01" step="0.01" value="0.00" required></div><div class="field-group"><label for="load">الحمولة (د.ل)</label><input type="number" id="load" min="0" step="0.01" value="0.00"></div><div class="field-group total-field-group"><label for="totalAmount">الإجمالي (د.ل)</label><input type="number" id="totalAmount" readonly></div></div>`, calculate: () => { const w = parseFloat(document.getElementById("weight")?.value) || 0; const p = parseFloat(document.getElementById("pricePerKilo")?.value) || 0; const l = parseFloat(document.getElementById("load")?.value) || 0; return { total: (w * p) + l, details: { weight: w, pricePerKilo: p, load: l } }; }, getDetailsText: (d) => `الوزن: ${d.weight} كجم، سعر الكيلو: ${d.pricePerKilo} د.ل، الحمولة: ${d.load} د.ل` },
        advertising: { displayName: 'دعاية وإعلان', fields: `<div class="expense-type-fields"><div class="field-group"><label for="meters">عدد الأمتار</label><input type="number" id="meters" min="1" step="1" value="1" required></div><div class="field-group"><label for="pricePerMeter">سعر المتر (د.ل)</label><input type="number" id="pricePerMeter" min="0.01" step="0.01" value="0.00" required></div><div class="field-group total-field-group"><label for="totalAmount">الإجمالي (د.ل)</label><input type="number" id="totalAmount" readonly></div></div>`, calculate: () => { const m = parseFloat(document.getElementById("meters")?.value) || 0; const p = parseFloat(document.getElementById("pricePerMeter")?.value) || 0; return { total: m * p, details: { meters: m, pricePerMeter: p } }; }, getDetailsText: (d) => `عدد الأمتار: ${d.meters}، سعر المتر: ${d.pricePerMeter} د.ل` },
        equipment: { displayName: 'معدات وأدوات', fields: `<div class="expense-type-fields"><div class="field-group"><label for="quantity">العدد</label><input type="number" id="quantity" min="1" step="1" value="1" required></div><div class="field-group"><label for="unitPrice">السعر (د.ل)</label><input type="number" id="unitPrice" min="0.01" step="0.01" value="0.00" required></div><div class="field-group total-field-group"><label for="totalAmount">الإجمالي (د.ل)</label><input type="number" id="totalAmount" readonly></div></div>`, calculate: () => { const q = parseFloat(document.getElementById("quantity")?.value) || 0; const p = parseFloat(document.getElementById("unitPrice")?.value) || 0; return { total: q * p, details: { quantity: q, unitPrice: p } }; }, getDetailsText: (d) => `العدد: ${d.quantity}، السعر: ${d.unitPrice} د.ل` },
        operational: { displayName: 'تشغيلية', fields: `<div class="expense-type-fields"><div class="field-group total-field-group"><label for="price">السعر (د.ل)</label><input type="number" id="price" min="0.01" step="0.01" value="0.00" required></div><div class="field-group total-field-group"><label for="totalAmount">الإجمالي (د.ل)</label><input type="number" id="totalAmount" readonly></div></div>`, calculate: () => { const p = parseFloat(document.getElementById("price")?.value) || 0; return { total: p, details: { price: p } }; }, getDetailsText: (d) => `السعر: ${d.price} د.ل` },
        misc: { displayName: 'نثرية', fields: `<div class="expense-type-fields"><div class="field-group total-field-group"><label for="price">السعر (د.ل)</label><input type="number" id="price" min="0.01" step="0.01" value="0.00" required></div><div class="field-group total-field-group"><label for="totalAmount">الإجمالي (د.ل)</label><input type="number" id="totalAmount" readonly></div></div>`, calculate: () => { const p = parseFloat(document.getElementById("price")?.value) || 0; return { total: p, details: { price: p } }; }, getDetailsText: (d) => `السعر: ${d.price} د.ل` }
    };

    // -------------------
    // 4. دوال التطبيق
    // -------------------

    function renderUI() {
        let totalYou = 0, totalPartner = 0;
        expenseTableBody.innerHTML = "";
        if (expensesList.length === 0) {
            expenseTableBody.innerHTML = `<tr><td colspan="8" class="no-expenses">لا توجد مصروفات مسجلة بعد.</td></tr>`;
        } else {
            expensesList.forEach((expense, index) => {
                const row = document.createElement("tr");
                const config = expenseTypeConfig[expense.type];
                // إضافة زر التعديل بجانب زر الحذف
                   row.innerHTML = `<td>${index + 1}</td><td>${config.displayName}</td><td>${expense.desc}</td><td>${config.getDetailsText(expense.details)}</td><td>${expense.total.toFixed(2)} د.ل</td><td>${expense.payer === "you" ? "أنت" : "شريكك"}</td><td>${formatDate(expense.date)}</td><td><div class="action-buttons"><button class="edit-btn" data-id="${expense.id}">تعديل</button><button class="delete-btn" data-id="${expense.id}">حذف</button></div></td>`;
                expenseTableBody.appendChild(row);
                if (expense.payer === "you") totalYou += expense.total; else totalPartner += expense.total;
            });
        }
        updateSummary(totalYou, totalPartner);
    }
    
    function loadInitialData() {
        if (!db) return;
        const tx = db.transaction(["expenses"], "readonly");
        const store = tx.objectStore("expenses");
        const request = store.getAll();
        request.onsuccess = () => {
            expensesList = request.result;
            renderUI();
        };
        request.onerror = () => {
             showAlert("❌ فشلت عملية قراءة المصروفات من قاعدة البيانات.", "error");
        };
    }

    /**
     * دالة جديدة: تبدأ عملية التعديل
     */
    function startEdit(id) {
        const expenseToEdit = expensesList.find(exp => exp.id === id);
        if (!expenseToEdit) return;

        // 1. الدخول في وضع التعديل
        editMode = true;
        currentEditId = id;

        // 2. ملء حقول الفورم الرئيسية
        document.getElementById("desc").value = expenseToEdit.desc;
        dateInput.value = expenseToEdit.date;
        expenseTypeSelect.value = expenseToEdit.type;
        document.getElementById("payer").value = expenseToEdit.payer;
        
        // 3. إنشاء الحقول الديناميكية الخاصة بنوع المصروف
        createExpenseFields(expenseToEdit.type);

        // 4. ملء الحقول الديناميكية بالبيانات (نستخدم setTimeout لضمان أن الحقول تم إنشاؤها)
        setTimeout(() => {
            const details = expenseToEdit.details;
            for (const key in details) {
                const input = document.getElementById(key);
                if (input) {
                    input.value = details[key];
                }
            }
            // 5. تحديث الإجمالي
            calculateTotal();
        }, 0);

        // 6. تغيير شكل زر الإرسال
        submitBtn.textContent = "حفظ التعديلات";
        submitBtn.classList.remove("btn-add");
        submitBtn.classList.add("btn-export"); // إعادة استخدام تصميم زر التصدير

        // 7. الصعود لأعلى الصفحة ليسهل على المستخدم رؤية الفورم
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    /**
     * دالة جديدة: تقوم بحفظ التعديلات
     */
    function updateExpense() {
        const { total, details } = expenseTypeConfig[expenseTypeSelect.value].calculate();
        const updatedExpense = {
            id: currentEditId, // نستخدم نفس الـ ID القديم
            type: expenseTypeSelect.value,
            desc: document.getElementById("desc").value.trim(),
            payer: document.getElementById("payer").value,
            date: dateInput.value,
            total,
            details
        };

        const tx = db.transaction(["expenses"], "readwrite");
        const store = tx.objectStore("expenses");
        store.put(updatedExpense); // put تقوم بالتحديث إذا كان الـ ID موجوداً

        tx.oncomplete = () => {
            // تحديث المصفوفة في الذاكرة
            const index = expensesList.findIndex(exp => exp.id === currentEditId);
            if (index !== -1) {
                expensesList[index] = updatedExpense;
            }
            renderUI();
            showAlert("✔ تم حفظ التعديلات بنجاح!", "success");
            resetFormState(); // إعادة الفورم لوضع الإضافة
        };
        tx.onerror = () => showAlert("❌ فشلت عملية حفظ التعديلات.", "error");
    }
    
    /**
     * دالة جديدة: تقوم بإضافة مصروف جديد (نفس منطق addExpense السابق)
     */
    function addNewExpense() {
        if (!type || !desc || !date) {
            showAlert("❌ تأكد من ملء جميع الحقول المطلوبة.", "error");
            return;
        }

        const type = expenseTypeSelect.value;
        const desc = document.getElementById("desc").value.trim();
        const payer = document.getElementById("payer").value;
        const date = dateInput.value;

        const { total, details } = expenseTypeConfig[type].calculate();
        if (total <= 0) {
            showAlert("❌ الإجمالي يجب أن يكون أكبر من الصفر.", "error");
            return;
        }
        
        const newExpense = { id: Date.now(), type, desc, details, total, payer, date };
        const tx = db.transaction(["expenses"], "readwrite");
        const store = tx.objectStore("expenses");
        store.add(newExpense);

        tx.oncomplete = () => {
            expensesList.push(newExpense);
            renderUI();
            resetFormState();
            showAlert("✔ تم إضافة المصروف بنجاح!", "success");
        };
        tx.onerror = () => showAlert("❌ فشلت عملية إضافة المصروف.", "error");
    }

    /**
     * دالة جديدة: المتحكم الرئيسي للفورم
     */
    function handleFormSubmit(event) {
        event.preventDefault();
        if (editMode) {
            updateExpense();
        } else {
            addNewExpense();
        }
    }

    function deleteExpense(id) {
        if (!db) return;
        if (confirm("هل أنت متأكد من رغبتك في حذف هذا المصروف؟")) {
            const tx = db.transaction(["expenses"], "readwrite");
            const store = tx.objectStore("expenses");
            store.delete(id);
            tx.oncomplete = () => {
                expensesList = expensesList.filter(exp => exp.id !== id);
                renderUI();
                showAlert("تم حذف المصروف بنجاح.", "success");
            };
            tx.onerror = () => {
                showAlert("❌ فشلت عملية حذف المصروف.", "error");
            };
        }
    }

    function resetExpenses() {
        if (!db) return;
        if (confirm("هل أنت متأكد من رغبتك في مسح جميع المصروفات؟ هذا الإجراء لا يمكن التراجع عنه.")) {
            const tx = db.transaction(["expenses"], "readwrite");
            const store = tx.objectStore("expenses");
            store.clear();
            tx.oncomplete = () => {
                expensesList = [];
                renderUI();
                showAlert("تم مسح جميع المصروفات بنجاح.", "success");
            };
            tx.onerror = () => {
                showAlert("❌ فشلت عملية مسح جميع المصروفات.", "error");
            };
        }
    }
    
    function exportToCSV() {
        if (expensesList.length === 0) {
            showAlert("ℹ️ لا توجد بيانات لتصديرها.", "error");
            return;
        }
        const headers = ["الرقم", "نوع المصروف", "الوصف/المنتج", "المدفوع بواسطة", "الإجمالي (د.ل)", "التاريخ", "تفاصيل إضافية"];
        const rows = expensesList.map((expense, index) => {
            const config = expenseTypeConfig[expense.type];
            const payerName = expense.payer === 'you' ? 'أنت' : 'شريكك';
            const detailsText = config.getDetailsText(expense.details).replace(/،/g, ';');
            return [index + 1, config.displayName, `"${expense.desc}"`, payerName, expense.total.toFixed(2), formatDate(expense.date), `"${detailsText}"`].join(',');
        });
        const csvContent = [headers.join(','), ...rows].join('\n');
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
        const today = new Date().toISOString().slice(0, 10);
        const filename = `مصروفاتي_${today}.csv`;
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // --- باقي الدوال المساعدة ---
    function updateSummary(totalYou, totalPartner) {
        const difference = Math.abs(totalYou - totalPartner) / 2;
        const totalAll = totalYou + totalPartner;
        let direction = "التسوية تمت، لا أحد مدين للآخر.";
        if (totalYou > totalPartner) {
            direction = `يجب أن يدفع شريكك لك ${difference.toFixed(2)} د.ل`;
        } else if (totalPartner > totalYou) {
            direction = `يجب أن تدفع لشريكك ${difference.toFixed(2)} د.ل`;
        }
        totalsContainer.innerHTML = `<div class="total-item">💰 إجمالي ما دفعته أنت: <strong>${totalYou.toFixed(2)} د.ل</strong></div><div class="total-item">💰 إجمالي ما دفعه شريكك: <strong>${totalPartner.toFixed(2)} د.ل</strong></div><div class="total-item">📊 إجمالي المصروفات: <strong>${totalAll.toFixed(2)} د.ل</strong></div><div class="difference">⚖️ ${direction}</div>`;
        youPaidSummary.textContent = `${totalYou.toFixed(2)} د.ل`;
        partnerPaidSummary.textContent = `${totalPartner.toFixed(2)} د.ل`;
        differenceAmountSummary.textContent = `${difference.toFixed(2)} د.ل`;
    }

    function createExpenseFields(type) {
        if (type && expenseTypeConfig[type]) {
            expenseFieldsContainer.innerHTML = expenseTypeConfig[type].fields;
            expenseFieldsContainer.querySelectorAll('input[type="number"]').forEach(input => {
                if (!input.readOnly) {
                    input.addEventListener('input', calculateTotal);
                }
            });
        } else {
            expenseFieldsContainer.innerHTML = '<p>اختر نوع المصروف لظهور الحقول المناسبة</p>';
        }
        calculateTotal();
    }

    function calculateTotal() {
        const type = expenseTypeSelect.value;
        let total = 0;
        if (type && expenseTypeConfig[type]) {
            const result = expenseTypeConfig[type].calculate();
            total = result.total;
        }
        const totalAmountInput = document.getElementById("totalAmount");
        if (totalAmountInput) {
            totalAmountInput.value = total.toFixed(2);
        }
        totalLabel.textContent = `الإجمالي: ${total.toFixed(2)} د.ل`;
    }

    function showAlert(message, type) {
        const existingAlert = document.querySelector(".alert");
        if (existingAlert) existingAlert.remove();
        const alertDiv = document.createElement("div");
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        const closeBtn = document.createElement("span");
        closeBtn.innerHTML = "&times;";
        closeBtn.style.cssText = "position: absolute; left: 15px; top: 50%; transform: translateY(-50%); cursor: pointer; font-size: 1.2rem;";
        closeBtn.onclick = () => alertDiv.remove();
        alertDiv.appendChild(closeBtn);
        expenseForm.parentNode.insertBefore(alertDiv, expenseForm);
        setTimeout(() => alertDiv.remove(), 5000);
    }
    
    function formatDate(dateString) {
        const date = new Date(dateString);
        return isNaN(date.getTime()) || !dateString ? "تاريخ غير معروف" : date.toLocaleDateString("ar-EG", { year: 'numeric', month: 'long', day: 'numeric' });
    }

    /**
     * دالة جديدة: تعيد الفورم إلى حالته الأصلية (وضع الإضافة)
     */
    function resetFormState() {
        expenseForm.reset();
        dateInput.value = new Date().toISOString().split("T")[0];
        createExpenseFields('');
        // الخروج من وضع التعديل
        editMode = false;
        currentEditId = null;
        // إعادة الزر إلى حالته الأصلية
        submitBtn.textContent = "إضافة المصروف";
        submitBtn.classList.add("btn-add");
        submitBtn.classList.remove("btn-export");
    }

    // -------------------
    // 5. ربط مستمعات الأحداث
    // -------------------
    expenseForm.addEventListener("submit", handleFormSubmit);
    expenseTypeSelect.addEventListener("change", () => createExpenseFields(expenseTypeSelect.value));
    resetBtn.addEventListener("click", resetExpenses);
    exportBtn.addEventListener("click", exportToCSV);
    
    expenseTableBody.addEventListener("click", (event) => {
        const target = event.target;
        // التأكد من أن الهدف هو زر قبل محاولة قراءة dataset
        if (target.tagName === 'BUTTON') {
            const id = Number(target.dataset.id);
            if (target.classList.contains("delete-btn")) {
                deleteExpense(id);
            } else if (target.classList.contains("edit-btn")) {
                startEdit(id);
            }
        }
    });

    // -------------------
    // 6. التهيئة الأولية
    // -------------------
    dateInput.value = new Date().toISOString().split("T")[0];
    createExpenseFields('');
});

// تسجيل الـ Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(error => {
        console.log('ServiceWorker registration failed: ', error);
      });
  });
}