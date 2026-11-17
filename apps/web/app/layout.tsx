import { EntranceFocus } from "../components/entrance-focus";
import { SpaceNavigation } from "../components/space-navigation";
import "../components/quelcom-entry.css";
import type { Metadata } from "next";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./globals.css";
export const metadata: Metadata = {
  referrer: "no-referrer",
  title: "IncForStartUp · L’espai on els projectes creixen",
  description:
    "Prototip per presentar, tutoritzar i fer evolucionar projectes universitaris.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ca">
      <body><EntranceFocus /><SpaceNavigation />{children}</body>
    </html>
  );
}
