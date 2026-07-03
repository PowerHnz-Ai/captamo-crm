"use client";

import { ExcelImport } from "@/components/contacts/ExcelImport";

interface ContactImportProps {
  onImported: () => void;
}

export function ContactImport({ onImported }: ContactImportProps) {
  return <ExcelImport onImported={onImported} />;
}
