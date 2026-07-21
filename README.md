# Report Settimanale

App Microsoft Teams per il report settimanale delle visite clienti dei commerciali.
Stessa architettura di RimborsoSpese: Next.js (App Router) + Auth.js con Teams SSO +
backend a provider (memoria per lo sviluppo, Microsoft Lists via Graph in produzione).
UI costruita con [HeroUI v3](https://heroui.com).

## Funzionalità

- **Form settimanale**: righe dinamiche "cliente visitato + data" con pulsante **+**
  per aggiungere visite; invio in blocco.
- **Cliente visitato**: ricerca con completamento automatico sul direttorio clienti
  dal gestionale Skyline (Oracle), con inserimento libero per i clienti non ancora
  censiti. Vedi [docs/client-directory.md](docs/client-directory.md).
- **Identità da Teams**: dentro Teams l'utente è riconosciuto automaticamente via SSO
  (nessun login); nel browser login Microsoft 365 classico.
- **Navigazione settimane**: consultazione e completamento delle settimane passate.
- **Vista manager**: gli admin vedono i report di tutti i commerciali.

## Sviluppo locale

```bash
npm install
npm run dev
```

Con `REPORTS_BACKEND_PROVIDER=memory` (default) l'app funziona subito: clienti mock e
visite in memoria. Serve comunque un login Microsoft (o Teams SSO) per entrare.

## Produzione

- `npm run build && npm run start` (porta 3009) oppure `pm2 start ecosystem.config.cjs`.
- Backend Microsoft 365: vedi [docs/microsoft-365-backend.md](docs/microsoft-365-backend.md)
  per lo schema delle liste SharePoint, l'app registration Entra e le variabili d'ambiente.
- App Teams: `teams-app/manifest.json` (dominio `report.fecitalia.it`, da zippare con le
  icone e caricare nel Teams admin center).

## Struttura

- `app/page.tsx` — schermata unica: navigatore settimana, form nuove visite, elenco visite,
  tab admin.
- `components/` — `report-form`, `client-combobox`, `visit-list`, `week-navigator`,
  `admin-panel`, `teams-sso`.
- `lib/backend/` — interfaccia `ReportBackend` + provider `memory` e `microsoft365`
  (archiviazione visite).
- `lib/clients/` — direttorio clienti separato: `ClientDirectory` letto dal
  gestionale Skyline (Oracle) in `providers/oracle.ts`.
- `lib/week.ts` — helper settimana ISO (lunedì-domenica).
- `auth.ts` — Auth.js: Teams SSO (OBO) + Microsoft Entra ID.
