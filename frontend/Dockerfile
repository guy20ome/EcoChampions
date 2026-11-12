FROM node:22-slim AS build
WORKDIR /app
ARG VITE_API_URL
COPY package*.json ./
RUN npm install
COPY . .
ENV VITE_API_URL=/api
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
