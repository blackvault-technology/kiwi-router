import ErrorBoundary from "./components/ErrorBoundary";
import { AuthScreen, KiwiDashboard } from "./components/KiwiDashboard";
import { ThemeProvider } from "./contexts/ThemeContext";
import { trpc } from "./lib/trpc";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

function Router() {
  const auth = trpc.auth.me.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  if (auth.isLoading) return <div className="grid min-h-screen place-items-center bg-[#090a09]"><div className="size-6 animate-spin rounded-full border-2 border-zinc-700 border-t-[#8ee53f]" /></div>;
  if (!auth.data) return <AuthScreen onAuthenticated={user => utils.auth.me.setData(undefined, user)} />;
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
