FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY vite.config.ts ./
COPY index.html ./
COPY tsconfig.json ./
COPY public ./public/
COPY src ./src/

EXPOSE 5173

CMD ["npm", "run", "dev"]
