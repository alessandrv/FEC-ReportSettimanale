# Microsoft 365 backend

The app has a backend provider layer and Microsoft Entra ID sign-in, following the same
architecture as the RimborsoSpese app.

- `memory` keeps a local-development behavior: visits live in memory and the
  "cliente visitato" search returns a mock client list.
- `microsoft365` writes visits into a Microsoft List and reads the client directory
  from a Microsoft List through Microsoft Graph.

Switch provider with `.env`:

```env
REPORTS_BACKEND_PROVIDER=microsoft365
```

## Authentication

Same setup as RimborsoSpese:

- Inside Microsoft Teams the user is signed in silently via Teams SSO (OBO flow).
- In the browser, users sign in interactively with their Fec Italia account (Entra ID).
- The signed-in user is always the owner of the visits they create; the client cannot
  impersonate another user.
- Admins (managers) can read every commerciale's report. Admin status comes from the
  optional Employees list (`IsAdmin=Yes`) or the `AUTH_ADMIN_EMAILS` fallback allowlist.

```env
AUTH_ADMIN_EMAILS=name.surname@fecpos.it,another.admin@fecpos.it
```

### Entra app registration

For a quick start you can reuse the RimborsoSpese app registration (same tenant-level
Graph permissions are needed: application permission to read/write SharePoint lists).

For Teams SSO on the production domain you need an app registration whose
**Application ID URI** matches the new domain:

```text
api://report.fecitalia.it/<app-client-id>
```

### Current packaged configuration

`teams-app/manifest.zip` is already built with these values:

- Teams catalog app id (`id`): `4fe9f6ed-1e6e-4ffb-a96e-5094fcc28234` — a **distinct**
  GUID. It must not equal the RimborsoSpese Teams app id, or the two apps collide in
  the tenant catalog. This is only the package identity; it is unrelated to Entra.
- SSO app (`webApplicationInfo.id`): `6b567373-bf89-4741-8cd8-bfefe7232195` — the
  **reused RimborsoSpese Entra app registration** client id.
- SSO resource (`webApplicationInfo.resource`):
  `api://report.fecitalia.it/6b567373-bf89-4741-8cd8-bfefe7232195`

### Steps to make SSO work on report.fecitalia.it (reusing the RimborsoSpese app)

The RimborsoSpese Entra app currently exposes `api://rimborso.fecitalia.it/6b567373…`.
To also serve `report.fecitalia.it`, add a second identifier on the same app:

1. Entra ID → App registrations → the RimborsoSpese app (`6b567373-…`).
2. Expose an API → add a second **Application ID URI**:
   `api://report.fecitalia.it/6b567373-bf89-4741-8cd8-bfefe7232195`
   (an app can hold multiple identifier URIs). Keep the existing `access_as_user` scope.
3. Confirm the Teams client applications are pre-authorized on that scope:
   - `1fec8e78-bce4-4aaf-ab1b-5451cc387264` (Teams mobile/desktop)
   - `5e3ce6c0-2b1f-4285-8d4b-75ee78787346` (Teams web)
4. Add the Web redirect URI for browser login:
   `https://report.fecitalia.it/api/auth/callback/microsoft-entra-id`
   (plus `http://localhost:3000/api/auth/callback/microsoft-entra-id` for local dev).
5. Upload `teams-app/manifest.zip` in Teams (Apps → Manage your apps → Upload an app),
   or publish it tenant-wide via the Teams admin center.

If you later prefer a dedicated app registration instead of reusing RimborsoSpese's,
create it, then swap `webApplicationInfo.id`/`resource` (and the `.env` client id/secret)
to the new client id and rebuild the zip:

```bash
cd teams-app && zip -j -X manifest.zip manifest.json color.png outline.png
```

## Microsoft Lists schema

Create the lists in the target SharePoint site (default: `sites/ReportSettimanale`).

### Visits list (required)

| Display name | Internal name | Type | Notes |
| --- | --- | --- | --- |
| Title | `Title` | Single line of text | Auto-filled by the app |
| Employee ID | `EmployeeId` | Single line of text | Filled from the signed-in Entra user |
| Employee Name | `EmployeeName` | Single line of text | Denormalized for reporting |
| Employee Email | `EmployeeEmail` | Single line of text | |
| Visit date | `VisitDate` | Date only | |
| Year | `Year` | Number | ISO week-numbering year |
| Week | `Week` | Number | ISO week number (1-53) |
| Client name | `ClientName` | Single line of text | |
| Client ID | `ClientId` | Single line of text | Id in the client directory, empty for free-text clients |
| Notes | `Notes` | Multiple lines of text | |

Set `MICROSOFT365_VISITS_LIST_ID` with this list's id.

The `ClientId` column stores the ERP key of the picked client (empty when the
commerciale typed a free-text name that is not in the directory).

### Employees list (optional)

Reuses the RimborsoSpese schema; only used to flag admins.

| Display name | Internal name | Type | Notes |
| --- | --- | --- | --- |
| Name | `Title` | Single line of text | |
| Employee ID | `EmployeeId` | Single line of text | |
| Email | `Email` | Single line of text | Matched against the signed-in Entra email |
| Active | `IsActive` | Yes/No | |
| Admin | `IsAdmin` | Yes/No | Grants access to "Tutti i commerciali" |

You can point `MICROSOFT365_EMPLOYEES_LIST_ID` at the existing RimborsoSpese
Employees list if the admin set is the same.

## API surface

- `GET /api/visits?year=&week=` — the signed-in user's visits for an ISO week.
- `GET /api/visits?action=all&year=&week=` — all users' visits (admin only).
- `POST /api/visits` — bulk create: `{ visits: [{ date, clientName, clientId?, notes? }] }`.
  The server derives the ISO year/week from each date and stamps the session user.
- `DELETE /api/visits/[id]` — owner or admin only.
- `GET /api/clients?query=` — client directory search (min 2 characters, top 20).

## Environment variables

```env
REPORTS_BACKEND_PROVIDER=microsoft365
AUTH_SECRET=generate-a-random-secret
AUTH_ADMIN_EMAILS=
AUTH_MICROSOFT_ENTRA_ID_ID=
AUTH_MICROSOFT_ENTRA_ID_SECRET=
AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/<tenant-id>/v2.0
MICROSOFT365_TENANT_ID=
MICROSOFT365_CLIENT_ID=
MICROSOFT365_CLIENT_SECRET=
MICROSOFT365_SHAREPOINT_HOSTNAME=fecitalia.sharepoint.com
MICROSOFT365_SHAREPOINT_SITE_PATH=sites/ReportSettimanale
MICROSOFT365_SITE_ID=
MICROSOFT365_VISITS_LIST_ID=
MICROSOFT365_CLIENTS_LIST_ID=
MICROSOFT365_EMPLOYEES_LIST_ID=
```
