"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

const testimonials = [
  {
    name: "Sarah Chen",
    title: "Top Producer, Compass",
    quote:
      "Vidzee cut my listing video turnaround from 3 days to 5 minutes. My sellers are blown away by the quality, and I've seen a noticeable uptick in engagement on my Reels.",
  },
  {
    name: "Marcus Rivera",
    title: "Broker, RE/MAX Elite",
    quote:
      "We rolled Vidzee out to our entire office of 40 agents. The consistency in branding across all our listing videos has been a game-changer for our team's social presence.",
  },
  {
    name: "Jennifer Park",
    title: "Luxury Agent, Sotheby's",
    quote:
      "The AI storyboarding is incredibly smart — it always picks the hero shots and orders scenes in a way that tells a compelling story. My luxury clients love the cinematic feel.",
  },
  {
    name: "David Thompson",
    title: "Team Lead, Keller Williams",
    quote:
      "I used to spend $200–$500 per listing video with a videographer. Vidzee gives me comparable quality for a fraction of the cost, and I can create videos on my own schedule.",
  },
  {
    name: "Rachel Goldstein",
    title: "Agent, Coldwell Banker",
    quote:
      "The dual-format export is genius. I post the vertical version on TikTok and Reels, and the horizontal version goes straight to MLS and YouTube. One upload, two videos.",
  },
  {
    name: "Michael Okafor",
    title: "New Agent, eXp Realty",
    quote:
      "As a new agent, I couldn't afford professional videography for every listing. Vidzee levels the playing field — my listing videos look just as polished as the top producers in my market.",
  },
];

const ease = [0.23, 1, 0.32, 1] as const;

function TestimonialCard({
  testimonial,
  index,
}: {
  testimonial: (typeof testimonials)[0];
  index: number;
}): ReactNode {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, ease, delay: index * 0.08 }}
      className="rounded-2xl bg-frame border border-border p-6"
    >
      <p className="text-sm leading-relaxed text-foreground/80 mb-5">
        &ldquo;{testimonial.quote}&rdquo;
      </p>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-sm font-semibold text-accent">
          {testimonial.name.split(" ").map(n => n[0]).join("")}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            {testimonial.name}
          </p>
          <p className="text-xs text-muted-foreground">{testimonial.title}</p>
        </div>
      </div>
    </motion.div>
  );
}

export function Testimonials(): ReactNode {
  return (
    <section className="w-full px-6 py-20 sm:py-28 bg-background">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease }}
          className="mb-12 text-center sm:mb-16"
        >
          <span className="text-sm font-medium text-muted-foreground">
            Testimonials
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Loved by agents everywhere
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Join thousands of real estate professionals creating stunning listing
            videos with Vidzee.
          </p>
        </motion.div>

        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
          {testimonials.map((testimonial, index) => (
            <div key={testimonial.name} className="break-inside-avoid">
              <TestimonialCard testimonial={testimonial} index={index} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
