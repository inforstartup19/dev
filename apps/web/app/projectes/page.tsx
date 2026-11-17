import { redirect } from "next/navigation";
// One authenticated workspace owns the project records, not a second copy.
export default function Projects() { redirect("/idees"); }
