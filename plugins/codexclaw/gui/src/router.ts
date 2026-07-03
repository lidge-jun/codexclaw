/**
 * router.ts — a dependency-free hash router (Phase 6).
 *
 * We stay zero-new-dep (no react-router): the app has a handful of routes, so a
 * `#/path` hash + a subscribe hook is enough and works from a static file:// or
 * the cxc serve origin without server-side route config.
 */
import { useEffect, useState } from "react";

export function currentRoute(): string {
  const hash = typeof location !== "undefined" ? location.hash : "";
  const path = hash.replace(/^#/, "");
  return path === "" || path === "/" ? "/channels" : path;
}

export function navigate(path: string): void {
  if (typeof location !== "undefined") location.hash = path;
}

export function useRoute(): string {
  const [route, setRoute] = useState<string>(currentRoute());
  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
