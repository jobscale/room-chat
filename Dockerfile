FROM ubuntu:bionic
SHELL ["bash", "-c"]

WORKDIR /root
COPY . .

RUN ./setup

EXPOSE $PORT
CMD ["./daemon"]
