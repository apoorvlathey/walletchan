# Railway Deployment

This workspace deploys the domain reputation service to Railway.

## Domain reputation

Use `apps/domain-reputation/Dockerfile` and its `railway.toml`; the Docker build
copies the workspace files and installs only `@walletchan/domain-reputation`.
Attach one volume at `/data`, set `DOMAIN_REPUTATION_SERVICE_TOKEN`, and put
the domain and same token in the website's `DOMAIN_REPUTATION_SERVICE_URL` /
`DOMAIN_REPUTATION_SERVICE_TOKEN` variables. `/readyz` is the deployment
healthcheck. The service loads its last-known-good snapshot from the volume
and polls the fixed MetaMask raw configuration URL with ETag validation.

Production variables are injected by Railway; do not copy `.env` files into
builds.
