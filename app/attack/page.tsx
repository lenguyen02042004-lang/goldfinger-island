import { AttackDashboard } from "@/components/attack-dashboard";
import { RoomRequired } from "@/components/room-required";

export default function AttackPage() {
  return <RoomRequired><AttackDashboard /></RoomRequired>;
}
