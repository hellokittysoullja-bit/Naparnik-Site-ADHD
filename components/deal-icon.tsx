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

export function DealIcon({ name, size = 40, dim = false }: { name: string; size?: number; dim?: boolean }) {
  const { icon: Icon, hue } = ICONS[name] ?? ICONS.spark
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-[12px] transition-opacity duration-200"
      style={{
        width: size,
        height: size,
        background: `oklch(0.74 0.12 ${hue} / 0.18)`,
        color: `oklch(0.88 0.13 ${hue})`,
        opacity: dim ? 0.5 : 1,
      }}
    >
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.1} />
    </span>
  )
}
