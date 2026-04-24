import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const memberSlug = searchParams.get('member')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && user) {
      // Check if user profile exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!existingUser && memberSlug) {
        // Create user profile
        const memberData = user.user_metadata
        await supabase.from('users').insert({
          id: user.id,
          email: user.email!,
          member_id: memberData.member_id,
          member_name: memberData.member_name,
          member_slug: memberData.member_slug || memberSlug,
        })
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
