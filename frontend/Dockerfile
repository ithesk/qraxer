# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Instalar dependencias del sistema para sharp y otras libs nativas
RUN apk add --no-cache python3 make g++ vips-dev

# Copiar package files
COPY package.json package-lock.json ./

# Instalar TODAS las dependencias (incluyendo devDependencies para el build)
RUN npm ci --include=dev

# Copiar código fuente
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src

# Build de producción
RUN npm run build

# Production stage con nginx
FROM nginx:alpine

# Copiar configuración de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar build
COPY --from=builder /app/dist /usr/share/nginx/html

# Puerto
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
