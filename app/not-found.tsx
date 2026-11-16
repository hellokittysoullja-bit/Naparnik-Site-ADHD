import Link from 'next/link'
import { AppBackdrop } from '@/components/app-backdrop'
import { prepaintScript } from '@/lib/app-prepaint'
import { MascotDoll as MascotSvg } from '@/components/mascot-doll'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      {/* небо и гряда — по часу и памяти с первого кадра, как на экранах /app (lib/app-prepaint.ts); без этого при
          обновлении небо сначала было ночным, а потом менялось на дневное (16.11) */}
      <script dangerouslySetInnerHTML={{ __html: prepaintScript() }} />
      <AppBackdrop />
      {/* Содержимое — в своём позиционированном слое: AppBackdrop fixed и без z-index, а непозиционированный
          текст и кнопка рисовались ПОД ним — на экране был только кот (он relative), без текста и кнопки */}
      <div className="relative flex flex-col items-center gap-6">
        <MascotSvg expression="sleepy" label="Напарник растерян" size={120} />
        <div className="flex flex-col gap-2">
          <p className="font-hand text-3xl text-foreground">
            Хм, я такой страницы не знаю.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Может, её никогда и не было. Пойдём домой — там точно всё на месте.
          </p>
        </div>
        <Button render={<Link href="/app" />} nativeButton={false} size="lg" className="font-semibold">
          Домой, к котику
        </Button>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          ошибка 404
        </span>
      </div>
    </main>
  )
}
