import { redirect } from "next/navigation";

// A gestão de clientes migrou para o painel dedicado da plataforma.
export default function ClientsPage() {
  redirect("/platform");
}
