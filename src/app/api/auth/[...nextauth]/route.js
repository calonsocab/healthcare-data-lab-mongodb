// src/app/api/auth/[...nextauth]/route.js
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { getCoreDb } from '@/lib/db/coreDb';
import { logLogin, logAccountCreated } from '@/lib/db/activityLog';
import { getCurrentAccessKey } from '@/lib/security/accessKey';

export const authOptions = {
  session: { 
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,      // 24 hours (vs default 30 days)
    updateAge: 60 * 60          // Refresh token every hour
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: { prompt: 'select_account', access_type: 'offline', response_type: 'code' },
      },
    }),
  ],
  pages: {
    signIn: '/',           // ok
    error: '/auth/error',  // don’t send errors back to "/" — it looks like a loop
  },
  callbacks: {
    async signIn({ account, user }) {
      if (account?.provider !== 'google') return false;
      // Best-effort upsert: don't block auth if DB hiccups
      try {
        const db = await getCoreDb();

        // Check if user exists before upserting
        const existingUser = await db.collection('users').findOne(
          { email: user.email },
          { projection: { _id: 1 } }
        );
        const isNewUser = !existingUser;

        await db.collection('users').updateOne(
          { email: user.email },
          {
            $set: {
              name: user.name || '',
              image: user.image || null,
              updatedAt: new Date(),
              lastLoginAt: new Date(),
            },
            $setOnInsert: {
              createdAt: new Date(),
              accountType: 'individual',
            },
          },
          { upsert: true }
        );

        // Log the login event for tracking
        await logLogin({
          userId: user.id || user.email,
          email: user.email,
          name: user.name,
          isNewUser,
        });

        // Log account creation separately for new users
        if (isNewUser) {
          await logAccountCreated({
            userId: user.id || user.email,
            email: user.email,
            name: user.name,
            accountType: 'individual',
          });
        }
      } catch (e) {
        console.error('signIn upsert failed:', e);
      }
      return true;
    },

    async jwt({ token, user, account, trigger }) {
      // Keep only essentials in the JWT
      if (user) {
        token.sub = token.sub || user.id || token.sub;
        token.email = user.email ?? token.email;
        token.name = user.name ?? token.name;
        token.picture = user.image ?? token.picture;
      }
      if (account?.access_token) token.accessToken = account.access_token;

      // Security: Validate token hasn't been invalidated by logout
      // Always validate in JWT mode so sign-out immediately revokes the token.
      if (token.email) {
        try {
          const db = await getCoreDb();
          const [u, accessState] = await Promise.all([
            db.collection('users').findOne(
              { email: token.email },
              { projection: { lastLogoutAt: 1 } }
            ),
            getCurrentAccessKey(db, token.email)
          ]);
          const lastLogoutAt = u?.lastLogoutAt || null;

          // Token issued before logout? Invalidate it
          if (lastLogoutAt && token.iat) {
            const tokenIssuedAt = token.iat * 1000;
            if (tokenIssuedAt < lastLogoutAt.getTime()) {
              console.warn('JWT invalidated by logout:', {
                email: token.email,
                tokenIssuedAt: new Date(tokenIssuedAt).toISOString(),
                lastLogoutAt: lastLogoutAt.toISOString()
              });
              return null;
            }
          }

          const liveAccessKey = accessState?.key || null;
          const tokenAccessKey = String(token.accessKey || '').trim() || null;
          if (trigger !== 'signIn' && tokenAccessKey && liveAccessKey && tokenAccessKey !== liveAccessKey) {
            console.warn('JWT invalidated by access-state key rotation:', {
              email: token.email
            });
            return null;
          }

          token.accessKey = liveAccessKey;
          token.accessKeyVersion = accessState?.payload?.version || null;
          token.accessKeyIssuedAt = Date.now();
        } catch (err) {
          console.error('JWT validation error:', err);
          return null;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.sub;
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.image = token.picture;
      }
      session.access = {
        key: token.accessKey || null,
        version: token.accessKeyVersion || null,
        issuedAt: token.accessKeyIssuedAt || null
      };
      // DO NOT add session.context
      return session;
    },
  },
  events: {
    // Ensure sign-out revokes the JWT server-side.
    // NextAuth's built-in /api/auth/signout only clears cookies; this is where we stamp revocation.
    async signOut(message) {
      try {
        const rawEmail = (message?.token?.email || message?.session?.user?.email || '').toString().trim();
        const normalizedEmail = rawEmail.toLowerCase();
        if (!rawEmail) return;

        const db = await getCoreDb();
        const now = new Date();
        const res = await db.collection('users').updateOne(
          { email: rawEmail },
          { $set: { lastLogoutAt: now, updatedAt: now }, $inc: { logoutCount: 1 } }
        );
        if (!res.matchedCount && normalizedEmail && normalizedEmail !== rawEmail) {
          await db.collection('users').updateOne(
            { email: normalizedEmail },
            { $set: { lastLogoutAt: now, updatedAt: now }, $inc: { logoutCount: 1 } }
          );
        }
      } catch (e) {
        console.error('events.signOut failed:', e);
      }
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
