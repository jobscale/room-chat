FROM jobscale/node:bionic
SHELL ["bash", "-c"]

WORKDIR /root
COPY . .

RUN apt install -y netcat
RUN . .nvm/nvm.sh && npm i && npm i socket.io@1.3.7

EXPOSE $PORT
CMD ["./daemon"]
