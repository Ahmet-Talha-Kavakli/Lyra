# Multi-stage Docker build for Lyra
# Stage 1: Builder
FROM node:22-alpine AS builder

WORKDIR /build

# Copy package files
COPY package*.json ./

# Install dependencies (without dev dependencies)
RUN npm ci --only=production

# Copy source code
COPY . .

# Stage 2: Runtime
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy node_modules and app from builder
COPY --from=builder --chown=nodejs:nodejs /build/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Set environment
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "server.js"]
