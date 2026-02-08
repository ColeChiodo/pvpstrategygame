FROM node:20-alpine

WORKDIR /app

# Copy package files first to leverage cache
COPY package.json package-lock.json* ./
RUN npm install

# Copy everything else
COPY . .

# Fix permissions: all files readable by node user
RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["npm", "run", "dev"]
