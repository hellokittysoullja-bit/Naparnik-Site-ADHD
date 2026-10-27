import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Правила под React Compiler — здесь он не включён, поэтому это советы, а не ошибки.
      // set-state-in-effect: чтение localStorage после mount — нарочный приём против рассинхрона со статическим
      // HTML (см. home-screen.tsx, mounted-гейт). refs/immutability: refs-«последнее значение» и счётчик внутри
      // одного рендера — корректны без компилятора.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      // массивы спрайтов (lib/island-sprites.tsx) рендерятся по одному внутри обёрток с key, не списком
      "react/jsx-key": ["error", { checkFragmentShorthand: false }],
    },
  },
  {
    // постеры кота: data: URI и абсолютное позиционирование по окну рисунка — next/image тут не подходит
    files: ["components/mascot-doll.tsx"],
    rules: { "@next/next/no-img-element": "off" },
  },
  {
    files: ["lib/island-sprites.tsx"],
    rules: { "react/jsx-key": "off" },
  },
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "design/**", "fonts-library/**", "public/**", "lib/asset-versions.ts", "components/mascot-poster-inline.ts", "e2e-report/**", "test-results/**"],
  },
];

export default config;
