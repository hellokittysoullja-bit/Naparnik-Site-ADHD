"use client";

import { useState } from "react";
import { MascotRive, type MascotRiveApi } from "@/components/mascot-rive";
import { MascotSvg, type MascotAction, type MascotExpression } from "@/components/mascot-svg";

const EXPR: MascotExpression[] = ["calm", "happy", "focused", "sleepy", "excited", "listening"];
const ACT: MascotAction[] = ["idle", "wave", "write", "think", "celebrate"];
const TRIG = ["blink", "blinkSlow", "blinkDouble", "tap", "yawn", "sigh", "earL", "earR"];

declare global {
  interface Window {
    __cat?: MascotRiveApi;
  }
}

export function RiveLab() {
  const [expression, setExpression] = useState<MascotExpression>("calm");
  const [action, setAction] = useState<MascotAction>("idle");
  const [api, setApi] = useState<MascotRiveApi | null>(null);
  const btn = "rounded-md border border-white/20 px-3 py-1.5 text-sm text-white/90";
  return (
    <main style={{ minHeight: "100dvh", background: "#202220", display: "grid", placeItems: "center", gap: 16, padding: 16 }}>
      <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
      <MascotRive
        size={520}
        expression={expression}
        action={action}
        onReady={(a) => {
          window.__cat = a;
          setApi(a);
        }}
      />
      <MascotSvg size={520} expression={expression} action={action} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 640 }}>
        {EXPR.map((e) => (
          <button key={e} className={btn} data-on={e === expression} onClick={() => setExpression(e)}>{e}</button>
        ))}
        {ACT.map((a) => (
          <button key={a} className={btn} onClick={() => { setAction("idle"); setTimeout(() => setAction(a), 30); }}>{a}</button>
        ))}
        {TRIG.map((t) => (
          <button key={t} className={btn} disabled={!api} onClick={() => api?.fire(t)}>{t}</button>
        ))}
      </div>
    </main>
  );
}
