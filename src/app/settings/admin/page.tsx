import { redirect } from "next/navigation";

// La gestione utenti e ruoli ora e' negli Strumenti admin
export default function SettingsAdminRedirect() {
  redirect("/strumenti?v=utenti");
}
