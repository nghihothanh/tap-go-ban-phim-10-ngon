// Service worker tối thiểu (bản thử nghiệm): chưa lưu gì, mọi yêu cầu vẫn đi thẳng ra mạng.
// Phần chạy offline thật sẽ làm ở bước 5.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => { e.respondWith(fetch(e.request)); });
