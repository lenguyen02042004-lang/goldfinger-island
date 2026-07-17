import { IslandDashboard } from "@/components/island-dashboard";
import { RoomRequired } from "@/components/room-required";

export default function IslandPage() {
  return <RoomRequired><IslandDashboard /></RoomRequired>;
}
