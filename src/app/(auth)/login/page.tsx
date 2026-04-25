import { Logo } from "@/components/brand/logo";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-[#F5F3FF] via-white to-white">
      <header className="px-5 pt-8 pb-4 flex items-center justify-center sm:justify-start sm:px-10">
        <Logo />
      </header>

      <div className="flex-1 flex items-center justify-center px-5 pb-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center sm:text-left space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="text-sm text-muted-foreground">
              Sign in to your customer portal to track your trips.
            </p>
          </div>

          <LoginForm />

          <p className="text-center text-xs text-muted-foreground">
            Don&rsquo;t have access? Contact your AiravatL account manager.
          </p>
        </div>
      </div>

      <footer className="px-5 py-4 text-center text-[11px] text-muted-foreground">
        © {new Date().getFullYear()} AiravatL · Enterprise Portal
      </footer>
    </main>
  );
}
