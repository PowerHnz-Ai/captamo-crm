"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { can, type Permission } from "@/lib/permissions";
import { getEffectiveRole } from "@/lib/roles";
import type { UserRole } from "@/lib/types";

export function usePermissions() {
  const { profile } = useAuth();

  const ctx = useMemo(() => {
    if (!profile) return { role: undefined, cargo: undefined };
    if (profile.effectiveRole) {
      return { role: profile.effectiveRole, cargo: undefined };
    }
    return { role: profile.role, cargo: profile.cargo };
  }, [profile]);

  const effectiveRole = useMemo(() => getEffectiveRole(ctx), [ctx]);

  return useMemo(
    () => ({
      role: effectiveRole as UserRole,
      can: (permission: Permission) => can(ctx, permission),
      ctx,
    }),
    [ctx, effectiveRole]
  );
}
