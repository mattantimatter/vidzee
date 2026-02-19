"use client";

import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

const faqs = [
  {
    question: "What types of photos work best?",
    answer:
      "Standard listing photos from any camera or smartphone work great — JPG, PNG, or WebP format. We recommend 10–30 well-lit interior and exterior shots. Photos taken by professional real estate photographers tend to produce the best results, but even phone photos create impressive videos.",
  },
  {
    question: "How long does video generation take?",
    answer:
      "Most videos are ready in 3–5 minutes. Our AI storyboard generates instantly, and each scene clip takes about 10–15 seconds to render. Priority rendering on Pro and Business plans cuts wait times in half.",
  },
  {
    question: "Can I customize the style and music?",
    answer:
      "Absolutely! Choose from 3 curated style packs — Modern Clean, Luxury Classic, and Bold Dynamic — each with unique transitions, typography, and color grading. Pro and Business plans include access to our full music library and custom branding options.",
  },
  {
    question: "What video formats are supported?",
    answer:
      "Every project exports in two formats: vertical 9:16 (optimized for Instagram Reels, TikTok, and Stories) and horizontal 16:9 (perfect for YouTube, MLS listings, and websites). Both are high-quality MP4 files ready to upload anywhere.",
  },
  {
    question: "Do I need to be a video editor?",
    answer:
      "Not at all! Vidzee is designed for real estate agents, not video editors. Just upload your photos, review the AI-generated storyboard, and export. The entire process takes minutes with zero editing skills required.",
  },
  {
    question: "Can I add my brokerage branding?",
    answer:
      "Yes! Business plan users can upload their brokerage logo, customize colors, and add agent contact information as overlays. Your videos will look professionally branded and consistent across all listings.",
  },
];

const ease = [0.23, 1, 0.32, 1] as const;

function FAQItem({
  faq,
  index,
  isOpen,
  onToggle,
}: {
  faq: (typeof faqs)[0];
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}): ReactNode {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, ease, delay: index * 0.05 }}
      onClick={onToggle}
      className="cursor-pointer rounded-2xl bg-frame p-5 shadow-sm sm:p-6"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      aria-expanded={isOpen}
    >
      <div className="flex w-full items-center justify-between gap-4 text-left">
        <span className="text-base font-medium text-foreground sm:text-lg">
          {faq.question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease }}
          className="shrink-0"
        >
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        </motion.div>
      </div>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease }}
            className="overflow-hidden"
          >
            <p className="pt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {faq.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function FAQ(): ReactNode {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="w-full px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease }}
          className="mb-12 text-center sm:mb-16"
        >
          <span className="text-sm font-medium text-muted-foreground">
            Frequently Asked Questions
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Everything you need to know
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Can&apos;t find the answer you&apos;re looking for? Reach out to our support team.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup">
              <motion.span
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center rounded-xl bg-foreground px-6 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
              >
                Get Started Free
              </motion.span>
            </Link>
            <a href="mailto:support@vidzee.app">
              <motion.span
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center rounded-xl border border-border bg-frame px-6 py-2.5 text-sm font-semibold text-foreground transition-colors"
              >
                Contact Support
              </motion.span>
            </a>
          </div>
        </motion.div>

        <div className="flex flex-col gap-3" role="list">
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              faq={faq}
              index={index}
              isOpen={openIndex === index}
              onToggle={() => handleToggle(index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
