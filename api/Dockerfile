FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY dist ./dist
EXPOSE 4000
CMD ["node", "dist/server.js"]
