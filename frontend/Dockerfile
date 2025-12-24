# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Verificar que node y npm estén disponibles
RUN node --version && npm --version

# Copiar package files
COPY package.json package-lock.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src

# Build de producción usando npx para asegurar que vite se encuentra
RUN npx vite build

# Production stage con nginx
FROM nginx:alpine

# Copiar configuración de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar build
COPY --from=builder /app/dist /usr/share/nginx/html

# Puerto
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
