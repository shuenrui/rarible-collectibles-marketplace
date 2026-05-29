"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Step = 0 | 1 | 2;

const fandomChoices = [
  { id: "pokemon", label: "Pokemon" },
  { id: "sports_cards", label: "Sports Cards" },
  { id: "one_piece", label: "One Piece" },
  { id: "yugioh", label: "Yu-Gi-Oh" },
  { id: "comics", label: "Comics" },
  { id: "sealed_products", label: "Sealed Products" },
];

const gradeChoices = ["PSA 10", "PSA 9", "Raw / Ungraded", "CGC", "BGS", "Anything Valuable"];

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(0);
  const [fandom, setFandom] = useState<string>("pokemon");
  const [grade, setGrade] = useState<string>("PSA 10");

  const stepTitle = useMemo(() => {
    if (step === 0) return "WHAT KIND OF COLLECTOR ARE YOU?";
    if (step === 1) return "WHAT DO YOU CHASE MOST?";
    return "YOU'RE READY";
  }, [step]);

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="border-b-[3px] border-black bg-[#FEDB02] px-4 py-3 md:px-8">
        <div className="mx-auto flex w-full max-w-[980px] items-center justify-between">
          <Link href="/" className="font-black tracking-tight text-black md:text-lg">
            RARIBLE COLLECTIBLES
          </Link>
          <div className="font-mono text-[10px] font-bold tracking-[0.2em] text-black">ONBOARDING</div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[980px] px-4 py-12 md:px-8">
        <div className="mb-10">
          <p className="font-mono text-[10px] font-bold tracking-[0.2em] text-[#FEDB02]">STEP {step + 1} / 3</p>
          <h1 className="mt-3 text-4xl font-black leading-tight md:text-6xl">{stepTitle}</h1>
        </div>

        {step === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fandomChoices.map((c) => (
              <button
                key={c.id}
                onClick={() => setFandom(c.id)}
                className={`border-2 p-5 text-left transition ${
                  fandom === c.id
                    ? "border-[#FEDB02] bg-[#FEDB02] text-black"
                    : "border-white/25 bg-black/25 text-white hover:border-[#FEDB02]/70"
                }`}
              >
                <p className="text-2xl font-black">{c.label}</p>
              </button>
            ))}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gradeChoices.map((g) => (
              <button
                key={g}
                onClick={() => setGrade(g)}
                className={`border-2 p-5 text-left transition ${
                  grade === g
                    ? "border-[#FEDB02] bg-[#FEDB02] text-black"
                    : "border-white/25 bg-black/25 text-white hover:border-[#FEDB02]/70"
                }`}
              >
                <p className="text-xl font-black">{g}</p>
              </button>
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="border-2 border-[#FEDB02] bg-[#111] p-7">
            <p className="font-mono text-[10px] font-bold tracking-[0.2em] text-[#FEDB02]">PROFILE SUMMARY</p>
            <h2 className="mt-3 text-3xl font-black">Collectors Mode Configured</h2>
            <p className="mt-3 text-white/75">
              Fandom focus: <span className="font-bold text-white">{fandom.replace(/_/g, " ")}</span>
            </p>
            <p className="text-white/75">
              Preferred condition: <span className="font-bold text-white">{grade}</span>
            </p>
            <p className="mt-5 text-sm text-white/60">You can change preferences later in Vault settings.</p>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          {step > 0 ? (
            <button
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="border-2 border-white/35 px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.2em]"
            >
              Back
            </button>
          ) : null}

          {step < 2 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as Step)}
              className="border-2 border-[#FEDB02] bg-[#FEDB02] px-5 py-3 font-mono text-xs font-black uppercase tracking-[0.2em] text-black"
            >
              Continue
            </button>
          ) : (
            <Link
              href="/collectibles"
              className="border-2 border-[#FEDB02] bg-[#FEDB02] px-5 py-3 font-mono text-xs font-black uppercase tracking-[0.2em] text-black"
            >
              Go To Marketplace
            </Link>
          )}

          <Link
            href="/"
            className="border-2 border-white/35 px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.2em] text-white"
          >
            Skip
          </Link>
        </div>
      </section>
    </main>
  );
}
