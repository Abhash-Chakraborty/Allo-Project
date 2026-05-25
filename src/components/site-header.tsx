"use client";

// Site header component
import Link from "next/link";
import clsx from "clsx";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

function AlloLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Arrow mark — right-pointing chevron */}
      <path
        d="M4 20 L12 14 L4 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 20 L18 14 L10 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.45"
      />
      {/* ALLO wordmark */}
      {/* A */}
      <path d="M26 22 L31 6 L36 22 M27.5 16 H34.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      {/* L */}
      <path d="M40 6 L40 22 L46 22" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      {/* L */}
      <path d="M50 6 L50 22 L56 22" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      {/* O */}
      <rect x="60" y="10" width="12" height="12" rx="6" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  );
}

export function SiteHeader({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <header className={clsx("w-full bg-canvas-night text-on-primary", className)}>
      <div className="mx-auto max-w-[1440px] flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="flex items-center" aria-label="Allo home">
          <AlloLogo className="h-7 w-24 text-on-primary" />
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-8 text-body-md">
          <Link href="/products" className="nav-link">
            Products
          </Link>
          <Link href="/docs" className="nav-link">
            Docs
          </Link>
          <Link href="/guide" className="nav-link">
            Guide
          </Link>
          <Link href="/resume" className="nav-link">
            Resume
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {/* GitHub CTA — desktop only; the mobile drawer keeps the bar uncluttered */}
          <a
            href="https://github.com/Abhash-Chakraborty/Allo-Project"
            target="_blank"
            rel="noopener noreferrer"
            className="pill pill-outline-dark site-header-github hidden md:inline-flex items-center gap-2 text-body-md"
          >
            <GitHubIcon className="h-4 w-4" />
            GitHub
          </a>

          <button
            type="button"
            className="site-header-menu-button md:hidden inline-flex h-11 w-11 items-center justify-center rounded-pill border border-on-primary text-on-primary transition-colors duration-200 hover:bg-on-primary hover:text-ink"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={open ? "close" : "menu"}
                initial={{ opacity: 0, rotate: -12, scale: 0.92 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 12, scale: 0.92 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
              >
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            className="md:hidden overflow-hidden border-t border-hairline-dark bg-canvas-night"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
          >
            <nav className="mx-auto flex max-w-[1440px] flex-col gap-1 px-6 py-4 text-body-md">
              {[
                { href: "/products", label: "Products" },
                { href: "/docs", label: "Docs" },
                { href: "/guide", label: "Guide" },
                { href: "/resume", label: "Resume" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-md px-1 py-3 text-link-cool-3 transition-colors duration-150 hover:text-on-primary"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
