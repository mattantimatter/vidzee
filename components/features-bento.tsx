"use client";

import { motion, type Transition } from "motion/react";
import { Brain, Film, Palette, MonitorSmartphone } from "lucide-react";
import type { ReactNode } from "react";

const EASE = [0.23, 1, 0.32, 1] as const;

const cardAnimation = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
};

const getCardTransition = (delay = 0): Transition => ({
  duration: 0.8,
  ease: EASE,
  delay,
});

function AIStoryboardCard(): ReactNode {
  return (
    <motion.div
      {...cardAnimation}
      transition={getCardTransition(0)}
      className="group bg-card-primary rounded-4xl p-8 pb-0 overflow-hidden min-h-140 md:row-span-2 flex flex-col"
    >
      <div className="relative z-10 text-center mb-6 transition-transform duration-500 ease-out group-hover:scale-105">
        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-5">
          <Brain className="w-7 h-7 text-white" />
        </div>
        {/* White text on the cyan card-primary background */}
        <h3 className="text-2xl md:text-4xl font-medium text-white leading-tight mb-3">
          AI-Powered Storyboarding
        </h3>
        <p className="text-white/80 text-sm max-w-xs mx-auto">
          Our AI detects room types, orders scenes logically, and picks the best
          shots — creating a professional storyboard in seconds.
        </p>
      </div>

      <div className="flex-1 flex justify-center items-end transition-transform duration-500 ease-out group-hover:scale-[1.02]">
        <div className="relative bg-white/90 rounded-t-3xl border-6 border-b-0 border-neutral-800 w-56 md:w-64 h-96 md:h-115 overflow-hidden">
          <div className="absolute left-1/2 -translate-x-1/2 top-2 w-20 h-5 bg-neutral-800 rounded-full z-10" />
          <div className="absolute inset-0 bg-neutral-50 pt-14 px-5">
            <h4 className="text-lg font-medium text-neutral-900 mb-1">Storyboard</h4>
            <p className="text-xs text-neutral-500 mb-4">AI-generated scene order</p>
            {["Living Room", "Kitchen", "Primary Suite", "Backyard", "Aerial"].map((room, i) => (
              <div
                key={room}
                className="flex items-center gap-3 py-2.5 border-b border-neutral-100 last:border-0"
              >
                <span className="text-xs font-mono text-neutral-400 w-5">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="w-8 h-6 rounded bg-accent/20" />
                <span className="text-sm text-neutral-700">{room}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CinematicVideoCard(): ReactNode {
  return (
    <motion.div
      {...cardAnimation}
      transition={getCardTransition(0.1)}
      className="group bg-card-secondary rounded-4xl p-8 overflow-hidden min-h-80 relative flex flex-col"
    >
      <div className="relative z-10 max-w-64 transition-transform duration-500 ease-out group-hover:scale-105">
        <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center mb-4">
          <Film className="w-6 h-6 text-accent" />
        </div>
        <h3 className="text-xl md:text-2xl font-medium text-card-foreground leading-tight mb-3">
          Cinematic Video Generation
        </h3>
        <p className="text-card-foreground-muted text-sm">
          Powered by Kling AI, each scene gets professional camera motions —
          smooth push-ins, elegant pans, and dramatic reveals that bring
          listings to life.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 transition-transform duration-500 ease-out group-hover:scale-[1.02]">
        {["Push In", "Pan Left", "Pan Right", "Tilt Up", "Tilt Down"].map((motion) => (
          <span
            key={motion}
            className="bg-background rounded-full px-3 py-1.5 text-xs font-medium text-foreground"
          >
            {motion}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

function StylePacksCard(): ReactNode {
  const packs = [
    { name: "Modern Clean", desc: "Minimal, elegant transitions", color: "bg-sky-400" },
    { name: "Luxury Classic", desc: "Rich, cinematic feel", color: "bg-amber-400" },
    { name: "Bold Dynamic", desc: "Energetic, fast-paced", color: "bg-rose-400" },
  ];

  return (
    <motion.div
      {...cardAnimation}
      transition={getCardTransition(0.2)}
      className="group bg-card-secondary rounded-4xl p-6 md:p-8 flex flex-col min-h-64"
    >
      <div className="mb-4 transition-transform duration-500 ease-out group-hover:scale-105">
        <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center mb-4">
          <Palette className="w-6 h-6 text-accent" />
        </div>
        <h3 className="text-xl md:text-2xl font-medium text-card-foreground leading-tight mb-1">
          3 Style Packs
        </h3>
        <p className="text-card-foreground-muted text-sm">
          Curated looks for every listing type
        </p>
      </div>

      <div className="flex flex-col gap-2 mt-auto transition-transform duration-500 ease-out group-hover:scale-[1.02]">
        {packs.map((pack) => (
          <div
            key={pack.name}
            className="flex items-center gap-3 bg-background rounded-xl p-3"
          >
            <span className={`w-3 h-3 rounded-full ${pack.color}`} />
            <div>
              <span className="text-sm font-medium text-foreground">{pack.name}</span>
              <span className="block text-xs text-muted-foreground">{pack.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function MultiFormatCard(): ReactNode {
  return (
    <motion.div
      {...cardAnimation}
      transition={getCardTransition(0.3)}
      className="group bg-card-secondary rounded-4xl p-6 md:p-8 flex flex-col items-center justify-center text-center min-h-64"
    >
      <div className="transition-transform duration-500 ease-out group-hover:scale-110">
        <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center mx-auto mb-4">
          <MonitorSmartphone className="w-6 h-6 text-accent" />
        </div>
        <h3 className="text-xl md:text-2xl font-medium text-card-foreground leading-tight mb-2">
          Multi-Format Export
        </h3>
      </div>

      <p className="text-card-foreground-muted text-sm mb-5 transition-transform duration-500 ease-out group-hover:scale-105">
        Every video exports in two formats, ready to post everywhere.
      </p>

      <div className="flex items-center gap-4 transition-transform duration-500 ease-out group-hover:scale-105">
        <div className="flex flex-col items-center">
          <div className="w-10 h-16 rounded-lg border-2 border-accent/60 flex items-center justify-center text-xs font-mono text-accent">
            9:16
          </div>
          <span className="text-xs text-muted-foreground mt-1.5">Reels / TikTok</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-20 h-12 rounded-lg border-2 border-accent/60 flex items-center justify-center text-xs font-mono text-accent">
            16:9
          </div>
          <span className="text-xs text-muted-foreground mt-1.5">YouTube / MLS</span>
        </div>
      </div>
    </motion.div>
  );
}

export function FeaturesBento(): ReactNode {
  return (
    <section className="w-full px-6 mb-32 bg-background">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-12 text-center"
        >
          <span className="text-sm font-medium text-muted-foreground">
            Features
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Everything you need to create listing videos
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-4">
          <AIStoryboardCard />
          <CinematicVideoCard />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MultiFormatCard />
            <StylePacksCard />
          </div>
        </div>
      </div>
    </section>
  );
}
