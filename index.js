const express = require('express');
const http = require('http');
const io = require('socket.io');
const redis = require('socket.io-redis');
const cache = require('redis');
const cluster = require('cluster');
const { EventEmitter } = require('events');
const os = require('os');

class App {
  constructor() {
    this.logger = console;
  }
  promise() {
    const promise = {};
    promise.instance = new Promise((...args) => {
      [promise.resolve, promise.reject] = args;
    });
    return promise;
  }
}
class ChatServer extends App {
  constructor() {
    super();
    const {
      DEBUG, PORT, DB_HOST, DB_PORT, CLUSTERING,
    } = process.env;
    this.options = {
      debug: DEBUG,
      port: PORT || 3000,
      db: {
        host: DB_HOST || '127.0.0.1',
        port: DB_PORT || 6379,
      },
    };
    CLUSTERING === 'true' ? this.clustering() : this.initialize();
  }
  clustering() {
    const fork = () => {
      for (let num = os.cpus().length; num; num--) {
        const worker = cluster.fork();
        this.logger.info('CLUSTER: Worker %d started', worker.id);
      }
      cluster.on('exit', () => {
        const worker = cluster.fork();
        this.logger.info('CLUSTER: Worker %d started', worker.id);
      });
    };
    cluster.isMaster ? fork() : this.initialize();
  }
  initialize() {
    this.emitter = new EventEmitter();
    this.initRoute();
    this.initEvent();
  }
  initEvent() {
    this.emitter.on('newEvent',
      (event, data) => this.logger.info('%s: %s', event, JSON.stringify(data)));
    const action = socket => {
      socket.emit('connected', 'Welcome to the chat server');
      this.emitter.emit('newEvent', 'userConnected', { socket: socket.id });
      this.dbSet(socket.id, 'connectionDate', new Date());
      this.dbSet(socket.id, 'socketID', socket.id);
      this.dbSet(socket.id, 'username', 'anonymous');
      this.subscribe(socket);
      this.unsubscribe(socket);
      this.getRooms(socket);
      this.getUsersInRoom(socket);
      this.setNickname(socket);
      this.newMessage(socket);
      this.disconnect(socket);
    };
    this.io = io.listen(this.server);
    this.io.adapter(redis(this.options.db));
    this.db = cache.createClient(this.options.db.port, this.options.db.host);
    this.io.sockets.on('connection', action);
  }
  initRoute() {
    this.route = express();
    this.server = http.createServer(this.route);
    this.server.listen(this.options.port);
    this.route.configure(() => {
      this.route.use(express.bodyParser());
      this.route.use(express.static(`${__dirname}/static`));
    });
    const requireAuthentication = (req, res, next) => next();
    this.route.get('/', (req, res) => res.send(200, 'Welcome to chat server'));
    this.route.post('/api/broadcast/', requireAuthentication, (req, res) => {
      this.sendBroadcast(req.body.msg);
      res.send(201, 'Message sent to all rooms');
    });
    this.route.get('/favicon.ico', (req, res) => res.send(200, ''));
  }
  dbSet(...args) {
    this.db.hset(args, redis.print);
  }
  dbGet(...args) {
    const promise = this.promise();
    const error = err => promise.reject({ err, args });
    this.db.hget(args,
      (err, res) => err ? error(err) : promise.resolve(res));
    return promise.instance;
  }
  dbGetAll(id) {
    const promise = this.promise();
    const error = err => promise.reject({ err, id });
    this.db.hgetall(id,
      (err, res) => err ? error(err) : promise.resolve(res));
    return promise.instance;
  }
  dbDel(id) {
    this.db.del(id, redis.print);
  }
  service(socket, command) {
    socket.emit('service', { command });
  }
  rooms(data) {
    const list = [];
    Object.values(data.rooms).forEach(room => {
      if (room === data.id) return;
      const name = room.replace(' ', '');
      if (!name) return;
      list.push(name);
    });
    return list;
  }
  fail(e) {
    this.emitter.emit('newEvent', 'error', e);
  }
  subscribe(socket) {
    const action = data => this.dbGet(socket.id, 'username')
    .then(username => this.rooms(data).forEach(room => {
      socket.join(room);
      this.emitter.emit('newEvent', 'userJoinsRoom', { socket: socket.id, username, room });
      socket.emit('subscriptionConfirmed', { room });
      this.io.to(room).emit('userJoinsRoom', {
        room, username, msg: '----- Joined the room -----', id: socket.id,
      });
    }))
    .catch(e => this.fail(e));
    socket.on('subscribe', action);
  }
  unsubscribe(socket) {
    const action = data => this.dbGet(socket.id, 'username')
    .then(username => this.rooms(data).forEach(room => {
      socket.leave(room);
      this.emitter.emit('newEvent', 'userLeavesRoom', { socket: socket.id, username, room });
      socket.emit('unsubscriptionConfirmed', { room });
      this.io.to(room).emit('userLeavesRoom', {
        room, username, msg: '----- Left the room -----', id: socket.id,
      });
    }))
    .catch(e => this.fail(e));
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
      const { adapter } = this.io.of('/');
      const socketsInRoom = Object.keys(adapter.rooms[data.room] || {});
      socketsInRoom.forEach(
        id => this.dbGetAll(id)
        .then(obj => {
          usersInRoom.push({ room: data.room, username: obj.username, id: obj.socketID });
          if (usersInRoom.length !== socketsInRoom.length) return;
          this.emitter.emit('newEvent', 'usersInRoom', { usersInRoom });
          socket.emit('usersInRoom', { users: usersInRoom });
        })
        .catch(e => this.fail(e)),
      );
    };
    socket.on('getUsersInRoom', action);
  }
  setNickname(socket) {
    const action = data => this.dbGet(socket.id, 'username')
    .then(username => {
      this.dbSet(socket.id, 'username', data.username);
      this.emitter.emit('newEvent', 'userSetsNickname', {
        socket: socket.id,
        oldUsername: username,
        newUsername: data.username,
      });
      this.rooms(socket).forEach(room => this.io.to(room).emit('userNicknameUpdated', {
        room, oldUsername: username, newUsername: data.username, id: socket.id,
      }));
    })
    .catch(e => this.fail(e));
    socket.on('setNickname', action);
  }
  newMessage(socket) {
    const action = data => this.dbGetAll(socket.id)
    .then(obj => {
      if (Object.values(socket.rooms).indexOf(data.room) === -1) return;
      (message => {
        const command = (message.msg.match(/^\/service (.+$)/) || [])[1];
        command ? this.service(this.io.to(data.room), command)
          : this.io.to(data.room).emit('newMessage', message);
        this.emitter.emit('newEvent', 'newMessage', message);
      })({
        id: obj.socketID, room: data.room, username: obj.username, msg: data.msg, date: new Date(),
      });
    })
    .catch(e => this.fail(e));
    socket.on('newMessage', action);
  }
  disconnect(socket) {
    const action = () => {
      this.dbGetAll(socket.id)
      .then(obj => {
        this.emitter.emit('newEvent', 'userDisconnected', {
          socket: socket.id, username: obj.username,
        });
        this.cacheRooms(socket.adapter).forEach(room => {
          if (!room) return;
          this.io.to(room).emit('userLeavesRoom', {
            room,
            username: obj.username,
            msg: '----- Left the room -----',
            id: obj.socketID,
          });
        });
      })
      .catch(e => this.fail(e));
      this.dbDel(socket.id);
    };
    socket.on('disconnect', action);
  }
  start() {
    if (this.options.debug) this.runTest();
  }
  runTest() {
    setInterval(() => this.sendBroadcast('Testing rooms'), 60000);
  }
  cacheRooms(adapter) {
    const list = [];
    const rooms = adapter.rooms || {};
    Object.keys(rooms).forEach(key => {
      if (key === Object.keys(rooms[key])[0]) return;
      list.push(key);
    });
    return list;
  }
  sendBroadcast(text) {
    const { adapter } = this.io.of('/');
    this.cacheRooms({ adapter }).forEach(
      room => this.io.to(room).emit('newMessage', {
        room, username: 'ServerBot', msg: text, date: new Date(),
      }),
    );
    this.emitter.emit('newEvent', 'newBroadcastMessage', {
      msg: text,
    });
  }
}
/* eslint-disable no-undef */
(async () => new ChatServer().start())()
.then(instance => chat = instance);
