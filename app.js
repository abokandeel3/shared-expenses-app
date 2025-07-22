document.addEventListener("DOMContentLoaded", () => {
    // -------------------
    // 1. إعداد المتغيرات الرئيسية وقاعدة البيانات
    // -------------------
    let db;
    let expensesList = [];
    let editMode = false;
    let currentEditId = null;
    let currentPage = 1;
    const rowsPerPage = 10;

    // ============== منطق الوضع الليلي ==============
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    const applyTheme = (theme) => { if (theme === 'dark') { body.classList.add('dark-mode'); } else { body.classList.remove('dark-mode'); } };
    themeToggle.addEventListener('click', () => { const newTheme = body.classList.contains('dark-mode') ? 'light' : 'dark'; localStorage.setItem('theme', newTheme); applyTheme(newTheme); });
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme) { applyTheme(savedTheme); } else if (systemPrefersDark) { applyTheme('dark'); }
    
    // ===================================================
    const request = indexedDB.open("SharedExpensesDB", 3);
    request.onerror = function () { console.error("فشل فتح قاعدة بيانات IndexedDB"); showAlert("❌ حدث خطأ كبير في قاعدة البيانات!", "error"); };
    request.onsuccess = function (event) { db = event.target.result; loadInitialData(); };
    request.onupgradeneeded = function (event) {
        db = event.target.result;
        let store;
        if (!db.objectStoreNames.contains("expenses")) { store = db.createObjectStore("expenses", { keyPath: "id" }); } else { store = event.target.transaction.objectStore("expenses"); }
        if (!store.indexNames.contains("type")) { store.createIndex("type", "type", { unique: false }); }
        if (store.indexNames.contains("details")) { store.deleteIndex("details"); }
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
    const submitBtn = expenseForm.querySelector('button[type="submit"]');
    const searchInput = document.getElementById('searchInput');
    const typeFilter = document.getElementById('typeFilter');
    const startDateFilter = document.getElementById('startDateFilter');
    const endDateFilter = document.getElementById('endDateFilter');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageInfo = document.getElementById('pageInfo');

    // -------------------
    // 3. كائن الإعدادات المركزي
    // -------------------
    const expenseTypeConfig = {
        food: { displayName: 'مواد غذائية', fields: `<div class="expense-type-fields"><div class="field-group"><label for="weight">الوزن (كجم)</label><input type="number" id="weight" min="0.01" step="0.01" value="1.00" required></div><div class="field-group"><label for="pricePerKilo">سعر الكيلو (د.ت)</label><input type="number" id="pricePerKilo" min="0.01" step="0.01" value="0.00" required></div><div class="field-group"><label for="load">الحمولة (د.ت)</label><input type="number" id="load" min="0" step="0.01" value="0.00"></div><div class="field-group total-field-group"><label for="totalAmount">الإجمالي (د.ت)</label><input type="number" id="totalAmount" readonly></div></div>`, calculate: () => { const w = parseFloat(document.getElementById("weight")?.value) || 0; const p = parseFloat(document.getElementById("pricePerKilo")?.value) || 0; const l = parseFloat(document.getElementById("load")?.value) || 0; return { total: (w * p) + l, details: { weight: w, pricePerKilo: p, load: l } }; }, getDetailsText: (d) => `الوزن: ${d.weight} كجم، سعر الكيلو: ${d.pricePerKilo} د.ت، الحمولة: ${d.load} د.ت` },
        advertising: { displayName: 'دعاية وإعلان', fields: `<div class="expense-type-fields"><div class="field-group"><label for="meters">عدد الأمتار</label><input type="number" id="meters" min="1" step="1" value="1" required></div><div class="field-group"><label for="pricePerMeter">سعر المتر (د.ت)</label><input type="number" id="pricePerMeter" min="0.01" step="0.01" value="0.00" required></div><div class="field-group total-field-group"><label for="totalAmount">الإجمالي (د.ت)</label><input type="number" id="totalAmount" readonly></div></div>`, calculate: () => { const m = parseFloat(document.getElementById("meters")?.value) || 0; const p = parseFloat(document.getElementById("pricePerMeter")?.value) || 0; return { total: m * p, details: { meters: m, pricePerMeter: p } }; }, getDetailsText: (d) => `عدد الأمتار: ${d.meters}، سعر المتر: ${d.pricePerMeter} د.ت` },
        equipment: { displayName: 'معدات وأدوات', fields: `<div class="expense-type-fields"><div class="field-group"><label for="quantity">العدد</label><input type="number" id="quantity" min="1" step="1" value="1" required></div><div class="field-group"><label for="unitPrice">السعر (د.ت)</label><input type="number" id="unitPrice" min="0.01" step="0.01" value="0.00" required></div><div class="field-group total-field-group"><label for="totalAmount">الإجمالي (د.ت)</label><input type="number" id="totalAmount" readonly></div></div>`, calculate: () => { const q = parseFloat(document.getElementById("quantity")?.value) || 0; const p = parseFloat(document.getElementById("unitPrice")?.value) || 0; return { total: q * p, details: { quantity: q, unitPrice: p } }; }, getDetailsText: (d) => `العدد: ${d.quantity}، السعر: ${d.unitPrice} د.ت` },
        operational: { displayName: 'تشغيلية', fields: `<div class="expense-type-fields"><div class="field-group total-field-group"><label for="price">السعر (د.ت)</label><input type="number" id="price" min="0.01" step="0.01" value="0.00" required></div><div class="field-group total-field-group"><label for="totalAmount">الإجمالي (د.ت)</label><input type="number" id="totalAmount" readonly></div></div>`, calculate: () => { const p = parseFloat(document.getElementById("price")?.value) || 0; return { total: p, details: { price: p } }; }, getDetailsText: (d) => `السعر: ${d.price} د.ت` },
        misc: { displayName: 'نثرية', fields: `<div class="expense-type-fields"><div class="field-group total-field-group"><label for="price">السعر (د.ت)</label><input type="number" id="price" min="0.01" step="0.01" value="0.00" required></div><div class="field-group total-field-group"><label for="totalAmount">الإجمالي (د.ت)</label><input type="number" id="totalAmount" readonly></div></div>`, calculate: () => { const p = parseFloat(document.getElementById("price")?.value) || 0; return { total: p, details: { price: p } }; }, getDetailsText: (d) => `السعر: ${d.price} د.ت` }
    };

    // -------------------
    // 4. دوال التطبيق
    // -------------------

    function renderUI(listToRender) {
        expenseTableBody.innerHTML = "";
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const paginatedItems = listToRender.slice(startIndex, endIndex);
        if (paginatedItems.length === 0 && expensesList.length > 0) { expenseTableBody.innerHTML = `<tr><td colspan="8" class="no-expenses">لا توجد مصروفات تطابق بحثك.</td></tr>`; }
        else if (expensesList.length === 0) { expenseTableBody.innerHTML = `<tr><td colspan="8" class="no-expenses">لا توجد مصروفات مسجلة بعد.</td></tr>`; }
        else {
            paginatedItems.forEach((expense) => {
                const row = document.createElement("tr");
                const config = expenseTypeConfig[expense.type];
                const itemNumber = expensesList.indexOf(expense) + 1;
                row.innerHTML = `<td>${itemNumber}</td><td>${config.displayName}</td><td>${expense.desc}</td><td>${config.getDetailsText(expense.details)}</td><td>${expense.total.toFixed(2)} د.ت</td><td>${expense.payer === "you" ? "أنت" : "شريكك"}</td><td>${formatDate(expense.date)}</td><td><div class="action-buttons"><button class="edit-btn" data-id="${expense.id}">تعديل</button><button class="delete-btn" data-id="${expense.id}">حذف</button></div></td>`;
                expenseTableBody.appendChild(row);
            });
        }
        setupPagination(listToRender);
        let totalYou = 0, totalPartner = 0;
        expensesList.forEach(exp => { if (exp.payer === "you") totalYou += exp.total; else totalPartner += exp.total; });
        updateSummary(totalYou, totalPartner);
    }

    function setupPagination(listToRender) {
        const pageCount = Math.ceil(listToRender.length / rowsPerPage);
        pageInfo.textContent = `صفحة ${currentPage} من ${pageCount > 0 ? pageCount : 1}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === pageCount || pageCount === 0;
    }

    function loadInitialData() {
        if (!db) return;
        const tx = db.transaction(["expenses"], "readonly");
        const store = tx.objectStore("expenses");
        const request = store.getAll();
        request.onsuccess = () => { expensesList = request.result; populateTypeFilter(); applyFiltersAndRender(); };
        request.onerror = () => showAlert("❌ فشلت عملية قراءة المصروفات.", "error");
    }
    
    function populateTypeFilter() { for (const type in expenseTypeConfig) { const option = document.createElement('option'); option.value = type; option.textContent = expenseTypeConfig[type].displayName; typeFilter.appendChild(option); } }
    
    function getFilteredList() {
        let filteredList = [...expensesList];
        const searchTerm = searchInput.value.toLowerCase().trim();
        if (searchTerm) { filteredList = filteredList.filter(expense => expense.desc.toLowerCase().includes(searchTerm)); }
        const selectedType = typeFilter.value;
        if (selectedType !== 'all') { filteredList = filteredList.filter(expense => expense.type === selectedType); }
        const startDate = startDateFilter.value;
        const endDate = endDateFilter.value;
        if (startDate) { filteredList = filteredList.filter(expense => expense.date >= startDate); }
        if (endDate) { filteredList = filteredList.filter(expense => expense.date <= endDate); }
        return filteredList;
    }

    function applyFiltersAndRender() {
        const filteredList = getFilteredList();
        renderUI(filteredList);
    }
    
    function startEdit(id) { const expenseToEdit = expensesList.find(exp => exp.id === id); if (!expenseToEdit) return; editMode = true; currentEditId = id; document.getElementById("desc").value = expenseToEdit.desc; dateInput.value = expenseToEdit.date; expenseTypeSelect.value = expenseToEdit.type; document.getElementById("payer").value = expenseToEdit.payer; createExpenseFields(expenseToEdit.type); setTimeout(() => { const details = expenseToEdit.details; for (const key in details) { const input = document.getElementById(key); if (input) { input.value = details[key]; } } calculateTotal(); }, 0); submitBtn.textContent = "حفظ التعديلات"; submitBtn.classList.remove("btn-add"); submitBtn.classList.add("btn-export"); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    function updateExpense() { const { total, details } = expenseTypeConfig[expenseTypeSelect.value].calculate(); const updatedExpense = { id: currentEditId, type: expenseTypeSelect.value, desc: document.getElementById("desc").value.trim(), payer: document.getElementById("payer").value, date: dateInput.value, total, details }; const tx = db.transaction(["expenses"], "readwrite"); const store = tx.objectStore("expenses"); store.put(updatedExpense); tx.oncomplete = () => { const index = expensesList.findIndex(exp => exp.id === currentEditId); if (index !== -1) { expensesList[index] = updatedExpense; } applyFiltersAndRender(); showAlert("✔ تم حفظ التعديلات بنجاح!", "success"); resetFormState(); }; tx.onerror = () => showAlert("❌ فشلت عملية حفظ التعديلات.", "error"); }
    function addNewExpense() { const type = expenseTypeSelect.value; const desc = document.getElementById("desc").value.trim(); const payer = document.getElementById("payer").value; const date = dateInput.value; if (!type || !desc || !date) { showAlert("❌ تأكد من ملء جميع الحقول المطلوبة.", "error"); return; } const { total, details } = expenseTypeConfig[type].calculate(); if (total <= 0) { showAlert("❌ الإجمالي يجب أن يكون أكبر من الصفر.", "error"); return; } const newExpense = { id: Date.now(), type, desc, details, total, payer, date }; const tx = db.transaction(["expenses"], "readwrite"); const store = tx.objectStore("expenses"); store.add(newExpense); tx.oncomplete = () => { expensesList.push(newExpense); applyFiltersAndRender(); resetFormState(); showAlert("✔ تم إضافة المصروف بنجاح!", "success"); }; tx.onerror = () => showAlert("❌ فشلت عملية إضافة المصروف.", "error"); }
    function handleFormSubmit(event) { event.preventDefault(); if (editMode) { updateExpense(); } else { addNewExpense(); } }
    function deleteExpense(id) { if (!db) return; if (confirm("هل أنت متأكد من رغبتك في حذف هذا المصروف؟")) { const tx = db.transaction(["expenses"], "readwrite"); const store = tx.objectStore("expenses"); store.delete(id); tx.oncomplete = () => { expensesList = expensesList.filter(exp => exp.id !== id); applyFiltersAndRender(); showAlert("تم حذف المصروف بنجاح.", "success"); }; tx.onerror = () => { showAlert("❌ فشلت عملية حذف المصروف.", "error"); }; } }
    function resetExpenses() { if (!db) return; if (confirm("هل أنت متأكد من رغبتك في مسح جميع المصروفات؟ هذا الإجراء لا يمكن التراجع عنه.")) { const tx = db.transaction(["expenses"], "readwrite"); const store = tx.objectStore("expenses"); store.clear(); tx.oncomplete = () => { expensesList = []; applyFiltersAndRender(); showAlert("تم مسح جميع المصروفات بنجاح.", "success"); }; tx.onerror = () => { showAlert("❌ فشلت عملية مسح جميع المصروفات.", "error"); }; } }
    function exportToCSV() { if (expensesList.length === 0) { showAlert("ℹ️ لا توجد بيانات لتصديرها.", "error"); return; } const headers = ["id", "type", "desc", "payer", "total", "date", "details_human", "details_json"]; const rows = expensesList.map(expense => { const config = expenseTypeConfig[expense.type]; const toCsvField = (str) => `"${String(str).replace(/"/g, '""')}"`; const rowData = [ expense.id, expense.type, toCsvField(expense.desc), expense.payer, expense.total, expense.date, toCsvField(config.getDetailsText(expense.details)), toCsvField(JSON.stringify(expense.details)) ]; return rowData.join(','); }); const csvContent = [headers.join(','), ...rows].join('\n'); const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' }); const today = new Date().toISOString().slice(0, 10); const filename = `مصروفاتي_${today}.csv`; const link = document.createElement("a"); const url = URL.createObjectURL(blob); link.setAttribute("href", url); link.setAttribute("download", filename); link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); }
    function handleFileImport(event) { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = function(e) { const csvContent = e.target.result; try { const importedExpenses = parseCSV(csvContent); if (importedExpenses) { if (expensesList.length > 0) { if (confirm("هل أنت متأكد؟ سيتم حذف جميع البيانات الحالية واستبدالها بالبيانات من الملف.")) { replaceData(importedExpenses); } } else { replaceData(importedExpenses); } } } catch (error) { console.error("Error parsing CSV:", error); showAlert("❌ فشل تحليل الملف. تأكد من أنه ملف CSV صحيح تم تصديره من التطبيق.", "error"); } }; reader.readAsText(file); event.target.value = ''; }
    function parseCSV(csvContent) { const lines = csvContent.trim().split('\n'); const headerLine = lines.shift(); const headers = headerLine.split(','); const requiredHeaders = ["id", "type", "desc", "payer", "total", "date", "details_json"]; for(const h of requiredHeaders) { if (!headers.includes(h)) { showAlert(`❌ الملف غير صالح. العمود المفقود: ${h}`, "error"); return null; } } const idIndex = headers.indexOf("id"); const typeIndex = headers.indexOf("type"); const descIndex = headers.indexOf("desc"); const payerIndex = headers.indexOf("payer"); const totalIndex = headers.indexOf("total"); const dateIndex = headers.indexOf("date"); const jsonIndex = headers.indexOf("details_json"); return lines.map(line => { const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); const cleanValue = (str) => { if (typeof str !== 'string') return str; if (str.startsWith('"') && str.endsWith('"')) { return str.slice(1, -1).replace(/""/g, '"'); } return str; }; const expense = { id: Number(values[idIndex]), type: cleanValue(values[typeIndex]), desc: cleanValue(values[descIndex]), payer: cleanValue(values[payerIndex]), total: parseFloat(values[totalIndex]), date: cleanValue(values[dateIndex]), details: JSON.parse(cleanValue(values[jsonIndex])) }; return expense; }); }
    function replaceData(importedExpenses) { const tx = db.transaction(["expenses"], "readwrite"); const store = tx.objectStore("expenses"); store.clear(); importedExpenses.forEach(expense => { store.add(expense); }); tx.oncomplete = () => { expensesList = importedExpenses; applyFiltersAndRender(); showAlert("✔ تم استيراد البيانات بنجاح!", "success"); }; tx.onerror = () => { showAlert("❌ فشلت عملية استبدال البيانات في قاعدة البيانات.", "error"); }; }
    function updateSummary(totalYou, totalPartner) { const difference = Math.abs(totalYou - totalPartner) / 2; const totalAll = totalYou + totalPartner; let direction = "التسوية تمت، لا أحد مدين للآخر."; if (totalYou > totalPartner) { direction = `يجب أن يدفع شريكك لك ${difference.toFixed(2)} د.ت`; } else if (totalPartner > totalYou) { direction = `يجب أن تدفع لشريكك ${difference.toFixed(2)} د.ت`; } totalsContainer.innerHTML = `<div class="total-item">💰 إجمالي ما دفعته أنت: <strong>${totalYou.toFixed(2)} د.ت</strong></div><div class="total-item">💰 إجمالي ما دفعه شريكك: <strong>${totalPartner.toFixed(2)} د.ت</strong></div><div class="total-item">📊 إجمالي المصروفات: <strong>${totalAll.toFixed(2)} د.ت</strong></div><div class="difference">⚖️ ${direction}</div>`; youPaidSummary.textContent = `${totalYou.toFixed(2)} د.ت`; partnerPaidSummary.textContent = `${totalPartner.toFixed(2)} د.ت`; differenceAmountSummary.textContent = `${difference.toFixed(2)} د.ت`; }
    function createExpenseFields(type) { if (type && expenseTypeConfig[type]) { expenseFieldsContainer.innerHTML = expenseTypeConfig[type].fields; expenseFieldsContainer.querySelectorAll('input[type="number"]').forEach(input => { if (!input.readOnly) { input.addEventListener('input', calculateTotal); } }); } else { expenseFieldsContainer.innerHTML = '<p>اختر نوع المصروف لظهور الحقول المناسبة</p>'; } calculateTotal(); }
    function calculateTotal() { const type = expenseTypeSelect.value; let total = 0; if (type && expenseTypeConfig[type]) { const result = expenseTypeConfig[type].calculate(); total = result.total; } const totalAmountInput = document.getElementById("totalAmount"); if (totalAmountInput) { totalAmountInput.value = total.toFixed(2); } totalLabel.textContent = `الإجمالي: ${total.toFixed(2)} د.ت`; }
    function showAlert(message, type) { const existingAlert = document.querySelector(".alert"); if (existingAlert) existingAlert.remove(); const alertDiv = document.createElement("div"); alertDiv.className = `alert alert-${type}`; alertDiv.textContent = message; const closeBtn = document.createElement("span"); closeBtn.innerHTML = "&times;"; closeBtn.style.cssText = "position: absolute; left: 15px; top: 50%; transform: translateY(-50%); cursor: pointer; font-size: 1.2rem;"; closeBtn.onclick = () => alertDiv.remove(); alertDiv.appendChild(closeBtn); expenseForm.parentNode.insertBefore(alertDiv, expenseForm); setTimeout(() => alertDiv.remove(), 5000); }
    function formatDate(dateString) { const date = new Date(dateString); return isNaN(date.getTime()) || !dateString ? "تاريخ غير معروف" : date.toLocaleDateString("ar-EG", { year: 'numeric', month: 'long', day: 'numeric' }); }
    function resetFormState() { expenseForm.reset(); dateInput.value = new Date().toISOString().split("T")[0]; createExpenseFields(''); editMode = false; currentEditId = null; submitBtn.textContent = "إضافة المصروف"; submitBtn.classList.add("btn-add"); submitBtn.classList.remove("btn-export"); }

    // -------------------
    // 5. ربط مستمعات الأحداث
    // -------------------
    expenseForm.addEventListener("submit", handleFormSubmit);
    expenseTypeSelect.addEventListener("change", () => createExpenseFields(expenseTypeSelect.value));
    resetBtn.addEventListener("click", resetExpenses);
    exportBtn.addEventListener("click", exportToCSV);
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', handleFileImport);
    expenseTableBody.addEventListener("click", (event) => {
        const target = event.target;
        if (target.tagName === 'BUTTON') {
            const id = Number(target.dataset.id);
            if (target.classList.contains("delete-btn")) { deleteExpense(id); } 
            else if (target.classList.contains("edit-btn")) { startEdit(id); }
        }
    });

    // ===================================================
    //  الإصلاح: نقل إعادة تعيين الصفحة إلى هنا
    // ===================================================
    searchInput.addEventListener('input', () => { currentPage = 1; applyFiltersAndRender(); });
    typeFilter.addEventListener('change', () => { currentPage = 1; applyFiltersAndRender(); });
    startDateFilter.addEventListener('change', () => { currentPage = 1; applyFiltersAndRender(); });
    endDateFilter.addEventListener('change', () => { currentPage = 1; applyFiltersAndRender(); });
    resetFiltersBtn.addEventListener('click', () => { 
        searchInput.value = ''; 
        typeFilter.value = 'all'; 
        startDateFilter.value = ''; 
        endDateFilter.value = ''; 
        currentPage = 1;
        applyFiltersAndRender(); 
    });

    // -- ربط الأحداث لأزرار التصفح (بدون إعادة تعيين) --
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            applyFiltersAndRender();
        }
    });

    nextPageBtn.addEventListener('click', () => {
        const filteredList = getFilteredList();
        const pageCount = Math.ceil(filteredList.length / rowsPerPage);
        if (currentPage < pageCount) {
            currentPage++;
            applyFiltersAndRender();
        }
    });

    // -------------------
    // 6. التهيئة الأولية
    // -------------------
    dateInput.value = new Date().toISOString().split("T")[0];
    createExpenseFields('');
    
    // تسجيل الـ Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(registration => console.log('ServiceWorker registration successful'))
          .catch(error => console.log('ServiceWorker registration failed: ', error));
      });
    }
});