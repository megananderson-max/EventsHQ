import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { sendGmailEmail } from '@/lib/gmail'
import { getDb } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    // Require a signed-in user
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'You must be signed in to send emails.' },
        { status: 401 }
      )
    }

    const userEmail = session.user.email

    // Look up this user's Gmail refresh token
    const db = getDb()
    const row = db.prepare(
      'SELECT gmail_refresh_token FROM user_tokens WHERE email = ?'
    ).get(userEmail) as { gmail_refresh_token: string | null } | undefined

    if (!row?.gmail_refresh_token) {
      return NextResponse.json(
        { error: 'Gmail not connected. Please sign out and sign in again to reconnect your Gmail.' },
        { status: 400 }
      )
    }

    const body = await req.json() as {
      to: string
      toName?: string | null
      subject: string
      emailBody: string
    }

    if (!body.to || !body.subject || !body.emailBody) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, emailBody' },
        { status: 400 }
      )
    }

    const result = await sendGmailEmail({
      to: body.to,
      toName: body.toName ?? undefined,
      subject: body.subject,
      body: body.emailBody,
      refreshToken: row.gmail_refresh_token,
      fromEmail: userEmail,
    })

    return NextResponse.json({
      sent: true,
      sentFrom: userEmail,
      messageId: result.messageId,
      threadId: result.threadId,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Send pricing email error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
