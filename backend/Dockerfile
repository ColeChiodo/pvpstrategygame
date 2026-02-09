FROM node:20

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy Prisma files and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code (no dist needed, tsc runs in container)
COPY . .

# Create directory for kubeconfig
RUN mkdir -p /app/.kube

# Expose backend port
EXPOSE 3000

# Set environment variable for Kubernetes client
ENV KUBECONFIG=/app/.kube/config

# Start dev server using tsc in watch mode (if your npm run dev does that)
CMD ["sh", "-c", "npx dotenv -e .env -- npm run dev"]

