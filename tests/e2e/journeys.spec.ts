import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, scenario?: string) {
  await page.goto("/login");
  if (scenario)
    await page.getByRole("button", { name: scenario, exact: true }).click();
  await page.getByRole("button", { name: "Entrar na demonstração" }).click();
}
test("login, dashboard, unit isolation, notifications and logout stay inside the app boundary", async ({
  page,
}) => {
  const external: string[] = [];
  const appOrigin = new URL(
    process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173",
  ).origin;
  page.on("request", (request) => {
    if (
      !request.url().startsWith(appOrigin) &&
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
  await expect(page.getByText("R$ 864.250")).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/home.png", fullPage: true });
  await page.getByRole("tab", { name: "Operação" }).click();
  await expect(page.getByText("MANUTENÇÕES PENDENTES")).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/operation.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Pessoas" }).click();
  await expect(page.getByText("COLABORADORES NA UNIDADE")).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/people.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "A pagar" }).click();
  await expect(page.getByText("Contas a pagar")).toBeVisible();
  await expect(page.getByText("Distribuidora Horizonte")).toBeVisible();
  await expect(page.getByText("R$ 184.320")).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({
    path: "docs/screenshots/payables.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Fluxo da semana" }).click();
  await expect(page.getByText("Ritmo diário")).toBeVisible();
  await expect(page.getByText("-R$ 310.463").first()).toBeVisible();
  await expect(page.getByText(/ENTRADAS · D\+1/)).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({
    path: "docs/screenshots/cash-flow-week.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: /IA$/ }).click();
  await page
    .getByRole("button", { name: "Como estão minhas empresas este mês?" })
    .click();
  await expect(page.getByText(/consultei 4 casas/)).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/assistant.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Mais" }).click();
  await page.getByRole("button", { name: "Notificações", exact: true }).click();
  await expect(page.getByText("Uma conta vence hoje")).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/notifications.png",
    fullPage: true,
  });
  await page.goBack();
  await page.getByRole("tab", { name: "Início" }).click();
  await page.getByRole("button", { name: "Escolher casa" }).click();
  await page.getByRole("button", { name: "Selecionar Mdna" }).click();
  await expect(
    page.getByText("R$ 628.430").filter({ visible: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/dashboard-house.png",
    fullPage: true,
  });
  await expect(
    page.getByText("R$ 864.250").filter({ visible: true }),
  ).toHaveCount(0);
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
test("protected deep link survives login", async ({
  page,
}) => {
  await page.goto("/notifications");
  await expect(page).toHaveURL(/login/);
  await page.getByRole("button", { name: "Entrar na demonstração" }).click();
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
test("restricted access hides unauthorized tabs and logout protects history", async ({
  page,
}) => {
  await login(page, "Acesso restrito");
  await expect(page.getByText("R$ 864.250")).toBeVisible();
  await expect(page.getByRole("tab", { name: /IA$/ })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "A pagar" })).toBeVisible();
  await page.getByRole("tab", { name: "Mais" }).click();
  await page.getByRole("button", { name: "Sair da demonstração" }).click();
  await expect(page).toHaveURL(/login/);
  await page.goBack();
  await expect(page.getByText("R$ 864.250")).toHaveCount(0);
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
  await page.getByRole("tab", { name: "Mais" }).click();
  await page.getByRole("button", { name: "Preferências e simulação" }).click();
  await page.getByRole("button", { name: "Vazio", exact: true }).click();
  await page.goBack();
  await page.getByRole("tab", { name: "A pagar" }).click();
  await expect(page.getByText("Nenhuma conta em aberto para esta casa.")).toBeVisible();
  await page.getByRole("tab", { name: "Mais" }).click();
  await page.getByRole("button", { name: "Preferências e simulação" }).click();
  await page.getByRole("button", { name: "Offline", exact: true }).click();
  await page.goBack();
  await page.getByRole("tab", { name: "A pagar" }).click();
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
  await page.getByRole("tab", { name: "A pagar" }).click();
  await expect(page.getByText("Distribuidora Horizonte")).toBeVisible();
});
test("authenticated deep link still denies missing capability", async ({
  page,
}) => {
  await page.goto("/notifications");
  await page
    .getByRole("button", { name: "Acesso restrito", exact: true })
    .click();
  await page.getByRole("button", { name: "Entrar na demonstração" }).click();
  await expect(
    page.getByText("Acesso restrito", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Uma conta vence hoje")).toHaveCount(0);
});
