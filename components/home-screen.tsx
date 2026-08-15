"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { ArrowRight, CalendarCheck, Play, Sparkles } from "lucide-react";
import { CompanionChat } from "@/components/companion-chat";
import { EmphasisText } from "@/components/emphasis-text";
import { MascotSvg, type MascotExpression } from "@/components/mascot-svg";
import {
  getCompanionName,
  getFinds,
  getPatterns,
  getPlan,
  getStarts,
  getStepQueue,
  saveCompanionName,
  savePlan,
  todayKey,
  type Patterns,
  type Plan,
} from "@/lib/memory";
import {
  ISLAND_ELEMENT_NAMES,
  ISLAND_POOL,
  LANDMARK_COUNT,
} from "@/lib/island-elements";
import { landmarkAnchors, landmarkNodes } from "@/lib/island-sprites";
import {
  enableCheckins,
  getCheckinState,
  mirrorCompanionName,
  registerServiceWorker,
  type CheckinState,
} from "@/lib/checkin";
import { trimLabel } from "@/lib/utils";
import { Bell, BellOff } from "lucide-react";
import { GreetingSkeleton, RewardCardSkeleton } from "@/components/skeletons";
import { SPRING_GESTURE } from "@/lib/motion";

type FirstWord = {
  greeting: string;
  /** Типографическое правило: рукописный шрифт — ТОЛЬКО голос существа.
      Инструкция интерфейса («выбери шаг ниже») — системный шрифт, отдельным
      полем: декоративные шрифты читаются медленнее (legibility-исследования),
      а смешение голоса и UI-указаний в одном пузыре размывает персонажа */
  hint?: string;
  /** Есть план на сегодня — показываем кнопку «Начинаю» */
  actionStep: string | null;
  /** Новичок без стартов — показываем чипы мгновенного первого старта */
  showStarterChips?: boolean;
  /** Вечер без плана у опытного: предлагаем однотаповый договор на завтра.
      Печатать план в 23:00 — стена (Fogg: ability на нуле в момент
      максимальной мотивации). Один тап из уже известного шага — мост. */
  offerEveningPlan?: boolean;
  /** Глубокая ночь (0:00–4:59). Инвертирует целевое действие экрана:
      единственный акцент — «положить план и лечь», старт уходит в тихую
      второстепенную ссылку. Механика, которой нет ни на одном другом
      экране: здесь продукт осознанно ПОВЫШАЕТ трение до старта, потому
      что в этот час вредное действие — именно старт. */
  nightMode?: boolean;
};

/**
 * Единая граница ночи. Раньше порогов было два — `hour < 4` для реплики
 * (buildFirstWord) и `hour < 5` для выражения маскота. Расхождение в один
 * час создавало зону 4:00–4:59, где кот УЖЕ спал глазами, но текст всё
 * ещё требовал «начни прямо сейчас» — два канала интерфейса
 * противоречили друг другу. Одна константа делает это невозможным.
 */
const NIGHT_UNTIL_HOUR = 5;

/** Готовые крошечные шаги: ноль решений до первого старта */
const starterChips = [
  "Открыть нужный файл",
  "Убрать одну вещь со стола",
  "Написать одно предложение",
];

/**
 * Дневник отсутствия: напарник жил на острове, пока человека не было.
 * Возврат через любопытство и привязанность, никогда — через вину.
 * Выбор события детерминированный, чтобы не менялся при каждом рендере.
 */
const awayDiary = [
  "Пока тебя не было, я рыбачил у причала. Море было тихое. Остров стоит, *ничего не сгорело*.",
  "Я тут пересчитал всё, что выросло на острове, — всё на месте. *Пауза* — это пауза, не откат.",
  "Без тебя я смотрел на волны и гадал, что вырастет от твоего *следующего старта*.",
  "Я развёл костёр и просто ждал. Это не упрёк — я *рад*, что ты зашёл.",
];

type IntroChoice = "procrastinate" | "curious" | null;

function buildFirstWord(
  plan: Plan | null,
  patterns: Patterns,
  now: Date,
  companionName: string | null,
  intro: IntroChoice = null,
  lastFindName: string | null = null,
): FirstWord {
  const hour = now.getHours();
  // Ночь отделена от вечера. Прежнее `hour >= 18 || hour < 4` называло
  // 2 часа ночи «вечером» (интерфейс врал) и оставляло 4:00–4:59 вообще
  // без ветки — этот час падал в дневную реплику «начни прямо сейчас».
  const isNight = hour < NIGHT_UNTIL_HOUR;
  const isEvening = hour >= 18;
  // Поздние ветки «план уже лежит» одинаковы для вечера и ночи: в 23:00 и
  // в 4:00 верный ответ один — «можешь спать спокойно».
  const isLate = isEvening || isNight;
  const today = todayKey(now);

  // М3 · Ночная весточка: новый день должен приносить новизну (R1).
  // Вчера был — сегодня кот рассказывает, что было ночью. Вариативно
  // (по дню и числу стартов), привязано к реальному острову.
  const dayN = Math.floor(now.getTime() / 86_400_000);
  const nightTales = [
    lastFindName
      ? `Ночью «${lastFindName}» тихо стояла под *звёздами* — я сторожил. `
      : "Ночью остров тихо дышал под *звёздами* — я сторожил. ",
    "Под утро над островом пролетела *падающая звезда*. Хороший знак. ",
    "Ночью море было гладкое, как стекло. Остров ждёт *первый старт* дня. ",
    lastFindName
      ? `Мне ночью показалось, что «${lastFindName}» *подросла*. Проверим после старта? `
      : "К утру на берегу прибавилось *ракушек*. Остров живёт. ",
  ];
  const nightLine =
    patterns.daysAway === 1 ? nightTales[(patterns.totalStarts + dayN) % nightTales.length] : "";

  // Прощение как дефолт (механика Duolingo без её кнута): пауза — это
  // просто пауза. Длинная — дневник острова, короткая — тихая радость.
  const awayLine =
    patterns.daysAway !== null && patterns.daysAway >= 3
      ? awayDiary[
          (patterns.totalStarts + patterns.daysAway) % awayDiary.length
        ] + " "
      : patterns.daysAway !== null && patterns.daysAway === 2
        ? "Ты пришёл. Два дня — это просто два дня, остров *всё помнит*. "
        : "";

  // Совпадение с личным часом стартов: мягкий, честный толчок из данных
  const hourLine =
    patterns.favoriteHour !== null &&
    patterns.totalStarts >= 3 &&
    hour === patterns.favoriteHour
      ? ` Сейчас ${hour}:00 — обычно именно в это время ты реально начинаешь.`
      : "";

  // ГЛУБОКАЯ НОЧЬ (0:00–4:59) — ветка, которой раньше не существовало.
  // Что было: в 04:14 (реальный скриншот с прода) продукт говорил
  // «Выбери одно крошечное действие ПРЯМО СЕЙЧАС». Для СДВГ-аудитории это
  // прицельный удар в revenge bedtime procrastination — самый дорогой
  // паттерн этой группы: недосып → исполнительные функции ещё слабее →
  // больше прокрастинации завтра. Приложение, обещавшее разорвать цикл,
  // становилось его соучастником.
  //
  // ПОЧЕМУ ЭТА ВЕТКА СТОИТ ВЫШЕ ПРОВЕРКИ ПЛАНА. Ночной договор кладёт план
  // на СЕГОДНЯШНЮЮ дату (человек ляжет и встанет в тот же календарный день,
  // см. sealEveningPlan). Пока эта ветка стояла ниже, сразу после тапа
  // срабатывала ветка «план на сегодня» — и экран, только что сказавший
  // «иди спать», подсовывал лаймовую кнопку «Начинаю». Тап по собственному
  // договору отменял его смысл; порядок ветвей здесь и есть механика.
  //
  // Новичок (totalStarts === 0) сюда не попадает намеренно: он пришёл с
  // лендинга попробовать, привычку защищать ещё нечего, а нулевое трение до
  // первого старта — само обещание продукта. Осознанная жертва один раз.
  if (isNight && patterns.totalStarts > 0) {
    const clock = `${hour}:${String(now.getMinutes()).padStart(2, "0")}`;
    // Договор уже лежит (только что тапнул или положил вечером) — ночью
    // остаётся только подтвердить и отпустить. Никакого призыва к старту.
    if (plan) {
      return {
        greeting: `Договорились: когда встанешь — ${plan.firstStep.toLowerCase()}. Больше от тебя сейчас ничего не нужно. *Спи*, я посторожу остров.`,
        actionStep: null,
        nightMode: true,
      };
    }
    return {
      greeting: `Сейчас ${clock}. Ночь — не время начинать: с недосыпом завтра будет вдвое тяжелее. Давай положим *один шаг* на утро и разойдёмся.`,
      hint: "Один тап — и всё. Начать всё равно можно, но я бы не советовал.",
      actionStep: null,
      offerEveningPlan: true,
      nightMode: true,
    };
  }

  // План, положенный на сегодня (вчера вечером) или прямо сегодня на сегодня
  if (plan && plan.forDate === today) {
    const time = plan.startTime ? ` в ${plan.startTime}` : "";
    return {
      greeting: `${awayLine}Ты решил: «${plan.task}»${time}. Не думай про всё дело — просто ${plan.firstStep.toLowerCase()}.${hourLine} ${companionName ?? "Я"} рядом, *жми кнопку*.`,
      actionStep: plan.firstStep,
    };
  }

  // План на завтра уже положен, сейчас день — подтверждение
  if (plan && !isLate) {
    return {
      greeting: `На завтра у нас уже лежит план: «${plan.task}». А *сегодня* можно ничего не доказывать. Хочешь — поболтаем, хочешь — начнём что-то маленькое.`,
      actionStep: null,
    };
  }

  if (plan && isLate) {
    return {
      greeting: `План на завтра уже готов: «${plan.task}», *первый шаг* — ${plan.firstStep.toLowerCase()}. Утром ${companionName ?? "я"} напишу первым. Можешь спать спокойно.`,
      actionStep: null,
    };
  }

  // Первый визит — ВСЕГДА раньше общей вечерней ветки, вне зависимости от
  // часа. Баг, который чинит эта строка: план физически не может
  // существовать на первом визите, поэтому раньше isEvening-проверка ниже
  // перехватывала любого новичка, зашедшего вечером/ночью — он не видел
  // ни приветствия, ни стартер-чипов, а сразу получал «давай распланируем
  // завтра». Для человека, который только что пришёл с лендинга, это
  // рвёт обещание «попробуй одно крошечное дело — увидишь» и убивает
  // весь эффект нулевого трения до первого старта.
  if (patterns.totalStarts === 0) {
    // К-В · Тёплый старт: выбор, сделанный в диалоге на лендинге, продолжает
    // разговор здесь — раньше он сохранялся и никогда не читался
    if (intro === "procrastinate") {
      return {
        greeting:
          "Ты сказал, что вечно откладываешь. Это не лечится силой воли — только *крошечным стартом*. Я рядом.",
        hint: "Выбери крошечный шаг ниже — или напиши, что висит.",
        actionStep: null,
        showStarterChips: true,
      };
    }
    if (intro === "curious") {
      return {
        greeting:
          "Заходи, смотри. Это мой *дом*, а остров растёт от твоих стартов.",
        hint: "Попробуй один крошечный шаг ниже — увидишь, как это работает.",
        actionStep: null,
        showStarterChips: true,
      };
    }
    return {
      greeting:
        "Привет. Я *Напарник*. Я не буду учить тебя жить — я помогаю начинать.",
      hint: "Выбери крошечный шаг ниже — или напиши, что висит.",
      actionStep: null,
      showStarterChips: true,
    };
  }

  if (isEvening) {
    return {
      // Короче прежней реплики: рядом появляется однотаповая карточка
      // договора — 4 строки рукописного текста + карточка = перегруз
      greeting:
        "Вечер — время договориться с *завтрашним собой*. Один тап ниже — и можно спать спокойно. Или напиши своё.",
      actionStep: null,
      offerEveningPlan: true,
    };
  }

  return {
    greeting: `${nightLine}${awayLine}Плана на сегодня нет — и это не минус, это *ноль*. Выбери одно крошечное действие прямо сейчас, или напиши мне, что висит — раздробим.${hourLine}`,
    actionStep: null,
  };
}

/**
 * Первая реплика чата. На нулевом старте — объясняет механику: чат ещё
 * не прожит, объяснение уместно. С первого же старта эта же строка
 * продолжала звучать как онбординг для человека, который её давно знает —
 * лендинг обещает «сообщение от живого существа», а не диктофонную запись.
 * totalStarts и имя уже приходят в HomeScreen из того же refresh(),
 * здесь только выбор реплики, не новый источник данных.
 */
function buildChatGreeting(
  totalStarts: number,
  companionName: string | null,
): string {
  if (totalStarts === 0) {
    return "Это наш чат. Вечером кладём план, днём дробим шаги, всегда — без стыда.";
  }
  const who = companionName ?? "Я";
  if (totalStarts === 1) {
    return `${who} тут. Помню твой первый старт — пиши, что нужно.`;
  }
  const startsWord = totalStarts < 5 ? "старта" : "стартов";
  return `${who} тут. Помню ${totalStarts} твоих ${startsWord} — пиши, что нужно.`;
}

export function HomeScreen() {
  const router = useRouter();
  const [firstWord, setFirstWord] = useState<FirstWord | null>(null);
  const [stats, setStats] = useState<Patterns | null>(null);

  // Endowment: названное существо становится «моим». Имя спрашиваем
  // после первого старта — когда ценность уже прожита, а не обещана.
  const [companionName, setCompanionName] = useState<string | null>(null);
  const [nameLoaded, setNameLoaded] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  // nameBusy: saveCompanionName асинхронна, а форма до этого позволяла жать
  // «Так и зовут» сколько угодно раз, пока запись идёт — тот самый «кнопку
  // можно нажать несколько раз во время запроса». В чате такой гейт уже был
  // (canSend), здесь его не было.
  const [nameBusy, setNameBusy] = useState(false);
  async function giveName(name: string) {
    const trimmed = name.trim();
    if (!trimmed || nameBusy) return;
    setNameBusy(true);
    try {
      await saveCompanionName(trimmed);
      setCompanionName(trimmed);
      // Дублируем имя в IndexedDB, чтобы весточки от напарника были персональными
      void mirrorCompanionName(trimmed);
    } finally {
      setNameBusy(false);
    }
  }

  // Проактивные весточки: «он пишет первым», когда приложение закрыто.
  // Работает только там, где браузер это умеет (установленная PWA на Chrome).
  const [checkinState, setCheckinState] = useState<CheckinState>("unsupported");
  const [checkinBusy, setCheckinBusy] = useState(false);

  // U5: enableCheckins может вернуть "available" при выданном разрешении —
  // это значит, что нужна установка PWA. Без подсказки кнопка была тупиком:
  // тап → ничего не меняется → тап → ничего.
  const [checkinHint, setCheckinHint] = useState(false);
  async function turnOnCheckins() {
    setCheckinBusy(true);
    const next = await enableCheckins();
    setCheckinState(next);
    setCheckinBusy(false);
    if (
      next === "available" &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      setCheckinHint(true);
    }
  }

  // reduceMotion объявляем первым — используется ниже
  const reduceMotion = useReducedMotion();

  // Маскот оживает ТОЛЬКО при возвращении после паузы (daysAway ≥ 1).
  // На каждый mount — НЕ анимируем: habituation убивает дофамин к 5-му визиту.
  // Событийный триггер (вернулся!) = surprise = дофамин. Variable Reward.
  const shouldAnimateMascot =
    !reduceMotion &&
    stats !== null &&
    // Событийный триггер: вернулся после паузы ИЛИ первый визит.
    // Первый визит: peak moment bond-formation — маскот должен отреагировать.
    // Возвращение после паузы: Variable Reward — дофамин от surprise.
    // ONLY return after real pause (daysAway≥1) = Variable Reward.
    // totalStarts===0 REMOVED: HomeScreen remounts on every tab switch →
    // bounce would fire 3x/session → habituation → dopamine dies by visit 5.
    // Rare event = dopamine peak. Frequent = background noise.
    stats.daysAway !== null && stats.daysAway >= 1;

  // Выражение маскота по контексту: вернулся после паузы — искренняя радость,
  // есть шаг — собран, поздний вечер — сонный, иначе спокоен.
  // mounted-гейт на "sleepy": страница статически пререндерена один раз при
  // сборке — new Date().getHours() в серверном HTML почти всегда отличается
  // от часа реального визита. Без гейта это расходится с SSR-версией уже на
  // первом рендере (до всяких stats/firstWord, оба ещё null) — настоящий
  // hydration mismatch (найден рендером с виртуальными часами, не по коду):
  // React откатывает и перестраивает всё поддерево с нуля, и клики рядом
  // теряются на те же мгновения. Тот же приём, что и у nameLoaded/stats
  // выше — реальные данные приходят только после mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const hour = new Date().getHours();
  const mascotExpression: MascotExpression =
    stats?.daysAway !== null && stats !== null && stats.daysAway >= 2
      ? "happy"
      : firstWord?.actionStep
        ? "focused"
        : mounted && (hour >= 22 || hour < NIGHT_UNTIL_HOUR)
          ? "sleepy"
          : "calm";

  const [lastStepLabel, setLastStepLabel] = useState<string | null>(null);
  // Очередь дробления приоритетнее повтора: «следующий шаг той же задачи» —
  // это продолжение работы, а не её повторение (Zeigarnik на самой работе)
  const [queuedStep, setQueuedStep] = useState<string | null>(null);
  // Задача, из которой раздроблен queuedStep, — для честного заголовка плана
  const [queuedTask, setQueuedTask] = useState<string | null>(null);
  // Однотаповый вечерний договор: мгновенный оптимистичный отклик до refresh
  const [eveningPlanBusy, setEveningPlanBusy] = useState(false);
  const [rareFound, setRareFound] = useState(0);
  // Pity дозрел (5+ обычных находок подряд): следующая гарантированно
  // необычная+ (см. drawFind) — утренний триггер вправе это знать
  const [pityRipe, setPityRipe] = useState(false);

  async function refresh() {
    const [plan, patterns, name, starts, finds, queue] = await Promise.all([
      getPlan(),
      getPatterns(),
      getCompanionName(),
      getStarts(),
      getFinds(),
      getStepQueue(),
    ]);
    const lastStart = starts.length > 0 ? starts[starts.length - 1] : null;
    setLastStepLabel(lastStart?.label ?? null);
    setQueuedStep(queue?.steps[0] ?? null);
    setQueuedTask(queue?.task ?? null);
    setRareFound(finds.filter((f) => f.rarity === "rare").length);
    let pity = 0;
    for (let i = finds.length - 1; i >= 0 && finds[i].rarity === "common"; i--)
      pity++;
    setPityRipe(pity >= 5);
    const lastFind = finds.length > 0 ? finds[finds.length - 1].name : null;
    let intro: IntroChoice = null;
    try {
      const saved = window.localStorage.getItem("naparnik:intro");
      if (saved === "procrastinate" || saved === "curious") intro = saved;
    } catch {
      /* приватный режим */
    }
    setFirstWord(
      buildFirstWord(plan, patterns, new Date(), name, intro, lastFind),
    );
    setStats(patterns);
    setCompanionName(name);
    setNameLoaded(true);
  }

  useEffect(() => {
    refresh();
    // Тихо ставим service worker и узнаём, доступны ли весточки
    void registerServiceWorker();
    void getCheckinState().then(setCheckinState);
  }, []);

  function startNow(step: string) {
    router.push(`/app/session?step=${encodeURIComponent(step)}&plan=1`);
  }

  // Однотаповый вечерний договор (implementation intentions, Gollwitzer):
  // решение принимается сейчас, на пике вечернего намерения, действие —
  // завтра. Ноль печати: шаг берётся из очереди дробления или последнего
  // старта. После сохранения refresh() сам переключает приветствие на
  // «План на завтра уже готов … можешь спать спокойно» — петля замыкается
  // видимым откликом кота, не тостом.
  async function sealEveningPlan() {
    const step = queuedStep ?? lastStepLabel;
    if (!step || eveningPlanBusy) return;
    setEveningPlanBusy(true);
    // Ночью «завтра» календарное и человеческое расходятся на целые сутки.
    // savePlan по умолчанию ставит tomorrowKey(): в 4:14 30-го числа это
    // 31-е — а человек ляжет и встанет всё ещё 30-го. План оказался бы
    // невидим весь предстоящий день (проверка `plan.forDate === today` не
    // сработала бы), и однотаповый договор молча промахнулся бы на сутки.
    await savePlan({
      task: queuedTask ?? step,
      firstStep: step,
      ...(firstWord?.nightMode ? { forDate: todayKey() } : {}),
    });
    await refresh();
    setEveningPlanBusy(false);
  }

  // Приветствие — голос персонажа, вырезать нельзя. Но с третьего визита
  // это уже не знакомство, а стена текста перед единственной нужной
  // кнопкой — сворачиваем до трёх строк (не двух: первая фраза часто несёт
  // сам план) с «Дочитать», и только когда голос уже узнан.
  const [greetingExpanded, setGreetingExpanded] = useState(false);
  const [greetingOverflows, setGreetingOverflows] = useState(false);
  const greetingRef = useRef<HTMLParagraphElement>(null);
  const greetingClamped =
    !!stats && stats.totalStarts >= 3 && !greetingExpanded;

  useEffect(() => {
    if (!greetingClamped) {
      setGreetingOverflows(false);
      return;
    }
    const measure = () => {
      const el = greetingRef.current;
      if (el) setGreetingOverflows(el.scrollHeight - el.clientHeight > 2);
    };
    measure();
    // Рукописный Caveat на момент коммита мог ещё не примениться — высота
    // была бы посчитана по подменному шрифту.
    let cancelled = false;
    document.fonts?.ready
      .then(() => {
        if (!cancelled) measure();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [firstWord?.greeting, greetingClamped]);

  /**
   * ОДНА ПРОСЬБА ЗА ВИЗИТ.
   *
   * Условия показа второстепенных блоков пересекаются, а не исключают друг
   * друга. Проверено рендером (1 авг, 20:20, 3 старта, имя не дано): на
   * экране одновременно оказывались договор на завтра И форма имени — поверх
   * карточки награды с её собственным CTA. Три обращения к человеку в одном
   * кадре, каждое со своей кнопкой: у экрана переставала существовать одна
   * точка фокуса, а для СДВГ-аудитории лишнее решение — это не «чуть больше
   * текста», это цена входа.
   *
   * Правило #24 уже частично введено ниже (весточки уступают готовому
   * первому шагу), но оно закрывало только пару «весточки vs actionStep» и
   * не ловило реальное столкновение — договор против формы имени. Здесь тот
   * же принцип доведён до конца одним слотом с фиксированным приоритетом:
   *   1) вечерний/ночной договор — привязан к часу, второго шанса сегодня
   *      не будет, поэтому выигрывает всегда;
   *   2) имя — момент присвоения (endowment), откладывать дальше некуда;
   *   3) весточки — единственное, что спокойно доживёт до следующего визита.
   *
   * Имя и весточки и так взаимоисключены (одно требует !companionName,
   * другое — companionName), так что фактически приоритет разводит договор
   * против остальных. Ничего не выбрасывается: непоказанное всплывёт при
   * следующем открытии, когда слот освободится.
   */
  const eveningOffer = Boolean(
    firstWord?.offerEveningPlan && (queuedStep ?? lastStepLabel),
  );
  // Два последних условия — не мои: их ввёл предыдущий проход (просьба об
  // имени ждёт, пока на экране лежит готовый первый шаг, и молчит ночью,
  // потому что ночной экран обязан вести в сон, а не открывать новую ветку).
  // Они верные, поэтому перенесены сюда как есть — чтобы у слота был один
  // источник правды, а не половина правил в JSX и половина здесь.
  const nameOffer =
    !eveningOffer &&
    nameLoaded &&
    !companionName &&
    stats !== null &&
    stats.totalStarts >= 1 &&
    !firstWord?.actionStep &&
    !firstWord?.nightMode;
  const checkinOffer =
    !eveningOffer &&
    checkinState === "available" &&
    !!companionName &&
    !firstWord?.actionStep;

  // Интро-карточки «Дома» — закреплённый контекст в начале ленты чата.
  // Раньше это была отдельная секция max-h-[60svh] overflow-y-auto НАД
  // чатом: две независимые скролл-зоны в одном мобильном вьюпорте. Верхняя
  // резала последнюю карточку посреди строки (её потолок), нижняя (чат)
  // ужималась в тонкую полоску — человек воевал сразу с двумя скроллами.
  // Теперь всё едет ОДНИМ скроллом: карточки прокручиваются вместе с
  // перепиской, композер остаётся прижатым внизу (canonical companion-app
  // pattern — контекст в начале треда, разговор ниже, ввод закреплён).
  // gap-5: крупные паузы между смысловыми блоками — визуальная теснота =
  // когнитивная теснота для СДВГ. Ширину/боковые поля даёт скролл-контейнер
  // чата (max-w-md px-4), поэтому здесь их нет — иначе двойной padding.
  const introHeader = (
    <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            {/*
              Mascot: bounce ТОЛЬКО при событии «вернулся после паузы» (daysAway ≥ 1).
              На каждый mount — статичен. Habituation убивает дофамин к 5-му визиту.
              Событийный триггер = Variable Reward = настоящий дофамин.
              keyframes [1, 1.14, 0.95, 1.05, 1] = радостный прыжок, не угроза.

              Тёплое пятно света позади — тот же очаг, что на лендинге, только
              статичный: существо живёт в своём мире и на этом экране, не в
              списке иконок. Continuity без анимационной цены.
            */}
            <div className="relative shrink-0">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,oklch(0.72_0.17_55/0.16)_0%,transparent_70%)]"
              />
              <motion.div
                className="relative"
                animate={
                  shouldAnimateMascot ? { scale: [1, 1.14, 0.95, 1.05, 1] } : {}
                }
                transition={{ duration: 0.55, ease: "easeInOut", delay: 0.3 }}
              >
                <MascotSvg
                  expression={mascotExpression}
                  label={companionName ?? "Напарник"}
                  size={52}
                />
              </motion.div>
            </div>
            {/*
              Greeting: iMessage pattern — появляется ТОЛЬКО когда данные загружены.
              Не на mount (иначе «…» fade-in = jank = negative prediction error).
              AnimatePresence ждёт firstWord, потом slide-up 0.25s.
            */}
            <AnimatePresence>
              {firstWord ? (
                <motion.div
                  key="greeting"
                  className="flex flex-col gap-1 pt-1"
                  initial={reduceMotion ? false : { opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : SPRING_GESTURE
                  }
                >
                  <p
                    ref={greetingRef}
                    className={`font-sans text-lg leading-relaxed ${
                      greetingClamped ? "line-clamp-3" : ""
                    }`}
                  >
                    <EmphasisText text={firstWord.greeting} />
                  </p>
                  {greetingClamped && greetingOverflows && (
                    <button
                      type="button"
                      onClick={() => setGreetingExpanded(true)}
                      className="inline-flex min-h-11 w-fit items-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Дочитать
                    </button>
                  )}
                  {/* Инструкция — системным шрифтом: голос кота и указание
                      интерфейса разделены типографически */}
                  {firstWord.hint && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {firstWord.hint}
                    </p>
                  )}
                </motion.div>
              ) : (
                /* #29 · Первый кадр: firstWord приходит из localStorage в
                   useEffect, и до этого здесь была ПУСТОТА рядом с маскотом —
                   экран выглядел сломанным именно в тот момент, когда человек
                   решает, доверять ли продукту. Скелетон повторяет форму
                   реплики (три строки рукописной высоты), поэтому появление
                   текста не сдвигает раскладку. */
                <GreetingSkeleton key="greeting-skeleton" />
              )}
            </AnimatePresence>
          </div>

          {/* Вечерний договор в один тап: шаг уже известен продукту
              (очередь дробления или последний старт) — человеку остаётся
              только согласиться. Приоритет очереди: продолжение начатой
              задачи (Zeigarnik) сильнее повтора.
              Стоит ВЫШЕ ghost-кнопки старта ниже намеренно (порядок в
              разметке, не CSS order): раньше здесь была пара order-1/
              order-2 — но order сортирует ВСЕ flex-сиблинги колонки, а не
              только эти два блока, поэтому оба реально уезжали в конец
              экрана, за карточку награды и форму имени. Простой порядок в
              JSX не ломается соседними order:0 элементами. */}
          {eveningOffer && (
            <button
              type="button"
              onClick={sealEveningPlan}
              disabled={eveningPlanBusy}
              className={
                firstWord?.nightMode
                  ? // Ночью карточка — единственный акцент экрана, получает
                    // кольцо primary: тот же вес, что днём у кнопки-героя
                    "glass glass-interactive press flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left ring-1 ring-primary/30 disabled:opacity-60"
                  : "glass glass-interactive press flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left disabled:opacity-60"
              }
            >
              <span className="flex min-w-0 items-start gap-2.5">
                <CalendarCheck
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold">
                      {/* Ночью «завтра» звучит как «через сутки» — человек
                          ляжет и встанет в тот же календарный день.
                          «Когда встанешь» совпадает с его моделью времени
                          и с forDate, который кладёт sealEveningPlan. */}
                      {firstWord?.nightMode
                        ? queuedStep
                          ? "Когда встанешь — следующий шаг"
                          : "Когда встанешь — это же дело"
                        : queuedStep
                          ? "Завтра — следующий шаг"
                          : "Завтра — это же дело"}
                    </span>
                  <span className="truncate text-sm text-muted-foreground">
                    «{queuedStep ?? lastStepLabel}»
                  </span>
                </span>
              </span>
              <span className="shrink-0 font-mono text-xs uppercase tracking-widest text-primary">
                {eveningPlanBusy ? "кладу…" : "один тап"}
              </span>
            </button>
          )}

          {/* М2 fused: действие обычно живёт ВНУТРИ карточки награды ниже
              (действие и его награда в одной рамке). Ночью — исключение:
              здесь остаётся тихая ghost-строка вне карточки, потому что
              весь смысл ночного режима — НЕ привлекать взгляд к старту, а
              карточка награды сама по себе яркая точка притяжения. */}
          {stats &&
            stats.totalStarts > 0 &&
            !firstWord?.actionStep &&
            !firstWord?.showStarterChips &&
            firstWord?.nightMode && (
              <div className="flex flex-col gap-2">
                {/*
                  НОЧНАЯ ИНВЕРСИЯ АКЦЕНТА (уникальная механика этого экрана).
                  Днём это кнопка-герой: лаймовая заливка, size lg, полная
                  ширина — намеренно самый тяжёлый объект экрана.
                  В 4:14 та же кнопка кричала «Повторить: «…»» ровно поверх
                  реплики «ночь — не время начинать»: два взаимоисключающих
                  приказа в одном кадре, и побеждал более контрастный —
                  визуальный вес важнее текста.
                  Ночью она становится тихой ghost-строкой: путь к старту
                  сохранён полностью (никакой блокировки — запрет породил бы
                  реактивное сопротивление), но перестаёт быть точкой
                  притяжения взгляда. Закон Фиттса, применённый наоборот:
                  трение до действия повышается осознанно, потому что
                  вредное в этот час действие — именно старт.
                */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-11 gap-2 self-center text-muted-foreground"
                  onClick={() => {
                    const quick = queuedStep ?? lastStepLabel;
                    return quick
                      ? router.push(
                          `/app/session?step=${encodeURIComponent(quick)}&d=15`,
                        )
                      : router.push("/app/session");
                  }}
                >
                  {/* Ночью — честная формулировка выбора, а не приглашение,
                      вне зависимости от того, есть ли известный шаг */}
                  Всё равно начать сейчас
                </Button>
              </div>
            )}

          {firstWord?.showStarterChips && (
            <div className="flex flex-col gap-2">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Первый старт за 15 минут — тап и всё:
              </p>
              <div className="flex flex-wrap gap-2">
                {starterChips.map((chip) => (
                  <Link
                    key={chip}
                    href={`/app/session?step=${encodeURIComponent(chip)}&d=15`}
                    className="glass glass-interactive press inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-semibold text-foreground hover:text-primary"
                  >
                    {chip}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Весточки от напарника: предлагаем один раз, после того как
              человек уже назвал существо. Только там, где браузер их умеет.
              Ни спама, ни давления — «один тихий раз в день». */}
          {/* #24 · Тот же принцип: предложение весточек — не срочное дело.
              Пока на экране лежит готовый первый шаг, оно ждёт свободного
              кадра, иначе человек читает две просьбы вместо одного действия. */}
          {checkinOffer && (
            <div className="glass flex flex-col gap-2 rounded-2xl p-3">
              <div className="flex items-start gap-2">
                <Bell
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <p className="font-sans text-[0.95rem] leading-relaxed">
                  <EmphasisText text="Хочешь, я буду махать тебе с острова раз в день? *Один тихий раз*, без спама — и никаких «ты пропал»." />
                </p>
              </div>
              {/* h-11, не h-10: 40px — не смог отрендерить это состояние в
                  headless-браузере (Notification.permission там всегда
                  'denied', даже после grantPermissions), проверил размер
                  по коду напрямую. */}
              <Button
                size="sm"
                variant="secondary"
                className="h-11 self-start"
                onClick={turnOnCheckins}
                disabled={checkinBusy}
              >
                {checkinBusy ? "Секунду…" : "Да, махай мне"}
              </Button>
              {checkinHint && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Почти получилось: чтобы я мог писать первым, добавь меня на
                  экран «Домой» (Поделиться → На экран «Домой») — и нажми ещё
                  раз.
                </p>
              )}
            </div>
          )}

          {checkinState === "enabled" && !!companionName && (
            <p className="flex items-center gap-1.5 text-xs leading-relaxed text-muted-foreground">
              <Bell
                className="size-3.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              {companionName} будет тихо махать тебе с острова раз в день.
            </p>
          )}

          {/* Браузер отказал в разрешении — раньше это состояние было
              немым: человек нажимал «Да, махай мне» когда-то раньше,
              передумал в системных настройках, и продукт просто переставал
              объяснять, что происходит. JS не может запросить разрешение
              повторно после явного отказа — единственный честный вариант
              здесь: сказать как есть и не звать никакую кнопку, которая бы
              всё равно ничего не сделала. */}
          {checkinState === "denied" && !!companionName && (
            <p className="flex items-center gap-1.5 text-xs leading-relaxed text-muted-foreground">
              <BellOff
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              Весточки выключены в настройках браузера — включишь там же,
              когда захочешь.
            </p>
          )}

          {/* М2 · Goal gradient: слитая карточка — действие и его награда в
              одной рамке. Раньше здесь стояли два раздельных объекта (кнопка
              сверху, карточка награды снизу); слитые — карточка перестаёт быть
              целиком-Link (внутри неё теперь живёт кнопка со своим переходом:
              кнопка внутри <a> кликалась бы одновременно с переходом самой
              ссылки — невалидно). Вместо этого «весь остров →» — свои
              маленькие ссылки в каждой ветке ниже. */}
          {/* #29 · Карточка награды — самый крупный объект экрана; её
              отсутствие на первом кадре роняло всю раскладку вверх, а потом
              она въезжала и толкала контент вниз. Скелетон держит место. */}
          {!stats && <RewardCardSkeleton />}
          {/* Без .press на карточке: своего onClick у неё нет — действие
              живёт в кнопке и ссылках внутри. CSS :active срабатывает на
              любом предке нажатого элемента, поэтому .press давал ложный
              отклик: палец жал на текст статистики или пустой отступ,
              карточка сжималась, и не происходило ничего. А при нажатии на
              настоящий CTA внутри её scale(0.97) складывался с собственным
              active:translate-y-px кнопки (components/ui/button.tsx) — два
              трансформа на один тап. Док самого класса .press это прямо
              запрещает: «только на CTA без собственного active-transform». */}
          {stats && (
            <div className="glass relative flex flex-col gap-3 overflow-hidden rounded-2xl p-4">
              {stats.totalStarts < LANDMARK_COUNT ? (
                <>
                  {/* Аура за силуэтом: холодный лунный свет из угла карты.
                      Средняя дозировка (0.16): v3 с 0.22 читался
                      «затмением», финальный откат до 0.1 гасил награду
                      в чёрный блин — обещание обязано манить (reward
                      anticipation, Schultz), холодный оттенок оправдан
                      сюжетно: луна — единственный холодный свет сцены */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -left-6 -top-8 size-30 rounded-full bg-[radial-gradient(circle,oklch(0.9_0.05_240/0.16)_0%,transparent_64%)]"
                  />
                  <span className="relative flex items-center gap-3.5">
                    {/* #14 · МИНИ-СЦЕНА вместо плоской иконки. Ориентир
                        вырезался из карты без земли под ним — «иконка
                        предмета», хотя обещание карточки в том, что на
                        острове появится МЕСТО. Здесь тот же спрайт получает
                        свой клочок мира: горизонт, две звезды и холодный
                        лунный свет — награда читается как кадр из будущего
                        острова, а не как ассет в списке. Всё внутри одного
                        SVG с клипом по скруглению: ни одного лишнего узла в
                        DOM и ни одного нового цвета в палитре. */}
                    <svg
                      viewBox="0 0 48 48"
                      className="size-16 shrink-0"
                      aria-hidden="true"
                    >
                      <defs>
                        <clipPath id="mini-scene-clip">
                          <rect x="0" y="0" width="48" height="48" rx="12" />
                        </clipPath>
                        <radialGradient id="mini-moonlight" cx="22%" cy="16%" r="72%">
                          <stop offset="0%" stopColor="oklch(0.9 0.05 240 / 0.3)" />
                          <stop offset="100%" stopColor="oklch(0.9 0.05 240 / 0)" />
                        </radialGradient>
                      </defs>
                      <g clipPath="url(#mini-scene-clip)">
                        {/* Ночное небо кадра — на полтона светлее стекла
                            карточки, чтобы сцена читалась как окно, а не
                            как дырка */}
                        <rect x="0" y="0" width="48" height="48" fill="oklch(0.2 0.02 140)" />
                        <rect x="0" y="0" width="48" height="48" fill="url(#mini-moonlight)" />
                        <circle cx="37" cy="9" r="0.9" fill="oklch(0.92 0.01 210 / 0.5)" />
                        <circle cx="30" cy="15" r="0.6" fill="oklch(0.92 0.01 210 / 0.32)" />
                        {/* Земля: тот же силуэт холмов, что в сцене фона */}
                        <path
                          d="M0 34 Q 12 29 24 32 T 48 30 L 48 48 L 0 48 Z"
                          fill="oklch(0.17 0.018 138)"
                        />
                        {/* Сам ориентир — стоит НА земле, не висит в пустоте.
                            brightness-150: ассеты нарисованы под тёмную сцену
                            Мира, без осветления силуэт читался чёрным блином. */}
                        <g
                          transform={`translate(${24 - landmarkAnchors[stats.totalStarts].x * 0.58}, ${30 - landmarkAnchors[stats.totalStarts].y * 0.58}) scale(0.58)`}
                          className="brightness-150 saturate-[0.75]"
                          style={{
                            filter:
                              "drop-shadow(0 0 5px oklch(0.9 0.06 240 / 0.45))",
                          }}
                        >
                          {landmarkNodes[stats.totalStarts]}
                        </g>
                      </g>
                    </svg>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                        Следующий старт вырастит
                      </span>
                      <span className="text-lg font-semibold leading-snug text-foreground text-balance">
                        «{ISLAND_ELEMENT_NAMES[stats.totalStarts]}»
                      </span>
                    </span>
                  </span>
                  {/* Endowed progress (Nunes & Drèze, 2006): видимая
                      заполненная часть пути к находке. Только при
                      totalStarts > 0 — пустой бар у новичка демотивирует */}
                  {stats.totalStarts > 0 && (
                    <span
                      className="flex flex-col gap-1.5"
                      role="progressbar"
                      aria-valuenow={stats.totalStarts}
                      aria-valuemin={0}
                      aria-valuemax={LANDMARK_COUNT}
                      aria-label={`Пройдено ${stats.totalStarts} из ${LANDMARK_COUNT} ориентиров острова`}
                    >
                      {/* #22 · ЖИВАЯ ТРОПА вместо сегментов прогресса.
                          Сегменты честно считали старты (unit bias), но
                          говорили языком загрузки файла — «системный
                          индикатор», к тому же неотличимый от прогресс-бара
                          в любом приложении. Здесь прогресс — это ПУТЬ по
                          острову, и тропа говорит это буквально: пройденные
                          шаги — следы на земле, следующий — пульсирующая
                          точка-цель (Goal Gradient: видимая близость цели
                          ускоряет действие), непройденные — бледный пунктир
                          уходящей вдаль дороги.
                          Семантика progressbar сохранена на родителе: для
                          скринридера ничего не изменилось. */}
                      <span className="relative flex h-4 items-center">
                        {/* Земля под следами — тонкая линия тропы */}
                        <span
                          aria-hidden="true"
                          className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/[0.07]"
                        />
                        {/* Пройденная часть тропы — тёплая, заработанная */}
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-primary/45"
                          style={{
                            width: `${(Math.max(0, stats.totalStarts - 1) / (LANDMARK_COUNT - 1)) * 100}%`,
                          }}
                        />
                        <span className="relative flex w-full items-center justify-between">
                          {Array.from({ length: LANDMARK_COUNT }, (_, i) => {
                            const done = i < stats.totalStarts;
                            const isNext = i === stats.totalStarts;
                            return (
                              <span
                                key={i}
                                className={
                                  done
                                    ? "size-2 rounded-full bg-primary shadow-[0_0_6px_oklch(0.86_0.22_130/0.5)]"
                                    : isNext
                                      ? "trail-beacon size-2 rounded-full bg-primary/70 ring-2 ring-primary/25"
                                      : "size-1 rounded-full bg-white/15"
                                }
                              />
                            );
                          })}
                        </span>
                      </span>
                      <span className="flex items-baseline justify-between gap-2">
                        {/* Вербальный фрейминг близости (goal-gradient,
                            Kivetz 2006): «остался последний» сильнее голого
                            счёта */}
                        <span className="font-mono text-xs uppercase tracking-wider tabular-nums text-muted-foreground">
                          {stats.totalStarts} из {LANDMARK_COUNT}
                          {LANDMARK_COUNT - stats.totalStarts === 1
                            ? ' · остался последний'
                            : stats.lastStartDate === todayKey(new Date())
                              ? ' · вырос сегодня'
                              : ''}
                        </span>
                        {/* py-3.5 -my-3.5: расширяет тач-цель до 44px, не
                            трогая визуальную высоту строки (WCAG 2.5.8) */}
                        <Link
                          href="/app/world"
                          className="-my-3.5 inline-flex shrink-0 items-center py-3.5 font-mono text-xs uppercase tracking-wider text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                        >
                          весь остров →
                        </Link>
                      </span>
                    </span>
                  )}
                  {/*
                    ПУСТОЕ СОСТОЯНИЕ КАРТОЧКИ (0 стартов) — было спроектировано
                    как «просто убрать блок», и это ломало анатомию.
                    Что видно на реальном скриншоте: у новичка под иконкой h-14
                    и двумя строками текста оставалась одинокая мелкая ссылка,
                    прижатая влево — карточка теряла нижний ряд целиком и
                    читалась как недогруженная, а не как «пустая, но целая».
                    Хуже: это первый экран после лендинга, где доверие ещё не
                    заработано, и «сломанная вёрстка» стоит дороже всего.

                    Бар остаётся скрытым намеренно: 10 серых пустых сегментов у
                    человека с нулём стартов — это визуализация нуля, она
                    демотивирует (и врать зажжённым сегментом нельзя — данные
                    обязаны быть честными). Вместо бара тот же самый
                    двухколоночный baseline-ряд, что и у прогресса: слева счёт
                    ориентиров, справа «весь остров →». Анатомия карточки
                    идентична во всех состояниях, разница только в содержании.

                    Копия ужата до «10 ориентиров ждут» по замеру: на 390px
                    левой колонке достаётся 223px, и вариант «10 ориентиров ·
                    первый в одном старте» переносился на вторую строку —
                    ровно тот сиротский перенос, который я считаю браком.
                    «В одном старте» вырезано не ради длины, а потому что это
                    дублировало заголовок карточки («Следующий старт вырастит
                    «Первый росток»»): заголовок говорит ЧТО дальше, нижний
                    ряд — насколько велик мир целиком (endowment всего набора).
                  */}
                  {stats.totalStarts === 0 && (
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 font-mono text-xs uppercase tracking-wider tabular-nums text-muted-foreground">
                        {LANDMARK_COUNT} ориентиров ждут
                      </span>
                      <Link
                        href="/app/world"
                        className="-my-3.5 inline-flex shrink-0 items-center py-3.5 font-mono text-xs uppercase tracking-wider text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                      >
                        весь остров →
                      </Link>
                    </span>
                  )}
                  {/* Вариативный слой награды — раньше этот текст жил только
                      в ветке totalStarts >= LANDMARK_COUNT ниже, то есть
                      впервые появлялся ПОСЛЕ десятого старта, хотя drawFind
                      (island-elements.ts) уже считает находку на каждый
                      старт с первого. Перенесено сюда, к раннему окну
                      удержания. */}
                  <span
                    className={`flex items-center gap-1.5 text-xs leading-snug ${
                      pityRipe ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
                    {pityRipe
                      ? "Следующая находка будет необычной — или лучше"
                      : "И одна находка на остров — какая, не знаю сам"}
                  </span>
                </>
              ) : pityRipe ? (
                <div className="flex flex-col gap-1">
                  <span className="text-sm leading-snug text-muted-foreground">
                    Следующая находка будет{" "}
                    <span className="font-semibold text-reward">
                      необычной — или лучше
                    </span>
                    .
                  </span>
                  <Link
                    href="/app/world"
                    className="-my-3.5 inline-flex w-fit items-center py-3.5 font-mono text-xs uppercase tracking-wider text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                  >
                    она уже ждёт →
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-sm leading-snug text-muted-foreground">
                    Редких находок:{" "}
                    <span className="font-semibold text-reward">
                      {rareFound} из{" "}
                      {ISLAND_POOL.filter((e) => e.rarity === "rare").length}
                    </span>{" "}
                    — полная сессия повышает шанс.
                  </span>
                  <Link
                    href="/app/world"
                    className="-my-3.5 inline-flex w-fit items-center py-3.5 font-mono text-xs uppercase tracking-wider text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                  >
                    весь остров →
                  </Link>
                </div>
              )}

              {/* Действие — внутри той же рамки, что и его награда (по
                  вашей просьбе в этой сессии). Ночью действие сюда не
                  переезжает — см. комментарий у ghost-кнопки выше. */}
              {firstWord?.actionStep ? (
                <div className="flex flex-col gap-1">
                        {/* Шаг на кнопке НЕ обрезаем. Проверено в браузере на
                            реальном плане: trimLabel(28) + truncate давали
                            «Начинаю: „открыть файл и перечитат…"» — человек
                            видел обрубок ровно того текста, ради которого
                            кнопка существует. Весь смысл первого шага в том,
                            что он крошечный и конкретный: «перечитать
                            последний абзац» снимает страх, «перечитат…» его
                            добавляет — мозг достраивает неизвестный объём.
                            Кнопка растёт в высоту под текст, а не режет его:
                            две строки здесь дешевле, чем потерянный старт. */}
                        <Button
                          size="lg"
                          className="cta-sheen h-auto w-full items-start gap-2 py-3 font-semibold whitespace-normal"
                          onClick={() => startNow(firstWord.actionStep as string)}
                        >
                          <Play className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                          <span className="text-left leading-snug text-pretty">
                            Начинаю: «{firstWord.actionStep}»
                          </span>
                        </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-11 self-center text-muted-foreground"
                    onClick={() => router.push("/app/session")}
                  >
                    Другое дело
                  </Button>
                </div>
              ) : (
                stats.totalStarts > 0 &&
                !firstWord?.showStarterChips &&
                !firstWord?.nightMode && (
                  <div className="flex flex-col gap-2">
                    <Button
                      size="lg"
                      className="cta-sheen w-full gap-2 font-semibold"
                      onClick={() => {
                        const quick = queuedStep ?? lastStepLabel;
                        return quick
                          ? router.push(
                              `/app/session?step=${encodeURIComponent(quick)}&d=15`,
                            )
                          : router.push("/app/session");
                      }}
                    >
                      {/* Продолжение раздробленной задачи (Zeigarnik) и
                          повтор прошлой — разные по смыслу действия, но до
                          сих пор рендерились с одной и той же иконкой Play.
                          Стрелка вперёд честнее говорит «дальше», а не
                          «сначала». */}
                      {queuedStep ? (
                        <ArrowRight className="size-4" aria-hidden="true" />
                      ) : (
                        <Play className="size-4" aria-hidden="true" />
                      )}
                      {(() => {
                        const quick = queuedStep ?? lastStepLabel;
                        if (!quick) return "Начать сессию";
                        const short = trimLabel(quick, 22);
                        return queuedStep
                          ? `Следующий шаг: «${short}»`
                          : `Повторить: «${short}»`;
                      })()}
                    </Button>
                    {lastStepLabel && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-11 self-center text-muted-foreground"
                        onClick={() => router.push("/app/session")}
                      >
                        Другое дело
                      </Button>
                    )}
                  </div>
                )
              )}
            </div>
          )}

          {/* Порядок сверху вниз = приоритет: действие (CTA) → награда
              (goal-карта) → отношения (имя). Карточка имени, стоявшая
              МЕЖДУ действием и наградой, разрывала связку «сделай — и
              вырастет» лишним социальным решением (serial position +
              минимизация числа решений до действия) */}
          {/* #24 · ГЕРОЙ ДНЯ. «Дизайн закончен, когда нечего убрать»: когда на
              экране есть готовый первый шаг, единственное нужное действие —
              нажать «Начинаю». Форма имени в этот момент — второе социальное
              решение поверх первого, и она физически отодвигает кнопку от
              большого пальца. Просьба об имени не исчезает, она ЖДЁТ момента,
              когда экран свободен (нет плана на сегодня): тогда она и главное
              событие кадра, и не конкурирует с действием.
              Ночью тоже прячем: ночной экран должен вести в сон, а не
              открывать новую ветку взаимодействия. */}
          {nameOffer && (
              <form
                className="glass flex flex-col gap-2 rounded-2xl p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  giveName(nameDraft);
                }}
              >
                <p className="font-sans text-[0.95rem] leading-relaxed">
                  <EmphasisText text="Слушай… у меня ведь до сих пор нет *имени*. Дашь мне его? Я буду откликаться." />
                </p>
                <div className="flex gap-2">
                  {/* h-11 (44px), не h-10: замерено рендером — оба контрола
                      были 40px, ниже минимума тач-цели. Прошлый скан их не
                      поймал: в тестовом стейте имя уже было задано, и форма
                      просто не рендерилась.
                      text-base на инпуте: как и в композере чата, шрифт
                      меньше 16px заставляет Safari на iOS зумить страницу
                      при фокусе. */}
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    placeholder="Как меня зовут?"
                    maxLength={24}
                    aria-label="Имя для напарника"
                    disabled={nameBusy}
                    className="glass h-11 min-w-0 flex-1 rounded-xl px-3 text-base disabled:opacity-60"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="h-11"
                    disabled={!nameDraft.trim() || nameBusy}
                  >
                    {nameBusy ? "Запоминаю…" : "Так и зовут"}
                  </Button>
                </div>
              </form>
            )}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* sr-only: без единого heading на экране скринридер не может
          перескочить сюда по заголовкам — визуально ничего не меняет. */}
      <h1 className="sr-only">Напарник — дом</h1>
      {/* Единственная скролл-зона экрана: интро-карточки (header) + лента
          переписки едут вместе, композер CompanionChat прижат внизу. */}
      <CompanionChat
        mode="companion"
        greeting={buildChatGreeting(stats?.totalStarts ?? 0, companionName)}
        onPlanSaved={refresh}
        showSuggestions={!firstWord?.showStarterChips}
        header={introHeader}
        // #23 · Наверху ленты лежат карточки «Дома» — их и обновляем жестом.
        onPullRefresh={refresh}
      />
    </div>
  );
}
