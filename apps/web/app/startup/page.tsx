import Link from "next/link";
import type { ReactNode } from "react";
import { startupCatalog as catalog, startupSelection } from "../../lib/startup-pathways";
import { StartupOrientation } from "./orientation";
import "./startup.css";

export const metadata = { title: "Startup · Quelcom", description: "Crea i creix, Enlaira i continuïtat del Campus." };
function Heading({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <header className="su-heading"><span className="su-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{children}</p></header>;
}
function ProjectContext() {
  return <section className="su-context"><div><span className="su-badge">CONTINUÏTAT DEL PROJECTE VIU</span><p>Reprèn el projecte per treballar sobre les seves proves i decisions.</p></div><Link href="/idees">Obre els teus projectes</Link></section>;
}
export default async function Startup({ searchParams }: { searchParams: Promise<{ track?: string | string[]; step?: string | string[]; view?: string | string[] }> }) {
  const query = await searchParams;
  const selection = startupSelection(query.track, query.step);
  const view = typeof query.view === "string" ? query.view : "";
  let content: ReactNode;
  if (selection) {
    const { track, step } = selection;
    content = <><Heading eyebrow={`STARTUP / ${track.title.toUpperCase()}`} title={track.title}>{track.description}</Heading><ProjectContext />
      <div className="su-workspace"><nav className="su-stages" aria-label={`Etapes de ${track.title}`}>{track.steps.map((item, index) => <Link key={item.id} href={`/startup?track=${track.id}&step=${item.id}`} aria-current={step.id === item.id ? "step" : undefined}><span>0{index + 1}</span><div><strong>{item.title}</strong><small>Per explorar</small></div></Link>)}</nav>
        <section className="su-activity"><div className="su-section-title"><span className="su-eyebrow">ETAPA 0{track.steps.indexOf(step) + 1} / 05</span><span className="su-badge">EXPLORACIÓ LLIURE</span></div><h2>{step.title}</h2><p>{step.learn}</p><div className="su-task"><span className="su-eyebrow">POSA-HO EN PRÀCTICA</span><p>{step.task}</p><h3>Què prepararàs</h3><p>{step.deliverable}</p><details><summary>Criteris per a la revisió</summary><ul>{step.criteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul></details><details><summary>Exemple orientatiu</summary><p>{step.example}</p></details></div><blockquote>{step.mentor}<small>Pregunta per preparar el retorn · cap mentor assignat</small></blockquote>
          {step.id === "recursos" && <section className="su-task"><h3>Finançament, si el necessites</h3><p>Buscar inversors no és un requisit per avançar. Pots explorar aquestes vies:</p><ul>{catalog.financing.filter((item) => item.id !== "pendent").map((item) => <li key={item.id}>{item.label}</li>)}</ul></section>}
          <section className="su-empty"><h3>Prepara una prova concreta</h3><p>El catàleg no inscriu ni modifica cap projecte. Pots reprendre el Projecte Viu per registrar una prova amb les eines disponibles al teu compte.</p><Link href="/idees">Torna al Projecte Viu</Link></section><p className="su-outcome"><strong>Horitzó de l’itinerari</strong>{track.outcome}</p>
        </section></div></>;
  } else if (view === "campus") {
    content = <><Heading eyebrow="CAMPUS / CONTINUÏTAT VOLUNTÀRIA" title="El teu treball pot tenir més recorregut.">Un TFG o TFM pot obrir una nova etapa. Tu i l’equip decidiu què continua; l’avaluació acadèmica manté el seu propi recorregut.</Heading>
      <div className="su-principles">{[["01", "Conserva l’origen", "Identitat, autoria, evidències i versions han de continuar vinculades al mateix projecte."], ["02", "Acorda la continuïtat", "Revisa equip, autoria dels materials i permisos abans de reutilitzar o compartir res."], ["03", "Separa les revisions", "El docent avalua el treball acadèmic. El mentor ajuda a contrastar el negoci."]].map(([n, title, description]) => <article key={n}><span>{n}</span><h3>{title}</h3><p>{description}</p></article>)}</div><ProjectContext />
      <section className="su-task"><h2>Primer, prepara la conversa</h2><p>Defineix què voldríeu continuar, amb qui i quins materials i acords cal revisar. La connexió amb l’expedient acadèmic està pendent; aquesta pantalla no trasllada documents ni concedeix permisos.</p><Link href="/campus">Torna al Campus</Link></section></>;
  } else if (view === "mentoria") {
    content = <><Heading eyebrow="STARTUP / ACOMPANYAMENT" title="Aprendre. Aplicar. Revisar i continuar.">Formació breu vinculada al que estàs fent. Cada pregunta ha d’ajudar-te a prendre una decisió més ben fonamentada.</Heading><div className="su-principles"><article><span>APRENENTATGE</span><h3>Una idea útil cada vegada</h3><p>Consulta la guia de cada etapa i aplica-la a una prova concreta.</p></article><article><span>REVISIÓ</span><h3>Mentor de projecte</h3><p>Revisa evidències i viabilitat. El rol de docent i la nota acadèmica es mantenen separats.</p></article><article><span>CONTINUÏTAT</span><h3>Un proper pas clar</h3><p>Prepara dubtes, materials i una petició concreta per a la conversa.</p></article></div><section className="su-task"><h2>Acompanyament en preparació</h2><p>Encara no hi ha assignació de mentors, reserves ni enviament de missatges en aquest espai. Una persona necessitarà les dues assignacions explícites per actuar com a docent i mentor.</p><Link href="/startup?track=crea-i-creix">Consulta la microformació</Link></section></>;
  } else if (query.track || view) {
    content = <><Heading eyebrow="STARTUP" title="Aquest recorregut no està disponible.">Tria un dels itineraris per continuar.</Heading><Link href="/startup">Explora Startup</Link></>;
  } else {
    content = <><Heading eyebrow="QUELCOM / STARTUP" title="Dona continuïtat al que has començat.">Un espai per aprendre, posar a prova i fer créixer una idea. Al teu ritme, amb decisions que pots revisar.</Heading><div className="su-tracks">{catalog.tracks.map((track) => <Link key={track.id} className={`su-track ${track.id === "enlaira" ? "su-violet" : ""}`} href={`/startup?track=${track.id}`}><span className="su-index">{track.number}</span><span className="su-eyebrow">{track.eyebrow}</span><h2>{track.title}</h2><p>{track.description}</p><span className="su-audience">{track.audience}</span><strong>Explora les 5 etapes</strong></Link>)}</div><ProjectContext /><StartupOrientation /><div className="su-links"><Link href="/startup?view=campus"><span className="su-eyebrow">CONTINUÏTAT</span><h3>Del Campus al següent horitzó</h3><p>Revisa què vols continuar, amb qui i amb quins materials.</p></Link><Link href="/startup?view=mentoria"><span className="su-eyebrow">ACOMPANYAMENT</span><h3>Aprèn fent, revisa amb criteri</h3><p>Formació, tasques i preguntes per preparar el retorn d’un mentor.</p></Link></div></>;
  }
  return <main className="startup-workspace"><div className="su-shell"><nav className="su-nav" aria-label="Espai Startup"><Link href="/startup">Startup</Link><Link href="/startup?track=crea-i-creix">Crea i creix</Link><Link href="/startup?track=enlaira">Enlaira</Link><Link href="/startup?view=campus">Des del Campus</Link><Link href="/startup?view=mentoria">Acompanyament</Link></nav>{content}<footer className="su-footer"><p>Catàleg de preparació · entrar o explorar no inscriu, no valida el negoci i no contacta mentors ni inversors. Les preparacions Startup vinculades al compte estan pendents d’integració.</p></footer></div></main>;
}
