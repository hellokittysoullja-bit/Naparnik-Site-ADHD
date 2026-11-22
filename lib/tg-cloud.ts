/**
 * Память мини-аппа в облаке Telegram (21.11). У окна Telegram своя память устройства, отдельная от браузера, и её может
 * стереть сам Telegram (переустановка, «очистить кэш», другой телефон). Поэтому всё, что сайт хранит на устройстве
 * (ключи naparnik:*), копируется в CloudStorage — хранилище Telegram этого человека у этого бота. Наш сервер в этом не
 * участвует и ничего не видит: копия лежит у Telegram в аккаунте человека, как его сообщения.
 *  - «Забудь всё» на сайте стирает ключи на устройстве — и следом их копии в облаке (пропавший ключ удаляется).
 *  - Новое устройство или стёртая память: при запуске память устройства пуста, а в облаке есть — сайт возвращает её
 *    и открывается уже со своим островом.
 *
 * Ограничения CloudStorage: ключ — 1–128 символов [A-Za-z0-9_-], значение — до 4096 символов, ключей — до 1024. Поэтому
 * значение режется на куски, а оглавление (manifest) говорит, какие куски чьи. Запись не рвёт данные: новые куски
 * пишутся под новым поколением, потом оглавление, и только потом удаляются старые — оборванная запись оставляет
 * в облаке прежнюю целую копию.
 */
export type Cloud = {
  get: (keys: string[]) => Promise<Record<string, string>>
  set: (key: string, value: string) => Promise<void>
  del: (keys: string[]) => Promise<void>
}

/** [номер ключа, поколение, кусков, отпечаток] */
export type Entry = [number, number, number, string]
export type Manifest = { v: 1; k: Record<string, Entry> }

export const MANIFEST_KEY = 'naparnik_m'
// 2000 символов: Telegram ограничивает значение 4096 символами, а если считает байты UTF-8, кириллица займёт 4000
export const CHUNK = 2000
/** кусков всего — с запасом под оглавление и под двойные поколения на время записи (лимит Telegram — 1024 ключа) */
export const MAX_CHUNKS = 480
const MANIFEST_MAX = 4096

/** что не копируется: параметры текущего запуска мини-аппа */
const SKIP = new Set(['naparnik:tgwa'])
/** память, по которой видно, что человек тут уже жил (знакомство, старты, дела, разговор, план) */
export const CORE = ['naparnik:onboarding', 'naparnik:starts', 'naparnik:deals', 'naparnik:chat', 'naparnik:plan', 'naparnik:facts', 'naparnik:notes']

export const syncable = (key: string) => key.startsWith('naparnik:') && !SKIP.has(key)

/** FNV-1a: дешёвый отпечаток, чтобы не писать неизменившееся */
export function fingerprint(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36) + s.length.toString(36)
}

export const chunkKey = (id: number, gen: number, i: number) => `c${id}_${gen}_${i}`

export function parseManifest(raw: string | undefined | null): Manifest | null {
  if (!raw) return null
  try {
    const m = JSON.parse(raw) as Manifest
    if (!m || m.v !== 1 || typeof m.k !== 'object' || m.k === null) return null
    const k: Record<string, Entry> = {}
    for (const [name, e] of Object.entries(m.k)) {
      if (!syncable(name) || !Array.isArray(e) || e.length !== 4) continue
      const [id, gen, n, h] = e
      if ([id, gen, n].every((x) => Number.isInteger(x) && x >= 0) && n <= MAX_CHUNKS && typeof h === 'string') k[name] = [id, gen, n, h]
    }
    return { v: 1, k }
  } catch {
    return null
  }
}

export async function loadManifest(cloud: Cloud): Promise<Manifest | null> {
  const r = await cloud.get([MANIFEST_KEY])
  return parseManifest(r[MANIFEST_KEY])
}

/** вернуть память из облака: только целые значения с верным отпечатком */
export async function restore(cloud: Cloud, man: Manifest): Promise<Record<string, string>> {
  const keys: string[] = []
  for (const [id, gen, n] of Object.values(man.k)) for (let i = 0; i < n; i++) keys.push(chunkKey(id, gen, i))
  const got: Record<string, string> = {}
  for (let i = 0; i < keys.length; i += 100) Object.assign(got, await cloud.get(keys.slice(i, i + 100)))
  const out: Record<string, string> = {}
  for (const [name, [id, gen, n, h]] of Object.entries(man.k)) {
    let v = ''
    let whole = true
    for (let i = 0; i < n; i++) {
      const part = got[chunkKey(id, gen, i)]
      if (typeof part !== 'string') {
        whole = false
        break
      }
      v += part
    }
    if (whole && fingerprint(v) === h) out[name] = v
  }
  return out
}

/** вернуть ли память из облака: в облаке человек уже жил, а на этом устройстве — нет */
export function shouldRestore(local: Record<string, string>, man: Manifest | null): boolean {
  if (!man) return false
  return CORE.some((k) => k in man.k) && !CORE.some((k) => k in local)
}

/**
 * Свести облако к памяти устройства. Возвращает новое оглавление (его же надо передать в следующий вызов).
 * Не влезающее в лимит Telegram (самые большие значения) не копируется — остальное важнее одного большого архива.
 */
export async function sync(cloud: Cloud, local: Record<string, string>, man: Manifest): Promise<Manifest> {
  const names = Object.keys(local).filter(syncable).sort((a, b) => local[a].length - local[b].length)
  const next: Manifest = { v: 1, k: {} }
  let budget = MAX_CHUNKS
  let nextId = Math.max(0, ...Object.values(man.k).map((e) => e[0] + 1))
  const writes: [string, string][] = []
  for (const name of names) {
    const v = local[name]
    const n = Math.max(1, Math.ceil(v.length / CHUNK))
    if (n > budget) continue
    budget -= n
    const h = fingerprint(v)
    const prev = man.k[name]
    if (prev && prev[3] === h) {
      next.k[name] = prev
      continue
    }
    const id = prev ? prev[0] : nextId++
    const gen = prev ? prev[1] + 1 : 0
    for (let i = 0; i < n; i++) writes.push([chunkKey(id, gen, i), v.slice(i * CHUNK, (i + 1) * CHUNK)])
    next.k[name] = [id, gen, n, h]
  }
  const stale: string[] = []
  for (const [name, [id, gen, n]] of Object.entries(man.k)) {
    const now = next.k[name]
    if (now && now[1] === gen) continue
    for (let i = 0; i < n; i++) stale.push(chunkKey(id, gen, i))
  }
  if (writes.length === 0 && stale.length === 0) return man
  // по 8 одновременно: Telegram отвечает на каждый вызов отдельно
  for (let i = 0; i < writes.length; i += 8) await Promise.all(writes.slice(i, i + 8).map(([k, v]) => cloud.set(k, v)))
  let json = JSON.stringify(next)
  // оглавление само ограничено 4096 символами: не влезает — без самых больших ключей
  while (json.length > MANIFEST_MAX) {
    const biggest = Object.keys(next.k).sort((a, b) => next.k[b][2] - next.k[a][2])[0]
    const [id, gen, n] = next.k[biggest]
    for (let i = 0; i < n; i++) stale.push(chunkKey(id, gen, i))
    delete next.k[biggest]
    json = JSON.stringify(next)
  }
  await cloud.set(MANIFEST_KEY, json)
  for (let i = 0; i < stale.length; i += 100) await cloud.del(stale.slice(i, i + 100))
  return next
}
