const express = require('express');
const http = require('http');
const createSocket = require('socket.io');
const redis = require('socket.io-redis');
const cache = require('redis');
const { EventEmitter } = require('events');

class App {
  constructor() {
    this.logger = console;
  }
}
class ChatServer extends App {
  constructor() {
    super();
    const { env } = process;
    this.debug = env.DEBUG;
    this.port = env.PORT || 3000;
    this.dbPort = env.DB_PORT || 6379;
    this.dbHost = env.DB_HOST || '127.0.0.1';
    this.initialize();
  }
  initialize() {
    this.emitter = new EventEmitter();
    this.route = express();
    this.server = http.createServer(this.route);
    this.server.listen(this.port);
    this.route.configure(() => {
      this.route.use(express.bodyParser());
      this.route.use(express.static(`${__dirname}/static`));
    });
    this.io = createSocket(this.server);
    this.io.adapter(redis({ host: this.dbHost, port: this.dbPort }));
    this.db = cache.createClient(this.dbPort, this.dbHost);
    this.initEvent();
    this.initRoute();
  }
  initEvent() {
    this.emitter.on('newEvent', (event, data) => {
      this.logger.info('%s: %s', event, JSON.stringify(data));
    });
    const action = socket => {
      socket.emit('connected', 'Welcome to the chat server');
      this.emitter.emit('newEvent', 'userConnected', { socket: socket.id });
      this.db.hset([socket.id, 'connectionDate', new Date()], redis.print);
      this.db.hset([socket.id, 'socketID', socket.id], redis.print);
      this.db.hset([socket.id, 'username', 'anonymous'], redis.print);
      this.subscribe(socket);
      this.unsubscribe(socket);
      this.getRooms(socket);
      this.getUsersInRoom(socket);
      this.setNickname(socket);
      this.newMessage(socket);
      this.disconnect(socket);
    };
    this.io.sockets.on('connection', action);
  }
  initRoute() {
    const requireAuthentication = (req, res, next) => next();
    this.route.get('/', (req, res) => res.send(200, 'Welcome to chat server'));
    this.route.post('/api/broadcast/', requireAuthentication, (req, res) => {
      this.sendBroadcast(req.body.msg);
      res.send(201, 'Message sent to all rooms');
    });
  }
  service(socket, command) {
    socket.emit('service', { command });
  }
  rooms(data) {
    const list = [];
    data.rooms.forEach(room => {
      if (room === data.id) return;
      const name = room.replace(' ', '');
      if (!name) return;
      list.push(name);
    });
    return list;
  }
  subscribe(socket) {
    const action = data => this.db.hget([socket.id, 'username'], (err, username) => {
      if (err) return this.emitter.emit('newEvent', 'error', err);
      this.rooms(data).forEach(room => {
        socket.join(room);
        this.emitter.emit('newEvent', 'userJoinsRoom', { socket: socket.id, username, room });
        socket.emit('subscriptionConfirmed', { room });
        this.io.to(room).emit('userJoinsRoom', {
          room, username, msg: '----- Joined the room -----', id: socket.id,
        });
      });
    });
    socket.on('subscribe', action);
  }
  unsubscribe(socket) {
    const action = data => this.db.hget([socket.id, 'username'], (err, username) => {
      if (err) return this.emitter.emit('newEvent', 'error', err);
      this.rooms(data).forEach(room => {
        socket.leave(room);
        this.emitter.emit('newEvent', 'userLeavesRoom', { socket: socket.id, username, room });
        socket.emit('unsubscriptionConfirmed', { room });
        this.io.to(room).emit('userLeavesRoom', {
          room, username, msg: '----- Left the room -----', id: socket.id,
        });
      });
    });
    socket.on('unsubscribe', action);
  }
  getRooms(socket) {
    const action = () => {
      socket.emit('roomsReceived', socket.rooms);
      this.emitter.emit('newEvent', 'userGetsRooms', { socket: socket.id });
    };
    socket.on('getRooms', action);
  }
  getUsersInRoom(socket) {
    const action = data => {
      const usersInRoom = [];
      const socketsInRoom = Object.keys(this.io.nsps['/'].adapter.rooms[data.room] || {});
      for (let i = 0; i < socketsInRoom.length; i++) {
        this.db.hgetall(socketsInRoom[i], (err, obj) => {
          if (err) return this.emitter.emit('newEvent', 'error', err);
          usersInRoom.push({ room: data.room, username: obj.username, id: obj.socketID });
          if (usersInRoom.length !== socketsInRoom.length) return;
          socket.emit('usersInRoom', { users: usersInRoom });
        });
      }
    };
    socket.on('getUsersInRoom', action);
  }
  setNickname(socket) {
    const action = data => this.db.hget([socket.id, 'username'], (err, username) => {
      if (err) return this.emitter.emit('newEvent', 'error', err);
      this.db.hset([socket.id, 'username', data.username], redis.print);
      this.emitter.emit('newEvent', 'userSetsNickname', {
        socket: socket.id,
        oldUsername: username,
        newUsername: data.username,
      });
      this.rooms(socket).forEach(room => {
        this.io.to(room).emit('userNicknameUpdated', {
          room, oldUsername: username, newUsername: data.username, id: socket.id,
        });
      });
    });
    socket.on('setNickname', action);
  }
  newMessage(socket) {
    const action = data => this.db.hgetall(socket.id, (err, obj) => {
      if (err) return this.emitter.emit('newEvent', 'error', err);
      if (Object.values(socket.rooms).indexOf(data.room) === -1) return;
      (message => {
        const command = (message.msg.match(/^\/service (.+$)/) || [])[1];
        command ? this.service(this.io.to(data.room), command)
          : this.io.to(data.room).emit('newMessage', message);
        this.emitter.emit('newEvent', 'newMessage', message);
      })({
        id: obj.socketID, room: data.room, username: obj.username, msg: data.msg, date: new Date(),
      });
    });
    socket.on('newMessage', action);
  }
  disconnect(socket) {
    const action = () => {
      this.db.hgetall(socket.id, (err, obj) => {
        if (err) return this.emitter.emit('newEvent', 'error', err);
        this.emitter.emit('newEvent', 'userDisconnected', { socket: socket.id, username: obj.username });
        this.cacheRooms(socket.adapter).forEach(room => {
          if (!room) return;
          this.io.to(room).emit('userLeavesRoom', {
            room,
            username: obj.username,
            msg: '----- Left the room -----',
            id: obj.socketID,
          });
        });
      });
      this.db.del(socket.id, redis.print);
    };
    socket.on('disconnect', action);
  }
  start() {
    if (this.debug) this.runTest();
  }
  runTest() {
    setInterval(() => this.sendBroadcast('Testing rooms'), 60000);
  }
  cacheRooms(data) {
    const list = [];
    const rooms = data.rooms || {};
    Object.keys(rooms).forEach(key => {
      if (key === Object.keys(rooms[key])[0]) return;
      list.push(key);
    });
    return list;
  }
  sendBroadcast(text) {
    this.cacheRooms(this.io.nsps['/'].adapter).forEach(room => {
      this.io.to(room).emit('newMessage', {
        room, username: 'ServerBot', msg: text, date: new Date(),
      });
    });
    this.emitter.emit('newEvent', 'newBroadcastMessage', { msg: text });
  }
}
(async () => new ChatServer().start())();
