FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY dist ./dist

ENV NODE_ENV=production
ENV GAME_ID=${GAME_ID:-default}
ENV PORT=${PORT:-3000}

EXPOSE $PORT

CMD ["node", "dist/index.js"]
