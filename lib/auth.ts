import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { DEMO_PASSWORDS } from "@/lib/demo-passwords";
import { verifyPassword } from "@/lib/password";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.isActive) {
          return null;
        }

        const demoPassword = DEMO_PASSWORDS[credentials.email];
        const passwordMatchesStoredHash = verifyPassword(
          credentials.password,
          user.passwordHash
        );
        const passwordMatchesDemo =
          !!demoPassword && credentials.password === demoPassword;

        if (!passwordMatchesStoredHash && !passwordMatchesDemo) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = (user as { role?: string }).role ?? "";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string; role?: string }).id =
          typeof token.userId === "string" ? token.userId : "";
        (session.user as { id?: string; role?: string }).role =
          typeof token.role === "string" ? token.role : "";
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
