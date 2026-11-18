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
 * Вид — «наклейка» в общем стиле записок продукта (владелец 18.11: «стилизуй красиво, как у нашего напарника»):
 * цветная плитка с бликом сверху, тёмная обводка и бортик снизу, как у кнопок записки; значок — тем же тёмным
 * «чернилом». Лапка — не значок из набора, а отпечаток лапы нашего кота (тот же, что на записке Фокуса).
 */
export function DealIcon({ name, size = 40, dim = false, done = false }: { name: string; size?: number; dim?: boolean; done?: boolean }) {
  const { icon: Icon, hue: own } = ICONS[name] ?? ICONS.spark
  // дело сделано целиком (предложение 18.11): наклейка становится золотой и один раз подпрыгивает
  const hue = done ? 85 : own
  const glyph = Math.round(size * 0.52)
  return (
    <span
      aria-hidden="true"
      className={`deal-sticker grid shrink-0 place-items-center transition-opacity duration-200${done ? " deal-sticker-done" : ""}`}
      style={{ width: size, height: size, ['--hue' as string]: hue, opacity: dim ? 0.5 : 1 }}
    >
      {name === 'paw' ? (
        <span className="deal-sticker-paw" style={{ width: glyph, height: glyph }} />
      ) : (
        <Icon style={{ width: glyph, height: glyph }} strokeWidth={2.4} />
      )}
    </span>
  )
}
