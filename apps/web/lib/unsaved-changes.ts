"use client";
import { useEffect, useRef } from "react";
const dirtyEditors = new Set<symbol>();
let installed = false;
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirtyEditors.size) { event.preventDefault(); event.returnValue = ""; }
}
function beforeLink(event: MouseEvent) {
  if (!dirtyEditors.size || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = (event.target as Element)?.closest?.("a");
  if (!link || link.hasAttribute("download") || link.target === "_blank" || link.href === location.href) return;
  if (!confirm("Tens canvis sense desar. Desa’ls o exporta’ls abans de sortir. Vols sortir igualment?")) {
    event.preventDefault(); event.stopPropagation();
  }
}
export function useUnsavedChanges(dirty: boolean) {
  const key = useRef(Symbol("editor"));
  useEffect(() => {
    const id = key.current;
    if (dirty) dirtyEditors.add(id); else dirtyEditors.delete(id);
    if (!installed) {
      window.addEventListener("beforeunload", beforeUnload);
      document.addEventListener("click", beforeLink, true);
      installed = true;
    }
    return () => {
      dirtyEditors.delete(id);
      if (!dirtyEditors.size) {
        window.removeEventListener("beforeunload", beforeUnload);
        document.removeEventListener("click", beforeLink, true);
        installed = false;
      }
    };
  }, [dirty]);
}
