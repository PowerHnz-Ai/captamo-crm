import { redirect } from "next/navigation";
import { CHECKLIST_ENTRY_PATH } from "@/lib/checklist-path";

export default function OperacionalConversasPage() {
  redirect(CHECKLIST_ENTRY_PATH);
}
