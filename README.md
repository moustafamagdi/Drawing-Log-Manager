# Drawing Log Manager

Static web frontend for the SAAD drawing numbering and drawing register workflow, backed by Supabase/PostgreSQL.

## Current MVP

- Supabase email/password authentication
- Dashboard summary
- Drawing register search and filtering
- New drawing number generation through the database RPC
- Controlled code lists loaded from Supabase
- CSV export of the drawing register
- RLS-protected database access

## Architecture

- Frontend: vanilla HTML/CSS/JavaScript (ES modules)
- Backend: Supabase / PostgreSQL
- Hosting: GitHub Pages, Cloudflare Pages, Netlify, or any static host

The browser uses only the Supabase project URL and publishable key. Never place a Supabase secret/service-role key or database password in this repository.

## Local use

Serve the repository with any static HTTP server and open `index.html`. Direct `file://` use is not recommended because browser module/CORS behavior varies.

## Deployment

GitHub Pages can publish directly from the `main` branch. No build step is required for the current MVP.
