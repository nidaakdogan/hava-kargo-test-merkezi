const CACHE_NAME = 'cargo-dtl-v2.0.0';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install Event - Cache Files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('[SW] Cache failed:', error);
      })
  );
  // Skip waiting to activate new version immediately
  self.skipWaiting();
});

// Activate Event - Clean Old Caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// Fetch Event - Stale While Revalidate Strategy
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Handle navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) {
            // Return cached version immediately
            console.log('[SW] Serving navigation from cache:', event.request.url);
            
            // Fetch in background to update cache
            fetch(event.request).then((fetchResponse) => {
              if (fetchResponse && fetchResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, fetchResponse);
                });
              }
            }).catch(() => {
              console.log('[SW] Background fetch failed for:', event.request.url);
            });
            
            return response;
          }
          
          // No cache, fetch from network
          return fetch(event.request).catch(() => {
            return caches.match('/offline.html');
          });
        })
    );
    return;
  }

  // Handle other requests with stale-while-revalidate
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // Cache successful responses
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => {
          console.log('[SW] Network failed for:', event.request.url);
          return null;
        });

        // Return cached response immediately if available
        if (cachedResponse) {
          console.log('[SW] Serving from cache (stale-while-revalidate):', event.request.url);
          // Update cache in background
          fetchPromise.catch(() => {});
          return cachedResponse;
        }

        // No cache, wait for network
        console.log('[SW] No cache, fetching from network:', event.request.url);
        return fetchPromise.then((response) => {
          if (response) {
            return response;
          }
          // Network failed and no cache
          throw new Error('Network failed and no cache available');
        });
      })
  );
});

// Background Sync for Offline Actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'barcode-sync') {
    event.waitUntil(syncBarcodeData());
  }
  
  if (event.tag === 'awb-sync') {
    event.waitUntil(syncAwbData());
  }
});

// Push Notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  const options = {
    body: event.data ? event.data.text() : 'Yeni bildirim',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge.png',
    vibrate: [100, 50, 100],
    tag: 'cargo-notification',
    actions: [
      {
        action: 'open',
        title: 'Aç',
        icon: '/icons/action-open.png'
      },
      {
        action: 'close',
        title: 'Kapat',
        icon: '/icons/action-close.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Cargo DTL', options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event);
  
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Helper Functions
async function syncBarcodeData() {
  try {
    const cache = await caches.open('barcode-cache');
    const requests = await cache.keys();
    
    for (const request of requests) {
      const response = await cache.match(request);
      const data = await response.json();
      
      // Send to server when online
      await fetch('/api/barcode/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      // Remove from cache after successful sync
      await cache.delete(request);
    }
    
    console.log('[SW] Barcode sync completed');
  } catch (error) {
    console.error('[SW] Barcode sync failed:', error);
  }
}

async function syncAwbData() {
  try {
    const cache = await caches.open('awb-cache');
    const requests = await cache.keys();
    
    for (const request of requests) {
      const response = await cache.match(request);
      const data = await response.json();
      
      // Send to server when online
      await fetch('/api/awb/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      // Remove from cache after successful sync
      await cache.delete(request);
    }
    
    console.log('[SW] AWB sync completed');
  } catch (error) {
    console.error('[SW] AWB sync failed:', error);
  }
}
