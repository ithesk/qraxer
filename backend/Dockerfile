FROM node:18-alpine

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias (usar npm install porque no hay package-lock.json)
RUN npm install --omit=dev

# Copiar código fuente
COPY src ./src

# Puerto
EXPOSE 3001

# Usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# Comando de inicio
CMD ["node", "src/index.js"]
