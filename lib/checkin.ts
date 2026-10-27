// Клиентская часть проактивных весточек напарника.
// Никакого сервера и никакой нашей базы: регистрируем service worker и
// просим браузер будить его раз в день (Periodic Background Sync).
// Всё живёт на устройстве пользователя.

const CHECKIN_TAG = 'companion-checkin'
const DB_NAME = 'naparnik'
const STORE = 'kv'
const MIN_INTERVAL = 20 * 60 * 60 * 1000 // ~20ч; точное время выбирает браузер

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Дублируем имя существа в IndexedDB, чтобы service worker мог его прочитать */
export async function mirrorCompanionName(name: string): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(name, 'companionName')
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    /* IndexedDB недоступен — не критично */
  }
}

/** Поддерживает ли браузер проактивные весточки в закрытом виде */
export function checkinSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PeriodicSyncManager' in window &&
    'Notification' in window
  )
}

export type CheckinState = 'unsupported' | 'available' | 'enabled' | 'denied'

/** Уже ли включены весточки (разрешение выдано и periodic sync зарегистрирован) */
/**
 * Синхронная часть getCheckinState — всё, что известно без service worker. Для первого кадра Дома при переходе
 * по табу: строка «Весточки выключены…» появлялась кадром позже и сдвигала ленту. 'granted' уточняет getCheckinState.
 */
export function peekCheckinState(): CheckinState {
  if (!checkinSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  return 'available'
}

export async function getCheckinState(): Promise<CheckinState> {
  if (!checkinSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'available'
  try {
    const reg = await navigator.serviceWorker.ready
    // @ts-expect-error periodicSync ещё не в типах TS
    const tags: string[] = (await reg.periodicSync?.getTags?.()) ?? []
    return tags.includes(CHECKIN_TAG) ? 'enabled' : 'available'
  } catch {
    return 'available'
  }
}

/** Тихо регистрируем SW при загрузке — без запроса разрешений */
export async function registerServiceWorker(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    await navigator.serviceWorker.register('/sw.js')
  } catch {
    /* регистрация не удалась — приложение работает и без неё */
  }
}

/**
 * Включить весточки: спросить разрешение (жест пользователя) и, если можно,
 * зарегистрировать периодическую синхронизацию. Возвращает итоговое состояние.
 */
export async function enableCheckins(): Promise<CheckinState> {
  if (!checkinSupported()) return 'unsupported'
  let permission = Notification.permission
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }
  if (permission !== 'granted') {
    return permission === 'denied' ? 'denied' : 'available'
  }
  try {
    await navigator.serviceWorker.register('/sw.js')
    const reg = await navigator.serviceWorker.ready
    // Разрешение на фоновую синхронизацию (в поддерживающих браузерах)
    const status = await navigator.permissions
      // @ts-expect-error нестандартное имя разрешения
      .query({ name: 'periodic-background-sync' })
      .catch(() => null)
    if (status && status.state !== 'granted') {
      // Всё равно пробуем зарегистрировать — часть браузеров не требует явного grant
    }
    // @ts-expect-error periodicSync ещё не в типах TS
    await reg.periodicSync.register(CHECKIN_TAG, { minInterval: MIN_INTERVAL })
    return 'enabled'
  } catch {
    // Разрешение есть, но periodic sync недоступен (например, PWA не установлена).
    // Уведомления при возврате всё равно смогут показываться.
    return 'available'
  }
}
