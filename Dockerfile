FROM node:4

WORKDIR /app
RUN apt-get update
ADD package.json /app/package.json
RUN npm install
RUN npm install -g node-dev #for hot reloads during development
ADD . /app/

CMD ["node", "index.js"]

EXPOSE 3000
