// اسم الكاش الذي سنخزن فيه ملفات التطبيق
const CACHE_NAME = 'shared-expenses-cache-v2';

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

// 2. عند طلب أي ملف (مثل صورة أو صفحة)، تحقق أولاً من الكاش
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // إذا وجدنا الملف في الكاش، قم بإرجاعه
        if (response) {
          return response;
        }
        // إذا لم نجده، اذهب إلى الشبكة لجلبه
        return fetch(event.request);
      }
    )
  );
});