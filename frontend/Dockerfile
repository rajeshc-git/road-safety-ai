# syntax=docker/dockerfile:1

# ── Stage 1: Build production dist bundle ──────────────────────────────────────
FROM oven/bun:1.4.2-alpine AS builder

WORKDIR /app

# Copy dependency specifications and lockfiles
COPY package*.json ./
COPY bun.lock* ./

# Install dependencies — cached across rebuilds via BuildKit mount
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install

# Copy source code and config files
COPY . .

# Compile optimized production dist bundle (no dev server)
RUN bun run build

# ── Stage 2: Serve compiled dist with ultra-lightweight Nginx ───────────────────
FROM nginx:alpine

# Copy custom Nginx reverse proxy configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy production dist output from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose production port
EXPOSE 9999

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
