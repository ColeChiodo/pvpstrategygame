# Dockerfile for development
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install   # do NOT omit dev dependencies

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

