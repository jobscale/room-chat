FROM node:lts-bullseye
WORKDIR /root
ENV DEBIAN_FRONTEND noninteractive
RUN apt-get update && apt-get install -y netcat
RUN rm -fr /var/lib/apt/lists/*
COPY package.json .
RUN npm i --omit=dev
COPY . .
EXPOSE 3000
CMD ["./start.sh"]
