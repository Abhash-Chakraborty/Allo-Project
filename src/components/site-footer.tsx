import clsx from "clsx";

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={clsx("w-full border-t border-hairline-light bg-canvas-cream", className)}>
      <div className="mx-auto max-w-[1440px] px-6 py-8 flex items-center justify-center">
        <p className="text-caption text-shade-50">
          © {new Date().getFullYear()} Abhash Chakraborty. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
