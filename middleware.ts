import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/inventory/:path*",
    "/admin/:path*",
    "/users/:path*",
    "/reports/:path*",
  ],
};
