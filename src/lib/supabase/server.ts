// Server-side Supabase client.
//
// Use this in Server Components, Server Actions, and Route Handlers.
// It creates a fresh client for each request and uses cookies to
// maintain the user's auth session.
//
// Usage:
//   import { createClient } from '@/lib/supabase/server'
//   const supabase = await createClient()
//   const { data } = await supabase.from('workout_sessions').select()

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll is called from a Server Component where cookies
            // can't be set. This is fine — the middleware handles it.
          }
        },
      },
    }
  )
}
