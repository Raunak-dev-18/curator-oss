"use client";

import { ChevronDown, HelpCircle } from "lucide-react";
import { useState } from "react";

const FAQ_ITEMS = [
  {
    question: "How does Cognix execute and run my generated full-stack code?",
    answer:
      "Cognix spins up a secure, isolated Linux container via Daytona for every project. The container runs a real Node.js runtime with Next.js App Router, manages an active file system, compiles TypeScript, and exposes a live local development server that is tunneled directly to your browser preview.",
  },
  {
    question: "Can I export the full source code and run it locally?",
    answer:
      "Yes! You have 100% ownership of everything created in Cognix with zero vendor lock-in. You can download the complete project as a standard Next.js application repository, complete with package.json, Tailwind config, Drizzle ORM schemas, and API routes, and run `npm run dev` on your own machine or deploy to Vercel/AWS.",
  },
  {
    question: "How does the Visual Click-to-Edit feature work?",
    answer:
      "Cognix injects a lightweight, bidirectional inspection bridge into your preview iframe. When you enable visual edit mode and click any button, card, or navigation element, Cognix extracts its DOM selector, React component hierarchy, and file path, automatically injecting this context into your next prompt.",
  },
  {
    question: "How does database persistence work with Neon PostgreSQL?",
    answer:
      "Every project connects directly to a serverless Neon PostgreSQL database. Cognix uses Drizzle ORM to define type-safe database schemas and automatically applies schema migrations (`drizzle-kit push`). Your data persists across reloads, edits, and live user interactions.",
  },
  {
    question: "Is my code and uploaded data secure and private?",
    answer:
      "Yes. Accounts and authentication are secured through Auth0 zero-trust identity. Project files, attachments, and database connections are completely private to your account. Daytona sandboxes are strictly isolated and never share memory, processes, or storage with other users.",
  },
  {
    question: "Can I publish my application to a live public URL?",
    answer:
      "Yes! Cognix offers one-click publishing. You can assign a custom subdomain (e.g. `your-app.cognix.app`) and publish your app instantly with global edge routing and SSL certificates.",
  },
];

export function LandingFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="landing-faq-section" id="faq">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="landing-section-badge">
            <HelpCircle className="size-3.5 text-indigo-400" />
            <span>Developer FAQ</span>
          </div>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-[-0.035em] text-white">
            Frequently asked questions.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-white/60">
            Everything you need to know about Daytona sandboxes, code export, and database persistence.
          </p>
        </div>

        {/* FAQ List */}
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="landing-faq-item"
              >
                <button
                  type="button"
                  className="landing-faq-question"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${idx}`}
                >
                  <span className="font-medium text-white">{item.question}</span>
                  <ChevronDown
                    className={`size-4 text-white/40 transition-transform duration-200 shrink-0 ${
                      isOpen ? "rotate-180 text-indigo-400" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div id={`faq-answer-${idx}`} className="landing-faq-answer" role="region">
                    <p className="text-sm text-white/65 leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
