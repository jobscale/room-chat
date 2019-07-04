FROM jobscale/ubuntu:bionic
SHELL ["bash", "-c"]

WORKDIR /root
COPY . .

RUN ./setup && . .nvm/nvm.sh && npm i

EXPOSE $PORT
CMD ["./daemon"]
