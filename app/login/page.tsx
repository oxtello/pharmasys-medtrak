import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <div className="relative h-24 w-72">
            <Image
              src="/logo.png"
              alt="PharmaSys MedTrak"
              fill
              priority
              className="object-contain"
            />
          </div>
        </div>

        <div className="rounded-xl border bg-white p-8 shadow-sm">
          <h1 className="mb-6 text-center text-2xl font-semibold text-slate-900">
            Log in to MedTrak
          </h1>

          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="name@clinic.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            <Link
              href="/dashboard"
              className="block w-full rounded-lg bg-blue-600 px-4 py-2 text-center font-medium text-white hover:bg-blue-700"
            >
              Log in
            </Link>
          </form>
        </div>
      </div>
    </main>
  );
}
