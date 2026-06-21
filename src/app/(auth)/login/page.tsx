import Image from "next/image";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-[#F5F3FF] via-white to-white">
      <div className="flex-1 flex items-center justify-center px-5 pb-10">
        <div className="w-full max-w-sm space-y-6">
          <Image
            src="/airavat logo (15).svg"
            alt="AiravatL"
            width={840}
            height={256}
            priority
            className="mr-auto h-64 w-auto -my-10 -ml-[16px]"
          />
          <LoginForm />

          <p className="text-center text-xs text-muted-foreground">
            Don&rsquo;t have access? Contact your Airavatl account manager.
          </p>
        </div>
      </div>

      <footer className="px-5 py-4 text-center text-[11px] text-muted-foreground">
        © {new Date().getFullYear()} Airavatl · Enterprise Portal
      </footer>
    </main>
  );
}
