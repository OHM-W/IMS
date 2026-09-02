# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Node.js Backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package.json ./
RUN npm install
COPY backend/ ./
RUN npm run build

# Stage 3: Production Runtime Container
FROM node:20-alpine
ENV NODE_ENV=production

# Install Nginx, Supervisord, and curl for healthcheck
RUN apk add --no-cache \
    nginx \
    supervisor \
    curl \
    && rm -f /etc/nginx/http.d/default.conf /etc/nginx/conf.d/default.conf

WORKDIR /app

# Install production dependencies only
COPY backend/package.json ./
RUN npm install --omit=dev --ignore-scripts

# Copy Built Backend Application
COPY --from=backend-builder /app/backend/dist /app/dist

# Copy Built Frontend Assets from Stage 1
COPY --from=frontend-builder /app/frontend/dist /var/www/html

# Copy Configuration Files
COPY nginx.conf /etc/nginx/http.d/default.conf
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Ensure required log and run directories exist
RUN mkdir -p /var/log/supervisor /var/log/nginx /run /app/data

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=30s \
  CMD curl -f http://127.0.0.1:80/api/health || exit 1

CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
