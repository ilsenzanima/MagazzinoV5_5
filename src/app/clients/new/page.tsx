import { redirect } from "next/navigation";

// La creazione del committente è ora un modale nella lista
export default function NewClientPage() {
  redirect("/clients?nuovo=1");
}
