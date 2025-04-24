FROM node:18-alpine

WORKDIR /

COPY package.json .

RUN npm install

# Copy the application source code
COPY . .

# Port number to expose the Node.js app outside of Docker
EXPOSE 3000

CMD ["npm", "start"]