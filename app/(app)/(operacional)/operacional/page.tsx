import { redirect } from "next/navigation";
import { CHECKLIST_ENTRY_PATH } from "@/lib/checklist-path";

export default function OperacionalPage() {
  redirect(CHECKLIST_ENTRY_PATH);
}
