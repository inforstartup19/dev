import type { ReactNode } from "react";

export function RequiredCaption({ children }: { children: ReactNode }) {
  return (
    <span>{children}<span className="required-mark" aria-hidden="true"> *</span></span>
  );
}
