# syntax=docker/dockerfile:1
#
# The agency dashboard as a container: build the bundle, then serve it as static files.
# Two stages, and nothing from the first reaches the image — the runtime layer is
# nginx plus a dist/ directory. No Node, no node_modules, no source.
#
# ⚠ BUILT IN CI, NEVER ON THE HOST. The VPS is 2 vCPU / 8 GB and already runs
#   Mongo, three Redis, two Postgres clusters, n8n and three backend services. A
#   tsc -b plus a Vite build next to that is how the kernel ends up choosing the
#   largest resident process to kill, which is mongod.
#   .github/workflows/release.yml builds this on GitHub's runners and pushes it to
#   GHCR; Dokploy only ever pulls.
#
# ⚠ THE API URL IS BAKED IN HERE, NOT INJECTED AT RUN TIME. Vite inlines every
#   VITE_ value into the JavaScript at build time, so the image IS the
#   configuration: env/.env.production decides what this image talks to, and changing it
#   needs a rebuild rather than a restart. That is also why there is no entrypoint
#   script rewriting placeholders — it would buy run-time configurability nothing
#   here needs, at the cost of a layer that can corrupt a bundle.

# ─── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Lockfile first, so npm ci is cached and only re-runs when a dependency really
# changes. Copying the source first would invalidate the install layer on every
# commit.
COPY package.json package-lock.json ./

# npm ci, not npm install: it installs exactly the lockfile and fails if the two
# disagree, which is what you want in a build nobody is watching.
# Dev dependencies are REQUIRED here — npm run build starts with tsc -b.
RUN npm ci

COPY . .

# ⚠ THIS ENV LINE IS WHAT MAKES DEEP LINKS WORK.
#
#   vite.config.ts resolves base to '/' only when WEB_DEPLOY=1, and otherwise
#   keeps the relative './' that Capacitor needs to serve the bundle off a device
#   filesystem. Without it, index.html references ./assets/index-abc.js; a browser
#   hard-refreshing /shipments/ID resolves that against the current directory,
#   nginx's SPA fallback answers the missing path with index.html, and the browser
#   refuses to execute HTML as a module — a blank page with a clean server log.
#
#   ⚠ DO NOT REPLACE THIS WITH --base=/ ON THE BUILD COMMAND. That was the first
#     attempt and it is a trap on Windows: Git Bash/MSYS rewrites a lone / argument
#     into the Git installation prefix, so the build emitted
#     base: "C:/Program Files/Git/" and still exited 0. Measured, not theorised.
ENV WEB_DEPLOY=1
RUN npm run build

# ─── CONFIGURATION GUARD ─────────────────────────────────────────────────────
# Prove the bundle was built against env/.env.production before this image can exist.
#
# Vite inlines the API host at build time, so a build that never saw that file
# still SUCCEEDS — it quietly falls back to the localhost default in
# src/services/http.ts, and the result is an image that looks fine, starts fine,
# serves fine and cannot reach any backend. The likeliest cause is a
# .dockerignore that excludes env/ or .env* a little too broadly: a one-character
# mistake with no other symptom.
#
# ⚠ THIS CHECKS FOR PRESENCE OF THE PRODUCTION HOST, NOT ABSENCE OF localhost.
#   A correct bundle contains BOTH — the localhost URL is a ?? fallback in the
#   source and is compiled in as unreachable code. Asserting that localhost is
#   absent fails every legitimate build. Measured on a real one before this guard
#   was written, which is the only reason it is phrased this way round.
RUN grep -rq "https://api[.]wi-mall[.]com/api" dist/assets/ || ( \
      echo "FATAL: https://api.wi-mall.com/api is not in the built bundle."; \
      echo "  env/.env.production was not read by this build."; \
      echo "  Check that .dockerignore does not exclude it."; \
      exit 1 )

# ─── Stage 2: serve ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# The stock config serves /usr/share/nginx/html with no SPA fallback and no cache
# policy. Replace it rather than adding beside it, so there is exactly one server
# block and no ambiguity about which one wins.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY deploy/nginx.conf /etc/nginx/conf.d/app.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Liveness only — nginx either serves the bundle or it does not. There is no
# dependency to report, so this can never go unready for somebody else's fault.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
