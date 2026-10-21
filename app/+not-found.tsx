import { router } from "expo-router";
import { Button, Screen } from "../src/ui/components";
export default function NotFound() {
  return (
    <Screen title="Caminho não encontrado">
      <Button title="Ir para o início" onPress={() => router.replace("/")} />
    </Screen>
  );
}
