"use client";

/**
 * Som de notificação do site.
 * Gerado pela Web Audio API (nenhum arquivo de áudio é baixado).
 *
 * Os navegadores só liberam áudio depois de o usuário interagir com a página (clique/tecla).
 * Por isso o "destrave" é feito no primeiro clique/tecla; antes disso o som não toca.
 */

let ctx: AudioContext | null = null;
let unlockInstalled = false;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Instala (uma única vez) o destravamento do áudio no primeiro clique/tecla do usuário */
export function installNotificationSoundUnlock(): void {
  if (typeof window === "undefined" || unlockInstalled) return;
  unlockInstalled = true;
  const unlock = () => {
    const c = getContext();
    if (c && c.state === "suspended") c.resume().catch(() => {});
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

/** Toca um "ding-dong" curto e agradável */
let lastPlayedAt = 0;

export function playNotificationSound(): void {
  // Evita tocar duas vezes seguidas quando o sininho e o chat avisam da mesma mensagem
  const nowMs = Date.now();
  if (nowMs - lastPlayedAt < 1500) return;

  const c = getContext();
  if (!c) return;
  if (c.state === "suspended") {
    // Ainda sem interação do usuário: o navegador não permite tocar
    c.resume().catch(() => {});
    if (c.state === "suspended") return;
  }
  lastPlayedAt = nowMs;

  const now = c.currentTime;
  const master = c.createGain();
  master.gain.value = 0.35;
  master.connect(c.destination);

  const notes: Array<{ freq: number; start: number; dur: number }> = [
    { freq: 880, start: 0, dur: 0.22 }, // A5
    { freq: 1318.5, start: 0.14, dur: 0.38 }, // E6
  ];

  notes.forEach(({ freq, start, dur }) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;

    const t0 = now + start;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(1, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  });
}
