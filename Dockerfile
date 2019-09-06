FROM jobscale/node
SHELL ["bash", "-c"]

WORKDIR /root

RUN apt-get update && apt-get install -y netcat

COPY . .

EXPOSE $PORT
CMD ["./daemon"]
