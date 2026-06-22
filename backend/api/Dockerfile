# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
# Utiliser `npm ci` une fois le package-lock.json commité (recommandé en CI).
RUN npm install --omit=dev

# ---- runtime ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache tini
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER node
EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
