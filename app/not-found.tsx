import Link from 'next/link'
import { AppBackdrop } from '@/components/app-backdrop'
import { MascotSvg } from '@/components/mascot-svg'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <AppBackdrop />
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
    </main>
  )
}
