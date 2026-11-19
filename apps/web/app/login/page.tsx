import { loginMethods, methodParameters, loginErrorMessage } from "../../lib/login-methods";
import Link from "next/link";
import { Sprout, ArrowRight, LockKeyhole } from "lucide-react";
import { loginConfig, loginDestination } from "../../lib/auth-config";
import { loginAction, privateLoginAction } from "../actions";
export const dynamic = "force-dynamic";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const configured = !!loginConfig();
  const message = loginErrorMessage(params.error);
  return (
    <main className="login-page">
      <section className="panel login-card">
        <span className="brand-icon">
          <Sprout size={28} />
        </span>
        <span className="eyebrow">QUELCOM · INCFORSTARTUP</span>
        <h1>
          Un compte.
          <br />
          Moltes idees per fer créixer.
        </h1>
        <p>
          Accedeix al teu espai, comparteix avenços i continua el projecte amb
          el teu equip.
        </p>
        {message && (
          <p className="notice error" role="alert">
            {message}
          </p>
        )}
        <div style={{ display: "grid", gap: 12 }}>
          {loginMethods.map(method => {
            const available = configured && methodParameters(method.id) !== null;
            return <form key={method.id} action={
              (params.next === "/private" || params.next === "/idees") && loginConfig()?.privateContext
                ? privateLoginAction : loginAction
            }>
              <input type="hidden" name="next" value={loginDestination(params.next)} />
              <input type="hidden" name="method" value={method.id} />
              <button className="button primary" disabled={!available} style={{ width: "100%" }}>
                {"provider" in method && <img width={20} height={20} src={`/providers/${method.id}.svg`} alt={method.provider} />}
                {"provider" in method ? method.label : `Continua amb ${method.label}`} {available ? <ArrowRight size={17} /> : <LockKeyhole size={17} />}
              </button>
              {!available && <small className="muted">Pendent de connexió</small>}
            </form>;
          })}
        </div>
        {!configured && <p className="waiting">L’accés compartit està en preparació. No s’enviaran codis ni es crearà cap sessió des d’aquesta pantalla.</p>}
        <p className="muted">
          Cada participant utilitza el seu compte. El professor et pot donar
          accés a un espai amb una invitació.
        </p>
        <Link className="text-button" href="/demo">
          Explora la demostració local <ArrowRight size={15} />
        </Link>
      </section>
    </main>
  );
}
