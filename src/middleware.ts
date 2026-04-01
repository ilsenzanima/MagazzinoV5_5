import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: Richiamare getUser rinfresca il token se necessario
  // e verifica crittograficamente la validità della sessione.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Definisci quali percorsi sono pubblici e non richiedono autenticazione
  const isPublicPath = 
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/auth') || // Route callback per oAuth o reset
    pathname.startsWith('/api/') || // Facciamo passare le API health, le API poi usano getUser internamente
    pathname.startsWith('/icons/') ||
    pathname === '/manifest.json'

  // Se l'utente NON è autenticato e NON si sta recando in una rotta pubblica,
  // redirigiamo con violenza verso /login, bloccando prima del Server Render.
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Se l'utente E' autenticato ma cerca di tornare su /login, lo rimandiamo al dashboard
  if (user && (pathname === '/login' || pathname === '/register' || pathname === '/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Matcha tutte le richieste HTTP TRANNE:
     * - _next/static (file statici generati)
     * - _next/image (componenti Image di next)
     * - favicon.ico (icona browser)
     * - tutto ciò che finisce con estensioni file comuni (.svg, .png Ecc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
