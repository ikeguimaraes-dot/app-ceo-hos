import { Redirect, Stack, usePathname } from "expo-router";
import { useGhost } from "../../src/state/provider";
import {
  protectedDestination,
  safeDestination,
} from "../../src/state/controller";
export default function ProtectedLayout() {
  const { state } = useGhost();
  const path = usePathname();
  const destination = protectedDestination(state);
  if (destination)
    return (
      <Redirect
        href={{
          pathname: destination,
          params: { next: safeDestination(path) },
        }}
      />
    );
  return <Stack screenOptions={{ headerShown: false }} />;
}
