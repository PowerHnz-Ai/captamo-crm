"use client";

import { Inbox, Smartphone, User, UserX, Users } from "lucide-react";
import { UserAvatar } from "@/components/users/UserAvatar";
import type { ConnectionOption } from "@/components/chat/ConnectionSwitcher";

export interface InboxRailAttendant {
  uid: string;
  name: string;
  photoUrl?: string;
}

interface InboxRailProps {
  connections: ConnectionOption[];
  connectionsLoading?: boolean;
  activeConnectionId: string | null;
  onConnectionChange: (connectionId: string) => void;
  unreadByConnection?: Record<string, number>;
  attendants: InboxRailAttendant[];
  attendantsLoading?: boolean;
  assigneeFilter: string;
  onAssigneeFilterChange: (value: string) => void;
  openCountByAssignee?: Record<string, number>;
  unassignedCount?: number;
  showUsersSection?: boolean;
  currentUid?: string;
}

function RailBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-app-accent px-1 text-[0.5625rem] font-bold text-black">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function RailItem({
  active,
  onClick,
  title,
  label,
  icon,
  badge,
  avatarSeed,
  photoUrl,
  compact,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
  avatarSeed?: string;
  photoUrl?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-current={active ? "true" : undefined}
      onClick={onClick}
      className={`group relative flex w-full items-center gap-2 rounded-xl border px-2 py-2 text-left transition-colors ${
        active
          ? "border-app-accent/50 bg-app-accent/15 text-app-text"
          : "border-transparent text-app-muted hover:border-app-border hover:bg-white/5 hover:text-app-text"
      } ${compact ? "justify-center px-1.5" : ""}`}
    >
      <span className="relative shrink-0">
        {avatarSeed || photoUrl ? (
          <UserAvatar
            name={label}
            seed={avatarSeed || label}
            photoUrl={photoUrl}
            size="sm"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-app-subtle">
            {icon}
          </span>
        )}
        {badge !== undefined && badge > 0 && <RailBadge count={badge} />}
      </span>
      {!compact && (
        <span className="min-w-0 flex-1 truncate text-xs font-medium leading-tight">
          {label}
        </span>
      )}
    </button>
  );
}

function RailSection({
  title,
  children,
  compact,
}: {
  title: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="space-y-1">
      {!compact && (
        <p className="px-1 text-[0.625rem] font-semibold uppercase tracking-wide text-app-muted">
          {title}
        </p>
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export function InboxRail({
  connections,
  connectionsLoading,
  activeConnectionId,
  onConnectionChange,
  unreadByConnection = {},
  attendants,
  attendantsLoading,
  assigneeFilter,
  onAssigneeFilterChange,
  openCountByAssignee = {},
  unassignedCount = 0,
  showUsersSection = true,
  currentUid,
}: InboxRailProps) {
  const compact = false;

  if (connectionsLoading && connections.length === 0) {
    return (
      <aside className="inbox-rail flex w-[4.5rem] shrink-0 flex-col gap-3 border-r border-app-border bg-app-secondary/20 p-2 lg:w-52">
        <div className="h-10 animate-pulse rounded-xl bg-white/5" />
        <div className="h-10 animate-pulse rounded-xl bg-white/5" />
      </aside>
    );
  }

  return (
    <aside
      className="inbox-rail flex w-[4.5rem] shrink-0 flex-col gap-4 overflow-y-auto border-r border-app-border bg-app-secondary/20 p-2 lg:w-52"
      aria-label="Navegação do inbox"
    >
      {connections.length > 0 && (
        <RailSection title="Caixas de entrada" compact={compact}>
          {connections.map((c) => (
            <RailItem
              key={c.id}
              active={c.id === activeConnectionId}
              onClick={() => onConnectionChange(c.id)}
              title={`${c.label}${c.status !== "connected" ? " (desconectado)" : ""}`}
              label={c.label}
              icon={<Smartphone className="h-4 w-4 text-app-whatsapp" />}
              badge={unreadByConnection[c.id] || 0}
              compact={compact}
            />
          ))}
        </RailSection>
      )}

      {showUsersSection && (
        <RailSection title="Usuários" compact={compact}>
          <RailItem
            active={!assigneeFilter}
            onClick={() => onAssigneeFilterChange("")}
            title="Todas as conversas"
            label="Todas"
            icon={<Users className="h-4 w-4" />}
            compact={compact}
          />
          <RailItem
            active={assigneeFilter === "__unassigned__"}
            onClick={() => onAssigneeFilterChange("__unassigned__")}
            title="Não atribuídas"
            label="Não atribuídas"
            icon={<UserX className="h-4 w-4" />}
            badge={unassignedCount}
            compact={compact}
          />
          {currentUid && (
            <RailItem
              active={assigneeFilter === currentUid}
              onClick={() => onAssigneeFilterChange(currentUid)}
              title="Minhas conversas"
              label="Minhas"
              avatarSeed={
                attendants.find((a) => a.uid === currentUid)?.name || currentUid
              }
              photoUrl={attendants.find((a) => a.uid === currentUid)?.photoUrl}
              badge={openCountByAssignee[currentUid] || 0}
              compact={compact}
            />
          )}
          {attendantsLoading && attendants.length === 0 ? (
            <div className="h-10 animate-pulse rounded-xl bg-white/5" />
          ) : (
            attendants
              .filter((a) => a.uid !== currentUid)
              .map((a) => (
                <RailItem
                  key={a.uid}
                  active={assigneeFilter === a.uid}
                  onClick={() => onAssigneeFilterChange(a.uid)}
                  title={a.name}
                  label={a.name}
                  avatarSeed={a.name}
                  photoUrl={a.photoUrl}
                  badge={openCountByAssignee[a.uid] || 0}
                  compact={compact}
                />
              ))
          )}
        </RailSection>
      )}

      {connections.length === 0 && !showUsersSection && (
        <div className="flex flex-col items-center gap-2 px-1 py-4 text-center text-app-muted">
          <Inbox className="h-5 w-5 opacity-60" />
          <User className="h-5 w-5 opacity-40" />
        </div>
      )}
    </aside>
  );
}
