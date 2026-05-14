import Link from "next/link";
import { Building2, MapPinned, MessageSquareText, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "./nav.module.css";

const links = [
  { href: "/search", label: "Search", icon: MapPinned },
  { href: "/assistant", label: "Assistant", icon: MessageSquareText },
  { href: "/compare", label: "Compare", icon: Scale }
];

export function Nav() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark}>
            <Building2 size={18} />
          </span>
          Relocation AI
        </Link>
        <nav className={styles.links}>
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
