'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

/*
 * #15 · ГОЛОСОВОЙ ВВОД.
 *
 * Зачем именно здесь: для СДВГ-аудитории набор текста — это лишний барьер
 * между «есть мысль» и «мысль записана». Пока человек ищет формулировку и
 * бьёт по клавишам, импульс успевает угаснуть. Голос снимает этот шаг:
 * говоришь как думаешь.
 *
 * Web Speech API, а не запись + серверная транскрипция: распознавание идёт
 * на устройстве, ничего не уходит по сети, и результат виден по ходу речи
 * (interim results) — человек сразу знает, что его слышат.
 *
 * Прогрессивное улучшение: где API нет (Firefox, часть Android-браузеров),
 * хук возвращает supported: false, и кнопка микрофона просто не рендерится.
 * Поле ввода остаётся полностью рабочим — голос это ускорение, не условие.
 */

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: { error?: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<
    ArrayLike<{ transcript: string }> & { isFinal: boolean }
  >
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const noopSubscribe = () => () => {}
const hasRecognition = () => getRecognitionCtor() !== null

export function useDictation(onFinalText: (text: string) => void) {
  // supported: на сервере window нет — серверный снимок false (разметка гидратации совпадает с HTML), на клиенте
  // React перерисовывает с настоящим значением сразу после гидратации, без отдельного эффекта. Раньше было useEffect → setSupported:
  // первый видимый кадр переписки показывал зелёную стрелку, а через кадр — микрофон (покадровая съёмка 16.11).
  const supported = useSyncExternalStore(noopSubscribe, hasRecognition, () => false)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  // Колбэк в ref: иначе пересоздание слушателей на каждый рендер родителя
  // обрывало бы уже идущее распознавание.
  const onFinalRef = useRef(onFinalText)
  useEffect(() => {
    onFinalRef.current = onFinalText
  }, [onFinalText])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
    setInterim('')
  }, [])

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) return

    // Уже слушаем — повторный тап останавливает: одна кнопка, два состояния.
    if (recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
    }

    const rec = new Ctor()
    rec.lang = 'ru-RU'
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (e) => {
      let finalText = ''
      let pending = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        const chunk = res[0]?.transcript ?? ''
        if (res.isFinal) finalText += chunk
        else pending += chunk
      }
      // Финальные куски отдаём наружу (дописываются в поле), промежуточные
      // показываем призраком — видимое подтверждение, что речь слышна.
      if (finalText.trim()) onFinalRef.current(finalText.trim())
      setInterim(pending)
    }

    rec.onerror = (e) => {
      // Отказ в микрофоне или тишина — не повод для алерта: тихо выходим из
      // состояния прослушивания, поле ввода остаётся доступным.
      if (e?.error !== 'aborted') setListening(false)
      setInterim('')
    }

    rec.onend = () => {
      setListening(false)
      setInterim('')
      recognitionRef.current = null
    }

    recognitionRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }, [])

  // Уходим со экрана во время диктовки — распознавание должно умереть с
  // компонентом, иначе микрофон остаётся занятым.
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [])

  return { supported, listening, interim, start, stop }
}
