import Link from "next/link";
export default function Startup() {
  return <main className="quelcom-workspace"><span className="eyebrow">QUELCOM / STARTUP</span>
    <h1>Prepara el següent horitzó</h1>
    <p>Fes créixer la teva idea conservant les proves, les decisions i els aprenentatges.</p>
    <Link className="button primary" href="/idees">Reprèn el teu Projecte Viu</Link>
    <p>Entrar en aquest espai no transforma un projecte en startup ni canvia qui hi té accés. Les eines específiques de negoci i finançament estan en preparació.</p>
  </main>;
}
