"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UltraWordmark } from "@/components/brand/UltraWordmark";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  FileText,
  LogOut,
  Megaphone,
  BarChart3,
  GitBranch,
  Settings,
  ArrowLeftRight,
  ChevronDown,
  List,
  MapPin,
  Zap,
  Palette,
  UserCheck,
  Smartphone,
  PanelLeftClose,
  PanelLeftOpen,
  UserCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { usePermissions } from "@/hooks/usePermissions";
import { roleLabel } from "@/lib/roles";
import { UserAvatar } from "@/components/users/UserAvatar";
import type { Permission } from "@/lib/permissions";
import type { UltraMode } from "@/lib/ultra-mode";

const SIDEBAR_COLLAPSED_KEY = "ultra-sidebar-collapsed";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: Permission;
};

const mainNavItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
  { href: "/conversations", label: "Conversas", icon: MessageSquare },
  { href: "/contacts", label: "Contatos", icon: Users, permission: "contacts.read" },
  { href: "/templates", label: "Templates", icon: FileText, permission: "templates.manage" },
  { href: "/campaigns", label: "Campanhas", icon: Megaphone, permission: "campaigns.manage" },
  { href: "/funnel", label: "Funil", icon: GitBranch, permission: "funnel.read" },
  { href: "/reports", label: "Relatórios", icon: BarChart3 },
];

const settingsNavItems: NavItem[] = [
  {
    href: "/settings/integrations",
    label: "Integrações",
    icon: Settings,
    permission: "integrations.view",
  },
  {
    href: "/settings/connections",
    label: "Conexões",
    icon: Smartphone,
    permission: "integrations.view",
  },
  { href: "/settings/team", label: "Equipe", icon: Users, permission: "team.view" },
  { href: "/settings/profile", label: "Meu perfil", icon: UserCircle },
  {
    href: "/settings/assignment",
    label: "Atribuição",
    icon: UserCheck,
    permission: "team.manage_roles",
  },
  {
    href: "/settings/contact-origins",
    label: "Origens",
    icon: MapPin,
    permission: "origins.manage",
  },
  { href: "/settings/contact-lists", label: "Listas", icon: List, permission: "lists.manage" },
  {
    href: "/settings/quick-replies",
    label: "Respostas rápidas",
    icon: Zap,
  },
  {
    href: "/settings/appearance",
    label: "Aparência",
    icon: Palette,
  },
];

function readCollapsedPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function saveCollapsedPreference(collapsed: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  } catch {
    // ignore
  }
}

interface SidebarProps {
  mode?: UltraMode;
  onlineCount?: number;
}

function NavLink({
  item,
  pathname,
  collapsed = false,
}: {
  item: NavItem;
  pathname: string;
  collapsed?: boolean;
}) {
  const active =
    item.href === "/"
      ? pathname === "/"
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  return (
    <Link href={item.href} title={collapsed ? item.label : undefined}>
      <motion.div
        whileHover={collapsed ? undefined : { x: 2 }}
        className={`flex min-w-0 items-center rounded-xl py-2.5 text-[0.9375rem] font-medium transition-colors ${
          collapsed ? "justify-center px-2" : "gap-3 px-3"
        } ${
          active
            ? "bg-app-accent/15 text-app-accent"
            : "text-app-subtle hover:bg-white/5 hover:text-app-text"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </motion.div>
    </Link>
  );
}

export function Sidebar({ mode = "api", onlineCount }: SidebarProps) {
  const pathname = usePathname();
  const { user, profile, logout } = useAuth();
  const { can, role } = usePermissions();
  const [settingsOpen, setSettingsOpen] = useState(pathname.startsWith("/settings"));
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(readCollapsedPreference());
  }, []);

  useEffect(() => {
    if (pathname.startsWith("/settings")) setSettingsOpen(true);
  }, [pathname]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      saveCollapsedPreference(next);
      return next;
    });
  }, []);

  const expandSidebar = useCallback(() => {
    setCollapsed(false);
    saveCollapsedPreference(false);
  }, []);

  const handleSettingsClick = useCallback(() => {
    if (collapsed) {
      expandSidebar();
      setSettingsOpen(true);
      return;
    }
    setSettingsOpen((v) => !v);
  }, [collapsed, expandSidebar]);

  const productName = mode === "operacional" ? "Ultra Operacional" : "Ultra API";
  const productSubtitle =
    mode === "operacional" ? "Checklist de tarefas" : "WhatsApp CRM e campanhas";

  const visibleMain = mainNavItems.filter(
    (item) => !item.permission || can(item.permission)
  );
  const visibleSettings = settingsNavItems.filter(
    (item) => !item.permission || can(item.permission)
  );
  const showSettings = visibleSettings.length > 0;

  if (mode === "operacional") {
    return null;
  }

  return (
    <aside
      className={`flex h-full w-full shrink-0 flex-col overflow-x-hidden border-r border-app-border bg-app-secondary/40 transition-[width] duration-200 ${
        collapsed ? "p-2 lg:w-20" : "p-4 lg:w-80"
      }`}
    >
      <div
        className={`mb-8 min-w-0 ${collapsed ? "flex flex-col items-center gap-2 px-0" : "px-2"}`}
      >
        <div
          className={`flex w-full items-center ${collapsed ? "justify-center" : "justify-between gap-2"}`}
        >
          <UltraWordmark size={collapsed ? "sm" : "lg"} />
          {!collapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              title="Recolher menu"
              aria-label="Recolher menu"
              className="hidden shrink-0 rounded-lg p-1.5 text-app-muted transition-colors hover:bg-white/5 hover:text-app-text lg:flex"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            title="Expandir menu"
            aria-label="Expandir menu"
            className="hidden rounded-lg p-1.5 text-app-muted transition-colors hover:bg-white/5 hover:text-app-text lg:flex"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
        {!collapsed && (
          <>
            <p className="mt-1 text-xs font-medium text-app-muted">{productName}</p>
            <p className="text-[0.6875rem] text-app-muted/80">{productSubtitle}</p>
          </>
        )}
      </div>

      <nav className="flex min-w-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto">
        {visibleMain.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
        ))}

        {showSettings && (
          <div className="mt-3">
            <button
              type="button"
              onClick={handleSettingsClick}
              title={collapsed ? "Configurações" : undefined}
              className={`flex w-full min-w-0 items-center rounded-xl py-2 text-xs font-semibold uppercase tracking-wide text-app-muted hover:text-app-subtle ${
                collapsed ? "justify-center px-2" : "justify-between gap-2 px-3"
              }`}
            >
              <span
                className={`flex min-w-0 items-center truncate ${
                  collapsed ? "justify-center" : "gap-2"
                }`}
              >
                <Settings className="h-3.5 w-3.5 shrink-0" />
                {!collapsed && "Configurações"}
              </span>
              {!collapsed && (
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform ${settingsOpen ? "rotate-180" : ""}`}
                />
              )}
            </button>
            {settingsOpen && !collapsed && (
              <div className="mt-1 ml-2 min-w-0 space-y-0.5 border-l border-app-border/60 pl-2">
                {visibleSettings.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      <Link
        href="/hub"
        title={collapsed ? "Trocar produto" : undefined}
        className={`mt-4 flex min-w-0 items-center rounded-xl border border-app-border bg-app-secondary/60 py-2.5 text-sm text-app-subtle transition-colors hover:border-app-accent/30 hover:text-app-text ${
          collapsed ? "justify-center px-2" : "gap-2 px-3"
        }`}
      >
        <ArrowLeftRight className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">Trocar produto</span>}
      </Link>

      <div className="mt-4 min-w-0 border-t border-app-border pt-4">
        {!collapsed ? (
          <>
            <Link
              href="/settings/profile"
              className="mb-2 flex min-w-0 items-center gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-white/5"
            >
              <UserAvatar
                name={profile?.name || user?.email || undefined}
                seed={profile?.name || user?.email || profile?.uid}
                photoUrl={profile?.photoUrl}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-app-text">
                  {profile?.name || user?.email}
                </p>
                {profile?.jobTitle && (
                  <p className="truncate text-xs text-app-muted">{profile.jobTitle}</p>
                )}
                <p className="truncate text-xs text-app-accent">{roleLabel(role)}</p>
              </div>
            </Link>
            {can("team.view_online") && onlineCount !== undefined && onlineCount > 0 && (
              <Link
                href="/settings/team?tab=online"
                className="mb-2 block px-2 text-xs text-emerald-400 hover:underline"
              >
                {onlineCount} online agora
              </Link>
            )}
          </>
        ) : (
          <Link
            href="/settings/profile"
            title="Meu perfil"
            className="mb-2 flex justify-center rounded-xl p-2 transition-colors hover:bg-white/5"
          >
            <UserAvatar
              name={profile?.name || user?.email || undefined}
              seed={profile?.name || user?.email || profile?.uid}
              photoUrl={profile?.photoUrl}
              size="sm"
            />
          </Link>
        )}
        <button
          type="button"
          onClick={() => logout()}
          title={collapsed ? "Sair" : undefined}
          className={`mt-2 flex w-full min-w-0 items-center rounded-xl py-2.5 text-sm text-app-subtle transition-colors hover:bg-red-500/10 hover:text-red-300 ${
            collapsed ? "justify-center px-2" : "gap-2 px-3"
          }`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="truncate">Sair</span>}
        </button>
      </div>
    </aside>
  );
}
