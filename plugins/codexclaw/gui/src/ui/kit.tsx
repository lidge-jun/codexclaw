/**
 * kit.tsx — reusable UI primitives (Phase 6).
 *
 * The shared vocabulary every page composes from: Card, Button, Field, states
 * (Loading/Empty/Error), StatusDot, Badge, Toast host. Keeping these in one
 * place is what makes the dashboard read as one system (dev-uiux-design).
 */
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons.tsx";

export function Card({ title, desc, children }: { title?: string; desc?: string; children: ReactNode }) {
  return (
    <div className="card">
      {title ? <h2 className="card-title">{title}</h2> : null}
      {desc ? <p className="card-desc">{desc}</p> : null}
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = "default",
  ...rest
}: { children: ReactNode; variant?: "default" | "primary" | "danger" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`btn ${variant === "default" ? "" : variant}`} {...rest}>
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

export function StatusDot({ status }: { status: "ok" | "warn" | "off" | "err" }) {
  return <span className={`dot ${status}`} aria-hidden />;
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "ok" | "accent" }) {
  return <span className={`badge ${tone === "default" ? "" : tone}`}>{children}</span>;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="state" role="status">
      <div className="spinner lg" />
      <div className="hint">{label}</div>
    </div>
  );
}

export function EmptyState({ icon = "inbox", title, children }: { icon?: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="state">
      <div className="glyph"><Icon name={icon} size={30} /></div>
      <div className="title">{title}</div>
      {children ? <div className="hint">{children}</div> : null}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", children }: { title?: string; children?: ReactNode }) {
  return (
    <div className="state">
      <div className="glyph"><Icon name="alert" size={30} /></div>
      <div className="title">{title}</div>
      {children ? <div className="hint">{children}</div> : null}
    </div>
  );
}
