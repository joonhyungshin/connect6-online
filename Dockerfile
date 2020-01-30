FROM node:latest

COPY nodejs /app
WORKDIR /app/

RUN npm install
RUN gcc jail/jail-8080/sandbox.c -o jail/jail-8080/sandbox -O2
CMD node index 8080

EXPOSE 8080

