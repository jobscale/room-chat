FROM jobscale/node:bionic
SHELL ["bash", "-c"]

WORKDIR /root
COPY . .

RUN apt install -y netcat
RUN . .nvm/nvm.sh && npm i

EXPOSE $PORT
CMD ["./daemon"]
