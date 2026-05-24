import Link from "next/link";

interface Crumb { label: string; href?: string }

export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-caption text-link-cool-3 mb-6">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden="true" className="opacity-40">/</span>}
          {c.href ? (
            <Link href={c.href} className="hover:text-on-primary transition-colors">
              {c.label}
            </Link>
          ) : (
            <span className="text-on-primary">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
