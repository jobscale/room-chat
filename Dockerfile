FROM node
WORKDIR /root
ENV DEBIAN_FRONTEND noninteractive
RUN apt-get update && apt-get install -y netcat
COPY . .
RUN npm i --production
RUN rm -fr /var/lib/apt/lists/*
EXPOSE $PORT
CMD ["./start.sh"]
