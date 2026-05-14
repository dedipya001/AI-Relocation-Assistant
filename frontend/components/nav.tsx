import Link from "next/link";
import { Building2, MapPinned, MessageSquareText, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/search", label: "Search", icon: MapPinned },
  { href: "/assistant", label: "Assistant", icon: MessageSquareText },
  { href: "/compare", label: "Compare", icon: Scale }
];

export function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/88 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
            <Building2 size={18} />
          </span>
          Relocation AI
        </Link>
        <nav className="hidden items-center gap-2 md:flex">
          {links.map((link) => (
            <Button key={link.href} asChild variant="ghost" size="sm">
              <Link href={link.href}>
                <link.icon size={16} />
                {link.label}
              </Link>
            </Button>
          ))}
        </nav>
      </div>
    </header>
  );
}
