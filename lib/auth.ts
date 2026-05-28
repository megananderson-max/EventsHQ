import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { getDb } from '@/lib/db'

// Auto-detect the deployment URL so NEXTAUTH_URL doesn't need to be manually
// updated when deploying to Replit or other platforms.
// Priority: NEXTAUTH_URL (explicit) → REPLIT_DEV_DOMAIN → localhost fallback
function getBaseUrl(): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL
  // Replit sets REPLIT_DEV_DOMAIN for the dev URL and REPLIT_DEPLOYMENT_URL in production
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`
  if (process.env.REPLIT_DEPLOYMENT_URL) return process.env.REPLIT_DEPLOYMENT_URL
  return `http://localhost:${process.env.PORT || 3000}`
}

// Write the resolved URL back so NextAuth internals see the right value
if (!process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = getBaseUrl()
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GMAIL_CLIENT_ID!,
      clientSecret: process.env.GMAIL_CLIENT_SECRET!,
      authorization: {
        params: {
          // Request Gmail send permission alongside standard login scopes
          scope: 'openid email profile https://www.googleapis.com/auth/gmail.send',
          access_type: 'offline',
          // prompt: consent ensures we always get a refresh_token back
          prompt: 'consent',
        },
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    async jwt({ token, account }) {
      // On first sign-in `account` is populated with the OAuth result
      if (account?.refresh_token && token.email) {
        try {
          const db = getDb()
          db.prepare(`
            INSERT INTO user_tokens (email, name, image, gmail_refresh_token, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(email) DO UPDATE SET
              name = excluded.name,
              image = excluded.image,
              gmail_refresh_token = excluded.gmail_refresh_token,
              updated_at = excluded.updated_at
          `).run(
            token.email,
            token.name ?? null,
            (token.picture as string | null) ?? null,
            account.refresh_token,
          )
        } catch (err) {
          console.error('Failed to store user Gmail token:', err)
        }
      }
      return token
    },

    async session({ session, token }) {
      if (session.user && token.email) {
        try {
          const db = getDb()
          const row = db.prepare(
            'SELECT gmail_refresh_token FROM user_tokens WHERE email = ?'
          ).get(token.email) as { gmail_refresh_token: string | null } | undefined

          // Attach gmailConnected so the client can show the right UI
          ;(session.user as { gmailConnected?: boolean }).gmailConnected =
            !!row?.gmail_refresh_token
          ;(session.user as { email?: string | null }).email = token.email
        } catch {
          // DB unavailable — non-fatal
        }
      }
      return session
    },
  },

  pages: {
    signIn: '/auth/signin',
  },
}
