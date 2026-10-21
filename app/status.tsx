import { Redirect } from "expo-router";
import { useGhost } from "../src/state/provider";
import { Status } from "../src/features/screens";
export default function Route() {
  const { state } = useGhost();
  if (!state.session) return <Redirect href="/login" />;
  return <Status />;
}
