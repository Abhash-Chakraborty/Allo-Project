import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Docs" };
export const revalidate = 3600; // re-fetch from GitHub every hour

const README_URL =
  "https://raw.githubusercontent.com/Abhash-Chakraborty/Allo-Project/main/README.md";

async function fetchReadme(): Promise<string> {
  try {
    const res = await fetch(README_URL, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.text();
  } catch {
    // fallback to local README
    const fs = await import("fs");
    const path = await import("path");
    const local = path.join(process.cwd(), "README.md");
    return fs.existsSync(local) ? fs.readFileSync(local, "utf-8") : "# README not found";
  }
}

export default async function DocsPage() {
  const content = await fetchReadme();

  return (
    <>
      <SiteHeader />
      <main id="main" className="bg-canvas-cream flex-1">
        {/* Hero band */}
        <div className="bg-canvas-night text-on-primary">
          <div className="mx-auto max-w-[860px] px-6 py-12">
            <p className="text-eyebrow-cap text-link-cool-3 mb-4 uppercase tracking-widest">Documentation</p>
            <h1 className="text-display-md">Allo — Project Docs</h1>
            <p className="text-body-lg text-link-cool-3 mt-4 max-w-xl">
              Architecture, API reference, concurrency model, and setup guide.
              Source on{" "}
              <a
                href="https://github.com/Abhash-Chakraborty/Allo-Project"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-on-primary"
              >
                GitHub
              </a>
              .
            </p>
          </div>
        </div>

        {/* README content */}
        <div className="mx-auto max-w-[860px] px-6 py-12 md:py-16">
          <div className="prose-allo">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
