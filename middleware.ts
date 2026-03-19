import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/",
  },
});

export const config = {
  matcher: ["/inventory/:path*", "/admin/:path*", "/reports/:path*"],
}
