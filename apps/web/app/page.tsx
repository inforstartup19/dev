import { SpaceEntrance } from "../components/space-entrance";
import { redirect } from "next/navigation";
import DemoCampus from "../components/demo-campus";
export const dynamic = "force-dynamic";
export default function Home() {
  if (process.env.INC_SPACE_ENTRANCE === "1") return <SpaceEntrance destination="/univers" />;
  if (process.env.CAMPUS_MODE === "connected") redirect("/campus");
  return <DemoCampus />;
}
