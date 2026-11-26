import { test } from "@playwright/test";
import {
  addDays,
  clearEvents,
  BASE,
  check,
  closeDb,
  futureMonday,
  loginAdmin,
  longMonthName,
  seedDemo,
  sql,
} from "./support";

// Vista de mes de la agenda: navegación, tope de eventos por día y celular.
test.afterAll(closeDb);

const monthName = (d: string) =>
  new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", month: "long" }).format(
    new Date(`${d}T12:00:00Z`),
  );
const firstOfMonth = (d: string, shift = 0) => {
  const x = new Date(`${d.slice(0, 7)}-01T12:00:00Z`);
  x.setUTCMonth(x.getUTCMonth() + shift);
  return x.toISOString().slice(0, 10);
};
const insertEvent = (title: string, date: string, hh: string, mm: string) =>
  sql(
    `insert into events(kind,title,starts_at,ends_at) values ('other','${title}',(timestamp '${date} ${hh}:${mm}' at time zone 'America/Argentina/Buenos_Aires'),(timestamp '${date} ${hh}:${mm}' at time zone 'America/Argentina/Buenos_Aires' + interval '30 minutes'))`,
  );

test("vista de mes", async ({ browser }) => {
  seedDemo();
  await clearEvents();
  // un lunes y su miércoles dentro del mismo mes
  let mon = futureMonday(14);
  while (mon.slice(0, 7) !== addDays(mon, 2).slice(0, 7)) mon = addDays(mon, 7);
  const wed = addDays(mon, 2);
  await insertEvent("Evento del lunes", mon, "10", "00");
  for (const [i, h] of ["08", "09", "10", "11", "12"].entries())
    await insertEvent(`Mucho ${i}`, wed, h, "00");

  const c = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const a = await c.newPage();
  await loginAdmin(a);
  await a.waitForURL("**/admin");
  await a.goto(`${BASE}/admin?vista=semana&fecha=${mon}`);
  await a.click("nav[aria-label=Vista] >> text=Mes");
  await a.waitForURL("**vista=mes**");
  check(
    "el botón Mes cambia de vista y conserva la fecha",
    a.url().includes(`fecha=${mon}`) &&
      (await a.innerText("header")).includes(longMonthName(mon)),
  );
  const cells = await a.locator("[role=gridcell]").count();
  check(
    "la grilla tiene 7 columnas (lunes a domingo)",
    cells > 0 && cells % 7 === 0,
  );
  check(
    "muestra el evento del lunes",
    (await a.innerText("[role=grid]")).includes("Evento del lunes"),
  );
  check(
    "día con muchos eventos: tope de 3 y «+2 más»",
    (await a.innerText("[role=grid]")).includes("+2 más"),
  );
  const day = Number(wed.slice(8));
  await a
    .locator(
      `a[aria-label^='miércoles'][aria-label*=' ${day} de ${monthName(wed)}']`,
    )
    .click({ position: { x: 4, y: 4 } });
  await a.waitForURL("**vista=dia**");
  check(
    "tocar un día abre la vista día",
    a.url().includes(`fecha=${wed}`) &&
      (await a.locator("a[href^='/admin/agenda/']:not([href*='/cita/']):not([href*='/evento/']):visible").count()) === 5,
  );

  await a.goto(`${BASE}/admin?vista=mes&fecha=${mon}`);
  await a.click("a[aria-label='Mes siguiente']");
  await a.waitForURL(`**fecha=${firstOfMonth(mon, 1)}`);
  check(
    "mes siguiente",
    (await a.innerText("header")).includes(longMonthName(firstOfMonth(mon, 1))),
  );
  await a.click("a[aria-label='Mes anterior']");
  await a.waitForURL(`**fecha=${firstOfMonth(mon, 0)}`);
  await a.click("a[aria-label='Mes anterior']");
  await a.waitForURL(`**fecha=${firstOfMonth(mon, -1)}`);
  check(
    "mes anterior",
    (await a.innerText("header")).includes(
      longMonthName(firstOfMonth(mon, -1)),
    ),
  );
  await a.goto(`${BASE}/admin?vista=mes&fecha=${mon}`);
  await a.click("nav[aria-label=Vista] >> text=Semana");
  await a.waitForURL("**vista=semana**");
  check("volver a Semana", (await a.innerText("header")).includes("al"));
  await a.goto(`${BASE}/admin?vista=mes&fecha=no-valida`);
  check(
    "una fecha inválida no rompe la pantalla",
    (await a.innerText("h1")).includes("Agenda"),
  );

  const m = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mp = await m.newPage();
  await loginAdmin(mp);
  await mp.waitForURL("**/admin");
  await mp.goto(`${BASE}/admin?vista=mes&fecha=${mon}`);
  check(
    "celular: la grilla no desborda",
    await mp.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await Promise.all([c, m].map((x) => x.close()));
});
