import { LEGACY_HOST } from '@/lib/visitor'

/**
 * Основной адрес сайта для поисковиков и нейропоиска: canonical, sitemap, robots, структурированные данные, llms.txt.
 * Пока свой домен не задан (CANONICAL_HOST в Vercel) — старый адрес; задан — всё сразу смотрит на новый, без правок кода.
 * Тот же репозиторий собирают несколько проектов Vercel на разных адресах — canonical с этим адресом склеивает их копии
 * в одну страницу в выдаче.
 */
const host = process.env.CANONICAL_HOST?.trim().toLowerCase() || LEGACY_HOST
export const SITE_URL = `https://${host}`
export const SITE_NAME = 'Напарник'

/** Абсолютный адрес страницы сайта */
export const siteUrl = (path = '/') => new URL(path, SITE_URL).toString()
