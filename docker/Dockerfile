FROM node:20-alpine

RUN mkdir /app
COPY . /app
WORKDIR /app

RUN yarn

EXPOSE 3000

CMD node /app/index.js