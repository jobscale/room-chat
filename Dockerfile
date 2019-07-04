FROM jobscale/ubuntu:bionic
SHELL ["bash", "-c"]

WORKDIR /root
COPY . .

RUN ./setup && npm i

EXPOSE $PORT
CMD ["./daemon"]
