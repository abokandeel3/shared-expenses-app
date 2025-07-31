// اسم الكاش الذي سنخزن فيه ملفات التطبيق
const CACHE_NAME = 'shared-expenses-cache-v14'; // <-- تم تحديث الإصدار

// قائمة الملفات الأساسية التي نريد تخزينها باستخدام المسارات النسبية الصحيحة
const assetsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-16x16.png',
  './icons/icon-24x24.png',
  './icons/icon-32x32.png',
  './icons/icon-64x64.png',
  './icons/icon-128x128.png',
  './icons/icon-256x256.png',
  './icons/icon-512x512.png'
];

// 1. عند "تثبيت" الـ Service Worker، قم بفتح الكاش وتخزين الملفات
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(assetsToCache);
      })
  );
});

// 2. عند طلب أي ملف، استخدم استراتيجية Stale-While-Revalidate
self.addEventListener('fetch', event => {
  // تجاهل الطلبات التي ليست من نوع GET
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(response => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          
          // تأكد من أن الطلب صالح وأنه من تطبيقك قبل تخزينه
          if (networkResponse && networkResponse.status === 200 && event.request.url.startsWith('http')) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });

        // أرجع النسخة المخزنة فوراً إذا كانت موجودة، وإلا انتظر الجلب من الشبكة
        // هذا يضمن عمل التطبيق حتى لو كان المستخدم غير متصل بالإنترنت
        return response || fetchPromise;
      });
    })
  );
});

// 3. عند "تفعيل" الـ Service Worker الجديد، قم بحذف أي كاش قديم
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
});