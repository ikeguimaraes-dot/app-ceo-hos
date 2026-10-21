import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, scenario?: string) {
  await page.goto("/login");
  if (scenario)
    await page.getByRole("button", { name: scenario, exact: true }).click();
  await page.getByRole("button", { name: "Entrar na demonstração" }).click();
}
async function unit(page: Page, name = "Jardim") {
  await page.getByRole("button", { name: `Abrir ${name} · Demo` }).click();
}
test("login, dashboard, unit isolation, notifications and logout stay local", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (
      !request.url().startsWith("http://127.0.0.1:4173") &&
      !request.url().startsWith("data:")
    )
      external.push(request.url());
  });
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Entrar na demonstração" }),
  ).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/login.png", fullPage: true });
  await page.getByRole("button", { name: "Entrar na demonstração" }).click();
  await expect(page.getByText("Sua próxima perspectiva")).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/units.png", fullPage: true });
  await unit(page);
  await expect(page.getByText("R$ 24.850,00")).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/home.png", fullPage: true });
  await page.getByRole("button", { name: "Ver pendências" }).click();
  await expect(page.getByText("Revisar fechamento")).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/pending.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Mais" }).click();
  await page.getByRole("button", { name: "Notificações", exact: true }).click();
  await expect(page.getByText("Um fechamento espera por você")).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/notifications.png",
    fullPage: true,
  });
  await page.goBack();
  await page
    .getByRole("button", { name: "Trocar unidade", exact: true })
    .click();
  await unit(page, "Costa");
  await expect(
    page.getByText("R$ 18.320,00").filter({ visible: true }),
  ).toBeVisible();
  await expect(page.getByText("R$ 24.850,00")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Pessoas" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Mais" }).click();
  await page.getByRole("button", { name: "Preferências e simulação" }).click();
  await page.getByRole("button", { name: "Escuro", exact: true }).click();
  await page.screenshot({
    path: "docs/screenshots/dark-preferences.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Simular sessão expirada" }).click();
  await expect(
    page.getByText("Sessão expirada. Entre novamente."),
  ).toBeVisible();
  expect(external).toEqual([]);
});
test("protected deep link survives login and unit selection", async ({
  page,
}) => {
  await page.goto("/notifications");
  await expect(page).toHaveURL(/login/);
  await page.getByRole("button", { name: "Entrar na demonstração" }).click();
  await unit(page);
  await expect(page.getByText("No seu radar")).toBeVisible();
});
test("inactive and unlinked scenarios cannot enter tabs", async ({ page }) => {
  await login(page, "Sem vínculo");
  await expect(
    page.getByText("Nenhuma unidade vinculada a este usuário simulado."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Voltar ao login" }).click();
  await login(page, "Usuário inativo");
  await expect(page.getByText("Acesso pausado")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Início" })).toHaveCount(0);
});
test("missing capability hides tab and logout protects history", async ({
  page,
}) => {
  await login(page, "Acesso restrito");
  await unit(page);
  await expect(page.getByText("R$ 24.850,00")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Pendências" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Mais" }).click();
  await page.getByRole("button", { name: "Sair da demonstração" }).click();
  await expect(page).toHaveURL(/login/);
  await page.goBack();
  await expect(page.getByText("R$ 24.850,00")).toHaveCount(0);
});
test("recovery, empty, offline, retry and dark appearance", async ({
  page,
}) => {
  await page.goto("/recover");
  await page.getByRole("button", { name: "Simular recuperação" }).click();
  await expect(
    page.getByText(
      "Solicitação simulada concluída. Nenhum e-mail foi enviado.",
    ),
  ).toBeVisible();
  await login(page);
  await unit(page);
  await page.getByRole("tab", { name: "Mais" }).click();
  await page.getByRole("button", { name: "Preferências e simulação" }).click();
  await page.getByRole("button", { name: "Vazio", exact: true }).click();
  await page.goBack();
  await page.getByRole("tab", { name: "Pendências" }).click();
  await expect(page.getByText("Tudo em dia por aqui.")).toBeVisible();
  await page.getByRole("tab", { name: "Mais" }).click();
  await page.getByRole("button", { name: "Preferências e simulação" }).click();
  await page.getByRole("button", { name: "Offline", exact: true }).click();
  await page.goBack();
  await page.getByRole("tab", { name: "Pendências" }).click();
  await expect(
    page.getByText(
      "Você está offline na simulação. Reconecte nas preferências.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(
    page.getByText(
      "Você está offline na simulação. Reconecte nas preferências.",
    ),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Mais" }).click();
  await page.getByRole("button", { name: "Preferências e simulação" }).click();
  await page.getByRole("button", { name: "Normal", exact: true }).click();
  await page.goBack();
  await page.getByRole("tab", { name: "Pendências" }).click();
  await expect(page.getByText("Revisar fechamento")).toBeVisible();
});
test("authenticated deep link still denies missing capability", async ({
  page,
}) => {
  await page.goto("/notifications");
  await page
    .getByRole("button", { name: "Acesso restrito", exact: true })
    .click();
  await page.getByRole("button", { name: "Entrar na demonstração" }).click();
  await unit(page);
  await expect(
    page.getByText("Acesso restrito", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Um fechamento espera por você")).toHaveCount(0);
});
