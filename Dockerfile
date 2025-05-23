FROM node:18-alpine

WORKDIR /app

# Install dependencies for node-gyp
RUN apk add --no-cache python3 make g++

COPY package*.json ./

RUN npm install

COPY . .

# Create necessary directories
RUN mkdir -p /app/db

# Set proper permissions
RUN chown -R node:node /app

USER node

CMD ["node", "bot.js"] 