import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("auth page routing", () => {
  it("renders AuthScreen for direct login and register entries instead of the landing page", () => {
    const app = read("client/src/App.tsx");
    expect(app).toContain('const authEntryRoute = location === "/" || location === "/login" || location === "/register";');
    expect(app).toContain('if (location === "/") return <LandingPage />;');
    expect(app).not.toContain('if (location === "/" || authEntryRoute) return <LandingPage />;');
    expect(app).toContain('return <AuthScreen initialMode={location === "/register" ? "register" : "login"}');
  });

  it("preserves authenticated entry redirects and actionable auth states", () => {
    const app = read("client/src/App.tsx");
    const auth = read("client/src/components/KiwiDashboard.tsx");
    expect(app).toContain('if (auth.data && authEntryRoute) setLocation("/app");');
    expect(app).toContain('if (auth.isLoading && (authEntryRoute || location === "/app" || location === "/ops"))');
    expect(auth).toContain('Continue with Google');
    expect(auth).toContain('googleError');
    expect(auth).toContain('Forgot password?');
  });
});
