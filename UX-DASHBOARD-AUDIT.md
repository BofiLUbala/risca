# RISAC – UX audit of all dashboards

**Scope:** the 12 role dashboards on web (`frontend/src/components/dashboard/boards/*`, shell in `tableau-de-bord/page.tsx`, `widgets.tsx`, `RoleActions.tsx`, `Sidebar`, `Topbar`) and the mobile dashboard (`mobile/app/(tabs)/index.tsx`, `mobile/src/components/boards.tsx`).
**Method:** static code review. I did not run the app with live data or test each role in a browser, so contrast, overflow and spacing findings are inferred from the code and should be confirmed visually.
**Severity:** P0 = broken or misleading, P1 = clearly hurts the main task, P2 = polish.

---

## 1. Global verdict

The dashboards are clean and consistent in look (cards, stat tiles, one palette), but they are **inventory screens, not work screens**. Each one answers "what are the numbers?" instead of "what must I do now, and how bad is it?". Most KPIs cannot be clicked, nothing is ranked by urgency, there is no time context or trend, and the role's real task list is pushed to the bottom of the page. On mobile, 8 of 12 roles get a placeholder.

---

## 2. Cross-cutting problems (affect every role)

| # | Sev | Problem | Where | Fix |
|---|-----|---------|-------|-----|
| G1 | **P0** | **No error state.** If `/dashboard` fails, `data` stays undefined and the page shows a spinner forever. Same on mobile. | `tableau-de-bord/page.tsx:25` (`isLoading \|\| !data`), mobile `index.tsx` | Read `error` from SWR, show an error card with a "Réessayer" button. Keep stale data visible if a refresh fails. |
| G2 | **P0** | **Mobile gives most roles an empty or wrong dashboard** (see section 4). | `mobile/.../boards.tsx` | Build boards for Agent, Staff, Moderator, Finance, Regional, National, Auditor, Partner. |
| G3 | P1 | **KPI tiles are not links.** "À valider", "Signalements ouverts", "À approuver", "Décaissements à confirmer", "Justificatifs attendus" are the user's tasks, but `Stat` has no `href`. Only some `CountRow`s link. | `ui/Stat.tsx`, all boards | Add optional `href` to `Stat` and link every actionable KPI to the pre-filtered list. |
| G4 | P1 | **Actions are buried.** "Mes fonctionnalités" is a generic card grid at the very bottom, below all the stats. It repeats the sidebar and gives every action equal weight. | `RoleActions.tsx`, `tableau-de-bord/page.tsx` | Put 1–3 primary CTAs at the top for work roles (Agent, Director, Staff, Ambassador). Drop or collapse the grid for roles that already have it in the sidebar. |
| G5 | P1 | **No urgency ordering.** Overdue, serious and failed items are mixed with neutral counts. Colors are assigned per tile, not per state: "Justificatifs attendus" is coral while "Fonds décaissés" is amber. | `Stat` tones everywhere | Define a rule: coral = needs action now, amber = attention, mint = healthy, neutral = information. Apply it by value, not by tile. |
| G6 | P1 | **No time context or trend.** No "mis à jour à…", no period label, no delta versus last week or month. The page auto-refreshes every 60 s without telling the user. | `useSWR(... refreshInterval: 60000)` | Add "Mis à jour il y a X min", a period on each figure, and a delta or sparkline on the key KPIs. |
| G7 | P1 | **French is unfinished.** Accents are missing in many user-facing strings: "Identifie", "Oriente", "labellises", "Decouvrir", "geles", "Activite recente", "Seances realisees", "equilibres", "A corriger", "Moderer", "Repondre", "televerser", "valable jusqu au" (apostrophe missing). Other strings in the same files are correctly accented. | National, Ambassador, Auditor, Staff, Donor, Partner, Finance, `role-actions-map.ts` | Run an accent pass; add a lint or spell check on `.tsx` strings. |
| G8 | P1 | **Raw backend codes leak into the UI**: `${k.kind} (${k.accounts})`, `p.provider`, `t.category`, `r.targetType`, `a.action`, `(${a.actor.role})`. | Finance, Moderator, Auditor | Map every enum through `label()` or `ROLE_LABEL`, as is already done for `label(s.status)` in SuperAdmin. |
| G9 | P1 | **Inconsistent empty states.** Most use a gray centered sentence. A proper `Empty` component exists but is not used on dashboards. Several lists have no empty state at all (SuperAdmin byStatus and worldMap, Finance recent donations and byProvider, Regional ambassadorPerformance). | boards | Use one empty pattern with a reason and a next step. |
| G10 | P1 | **Lists are unbounded or silently truncated.** Regional `overdueDetails`, `nearingAdulthood` and `ambassadorPerformance` have no cap. Ambassador `alerts.slice(0, 8)` truncates with no "+N de plus". | Regional, Ambassador | Cap at 5–8 and add "Voir les N autres". |
| G11 | P1 | **Page title duplication.** The shell `Topbar` shows a title and a role/province subtitle, and the page repeats "Bonjour {name}" plus the same role/province line as another `h1`. Two `h1`s on one page and the same text twice. | `Topbar.tsx`, `tableau-de-bord/page.tsx` | Keep one `h1`. Show the role/scope line once. |
| G12 | P1 | **Accessibility gaps.** Meaning is carried by color alone (AlertRow tones, Stat tones, reconciliation green or red box). `text-ink-400` is used at `text-xs` for timestamps and empty states, which is likely below 4.5:1 on white. `Progress` has no `role="progressbar"`, `aria-valuenow` or text value. Clickable rows rely on hover color only. | `widgets.tsx`, boards | Add a status icon or word next to color, raise the muted text color, add progressbar ARIA, add focus-visible rings. |
| G13 | P2 | **Loading uses a full-page spinner** instead of skeletons. `SkeletonList` exists but is unused here. The layout jumps when data arrives. | `PageLoading` | Render the grid of skeleton cards immediately. |
| G14 | P2 | **Currency is ambiguous.** `money()` defaults to USD and most tiles show a bare number with no currency note, although donations and disbursements can be in other currencies. | `widgets.tsx` `MoneyRow`, Stats | State the currency, and say when a figure is converted. |
| G15 | P2 | **Layout glitches.** Rows built as `justify-between` with a long right-hand `shrink-0 text-xs` string will squeeze the name on narrow screens (Regional ambassador performance, Regional nearing adulthood, Ambassador FONAREV). `Wrapper: any` is used for `Link`/`div`. | Regional, Ambassador, `widgets.tsx` | Stack on `<sm`, wrap the meta text. |
| G16 | P2 | **Duplicated code.** `FONAREV_LABEL` is defined twice (National, Ambassador). | | Move to `lib/roles`. |
| G17 | P2 | **Unexplained jargon.** "FONAREV" is shown with no explanation, and "Labellisation" has no hint. | National, Ambassador | Add a tooltip or a one-line description. |

---

## 3. Per-dashboard critique (web)

### Super Admin  (`SuperAdmin.tsx`)
- **P1 – Priority is upside-down.** The first row is "Connectés maintenant", total users, children and funds raised. The things that need a decision (pending approvals, open reports, tickets) sit in the third block, small, as plain rows.
- **P1 – Missing: reconciliation.** The Finance and Auditor dashboards show the daily reconciliation status. The Super Admin, who owns the whole network, does not. A ledger discrepancy would not show up here.
- **P1 – Security card has no judgment.** "Connexions échouées (24 h)" and "Comptes bloqués à l'activation" are raw numbers with no threshold, no trend and no link to the affected accounts.
- **P1 – "Carte mondiale des utilisateurs" is not a map.** It is a grid of country tiles, so the title overpromises and the feature gives no geographic insight. Either build a real map or rename it "Utilisateurs par pays".
- P2 – "Dossiers enfants par statut" is a text list. Proportions would read faster as bars. The status rows are not clickable even though a "Voir les dossiers" link exists.
- P2 – Labellisation target (`labelled / target`) has no deadline or pace, so users cannot tell if the network is on track.
- P2 – No system health (queues, jobs, integrations).

### Finance  (`Finance.tsx`)
- **P1 – The most important signal is hidden.** Reconciliation (balanced or not) is the finance admin's safety check, yet it is the third small card, below four tiles. An imbalance should be a top-of-page banner.
- **P1 – Discrepancy rows are not actionable.** They show "stocké X / calculé Y" with no difference, no link to the account and no age.
- **P1 – Queue tiles have no value or age.** "À approuver" shows a count only. A finance admin needs the total amount waiting and the age of the oldest request. The tile does not link to `/decaissements`.
- **P1 – Missing KPI the product itself calls critical.** `role-actions-map` says "Un compte non vérifié bloque les paiements", but the dashboard shows no count of unverified orphanage accounts.
- P1 – "Compte central" appears twice (tile and "Soldes"), and "Frais" appears under two names (Frais de fonctionnement, Frais prélevés).
- P2 – "Par fournisseur" shows totals only: no share, no failure or pending rate, no currency split.
- P2 – "Derniers dons réglés" shows date and amount but no donor, no link to the donation, and no failed or pending donations.

### Moderator  (`Moderator.tsx`)
- **P1 – No SLA or age.** The queue does not show the oldest open report or how long items have waited. The list is "recent", not "most urgent".
- **P1 – Serious reports are not prioritized.** There is a separate "graves" tile, but the list below is not sorted or filtered by severity.
- **P1 – Confusing badge.** The `Badge` receives both a `status` and a severity override, so one pill is trying to mean two things.
- P1 – Raw `targetType` and `category` values are shown.
- P2 – Support is reduced to counts per category. There is no ticket list, so the moderator must navigate away to see any ticket. "Contenus masqués" is a number with no action.

### Ethics Auditor  (`Auditor.tsx`)
- **P1 – Compliance metrics are dead ends.** "Enfants sans consentement photo" and "Accès psychotrauma (30 j)" are the point of this role, but neither links to the list behind it, and there is no trend.
- **P1 – Reconciliation is shown without detail.** Unlike Finance, discrepancies are only counted, so an auditor cannot see which account is off.
- **P1 – Activity log is unreadable.** `a.action` is a raw code and the actor shows a raw role code, e.g. `(ORPHANAGE_DIRECTOR)`. There is no filter and no severity.
- P2 – The permanent blue banner takes prime space to repeat a rule the user already knows. It mentions freezing a project or account, but there is no freeze action on this page.
- P2 – "Projets gelés / Comptes gelés" are not linked to the frozen items.

### National Manager  (`National.tsx`)
- **P1 – Region comparison compares nothing.** The list shows only the orphanage count per region. No children, funds, dossier completeness, overdue items or validation backlog, so a national manager cannot tell which region needs help. There are no bars and the rows are not clickable.
- **P1 – No action queue.** Nothing about pending approvals, overdue updates, or regional managers who are inactive.
- P1 – "Zone à risque" is a tiny amber chip in lowercase and unaccented. A risk zone deserves stronger treatment and a reason.
- P2 – "Fonds reçus" and "Fonds décaissés" are two separate tiles with no ratio or timeline. "Encadrement" counts are not linked to the user list.

### Regional Manager  (`Regional.tsx`)  – the best of the set, still weak in places
- **P1 – "À valider" is not a link** even though `/validations` is this role's main job. Pending transfers (a validation task) appear only in a conditional section at the very bottom.
- **P1 – Two numbers for the same idea.** The tile says `completionRate` from the API, while the progress bar computes `active / children` on the client. They can disagree.
- **P1 – The "Alertes" tile mixes two meanings** (overdue count with "proches de 18 ans" as the hint), and the overdue list is unbounded.
- P2 – Ambassador performance is unsorted, a crowded sentence ("5 enfants, 3 visites, 2 publications"), with no benchmark or target, so it cannot show who is struggling.
- P2 – Title format "Prénom (ID) - orphelinat" uses a hyphen and is hard to scan.

### Ambassador  (`Ambassador.tsx`)
- **P1 – Task, no list.** "Décaissements à confirmer" is a coral tile, but there is no list of those items and no link, so the ambassador cannot act from the dashboard.
- **P1 – Vanity before action.** "Mes publications" (views, reactions) sits above the unreadable FONAREV block, while overdue visits are limited to 8 with no "see all".
- P2 – FONAREV block shows a raw status with no next step.
- P2 – "Fonds levés" and "enfants parrainés" mix two ideas in one tile.

### Orphanage Director  (`Director.tsx`)
- **P1 – "Compte non vérifié" is just a chip.** The code comment and role map say an unverified account blocks payments. That is a blocking condition and needs an alert banner with a "Vérifier mon compte" CTA, not a small amber chip.
- **P1 – Label expiry has no warning.** The label date is plain text ("valable jusqu au …"). An expiring label should turn into a warning ahead of time.
- P1 – "Mes dossiers" card also lists "Personnel" and "Projets", which are not dossiers.
- P2 – "Places occupées" is `x / y` without a bar or percentage. "Solde disponible" does not warn when the account is unverified (and so unusable).
- P2 – The primary action ("Nouvel enfant") is a small text link in a card corner.

### Orphanage Staff  (`Staff.tsx`)  – nearly empty
- **P0 – Wrong content for Social Worker.** The code treats everything that is not Psychologist or Educator as health staff, so a `SOCIAL_WORKER` sees "Fiches santé saisies", which is not their function. (`Staff.tsx`: `!isPsy && !isEdu`)
- **P1 – Nothing to do.** One banner, two or three tiles and one button. "Sans évaluation initiale" and "Sans bulletin" are exactly the to-do lists, but they are not clickable and no child list is shown.
- P2 – The "Actions" section has a single link that repeats "Mes fonctionnalités" below. The confidentiality notice is a chip next to a button, so it looks like another action.

### Field Agent  (`Agent.tsx`)
- **P1 – Duplicate CTAs.** The three actions (Recenser, Proposer, Signaler une urgence) appear in "Actions de terrain" and again in "Mes fonctionnalités", on the same screen.
- **P1 – "Signaler une urgence" is a ghost button**, the lowest-emphasis style, for the most safety-critical action.
- **P1 – No correction loop.** The agent sees "en attente de validation" but not which censuses were returned for correction, or why.
- P1 – A field agent often works with poor connectivity, yet there is no offline or draft-saved indicator.
- P2 – No list of recent entries.

### Donor  (`Donor.tsx`)  – good tone, but misses trust-building details
- **P1 – No payment status.** "Mes filleuls" shows the monthly amount but not the next payment date, a failed or paused payment, or a one-tap receipt. A failed recurring donation would go unnoticed.
- **P1 – "Preuves de dépense" is an amber tile that is not clickable.** Proof of how money was used is the core trust feature and should open the proofs.
- P2 – "Engagement mensuel" sums amounts that may be in different currencies. "Gérer" is a small text link. The feed images need meaningful `alt` text (the `SafeImage` usage does not set one here).

### Partner  (`Partner.tsx`)
- **P1 – Impact is not shown.** The partner sees a total contribution and project cards, but not what their money achieved, the share of each project they fund, or any report to share with their own stakeholders.
- P2 – "Partenaires du réseau" is a vanity tile. The org bio takes prime space and "Modifier la fiche" appears twice (here and in actions).

---

## 4. Mobile app dashboard  (`mobile/src/components/boards.tsx`)

| Role | What the user actually gets | Sev |
|------|------------------------------|-----|
| Field Agent | `GenericBoard` checks `data.children`, `money`, `queues`, `region`. The agent payload has none of them, so the screen shows **only the greeting**. This is the role most likely to use the phone. | **P0** |
| Orphanage Staff | Same: **blank screen**. | **P0** |
| Moderator | Shows a "Files en attente" card where "Validations" reads `data.queues.pendingApprovals` (not part of their data), so it shows a misleading 0 or NaN. | **P0** |
| Partner | Uses `DonorBoard`, so the card says "Mon impact" and "Dons effectués", not partner content. | P1 |
| Finance / Regional / National / Auditor | A generic block of numbers with no alerts, lists or reconciliation. No tap-through. | P1 |
| All roles | No error state, no auto-refresh (pull-to-refresh only), no tappable rows, no shortcut actions (the web has "Mes fonctionnalités"). Alerts are not tappable even for Ambassador. | P1 |
| Ambassador / Director | Rows are text only, so one cannot open a child or a disbursement from a reminder. | P1 |

---

## 5. What is missing from every dashboard

1. A single "Aujourd'hui, à faire" block (top 3–5 items by urgency with one-tap action).
2. Click-through from every KPI to a pre-filtered list.
3. Trend or comparison (vs last period) on key numbers.
4. "Last updated" plus manual refresh on web.
5. Error and offline handling.
6. Shared status semantics (color + icon + label) for urgent, warning, healthy.
7. Search or filter inside long lists.
8. Onboarding or empty-account guidance for new users (new donor, new partner, new orphanage director).

---

## 6. Recommended fix order

**Week 1 (P0, small effort)**
1. Add error and retry state to web and mobile dashboard (G1).
2. Fix the `SOCIAL_WORKER` branch in `Staff.tsx`.
3. Mobile: add real boards for Agent and Staff, and stop `GenericBoard` from rendering wrong zeros for Moderator (G2).

**Week 2 (P1, shared components)**
4. Make `Stat` clickable and wire every actionable KPI (G3).
5. Move the primary actions/queues to the top; remove duplicated CTAs on Agent/Staff (G4).
6. Define the urgency color rule and apply it by value (G5).
7. Accent pass and enum-label pass (G7, G8).
8. Replace the Director "compte non vérifié" chip with a blocking alert; promote the Finance reconciliation to a banner.

**Week 3+ (P1/P2)**
9. Real comparison table for National; ranked performance for Regional.
10. Add last-updated, period, trends, skeleton loading, cap and "voir plus" on lists.
11. Accessibility pass (contrast, progressbar ARIA, non-color cues).
12. Donor payment status, Partner impact view, Auditor drill-downs.
