import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"

// Genera apposta un errore sul server per verificare che Sentry lo riceva.
// Solo per gli admin: l'API non è protetta dal login del middleware.
export async function GET() {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 })

    const { data: role } = await supabase.rpc("get_my_role")
    if (role !== "admin") return NextResponse.json({ error: "Solo gli admin possono usare il test" }, { status: 403 })

    throw new Error("Test Sentry: errore di prova generato dal server")
}
