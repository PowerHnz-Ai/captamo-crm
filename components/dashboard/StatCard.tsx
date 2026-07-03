"use client";

import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { AnimatedNumber } from "./AnimatedNumber";

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  gradient: string;
}

export function StatCard({ title, value, icon: Icon, gradient }: StatCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-app-subtle">{title}</p>
          <p className="mt-2 text-3xl font-bold font-display tracking-tight">
            <AnimatedNumber value={value} />
          </p>
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient}`}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </Card>
  );
}
