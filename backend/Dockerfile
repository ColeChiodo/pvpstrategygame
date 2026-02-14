FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/

EXPOSE 3000

ENV KUBECONFIG=/app/.kube/config

CMD ["sh", "-c", "npx dotenv -e .env -- npm run dev"]
