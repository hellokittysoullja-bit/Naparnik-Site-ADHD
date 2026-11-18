import {
  Ban,
  Bath,
  BookOpen,
  DoorOpen,
  Dumbbell,
  FileText,
  Gauge,
  GraduationCap,
  Landmark,
  Mail,
  PawPrint,
  Phone,
  Presentation,
  Receipt,
  Shirt,
  ShoppingCart,
  Sofa,
  Sparkle,
  Stethoscope,
  Trash2,
  UtensilsCrossed,
  Video,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useId } from 'react'

/**
 * Значок дела в цветной плитке. У Tiimo у каждой карточки дня — предмет в цветном круге, по нему дело узнают раньше,
 * чем прочтут название (research/25-deep-teardowns/tiimo.md, кадры 2–3). У нас те же плитки, что у вариантов
 * знакомства (components/onboarding/first-run.tsx, Option): один язык на весь продукт, без эмодзи (они на каждом
 * телефоне рисуются по-своему).
 */
const ICONS: Record<string, { icon: LucideIcon; hue: number }> = {
  utensils: { icon: UtensilsCrossed, hue: 65 },
  bath: { icon: Bath, hue: 205 },
  shirt: { icon: Shirt, hue: 265 },
  sofa: { icon: Sofa, hue: 25 },
  door: { icon: DoorOpen, hue: 150 },
  trash: { icon: Trash2, hue: 150 },
  mail: { icon: Mail, hue: 205 },
  phone: { icon: Phone, hue: 150 },
  file: { icon: FileText, hue: 65 },
  video: { icon: Video, hue: 330 },
  book: { icon: BookOpen, hue: 265 },
  slides: { icon: Presentation, hue: 25 },
  grad: { icon: GraduationCap, hue: 330 },
  stethoscope: { icon: Stethoscope, hue: 330 },
  landmark: { icon: Landmark, hue: 205 },
  receipt: { icon: Receipt, hue: 65 },
  gauge: { icon: Gauge, hue: 150 },
  wallet: { icon: Wallet, hue: 25 },
  ban: { icon: Ban, hue: 330 },
  cart: { icon: ShoppingCart, hue: 65 },
  paw: { icon: PawPrint, hue: 25 },
  dumbbell: { icon: Dumbbell, hue: 150 },
  spark: { icon: Sparkle, hue: 130 },
}

/**
 * Фирменная наклейка дела (владелец 18.11: «как наш фирменный красивый дизайн»): плитка — голова кота Напарника, с
 * ушками и розовыми внутренними ушками, кремовая кайма вырезанной наклейки и тень снизу; цветная заливка своего
 * оттенка с бликом. Значок внутри — двухцветный: светлая заливка своего цвета и тёмный контур («чернило» продукта).
 * Лапка — отпечаток лапы нашего кота. Сделанное дело — золотая наклейка с искоркой (один прыжок при появлении).
 */
/** у этих значков внутри есть свои линии (конверт, строки документа), заливка их закрывает — рисуем только контуром */
const NO_FILL = new Set(['mail', 'file', 'book', 'receipt', 'landmark', 'slides', 'video', 'grad', 'gauge', 'wallet', 'utensils', 'door', 'cart'])

export function DealIcon({ name, size = 40, dim = false, done = false }: { name: string; size?: number; dim?: boolean; done?: boolean }) {
  const { icon: Icon, hue: own } = ICONS[name] ?? ICONS.spark
  const hue = done ? 85 : own
  const id = useId().replace(/:/g, '')
  const h = Math.round((size * 54) / 48)
  const glyph = Math.round(size * 0.46)
  const head = 'M19 12.5 L10.2 2 Q8.3 0 7.8 2.6 L6 15 Q3 17.5 3 22 V40 Q3 49 12.5 49 H35.5 Q45 49 45 40 V22 Q45 17.5 42 15 L40.2 2.6 Q39.7 0 37.8 2 L29 12.5 Z'
  return (
    <span
      aria-hidden="true"
      className={`deal-sticker relative inline-block shrink-0 transition-opacity duration-200${done ? ' deal-sticker-done' : ''}`}
      style={{ width: size, height: h, opacity: dim ? 0.5 : 1 }}
    >
      <svg viewBox="0 0 48 54" width={size} height={h} className="absolute inset-0 overflow-visible">
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor={`oklch(0.9 0.1 ${hue})`} />
            <stop offset="1" stopColor={`oklch(0.74 0.14 ${hue})`} />
          </linearGradient>
        </defs>
        {/* тень-бортик снизу и кремовая кайма — как у вырезанной наклейки: на тёмной карточке тёмная обводка пропадала */}
        <path d={head} transform="translate(0 2.6)" fill="rgb(0 0 0 / 0.5)" />
        <path d={head} fill={`url(#g${id})`} stroke="#fff3dc" strokeWidth="2.6" strokeLinejoin="round" />
        {/* внутренние ушки */}
        <path d="M9.9 6 L15.6 12.6 L8.6 13.4 Z" fill="oklch(0.84 0.09 15)" />
        <path d="M38.1 6 L32.4 12.6 L39.4 13.4 Z" fill="oklch(0.84 0.09 15)" />
        {/* блик */}
        <ellipse cx="13.5" cy="21" rx="6" ry="2.8" fill="#fff" opacity="0.5" transform="rotate(-18 13.5 21)" />
        {done && <path d="M40 32 l1.5 3.8 3.8 1.5 -3.8 1.5 -1.5 3.8 -1.5 -3.8 -3.8 -1.5 3.8 -1.5 Z" fill="#fff8ea" stroke="#2a1f17" strokeWidth="1" />}
      </svg>
      <span className="absolute inset-x-0 grid place-items-center" style={{ top: Math.round(h * 0.26), bottom: Math.round(h * 0.08) }}>
        {name === 'paw' ? (
          <span className="deal-sticker-paw" style={{ width: glyph, height: glyph }} />
        ) : (
          <Icon style={{ width: glyph, height: glyph, color: '#2a1f17' }} fill={NO_FILL.has(name) ? 'none' : `oklch(0.97 0.04 ${hue})`} strokeWidth={2.3} />
        )}
      </span>
    </span>
  )
}
