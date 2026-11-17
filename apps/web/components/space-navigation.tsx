"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function SpaceNavigation() {
  const path = usePathname();
  if (["/", "/entrada", "/univers"].includes(path)) return null;
  return <nav className="quelcom-space-navigation" aria-label="Canvi d’espai"><Link href="/univers">Els quatre espais</Link></nav>;
}
