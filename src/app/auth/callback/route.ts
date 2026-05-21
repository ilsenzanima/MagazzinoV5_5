import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Se la sessione è di tipo recovery, manda alla pagina di reset password
      const sessionType = data.session?.user?.aud
      const isRecovery = next === '/auth/reset-password' || sessionType === 'recovery'
      const redirectTo = isRecovery ? '/auth/reset-password' : next
      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
