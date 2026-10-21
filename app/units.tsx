import { Redirect } from "expo-router";
import { useGhost } from "../src/state/provider";
import { Units } from "../src/features/screens";
export default function Route() {
  const { state } = useGhost();
  if (state.status !== "ready") return <Redirect href="/login" />;
  if (state.locked) return <Redirect href="/lock" />;
  return <Units />;
}
