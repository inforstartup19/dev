"use server";
import { methodParameters } from "../lib/login-methods";
import { signIn, signOut } from "../auth";
import { loginConfig, loginDestination } from "../lib/auth-config";
import { redirect } from "next/navigation";
import { privateClaims } from "../lib/private-policy";

export async function loginAction(data: FormData) {
  if (!loginConfig()) redirect("/login");
  const parameters = methodParameters(data.get("method"));
  if (!parameters) redirect(`/login?next=${encodeURIComponent(loginDestination(data.get("next")))}&error=ProviderUnavailable`);
  await signIn("campus-oidc", {
    redirectTo: loginDestination(data.get("next")),
  }, parameters);
}
export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function privateLoginAction(data: FormData) {
  const config = loginConfig();
  if (!config?.privateContext)
    redirect("/login?next=/private&error=Configuration");
  const parameters = methodParameters(data.get("method"));
  if (!parameters) redirect(`/login?next=${encodeURIComponent(loginDestination(data.get("next")))}&error=ProviderUnavailable`);
  await signIn(
    "campus-oidc",
    { redirectTo: data.get("next") === "/idees" ? "/idees" : "/private" },
    { ...parameters, claims: privateClaims(config.privateContext) },
  );
}
