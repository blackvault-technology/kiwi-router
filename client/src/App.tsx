import ErrorBoundary from "./components/ErrorBoundary";
import { AuthScreen, KiwiDashboard } from "./components/KiwiDashboard";
import { ThemeProvider } from "./contexts/ThemeContext";
import { trpc } from "./lib/trpc";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPassword from "./pages/ResetPassword";
import { AboutPage } from "./pages/PublicSite";
import { LandingPage } from "./pages/LandingV2";
import { DocsPageV2 } from "./pages/DocsV2";
import { AcceptableUsePage, CookiePolicyPage, PrivacyPage, TermsPage } from "./pages/LegalPages";

function Router() {
  const [location] = useLocation();
  const isPublicRoute = location === "/" || location === "/about" || location === "/docs" || location === "/terms" || location === "/privacy" || location === "/acceptable-use" || location === "/cookies" || location === "/verify-email" || location === "/reset-password" || location === "/login" || location === "/register";
  const auth = trpc.auth.me.useQuery(undefined, { retry: false, enabled: !isPublicRoute });
  const utils = trpc.useUtils();
  if (location === "/verify-email") return <VerifyEmail />;
  if (location === "/reset-password") return <ResetPassword />;
  if (location === "/") return <LandingPage />;
  if (location === "/about") return <AboutPage />;
  if (location === "/docs") return <DocsPageV2 />;
  if (location === "/terms") return <TermsPage />;
  if (location === "/privacy") return <PrivacyPage />;
  if (location === "/acceptable-use") return <AcceptableUsePage />;
  if (location === "/cookies") return <CookiePolicyPage />;
  if (auth.isLoading) return <div className="grid min-h-screen place-items-center bg-[#090a09]"><div className="size-6 animate-spin rounded-full border-2 border-zinc-700 border-t-[#8ee53f]" /></div>;
  if (!auth.data) return <AuthScreen initialMode={location === "/register" ? "register" : "login"} onAuthenticated={user => { utils.auth.me.setData(undefined, user); }} />;
  return <KiwiDashboard user={auth.data} onLogout={() => { utils.auth.me.setData(undefined, null); utils.invalidate(); }} />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
