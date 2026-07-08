import { useEffect, useState } from "react";
import { api, type ProviderState } from "./api.ts";
import { useRoute, navigate } from "./router.ts";
import { ToastHost } from "./ui/toast.tsx";
import { Icon, type IconName } from "./ui/icons.tsx";
import { SubagentsPage } from "./pages/Subagents.tsx";
import { ChannelsPage } from "./pages/Channels.tsx";
import { AgentsPage } from "./pages/Agents.tsx";
import { DashboardPage } from "./pages/Dashboard.tsx";
import { SessionsPage } from "./pages/Sessions.tsx";

interface NavItem {
  route: string;
  label: string;
  icon: IconName;
}

const NAV: NavItem[] = [
  { route: "/dashboard", label: "Dashboard", icon: "activity" },
  { route: "/channels", label: "Channels", icon: "link" },
  { route: "/agents", label: "Agents", icon: "cpu" },
  { route: "/sessions", label: "Sessions", icon: "database" },
  { route: "/subagents", label: "Subagents", icon: "sliders" },
];

export function App() {
  const route = useRoute();
  const [provider, setProvider] = useState<ProviderState>({ mode: "native", port: null });

  useEffect(() => {
    void api.getProvider().then(setProvider);
  }, []);

  const active = NAV.find((n) => route.startsWith(n.route)) ?? NAV[0];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img
            src="/logo-64.png"
            alt="codexclaw"
            width={22}
            height={22}
            style={{ borderRadius: "var(--r-sm)", imageRendering: "auto" }}
          />
          codexclaw
        </div>
        <nav aria-label="Primary">
          {NAV.map((item) => (
            <button
              key={item.route}
              type="button"
              className={`nav-link ${active.route === item.route ? "active" : ""}`}
              aria-current={active.route === item.route ? "page" : undefined}
              onClick={() => navigate(item.route)}
            >
              <span className="ico"><Icon name={item.icon} size={16} /></span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="spacer" />
        <div className="foot">
          {provider.mode === "provider" ? `ocx :${provider.port}` : "native codex"} · v0.1
        </div>
      </aside>

      <main className="main">
        {active.route === "/dashboard" ? (
          <DashboardPage />
        ) : active.route === "/channels" ? (
          <ChannelsPage />
        ) : active.route === "/agents" ? (
          <AgentsPage />
        ) : active.route === "/sessions" ? (
          <SessionsPage />
        ) : (
          <SubagentsPage provider={provider} />
        )}
      </main>
      <ToastHost />
    </div>
  );
}
