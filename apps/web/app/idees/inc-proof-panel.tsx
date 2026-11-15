"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PrivateError, privateJson, privateRequest } from "../../lib/private-api";
import styles from "./inc-proof-panel.module.css";
type Proof = { id:string; summary:string; version:number; recognition:keyof typeof states; can_add_evidence:boolean; can_attest:boolean; can_withdraw:boolean };
type Agreement = { id:string; version:number; status:string; fully_confirmed:boolean; terms:{goal:string} };
type Evidence = {id:string;proof_version:number;source_reference:string;source_version:string;provenance:string;rights_note:string};
type Attestation = {id:string;proof_version:number;decision:string;note:string};
type Detail = {proof:Proof;evidence:Evidence[];attestations:Attestation[]};
const states = {declared:"Declarada",participant_attested:"Confirmada per un participant",bilaterally_attested:"Confirmada per ambdues parts",disputed:"En disputa",withdrawn:"Retirada"};
async function read<T>(path:string,signal:AbortSignal):Promise<T>{return (await privateRequest(path,{signal})).json()}
function message(err:unknown){
 if(err instanceof PrivateError && err.status===409)return "La versió ha canviat. Revisa les dades actualitzades abans de tornar a decidir.";
 if(err instanceof PrivateError && [403,404].includes(err.status))return "Aportació no disponible o sense permís. Les dades anteriors s’han retirat de la vista.";
 return err instanceof Error?err.message:"No hem pogut carregar Inc Proof.";
}
export function IncProofPanel(){
 const [proofs,setProofs]=useState<Proof[]>([]),[agreements,setAgreements]=useState<Agreement[]>([]);
 const [selected,setSelected]=useState(""),[detail,setDetail]=useState<Detail|null>(null),[revision,setRevision]=useState(0);
 const [loading,setLoading]=useState(true),[detailLoading,setDetailLoading]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const locked=useRef(false),mounted=useRef(false);
 useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false}},[]);
 useEffect(()=>{
  const c=new AbortController();setLoading(true);
  Promise.all([read<Proof[]>("proofs",c.signal),read<Agreement[]>("agreements",c.signal)]).then(([items,terms])=>{
   if(c.signal.aborted)return;setProofs(items);setAgreements(terms);setSelected(id=>items.some(p=>p.id===id)?id:"");
  }).catch(err=>{if(c.signal.aborted)return;setProofs([]);setAgreements([]);setDetail(null);setSelected("");setError(message(err));})
  .finally(()=>{if(!c.signal.aborted)setLoading(false)});return ()=>c.abort();
 },[revision]);
 useEffect(()=>{
  const c=new AbortController();setDetail(null);
  if(!selected){setDetailLoading(false);return ()=>c.abort()}
  setDetailLoading(true);
  Promise.all([read<Proof>(`proofs/${selected}`,c.signal),read<Evidence[]>(`proofs/${selected}/evidence`,c.signal),read<Attestation[]>(`proofs/${selected}/attestations`,c.signal)])
  .then(([proof,evidence,attestations])=>{if(!c.signal.aborted)setDetail({proof,evidence,attestations})})
  .catch(err=>{if(c.signal.aborted)return;setDetail(null);setProofs(items=>items.filter(p=>p.id!==selected));setError(message(err));})
  .finally(()=>{if(!c.signal.aborted)setDetailLoading(false)});return ()=>c.abort();
 },[selected,revision]);
 function refresh(){setDetail(null);setProofs([]);setAgreements([]);setLoading(true);setRevision(v=>v+1)}
 async function mutate(path:string,body:unknown,success:string,form:HTMLFormElement){
  if(locked.current)return;locked.current=true;setBusy(true);setError("");setNotice("");
  try{const result=await privateJson<Proof>(path,body);if(!mounted.current)return;form.reset();if(path.startsWith("agreements/"))setSelected(result.id);setNotice(success);refresh()}
  catch(err){if(!mounted.current)return;setError(message(err));if(err instanceof PrivateError&&[401,403,404,409].includes(err.status))refresh()}
  finally{locked.current=false;if(mounted.current)setBusy(false)}
 }
 function submit(e:FormEvent<HTMLFormElement>,action:"declare"|"evidence"|"attest"|"withdraw"){
  e.preventDefault();const form=e.currentTarget,v=Object.fromEntries(new FormData(form));
  if(action==="declare"){
   const a=agreements.find(a=>a.id===v.agreement);if(!a?.fully_confirmed||a.status!=="active")return;
   void mutate(`agreements/${a.id}/proofs`,{kind:v.kind,summary:String(v.summary).trim()},"Aportació privada declarada.",form);return;
  }
  if(!detail||detail.proof.id!==selected)return;const p=detail.proof,root=`proofs/${p.id}`;
  if(action==="evidence"&&p.can_add_evidence)void mutate(`${root}/evidence`,{expected_version:p.version,origin:v.origin,source_reference:v.source_reference,source_version:v.source_version,provenance:v.provenance,rights_note:v.rights_note},"Evidència afegida. Les confirmacions anteriors ja no són vigents.",form);
  if(action==="attest"&&p.can_attest&&v.consent==="on")void mutate(`${root}/attestations`,{expected_version:p.version,decision:v.decision,note:v.note,confirm:true},"Decisió registrada per a aquesta versió.",form);
  if(action==="withdraw"&&p.can_withdraw&&v.consent==="on")void mutate(`${root}/withdraw`,{expected_version:p.version,reason:v.reason,confirm:true},"Aportació retirada. L’historial es conserva.",form);
 }
 const current=detail?.proof.id===selected?detail:null,eligible=agreements.filter(a=>a.fully_confirmed&&a.status==="active");
 return <section className={styles.section} data-testid="inc-proof-panel" aria-label="Inc Proof">
  <div className={styles.header}><div><h2>Inc Proof · Aportacions amb context</h2><p>Privades entre participants. Una confirmació no és una certificació professional ni concedeix accés al projecte.</p></div><button disabled={busy||loading} onClick={()=>{setError("");setNotice("");refresh()}}>Actualitzar Proof</button></div>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{loading&&<p role="status">Carregant aportacions…</p>}
  <div className={styles.columns}><div><h3>Declarar una aportació</h3>
   {!loading&&!eligible.length&&<p>Cal un acord actiu confirmat per ambdues parts. Actualitza Proof després de confirmar-lo.</p>}
   <form onSubmit={e=>submit(e,"declare")}><fieldset disabled={busy||loading||!eligible.length}>
    <label>Acord confirmat<select name="agreement" required defaultValue=""><option value="" disabled>Tria un acord</option>{eligible.map(a=><option key={a.id} value={a.id}>{a.terms.goal} · v{a.version}</option>)}</select></label>
    <label>Tipus d’aportació<select name="kind"><option value="work">Treball</option><option value="knowledge">Coneixement</option><option value="resource">Recurs</option><option value="other">Altres</option></select></label>
    <label>Resum de l’aportació<textarea name="summary" required maxLength={1200}/></label><button>Declarar aportació privada</button>
   </fieldset></form><h3>Les aportacions accessibles</h3>{!loading&&!proofs.length&&<p>No hi ha aportacions accessibles.</p>}
   {proofs.map(p=><button className={styles.choice} key={p.id} disabled={busy} aria-pressed={selected===p.id} onClick={()=>{setDetail(null);setError("");setNotice("");if(selected===p.id)setRevision(v=>v+1);else setSelected(p.id)}}>{p.summary} · v{p.version} · {states[p.recognition]}</button>)}
  </div><div aria-busy={detailLoading}>{detailLoading&&<p role="status">Carregant el detall…</p>}
   {current&&<div key={`${current.proof.id}:${current.proof.version}`} data-testid="proof-detail"><h3>{current.proof.summary}</h3><p>Versió {current.proof.version} · {states[current.proof.recognition]}</p>
    <h4>Evidències declarades</h4>{!current.evidence.length&&<p>Encara sense evidències.</p>}{current.evidence.map(v=><article key={v.id}><p>Incorporada a v{v.proof_version} · {v.source_reference} · {v.source_version}</p><p>{v.provenance}</p><small>Drets declarats: {v.rights_note}</small></article>)}
    <h4>Historial de confirmacions i disputes</h4>{!current.attestations.length&&<p>Encara sense decisions.</p>}{current.attestations.map(v=><article key={v.id}><p>v{v.proof_version} · {v.proof_version===current.proof.version?"Versió vigent":"Històrica, no vigent"} · {v.decision==="confirm"?"Confirmació":"Disputa"}</p><p>{v.note}</p></article>)}
    {current.proof.can_add_evidence&&<form onSubmit={e=>submit(e,"evidence")}><fieldset disabled={busy}><legend>Afegir evidència</legend>
     <label>Origen<select name="origin"><option value="self">Propi</option><option value="experiment">Prova</option><option value="external">Extern</option></select></label>
     <label>Referència de la font<input name="source_reference" required maxLength={500}/></label><label>Versió de la font<input name="source_version" required maxLength={100}/></label>
     <label>Procedència<textarea name="provenance" required maxLength={1000}/></label><label>Drets d’ús declarats<textarea name="rights_note" required maxLength={500}/></label>
     <p>Afegir evidència crea una versió nova i invalida les confirmacions anteriors.</p><button>Afegir evidència i revisar versió</button>
    </fieldset></form>}
    {current.proof.can_attest&&<form onSubmit={e=>submit(e,"attest")}><fieldset disabled={busy}><legend>Revisar aquesta versió</legend>
     <label>Decisió<select name="decision"><option value="confirm">Confirmar</option><option value="dispute">Disputar</option></select></label><label>Nota de revisió<textarea name="note" required maxLength={500}/></label>
     <label className={styles.check}><input type="checkbox" name="consent" required/>He revisat la versió {current.proof.version} i confirmo aquesta decisió.</label><button>Registrar decisió de Proof</button>
    </fieldset></form>}
    {current.proof.can_withdraw&&<form onSubmit={e=>submit(e,"withdraw")}><fieldset disabled={busy}><legend>Retirar la meva aportació</legend><label>Motiu de retirada<textarea name="reason" required maxLength={500}/></label>
     <label className={styles.check}><input type="checkbox" name="consent" required/>Vull retirar aquesta aportació conservant l’historial.</label><button>Retirar aportació</button>
    </fieldset></form>}
   </div>}
  </div></div>
 </section>;
}
