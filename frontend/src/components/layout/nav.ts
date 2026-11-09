import {
  Activity,
  Bot,
  Film,
  Inbox,
  LayoutDashboard,
  Plug,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  /** Short label used in the compact mobile bar. */
  shortLabel: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard, shortLabel: "Home" }],
  },
  {
    label: "Workspace",
    items: [
      { href: "/inbox", label: "Instagram Inbox", icon: Inbox, badge: 6, shortLabel: "Inbox" },
      { href: "/reels", label: "Reel Intelligence", icon: Film, badge: 2, shortLabel: "Reels" },
      { href: "/activity", label: "Activity History", icon: Activity, shortLabel: "Activity" },
    ],
  },
  {
    label: "Configure",
    items: [
      { href: "/assistant", label: "AI Assistant", icon: Bot, shortLabel: "Assistant" },
      { href: "/connection", label: "Instagram Connection", icon: Plug, shortLabel: "Connect" },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
