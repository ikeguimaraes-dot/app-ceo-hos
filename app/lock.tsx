import { Redirect } from "expo-router";
import { useGhost } from "../src/state/provider";
import { Lock } from "../src/features/screens";
export default function Route() {
  const { state } = useGhost();
  if (state.status !== "ready") return <Redirect href="/login" />;
  return <Lock />;
}
