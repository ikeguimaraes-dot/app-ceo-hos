import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { router } from "expo-router";
import { useGhost } from "../../src/state/provider";
import {
  Button,
  Card,
  Field,
  Label,
  Loading,
  Screen,
} from "../../src/ui/components";

export default function ResetPassword() {
  const { gateways } = useGhost();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void Linking.getInitialURL()
      .then((url) => {
        if (!url) throw new Error("Link de recuperação ausente.");
        return gateways.auth.completeRecovery(url);
      })
      .then(() => setReady(true))
      .catch((cause: unknown) =>
        setMessage(
          cause instanceof Error
            ? cause.message
            : "Não foi possível validar o link.",
        ),
      );
  }, [gateways]);

  if (!ready && !message)
    return (
      <Screen title="Validando seu acesso">
        <Loading />
      </Screen>
    );

  return (
    <Screen title="Criar nova senha">
      <Card>
        {!!message && <Label>{message}</Label>}
        {ready && (
          <>
            <Field
              label="Nova senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <Button
              title="Salvar nova senha"
              onPress={() => {
                setMessage("");
                void gateways.auth
                  .updatePassword(password)
                  .then(() => gateways.auth.signOut())
                  .then(() => router.replace("/login"))
                  .catch((cause: unknown) =>
                    setMessage(
                      cause instanceof Error
                        ? cause.message
                        : "Não foi possível atualizar a senha.",
                    ),
                  );
              }}
            />
          </>
        )}
        <Button
          title="Voltar ao login"
          secondary
          onPress={() => router.replace("/login")}
        />
      </Card>
    </Screen>
  );
}
