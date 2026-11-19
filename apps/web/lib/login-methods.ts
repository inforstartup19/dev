/** All methods federate through the existing Campus issuer, preserving API audience/subject. */
export const loginMethods = [
  { id: "university", label: "la teva universitat" },
  { id: "microsoft", label: "Correu i ofimàtica", provider: "Microsoft" },
  { id: "google", label: "Correu i serveis en línia", provider: "Google" },
  { id: "apple", label: "Serveis del dispositiu", provider: "Apple" },
  { id: "email", label: "correu electrònic" },
] as const;
export type LoginMethod = typeof loginMethods[number]["id"];
export function methodParameters(value: unknown, env: Record<string,string|undefined> = process.env): Record<string,string> | null {
  const id = value === null || value === undefined ? "university" : value;
  if (!loginMethods.some(method => method.id === id)) return null;
  // Compatibility: existing Campus OIDC still works without federation routing.
  if (id === "university" && !env.CAMPUS_LOGIN_METHODS) return {};
  try {
    const methods = JSON.parse(env.CAMPUS_LOGIN_METHODS || "{}");
    if (!methods || Array.isArray(methods) || typeof methods !== "object") return null;
    const config = methods[id as LoginMethod];
    if (!config || config.enabled !== true) return null;
    // Hints are configured by the operator, never accepted from browser FormData.
    if (typeof config.domainHint !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,252}$/.test(config.domainHint)) return null;
    return { domain_hint: config.domainHint };
  } catch { return null; }
}
export function loginErrorMessage(error: unknown): string | null {
  if (!error) return null;
  const messages: Record<string,string> = {
    AccessDenied: "L’entrada no s’ha completat. Pots tornar-ho a provar amb un compte autoritzat.",
    OAuthAccountNotLinked: "Aquest accés encara no està vinculat. Entra amb el teu mètode habitual; no fusionem comptes automàticament pel correu.",
    SessionExpired: "La sessió ha caducat. Torna a identificar-te per continuar.",
    ProviderUnavailable: "Aquest mètode encara no està disponible. Tria una altra opció activa.",
    Configuration: "L’accés està en preparació. Pots continuar explorant la demostració.",
  };
  return typeof error === "string" && Object.hasOwn(messages,error) ? messages[error] : "No hem pogut completar l’accés. Torna-ho a provar; si persisteix, utilitza un altre mètode que ja tinguis vinculat.";
}
