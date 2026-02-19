/**
 * ============================================================================
 * SITE CONFIGURATION — Vidzee
 * ============================================================================
 */

export const siteConfig = {
  name: "Vidzee",
  tagline: "Turn Listing Photos into Cinematic Videos",
  description:
    "Upload your listing photos and let AI create stunning cinematic property videos in minutes — ready for Reels, TikTok, YouTube, and MLS.",
  url: "https://vidzee.vercel.app",
  twitter: "@vidzee",
  nav: {
    cta: {
      text: "Get Started Free",
      href: "/signup",
    },
    signIn: {
      text: "Sign in",
      href: "/login",
    },
  },
};

export const heroConfig = {
  badge: "Now in Beta",
  headline: {
    line1: "Turn Listing Photos",
    line2: "into Cinematic",
    accent: "Videos",
  },
  subheadline:
    "Upload 10-30 property photos and get polished, branded videos for Reels, TikTok, YouTube, and MLS — in minutes, not days.",
  cta: {
    text: "Create Your First Video",
    href: "/signup",
  },
};

export const blurHeadlineConfig = {
  text: "Top-producing agents use Vidzee to turn every listing into scroll-stopping video content, combining AI storyboarding with cinematic motion to create branded property tours that generate more views, more leads, and faster sales.",
};

export const testimonialsConfig = {
  title: "Loved by top-producing agents",
  autoplayInterval: 10000,
};

export const howItWorksConfig = {
  title: "How it works",
  description:
    "Three simple steps to transform your listing photos into professional cinematic videos.",
  cta: {
    text: "Create Your First Video",
    href: "/signup",
  },
};

export const pricingConfig = {
  title: "Simple, transparent pricing",
  description:
    "Start free. Upgrade when you need more videos. Cancel anytime.",
  billingNote: "Billed monthly",
};

export const faqConfig = {
  title: "Everything you need to know",
  description: "Can't find the answer you're looking for? Reach out!",
  cta: {
    primary: {
      text: "Get Started Free",
      href: "/signup",
    },
    secondary: {
      text: "Contact Support",
      href: "mailto:support@vidzee.app",
    },
  },
};

export const footerConfig = {
  cta: {
    headline: "Start creating cinematic listing videos today",
    placeholder: "Enter your email",
    button: "Get Early Access",
  },
  copyright: `© ${new Date().getFullYear()} Vidzee. All rights reserved.`,
};

export const features = {
  smoothScroll: true,
  testimonialAutoplay: true,
  parallaxHero: true,
  blurInHeadline: true,
};

export const themeConfig = {
  defaultTheme: "system" as "light" | "dark" | "system",
  enableSystemTheme: true,
};
