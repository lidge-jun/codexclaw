/**
 * kit.tsx — reusable UI primitives (Phase 6).
 *
 * The shared vocabulary every page composes from: Card, Button, Field, states
 * (Loading/Empty/Error), StatusDot, Badge, Toast host. Keeping these in one
 * place is what makes the dashboard read as one system (dev-uiux-design).
 */
import { useEffect, useRef, type ReactNode } from "react";
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

/** Accessible toggle switch: role="switch", keyboard-operable, focus ring. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch ${checked ? "on" : ""}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-thumb" aria-hidden />
    </button>
  );
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

/**
 * Modal — small dialog with focus trap, Escape-to-close, and focus restore.
 * Rendered inline (no portal lib): the overlay is fixed and the app is small
 * enough that stacking context conflicts don't arise.
 */
export function Modal({
  title,
  onClose,
  children,
  closable = true,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  closable?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const node = ref.current;
    // Move focus into the dialog on open.
    const first = node?.querySelector<HTMLElement>("input, select, textarea, button, [tabindex]");
    (first ?? node)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closable) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const focusables = Array.from(
        node.querySelectorAll<HTMLElement>("input, select, textarea, button, a[href], [tabindex]:not([tabindex='-1'])"),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      opener?.focus();
    };
  }, [onClose, closable]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && closable && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <div className="modal-head">
          <h2 className="modal-title">{title}</h2>
          {closable ? (
            <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
              <Icon name="x" size={16} />
            </button>
          ) : null}
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
