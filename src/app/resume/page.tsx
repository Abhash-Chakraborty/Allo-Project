import Link from "next/link";

export const metadata = { title: "Resume · Abhash Chakraborty" };

export default function ResumePage() {
  return (
    <>
      <style>{`html, body { overflow: hidden; height: 100%; }`}</style>

      <div className="flex flex-col" style={{ height: "100vh" }}>
        {/* Minimal header */}
        <header className="flex-shrink-0 bg-canvas-night text-on-primary flex items-center justify-between px-6 h-14 border-b border-white/10">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3" aria-label="Allo home">
            <svg viewBox="0 0 80 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-20 text-on-primary" aria-hidden="true">
              <path d="M4 20 L12 14 L4 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 20 L18 14 L10 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.45"/>
              <path d="M26 22 L31 6 L36 22 M27.5 16 H34.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M40 6 L40 22 L46 22" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M50 6 L50 22 L56 22" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="60" y="10" width="12" height="12" rx="6" stroke="currentColor" strokeWidth="1.4"/>
            </svg>
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-caption text-link-cool-3">
              <span className="opacity-40">/</span>
              <span className="text-on-primary">Resume</span>
            </nav>
          </Link>

          {/* GitHub */}
          <a
            href="https://github.com/Abhash-Chakraborty/Allo-Project"
            target="_blank"
            rel="noopener noreferrer"
            className="pill pill-outline-dark flex items-center gap-2 text-body-md h-1"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
            </svg>
            GitHub
          </a>
        </header>

        {/* PDF fills remaining height */}
        <div className="flex-1 relative" style={{ overflow: "hidden" }}>
          <iframe
            src="/resume.pdf#toolbar=0&navpanes=0&scrollbar=1"
            style={{ display: "block", width: "100%", height: "100%", border: "none" }}
            title="Abhash Chakraborty Resume"
          />

          {/* Floating download */}
          <a
            href="/resume.pdf"
            download="Abhash_Chakraborty_Resume.pdf"
            className="absolute bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-canvas-night text-on-primary px-5 py-3 text-body-md shadow-elevation-4 hover:bg-shade-70 transition-colors"
          >
            <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download PDF
          </a>
        </div>
      </div>
    </>
  );
}
