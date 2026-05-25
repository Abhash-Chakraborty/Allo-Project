"use client";

import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";

function AlloLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
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
      <path d="M26 22 L31 6 L36 22 M27.5 16 H34.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M40 6 L40 22 L46 22" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M50 6 L50 22 L56 22" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
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

const NAV_LINKS = [
  { href: "/products", label: "Products" },
  { href: "/docs", label: "Docs" },
  { href: "/guide", label: "Guide" },
  { href: "/resume", label: "Resume" },
];

export function SiteHeader({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <header className={clsx("w-full bg-canvas-night text-on-primary", className)}>
      <div className="mx-auto max-w-[1440px] flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="flex items-center" aria-label="Allo home">
          <AlloLogo className="h-7 w-24 text-on-primary" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8 text-body-md">
          {NAV_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="text-link-cool-3 hover:text-on-primary transition-colors">
              {label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/Abhash-Chakraborty/Allo-Project"
            target="_blank"
            rel="noopener noreferrer"
            className="pill pill-outline-dark flex items-center gap-2 text-body-md"
          >
            <GitHubIcon className="h-4 w-4" />
            <span className="hidden sm:inline">GitHub</span>
          </a>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden flex flex-col justify-center items-center w-9 h-9 gap-[5px]"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            <span className={clsx("block w-5 h-[2px] bg-on-primary rounded transition-transform duration-200", open && "translate-y-[7px] rotate-45")} />
            <span className={clsx("block w-5 h-[2px] bg-on-primary rounded transition-opacity duration-200", open && "opacity-0")} />
            <span className={clsx("block w-5 h-[2px] bg-on-primary rounded transition-transform duration-200", open && "-translate-y-[7px] -rotate-45")} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="md:hidden fixed inset-0 top-[60px] z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      <div
        className={clsx(
          "md:hidden overflow-hidden transition-[max-height] duration-300 ease-in-out relative z-50",
          open ? "max-h-64" : "max-h-0"
        )}
      >
        <nav className="flex flex-col px-6 pb-6 gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="text-link-cool-3 hover:text-on-primary transition-colors py-3 border-b border-white/10 text-body-md"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
