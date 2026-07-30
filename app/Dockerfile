##
## Build stage — installs the full dependency tree and compiles Next.js.
##
FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies from the lockfile first so this layer caches across
# source-only changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Next reads env at build time for static optimisation; every page here is
# force-dynamic, so no runtime secrets are needed to build.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

##
## Runtime stage — only the standalone server output and its assets.
##
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Run as a non-root user. Cloud Run doesn't require it, but a compromised
# process should not own the filesystem it runs on.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 8080

CMD ["node", "server.js"]
