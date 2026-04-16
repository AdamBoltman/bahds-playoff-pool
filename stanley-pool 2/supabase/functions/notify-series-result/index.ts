// Supabase Edge Function: notify-series-result
// Triggered manually from AdminPage after saving results
// Sends a summary email to all pool members

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { matchupId, winner, games, seriesLabel } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get all pool members' emails
    const { data: profiles } = await supabase
      .from('profiles')
      .select('email, display_name')

    if (!profiles?.length) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get updated leaderboard
    const { data: scores } = await supabase
      .from('scores')
      .select('display_name, total')
      .order('total', { ascending: false })
      .limit(5)

    const leaderboardText = scores?.map((s, i) =>
      `${i + 1}. ${s.display_name} — ${s.total} pts`
    ).join('\n') || 'No scores yet'

    // Send email via Supabase's built-in SMTP (or Resend if configured)
    // Using Supabase Auth admin to send emails
    const subject = `Series over: ${winner} wins in ${games}!`
    const body = `
Hey Bahd,

A series just wrapped up in the Bahds Playoff Pool!

${seriesLabel}
Result: ${winner} wins in ${games} games

---
Top 5 standings:
${leaderboardText}

---
Check the full leaderboard: ${Deno.env.get('APP_URL')}/leaderboard

— Bahds Playoff Pool Commissioner
    `.trim()

    // Send to each member using Supabase's mailer
    let sent = 0
    for (const profile of profiles) {
      if (!profile.email) continue
      try {
        // Using fetch to Resend API (recommended for production)
        // Configure RESEND_API_KEY in Supabase Edge Function secrets
        const resendKey = Deno.env.get('RESEND_API_KEY')
        if (resendKey) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Bahds Playoff Pool <noreply@bahdsplayoffpool.com>',
              to: profile.email,
              subject,
              text: body,
            }),
          })
          sent++
        }
      } catch (e) {
        console.error(`Failed to send to ${profile.email}:`, e)
      }
    }

    return new Response(
      JSON.stringify({ sent, total: profiles.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
