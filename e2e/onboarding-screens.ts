// Экраны знакомства для проверок «влезает без прокрутки» (onboarding-fit*.spec.ts)
export const SCREENS = [
  ['что висит', 'step=1&s=unsure'],
  ['сколько висит + пояснение', 'step=2&s=work&h=month'],
  ['что мешает (самая длинная реплика)', 'step=3&s=work&h=week&b=where'],
  ['ради чего', 'step=4&s=work&h=month&b=fear&m=rest'],
  ['сколько ест', 'step=5&s=work&h=month&b=fear&m=relief&c=allday'],
  ['твоя цифра', 'step=6&s=work&h=month&b=fear&m=relief&c=hour'],
  ['первый шаг, «не знаю, с чего»', 'step=7&s=message&h=week&b=where&m=relief&c=hour&f=0'],
  ['первый шаг, «нет сил»', 'step=7&s=message&h=week&b=tired&m=relief&c=hour&f=0'],
  ['план', 'step=8&s=message&h=month&b=fear&m=rest&c=hour&f=0'],
  ['договор', 'step=9&s=work&h=month&b=phone&m=relief&c=hour&f=1'],
] as const
