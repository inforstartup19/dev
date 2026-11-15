import { SpaceEntrance } from "../../components/space-entrance";
import { loginDestination } from "../../lib/auth-config";
export const dynamic="force-dynamic";
export default async function Entrance({searchParams}:{searchParams:Promise<{next?:string}>}) {
  const {next}=await searchParams;
  const destination=next ? loginDestination(next) : process.env.CAMPUS_MODE==="connected" ? "/campus" : "/demo";
  return <SpaceEntrance destination={destination}/>;
}
