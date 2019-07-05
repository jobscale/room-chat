FROM jobscale/node:bionic
SHELL ["bash", "-c"]

WORKDIR /root
COPY . .

RUN apt install -y netcat

EXPOSE $PORT
CMD ["./daemon"]
