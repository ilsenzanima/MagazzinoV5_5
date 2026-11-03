import { redirect } from "next/navigation";

// La creazione del fornitore è ora un modale nella lista
export default function NewSupplierPage() {
  redirect("/suppliers?nuovo=1");
}
