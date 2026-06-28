import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { google } from "googleapis"

export async function GET(req: NextRequest) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY non configurata' }, { status: 500 })
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } })
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Solo gli admin possono eseguire questa operazione' }, { status: 403 })

    const code = req.nextUrl.searchParams.get('code')
    const errorParam = req.nextUrl.searchParams.get('error')
    if (errorParam) return NextResponse.json({ error: `Google ha risposto con errore: ${errorParam}` }, { status: 400 })
    if (!code) return NextResponse.json({ error: 'Parametro "code" mancante' }, { status: 400 })

    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET
    if (!clientId || !clientSecret) return NextResponse.json({ error: 'GOOGLE_DRIVE_CLIENT_ID/SECRET non configurati' }, { status: 500 })

    const redirectUri = `${req.nextUrl.origin}/api/admin/drive-oauth/callback`
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

    try {
        const { tokens } = await oauth2Client.getToken(code)
        if (!tokens.refresh_token) {
            return new NextResponse(
                `<html><body style="font-family:monospace;padding:2rem">
                <h2>Nessun refresh_token ricevuto</h2>
                <p>Probabilmente questo account aveva gi&agrave; autorizzato l'app in precedenza con questo scope.
                Vai su <a href="https://myaccount.google.com/permissions" target="_blank">myaccount.google.com/permissions</a>,
                revoca l'accesso per questa app, poi riprova da /api/admin/drive-oauth/start.</p>
                </body></html>`,
                { status: 200, headers: { 'Content-Type': 'text/html' } }
            )
        }
        return new NextResponse(
            `<html><body style="font-family:monospace;padding:2rem;word-break:break-all">
            <h2>Nuovo refresh token generato (scope drive.file)</h2>
            <p>Copia questo valore e impostalo come <b>GOOGLE_DRIVE_REFRESH_TOKEN_NEW</b> nelle Environment Variables di Vercel
            (NON sostituire ancora quello attuale: prima va eseguita la migrazione dei file esistenti).</p>
            <pre style="background:#111;color:#0f0;padding:1rem;border-radius:8px">${tokens.refresh_token}</pre>
            </body></html>`,
            { status: 200, headers: { 'Content-Type': 'text/html' } }
        )
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Errore scambio token' }, { status: 500 })
    }
}
