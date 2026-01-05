FROM node:18-alpine

WORKDIR /app

# Instalar dependencias de compilación para better-sqlite3
RUN apk add --no-cache python3 make g++

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm ci --omit=dev

# Copiar código fuente
COPY src ./src

# Crear directorio para base de datos
RUN mkdir -p /app/data

# Puerto
EXPOSE 3001

# Usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app/data
USER nodejs

# Comando de inicio
CMD ["node", "src/index.js"]
