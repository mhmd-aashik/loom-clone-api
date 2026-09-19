# -----------------------------
# Stage 1 — Build
# -----------------------------
 FROM oven/bun:1 AS builder

 WORKDIR /app
 
 COPY package.json bun.lock ./
 
 RUN bun install --frozen-lockfile
 
 COPY . .
 
 RUN bun run build
 
 
 # -----------------------------
 # Stage 2 — Production
 # -----------------------------
 FROM oven/bun:1-slim AS production
 
 WORKDIR /app
 
 # FFmpeg package also provides ffprobe.
 RUN apt-get update \
     && apt-get install -y --no-install-recommends ffmpeg \
     && rm -rf /var/lib/apt/lists/*
 
 COPY package.json bun.lock ./
 
 RUN bun install \
     --production \
     --frozen-lockfile
 
 COPY --from=builder /app/dist ./dist
 
 ENV NODE_ENV=production
 
 EXPOSE 3000
 
 CMD ["bun", "run", "start:prod"]