/* ─────────────────────────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — ShareModal
 *
 * ENTRANCE (ms after mount):
 *   80ms   card: y 24→0, scale 0.96→1, opacity 0→1  (spring)
 *  220ms   header row ("Share" + ×)                   (spring, slide up)
 *  360ms   access row (globe · Anyone · toggle)        (spring, slide up)
 *  460ms   url + copy-link row                         (spring, slide up)
 *
 * ON TOGGLE OFF:
 *    0ms   thumb slides LEFT  spring(k=560, d=18, m=0.7) — overshoot + settle
 *    0ms   track fades  #3592f9 → rgba(218,218,219,0.8)  (CSS transition 220ms)
 *    0ms   "Invite members" section springs open          (height 0→auto)
 *
 * ON TOGGLE ON:
 *    0ms   thumb slides RIGHT  (same spring)
 *    0ms   track fades back to #3592f9
 *    0ms   "Invite members" section collapses             (height auto→0, 160ms ease-in)
 *
 * ON COPY CLICK:
 *    0ms   button squishes (scale → 0.90)
 *   90ms   button pops back (spring overshoot)
 *  100ms   label flips  "Copy link" → "Copied ✓"
 *  120ms   GSAP dot-burst radiates from button center (12 particles)
 * 2200ms   label resets "Copied ✓" → "Copy link"
 *
 * ──────────────────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { gsap } from "gsap";

// ─── Local assets (exported from Figma) ──────────────────────────────────────
import IMG_GLOBE          from "./assets/globe.svg";
import IMG_GLOBE_KEYLINES from "./assets/globe-keylines.svg";
import IMG_GLOBE_SUBTRACT from "./assets/globe-subtract.svg";
import IMG_CLOSE          from "./assets/close.svg";
import IMG_ARROW_DOWN     from "./assets/arrow-down.svg";
import IMG_CHIP_CLOSE     from "./assets/chip-close.svg";
export { IMG_GLOBE_KEYLINES, IMG_GLOBE_SUBTRACT }; // suppress unused-export lint

// ─── TIMING (ms after mount) ─────────────────────────────────────────────────
const TIMING = {
  card:      80,
  header:    220,
  accessRow: 360,
  urlRow:    460,
};

// ─── MOTION CONFIGS ───────────────────────────────────────────────────────────
const CARD = {
  initialY:     28,
  initialScale: 0.94,
  // Entrance with a noticeable overshoot — card overshoots then settles
  spring: { type: "spring" as const, visualDuration: 0.55, bounce: 0.35 },
};

const ROW = {
  offsetY: 12,
  // Each row pops in with its own bounce — stagger makes them feel playful
  spring: { type: "spring" as const, visualDuration: 0.42, bounce: 0.28 },
};

const COPY_BTN = {
  pressScale: 0.88,
  // Snappy pop-back on release
  spring: { type: "spring" as const, visualDuration: 0.3, bounce: 0.55 },
  resetMs: 2200,
};

const TOGGLE = {
  // 40×20px track | 22×16px thumb | travel = 40 − 22 − 2 − 2 = 14px
  thumbTravel: 14,
  // Snappy but not distracting — just triggers the expand
  spring: { type: "spring" as const, visualDuration: 0.3, bounce: 0.3 },
};

// Same spring as Calendar animation's SPRING_LAYOUT — elastic settle on height
const SPRING_LAYOUT = { type: "spring" as const, stiffness: 240, damping: 22 };

const BURST = {
  count:    12,
  radius:   48,
  duration: 0.55,
  colors: [
    "#3b82f6","#60a5fa","#93c5fd",
    "#2563eb","#1d4ed8","#38bdf8",
    "#0ea5e9","#7dd3fc","#bfdbfe",
    "#dbeafe","#3b82f6","#60a5fa",
  ],
};

// ─── SHADOW TOKENS ────────────────────────────────────────────────────────────
const SHADOW = {
  // AlignUI custom-shadows/small (acts as 1px stroke + depth)
  card: [
    "0px 0px 0px 1px rgba(51,51,51,0.04)",
    "0px 16px 8px -8px rgba(51,51,51,0.01)",
    "0px 12px 6px -6px rgba(51,51,51,0.02)",
    "0px 5px 5px -2.5px rgba(51,51,51,0.08)",
    "0px 1px 3px -1.5px rgba(51,51,51,0.16)",
  ].join(", "),

  // Globe icon outer
  globe: [
    "0px 0.6px 0.6px 0.3px rgba(51,51,51,0.04)",
    "0px 1.8px 1.8px -0.9px rgba(51,51,51,0.02)",
    "0px 3.6px 3.6px -1.8px rgba(51,51,51,0.04)",
    "0px 7.2px 7.2px -3.6px rgba(51,51,51,0.04)",
    "0px 14.4px 14.4px -7.2px rgba(51,51,51,0.04)",
    "0px 28.8px 28.8px -14.4px rgba(51,51,51,0.04)",
    "0px 0px 0px 0.45px #0088fe",
  ].join(", "),

  globeInner:
    "inset 0px -2px 4px 0px rgba(255,255,255,0.25), inset 0px 2px 4px 0px rgba(255,255,255,0.16)",

  filterInner: "inset 0px -0.5px 0.5px 0px rgba(51,51,51,0.08)",

  // Copy button (fancy-buttons/stroke)
  copyBtn: "0px 1px 3px 0px rgba(14,18,27,0.12), 0px 0px 0px 1px #ebebeb",

  // Toggle thumb — ON state (shadow-switch)
  toggleOn:
    "0px 0px 1px 0px rgba(0,0,0,0.3), 0px 2px 10px 0px rgba(0,0,0,0.06), 0px 0px 5px 0px rgba(0,0,0,0.02)",
  // Toggle thumb — OFF state (form-field/shadow)
  toggleOff:
    "0px 2px 4px 0px rgba(0,0,0,0.04), 0px 1px 2px 0px rgba(0,0,0,0.06), 0px 0px 1px 0px rgba(0,0,0,0.06)",

  // Input field (shadow-field)
  inputField:
    "0px 2px 4px 0px rgba(0,0,0,0.04), 0px 1px 2px 0px rgba(0,0,0,0.06), 0px 0px 1px 0.5px #ebebeb",

  // Invite button (custom-shadows/small + 0.75px stroke)
  inviteBtn: [
    "0px 0px 0px 0.75px #171717",
    "0px 16px 8px -8px rgba(51,51,51,0.01)",
    "0px 12px 6px -6px rgba(51,51,51,0.02)",
    "0px 5px 5px -2.5px rgba(51,51,51,0.08)",
    "0px 1px 3px -1.5px rgba(51,51,51,0.16)",
  ].join(", "),

  inviteBtnInner: "inset 0px 1px 2px 0px rgba(255,255,255,0.16)",

  // Email chip — custom-shadows/small (same as card)
  chip: [
    "0px 0px 0px 1px rgba(51,51,51,0.04)",
    "0px 16px 8px -8px rgba(51,51,51,0.01)",
    "0px 12px 6px -6px rgba(51,51,51,0.02)",
    "0px 5px 5px -2.5px rgba(51,51,51,0.08)",
    "0px 1px 3px -1.5px rgba(51,51,51,0.16)",
  ].join(", "),
  chipInner: "inset 0px -0.5px 0.5px 0px rgba(51,51,51,0.08)",
};

// ─── SHARED AVATAR HELPERS ────────────────────────────────────────────────────
const CHIP_SPRING   = { type: "spring" as const, visualDuration: 0.2, bounce: 0.3 };
const MEMBER_SPRING = { type: "spring" as const, visualDuration: 0.28, bounce: 0.18 };

const AVATAR_COLORS = ["#ffecc0", "#c0d5ff", "#c0eaff", "#d0f0c0", "#ffd0d0", "#e8d5ff"];
function avatarColor(email: string) {
  return AVATAR_COLORS[email.charCodeAt(0) % AVATAR_COLORS.length];
}
function displayName(email: string) {
  return email.includes("@") ? email.split("@")[0] : email;
}

// ─── MEMBER ROW (appears in "Members with access" after invite) ───────────────
interface Member { email: string; }

function MemberRow({ member, delay }: { member: Member; delay: number }) {
  const name = displayName(member.email);
  const bg   = avatarColor(member.email);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -6, transition: { duration: 0.12, ease: "easeIn" as const } }}
      transition={{ ...MEMBER_SPRING, delay }}
      className="flex items-center justify-between w-full"
    >
      {/* Left: white pill — avatar + name/email */}
      <div className="bg-white flex items-center justify-center overflow-clip px-[4px] py-[2px] relative rounded-[16px] shrink-0">
        <div className="flex gap-[8px] items-center relative shrink-0">
          {/* 40px avatar */}
          <div
            className="relative rounded-full shrink-0 size-[40px] flex items-center justify-center overflow-hidden"
            style={{ background: bg }}
          >
            <span className="text-[16px] font-semibold text-[#171717] leading-none select-none">
              {name[0].toUpperCase()}
            </span>
          </div>
          {/* Name + email */}
          <div className="flex flex-col items-start justify-center relative shrink-0 whitespace-nowrap">
            <p
              className="font-medium leading-[20px] text-[13px] text-[#171717] not-italic"
              style={{ letterSpacing: "-0.006em", fontFeatureSettings: "'calt' 0, 'liga' 0" }}
            >
              {name}
            </p>
            <p className="font-normal leading-[18px] text-[12px] text-[#5c5c5c]">
              {member.email.includes("@") ? member.email : `${member.email}@email.com`}
            </p>
          </div>
        </div>
      </div>
      {/* Right: Can view ↓ */}
      <div className="flex gap-[4px] items-center shrink-0">
        <p className="font-normal text-[12px] leading-[18px] text-[#71717a] whitespace-nowrap">
          Can view
        </p>
        <div className="relative overflow-clip shrink-0 size-[20px]">
          <div className="absolute" style={{ inset: "35.83% 26.13% 35% 26.14%" }}>
            <img alt="" aria-hidden="true" className="absolute block inset-0 max-w-none size-full" src={IMG_ARROW_DOWN} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── EMAIL CHIP ───────────────────────────────────────────────────────────────
interface ChipProps { email: string; onRemove: () => void; }

function EmailChip({ email, onRemove }: ChipProps) {
  const name = displayName(email);
  return (
    <motion.div
      layout
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.7, opacity: 0, transition: { duration: 0.12, ease: "easeIn" as const } }}
      transition={CHIP_SPRING}
      className="flex gap-[6px] items-center justify-center overflow-clip px-[4px] py-[2px] relative rounded-[16px] shrink-0"
      style={{ boxShadow: SHADOW.chip }}
    >
      <div aria-hidden="true" className="absolute bg-white inset-0 pointer-events-none rounded-[16px]" />
      <div className="flex gap-[2px] items-center relative shrink-0">
        {/* Avatar */}
        <div
          className="relative rounded-full shrink-0 size-[16px] flex items-center justify-center overflow-hidden"
          style={{ background: avatarColor(email) }}
        >
          <span className="text-[8px] font-semibold text-[#171717] leading-none select-none">
            {name[0].toUpperCase()}
          </span>
        </div>
        {/* Name */}
        <p className="font-normal leading-[18px] relative shrink-0 text-[12px] text-[#171717] whitespace-nowrap">
          {name}
        </p>
      </div>
      {/* Remove */}
      <button
        onClick={onRemove}
        className="overflow-clip relative shrink-0 size-[16px] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3592f9] rounded-full"
        aria-label={`Remove ${email}`}
      >
        <div className="absolute" style={{ inset: "26.14% 26.13% 26.13% 26.14%" }}>
          <img alt="" aria-hidden="true" className="absolute block inset-0 max-w-none size-full" src={IMG_CHIP_CLOSE} />
        </div>
      </button>
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none rounded-[inherit]" style={{ boxShadow: SHADOW.chipInner }} />
    </motion.div>
  );
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
interface ShareModalProps {
  onClose?: () => void;
}

export function ShareModal({ onClose }: ShareModalProps) {
  const [stage, setStage]     = useState(0);
  const [toggled, setToggled] = useState(true);
  const [copied, setCopied]   = useState(false);
  const [emails, setEmails]   = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const copyBtnRef  = useRef<HTMLButtonElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const prefersReduced = useReducedMotion();

  function addEmail(raw: string) {
    const val = raw.trim().replace(/,$/, "");
    if (val && !emails.includes(val)) setEmails((p) => [...p, val]);
    setInputValue("");
  }

  function handleInvite() {
    // Commit any text still in the input
    const pending = inputValue.trim().replace(/,$/, "");
    const toInvite = [...emails, ...(pending ? [pending] : [])];
    if (toInvite.length === 0) return;
    setMembers((prev) => {
      const existing = new Set(prev.map((m) => m.email));
      const newOnes  = toInvite.filter((e) => !existing.has(e)).map((e) => ({ email: e }));
      return [...prev, ...newOnes];
    });
    setEmails([]);
    setInputValue("");
  }

  function handleEmailKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (inputValue.trim()) addEmail(inputValue);
    } else if (e.key === "Backspace" && inputValue === "" && emails.length > 0) {
      setEmails((p) => p.slice(0, -1));
    }
  }

  // ── Entrance stagger ──────────────────────────────────────────────────────
  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];
    t.push(setTimeout(() => setStage(1), TIMING.card));
    t.push(setTimeout(() => setStage(2), TIMING.header));
    t.push(setTimeout(() => setStage(3), TIMING.accessRow));
    t.push(setTimeout(() => setStage(4), TIMING.urlRow));
    return () => t.forEach(clearTimeout);
  }, []);

  // ── Copy handler ──────────────────────────────────────────────────────────
  function handleCopy() {
    if (copied) return;
    setCopied(true);
    fireBurst();
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), COPY_BTN.resetMs);
  }

  // ── GSAP particle burst ───────────────────────────────────────────────────
  function fireBurst() {
    const btn = copyBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (let i = 0; i < BURST.count; i++) {
      const dot = document.createElement("span");
      const angle = (i / BURST.count) * Math.PI * 2;
      Object.assign(dot.style, {
        position: "fixed", width: "6px", height: "6px",
        borderRadius: "50%", background: BURST.colors[i % BURST.colors.length],
        left: `${cx}px`, top: `${cy}px`,
        pointerEvents: "none", zIndex: "9999",
        transform: "translate(-50%,-50%)",
      });
      document.body.appendChild(dot);
      gsap.fromTo(dot, { x: 0, y: 0, opacity: 1, scale: 1 }, {
        x: Math.cos(angle) * BURST.radius,
        y: Math.sin(angle) * BURST.radius,
        opacity: 0, scale: 0,
        duration: BURST.duration, ease: "power2.out",
        onComplete: () => dot.remove(),
      });
    }
  }

  return (
    <div className="flex items-center justify-center">

      {/* ── Card ─────────────────────────────────────────────────────────── */}
      <motion.div
        className="relative w-[400px] rounded-[20px] bg-[#f7f7f7]"
        initial={prefersReduced ? false : { opacity: 0, y: CARD.initialY, scale: CARD.initialScale }}
        animate={{
          opacity: stage >= 1 ? 1 : 0,
          y:       stage >= 1 ? 0 : CARD.initialY,
          scale:   stage >= 1 ? 1 : CARD.initialScale,
        }}
        transition={CARD.spring}
      >

        {/* ── Filter section — grows naturally, no transform on parent ── */}
        <div
          className="relative rounded-[20px] flex flex-col gap-4 items-start w-full"
          style={{
            boxShadow: SHADOW.card,
            // The last visible section's inner pb-4 provides the 16px bottom space
            paddingBottom: (toggled && members.length === 0) ? 16 : 0,
            transition: "padding-bottom 0.2s cubic-bezier(0.215, 0.61, 0.355, 1)",
          }}
        >
          {/* White bg fill */}
          <div aria-hidden="true" className="absolute bg-white inset-0 pointer-events-none rounded-[20px]" />

          {/* ── Header ── */}
          <motion.div
            className="relative bg-white border-b border-[#ebebeb] px-4 py-4 flex items-center justify-between w-full rounded-t-[20px] overflow-hidden"
            initial={{ opacity: 0, y: ROW.offsetY }}
            animate={{ opacity: stage >= 2 ? 1 : 0, y: stage >= 2 ? 0 : ROW.offsetY }}
            transition={{ ...ROW.spring, delay: 0 }}
          >
            <span
              className="text-[16px] font-medium leading-[24px] text-[#5c5c5c] not-italic whitespace-nowrap"
              style={{ letterSpacing: "-0.011em", fontFeatureSettings: "'ss11' 1, 'calt' 0, 'liga' 0" }}
            >
              Share
            </span>
            <button
              onClick={onClose}
              className="relative overflow-clip shrink-0 size-[20px] cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Close share dialog"
            >
              <div className="absolute inset-[18%]">
                <img alt="" aria-hidden="true" className="absolute block inset-0 max-w-none size-full" src={IMG_CLOSE} />
              </div>
            </button>
          </motion.div>

          {/* ── Access row + Invite section (single flex item — avoids gap bleed) ── */}
          <div className="flex flex-col w-full">

            {/* Access row */}
            <motion.div
              className="relative px-4 w-full"
              initial={{ opacity: 0, y: ROW.offsetY }}
              animate={{ opacity: stage >= 3 ? 1 : 0, y: stage >= 3 ? 0 : ROW.offsetY }}
              transition={{ ...ROW.spring, delay: 0.04 }}
            >
              <div className="bg-[#f7f7f7] p-3 rounded-2xl flex items-center justify-between w-full">

                {/* Globe icon + text */}
                <div className="flex gap-2 items-center">
                  {/* Globe icon — 40×40px */}
                  <div
                    className="relative flex items-center justify-center p-2 rounded-[8px] shrink-0"
                    style={{
                      background: "linear-gradient(179.99deg, rgba(255,255,255,0.154) 6.67%, rgba(255,255,255,0) 103.33%), #0088fe",
                      boxShadow: SHADOW.globe,
                    }}
                  >
                    <div className="relative size-[24px]">
                      <div className="absolute flex items-center justify-center" style={{ inset: "8.33%" }}>
                        <img
                          alt="" aria-hidden="true"
                          className="block size-full"
                          style={{ transform: "scaleX(-1)" }}
                          src={IMG_GLOBE}
                        />
                      </div>
                    </div>
                    <div aria-hidden="true" className="absolute inset-0 pointer-events-none rounded-[inherit]" style={{ boxShadow: SHADOW.globeInner }} />
                  </div>

                  {/* "Anyone" + subtitle — w-[186px] per Figma */}
                  <div className="flex flex-col leading-[20px] not-italic w-[186px]">
                    <p className="font-medium text-[14px] text-[#171717]" style={{ letterSpacing: "-0.006em", fontFeatureSettings: "'calt' 0, 'liga' 0" }}>
                      Anyone
                    </p>
                    <p className="font-normal text-[13px] text-[#5c5c5c]" style={{ letterSpacing: "-0.006em", fontFeatureSettings: "'calt' 0, 'liga' 0" }}>
                      Every one with link can access
                    </p>
                  </div>
                </div>

                {/* Toggle — 40×20px, pill thumb 22×16px */}
                <button
                  role="switch"
                  aria-checked={toggled}
                  aria-label="Toggle public access"
                  onClick={() => setToggled((v) => !v)}
                  className="relative shrink-0 h-[20px] w-[40px] rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3592f9] focus-visible:ring-offset-2"
                  style={{
                    // Figma OFF track: #dadadb at opacity-80 = rgba(218,218,219,0.8)
                    background: toggled ? "#3592f9" : "rgba(218,218,219,0.8)",
                    transition: "background 0.22s ease",
                  }}
                >
                  <motion.span
                    className="absolute top-[2px] left-[2px] w-[22px] rounded-full"
                    style={{
                      height: "16px",
                      background: "white",
                      // Shadow differs between ON and OFF states
                      boxShadow: toggled ? SHADOW.toggleOn : SHADOW.toggleOff,
                      transition: "box-shadow 0.22s ease",
                    }}
                    animate={{ x: toggled ? TOGGLE.thumbTravel : 0 }}
                    transition={TOGGLE.spring}
                  />
                </button>
              </div>
            </motion.div>

            {/* ── Invite members section — height spring matches Calendar expand/close ── */}
            <AnimatePresence initial={false}>
            {!toggled && (
                <motion.div
                  key="invite"
                  className="overflow-hidden w-full"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{
                    height: 0,
                    opacity: 0,
                    transition: {
                      height:   { duration: 0.2, ease: [0.4, 0, 1, 1] },
                      opacity:  { duration: 0.1, ease: "easeIn" as const },
                    },
                  }}
                  transition={{
                    height:  SPRING_LAYOUT,
                    opacity: { duration: 0.22, ease: "easeOut" as const },
                  }}
                >
                  {/* Inner wrapper carries the padding so height measures correctly */}
                  <div className="relative px-4 pt-4 pb-4 flex flex-col gap-[4px] items-start w-full">

                    {/* Label */}
                    <div className="flex items-center gap-1 pr-2">
                      <p
                        className="font-medium text-[14px] leading-[1.43] text-[#18181b] whitespace-nowrap"
                        style={{ letterSpacing: "0", fontFeatureSettings: "'calt' 0, 'liga' 0" }}
                      >
                        Invite members
                      </p>
                    </div>

                    {/* Input + Button row */}
                    <div className="flex gap-2 items-start w-full">

                      {/* Input field — interactive, grows with chips */}
                      <div
                        className="relative flex flex-1 min-h-[36px] items-start px-3 py-2 rounded-[12px] overflow-clip border border-transparent cursor-text"
                        style={{ boxShadow: SHADOW.inputField }}
                        onClick={() => emailInputRef.current?.focus()}
                      >
                        {/* White bg fill */}
                        <div aria-hidden="true" className="absolute inset-0 bg-white rounded-[12px] pointer-events-none" />
                        {/* Content row */}
                        <div className="relative flex flex-1 items-start justify-between min-w-0 gap-2">
                          {/* Left: chips + text input */}
                          <div className="flex flex-wrap gap-[6px] items-center flex-1 min-w-0">
                            <AnimatePresence mode="popLayout" initial={false}>
                              {emails.map((e) => (
                                <EmailChip
                                  key={e}
                                  email={e}
                                  onRemove={() => setEmails((p) => p.filter((x) => x !== e))}
                                />
                              ))}
                            </AnimatePresence>
                            <input
                              ref={emailInputRef}
                              type="text"
                              value={inputValue}
                              onChange={(ev) => setInputValue(ev.target.value)}
                              onKeyDown={handleEmailKeyDown}
                              onBlur={() => { if (inputValue.trim()) addEmail(inputValue); }}
                              placeholder={emails.length === 0 ? "Enter email" : ""}
                              className="flex-1 min-w-[90px] h-[20px] text-[14px] font-normal leading-[20px] text-[#18181b] placeholder:text-[#71717a] bg-transparent outline-none border-none"
                              style={{ letterSpacing: "-0.006em" }}
                            />
                          </div>
                          {/* Right: Can view dropdown — stays top-aligned when field grows */}
                          <div className="flex gap-1 items-center shrink-0 h-[20px]">
                            <p className="font-normal text-[13px] leading-[20px] text-[#71717a] whitespace-nowrap">
                              Can view
                            </p>
                            <div className="relative overflow-clip shrink-0 size-[20px]">
                              <div className="absolute" style={{ inset: "35.83% 26.13% 35% 26.14%" }}>
                                <img alt="" aria-hidden="true" className="absolute block inset-0 max-w-none size-full" src={IMG_ARROW_DOWN} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Invite button */}
                      <motion.button
                        onClick={handleInvite}
                        whileTap={{ scale: 0.93 }}
                        transition={{ type: "spring", visualDuration: 0.25, bounce: 0.4 }}
                        className="relative flex h-[36px] items-center justify-center overflow-clip px-4 py-2 rounded-[8px] shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717] focus-visible:ring-offset-1"
                        style={{ boxShadow: SHADOW.inviteBtn }}
                      >
                        {/* Dark gradient bg */}
                        <div
                          aria-hidden="true"
                          className="absolute inset-0 pointer-events-none rounded-[8px]"
                          style={{
                            backgroundImage:
                              "linear-gradient(179.99deg, rgba(255,255,255,0.154) 6.67%, rgba(255,255,255,0) 103.33%), linear-gradient(90deg, #171717 0%, #171717 100%)",
                          }}
                        />
                        {/* "Invite" label */}
                        <span
                          className="relative font-medium text-[14px] leading-[20px] text-white whitespace-nowrap"
                          style={{ letterSpacing: "-0.006em", fontFeatureSettings: "'ss11' 1, 'calt' 0, 'liga' 0" }}
                        >
                          Invite
                        </span>
                        {/* Inner top highlight */}
                        <div aria-hidden="true" className="absolute inset-0 pointer-events-none rounded-[inherit]" style={{ boxShadow: SHADOW.inviteBtnInner }} />
                      </motion.button>
                    </div>

                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Members with access — springs open after first invite ── */}
          <AnimatePresence initial={false}>
            {members.length > 0 && (
              <motion.div
                key="members"
                className="overflow-hidden w-full"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{
                  height: 0,
                  opacity: 0,
                  transition: {
                    height:  { duration: 0.2, ease: [0.4, 0, 1, 1] },
                    opacity: { duration: 0.1, ease: "easeIn" as const },
                  },
                }}
                transition={{
                  height:  SPRING_LAYOUT,
                  opacity: { duration: 0.22, ease: "easeOut" as const },
                }}
              >
                <div className="relative px-4 pt-0 pb-4 flex flex-col gap-[8px] items-start w-full">
                  {/* Section label */}
                  <p
                    className="font-medium text-[14px] leading-[1.43] text-[#18181b] whitespace-nowrap"
                    style={{ letterSpacing: "0", fontFeatureSettings: "'calt' 0, 'liga' 0" }}
                  >
                    Members with access
                  </p>
                  {/* Member rows */}
                  <AnimatePresence mode="popLayout" initial={false}>
                    {members.map((m, i) => (
                      <MemberRow key={m.email} member={m} delay={i * 0.045} />
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filter section inner-bottom glow */}
          <div aria-hidden="true" className="absolute inset-0 pointer-events-none rounded-[inherit]" style={{ boxShadow: SHADOW.filterInner }} />
        </div>

        {/* ── URL / Items row ──────────────────────────────────────────────── */}
        <motion.div
          className="flex items-center justify-between overflow-clip px-4 py-4 w-full"
          initial={{ opacity: 0, y: ROW.offsetY }}
          animate={{ opacity: stage >= 4 ? 1 : 0, y: stage >= 4 ? 0 : ROW.offsetY }}
          transition={{ ...ROW.spring, delay: 0.06 }}
        >
          <span
            className="font-medium text-[14px] leading-[20px] text-[#5c5c5c] truncate not-italic"
            style={{ letterSpacing: "-0.006em", fontFeatureSettings: "'calt' 0, 'liga' 0" }}
          >
            Https://orevbajohn.me
          </span>

          {/* Copy link button */}
          <motion.button
            ref={copyBtnRef}
            onClick={handleCopy}
            whileTap={{ scale: COPY_BTN.pressScale }}
            transition={COPY_BTN.spring}
            className="relative overflow-hidden shrink-0 flex gap-1 items-center justify-center bg-white px-[6px] py-[6px] rounded-[8px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
            style={{ boxShadow: SHADOW.copyBtn }}
            aria-label="Copy link to clipboard"
          >
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.span
                  key="copied"
                  className="flex items-center gap-1 text-blue-600 px-1"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span
                    className="font-medium text-[14px] leading-[20px] whitespace-nowrap"
                    style={{ letterSpacing: "-0.006em", fontFeatureSettings: "'ss11' 1, 'calt' 0, 'liga' 0" }}
                  >
                    Copied!
                  </span>
                </motion.span>
              ) : (
                <motion.span
                  key="copy"
                  className="font-medium text-[14px] leading-[20px] text-[#5c5c5c] whitespace-nowrap px-1"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  style={{ letterSpacing: "-0.006em", fontFeatureSettings: "'ss11' 1, 'calt' 0, 'liga' 0" }}
                >
                  Copy link
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </motion.div>

      </motion.div>
    </div>
  );
}
