// Browser-side Supabase client.
//
// Use this in any component that has "use client" at the top.
// It creates one shared Supabase client for the entire browser
// session, so you're not making a new connection on every render.
//
// Usage:
//   import { supabase } from '@/lib/supabase/client'
//   const { data } = await supabase.from('workout_sessions').select()

import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
