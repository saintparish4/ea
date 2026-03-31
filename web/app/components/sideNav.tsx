"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/accounts", label: "Accounts" },
  { href: "/send", label: "Send" },
  { href: "/plugins", label: "Plugins" },
  { href: "/audit", label: "Audit Log" },
] as const;

export function SideNav() {
  const pathname = usePathname();

  return (
    <nav className="w-56 shrink-0 border-r border-gray-200 bg-white px-4 py-6 flex flex-col gap-1">
      <span className="mb-6 px-2 text-lg font-semibold tracking-tight text-brand-700">
        Ea Wallet
      </span>
      {NAV_ITEMS.map(({ href, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={[
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-brand-50 text-brand-700"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
            ].join(" ")}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
