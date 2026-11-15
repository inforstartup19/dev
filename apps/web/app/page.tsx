import { SpaceEntrance } from "../components/space-entrance";
import { redirect } from "next/navigation";
import DemoCampus from "../components/demo-campus";
export const dynamic = "force-dynamic";
export default function Home() {
  // Enable only after the performance and Safari gates in #77/#55.
  if (process.env.INC_SPACE_ENTRANCE === "1") return <SpaceEntrance destination={process.env.CAMPUS_MODE === "connected" ? "/campus" : "/demo"} />;
  if (process.env.CAMPUS_MODE === "connected") redirect("/campus");
  return <DemoCampus />;
}
