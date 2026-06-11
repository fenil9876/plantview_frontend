# syntax=docker/dockerfile:1

# ----------------------------------------------------------------------------
# Stage 1 — build the static bundle.
# The API base URL is baked in at build time (Vite inlines VITE_* vars).
# ----------------------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# Install deps first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Build with the chosen API base URL. Process env wins over any .env file.
ARG VITE_API_BASE_URL=http://localhost:8000/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY . .
RUN npm run build

# ----------------------------------------------------------------------------
# Stage 2 — serve the prebuilt assets with nginx (alpine, minimal memory).
# Only the static files and a tiny nginx config land in the final image; no
# Node.js, no node_modules, no source.
# ----------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
