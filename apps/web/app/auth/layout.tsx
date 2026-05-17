import { AuthLeftPanel } from "../../components/auth/AuthLeftPanel";
import { AuthRouteTransition } from "../../components/auth/AuthRouteTransition";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen bg-bg">
      <AuthLeftPanel />
      <section className="flex min-h-screen flex-1 items-center justify-center bg-bg px-5 py-10 md:w-[45vw] md:px-16">
        <div className="w-full max-w-auth-form">
          <div className="mb-8 text-left font-heading text-md font-bold text-primary md:hidden">Retrace</div>
          <AuthRouteTransition>{children}</AuthRouteTransition>
        </div>
      </section>
    </main>
  );
}
