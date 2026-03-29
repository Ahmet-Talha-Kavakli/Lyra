# Dockerfile
# Multi-stage build: prod-ready image

FROM node:20-alpine AS base
WORKDIR /app

# Install dumb-init (graceful shutdown)
RUN apk add --no-cache dumb-init

# ─── BUILD STAGE ──────────────────────────────────────────────
FROM base AS builder
COPY package*.json ./
RUN npm ci --only=production

# ─── FINAL STAGE ──────────────────────────────────────────────
FROM base AS runtime

# Security: non-root user
RUN addgroup -g 1000 nodejs && adduser -D -u 1000 -G nodejs nodejs

# Copy built dependencies
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

# Set user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Graceful shutdown
ENTRYPOINT ["/usr/sbin/dumb-init", "--"]
CMD ["node", "server.js"]

# Expose
EXPOSE 3000

# Metadata
LABEL org.opencontainers.image.title="Lyra Brain" \
      org.opencontainers.image.description="AI Therapist Backend" \
      org.opencontainers.image.vendor="Lyra"
