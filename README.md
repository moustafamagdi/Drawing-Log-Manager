# Drawing Log Manager

Static web application for controlled drawing numbering and revision management, backed by Supabase/PostgreSQL.

## V1 capabilities

- Supabase email/password authentication
- Role model: `viewer`, `editor`, `document_controller`, `admin`
- Dashboard and searchable/sortable/paginated Drawing Register
- Atomic six-digit serial allocation in PostgreSQL
- Drawing, Shop Drawing, As-Built and DDE number generation
- DDE types `A–I` and drawing types `0–8`
- Drawing details, metadata editing and lifecycle status
- Stage-only changes without revision increment
- Formal revision workflow (alphabetic/numeric by stage)
- Draft revisions such as `00.1`
- Revision filename generation with configurable template
- Revision history and audit trail
- Controlled code-list browser
- Admin organization-code management
- CSV export
- GitHub Pages deployment workflow

## Security model

The browser contains only the Supabase project URL and a publishable key. Never add a Supabase secret/service-role key or database password to this repository.

Official number allocation and revision issuance are implemented as role-checked PostgreSQL RPC functions. Direct serial-counter access is blocked by RLS. New accounts default to `viewer`.

Role intent:

- `viewer` — read-only register access
- `editor` — metadata and stage updates
- `document_controller` — allocate official drawing numbers, add revisions, control lifecycle status
- `admin` — all of the above plus controlled settings and organization codes

## Architecture

`Browser UI -> Supabase Auth/RLS -> PostgreSQL RPCs/Tables`

Frontend: vanilla HTML/CSS/JavaScript ES modules. Backend: Supabase/PostgreSQL. Hosting: GitHub Pages or any static host.

## Controlled-rule notes

Stage is stored as metadata and is not inserted into the V1 drawing number because the source standard is internally inconsistent on that point. As-Built is mapped to Stage `5C` based on the controlled stage appendix / QA wording. Filename format is configurable because the source contains conflicting filename wording and explicit examples.

## Deployment

The repository includes a GitHub Pages workflow under `.github/workflows/`. No frontend build step is required.
