class App {
  constructor() {
    this.logger = console;
  }
}
class Chat extends App {
  constructor() {
    super();
    this.debug = false;
    this.mainRoom = 'MainRoom';
    this.templates = {};
    this.initialize();
    this.logger.info('begin');
  }
  initialize() {
    this.initEvent();
    this.initAction();
  }
  initEvent() {
    const action = socket => {
      this.connected(socket);
      this.disconnect(socket);
      this.reconnect(socket);
      this.subscriptionConfirmed(socket);
      this.unsubscriptionConfirmed(socket);
      this.userJoinsRoom(socket);
      this.userLeavesRoom(socket);
      this.newMessage(socket);
      this.usersInRoom(socket);
      this.userNicknameUpdated(socket);
      this.debugging(socket);
      return socket;
    };
    this.socket = action(io.connect(window.location.host));
  }
  initAction() {
    this.onClick(this.select('#b_send_message'), event => {
      event.preventDefault();
      if (this.select('#message_text').value === '') return;
      this.socket.emit('newMessage', { room: this.getCurrentRoom(), msg: this.getMessageText() });
    });
    this.onClick(this.select('#b_join_room'), event => {
      event.preventDefault();
      const roomName = this.getRoomName();
      if (!roomName) {
        this.select('#room_name').classList.add('error');
        return;
      }
      this.socket.emit('subscribe', { rooms: [roomName] });
    });
    this.onClick(this.select('#b_leave_room'), event => {
      event.preventDefault();
      const currentRoom = this.getCurrentRoom();
      if (currentRoom === this.mainRoom) return;
      this.socket.emit('unsubscribe', { rooms: [this.getCurrentRoom()] });
      this.select('[data-href="#id-MainRoom"]').click();
    });
    this.select('#modal_joinroom').addEventListener('hidden.bs.modal', event => {
      this.logger({ event });
      event.preventDefault();
      if (!this.select('#room_name').classList.contains('error')) return;
      this.select('#room_name').classList.remove('error');
    });
    this.onClick(this.select('#b_set_nickname'), event => {
      event.preventDefault();
      this.socket.emit('setNickname', { username: this.getNickname() });
      this.hideModal(this.select('#modal_setnick'));
    });
    this.onClick(this.select('#drop-down .link'), event => {
      if (this.select('#drop-down').classList.contains('open')) {
        this.select('#drop-down').classList.remove('open');
      } else {
        event.preventDefault();
        this.select('#drop-down').classList.add('open');
      }
    });
    this.onClick(this.select('#open_setnick'), () => {
      this.select('#drop-down').classList.remove('open');
      this.showModal(this.select('#modal_setnick'));
    });
    this.onClick(this.select('#open_joinroom'), () => {
      this.select('#drop-down').classList.remove('open');
      this.showModal(this.select('#modal_joinroom'));
    });
  }
  debugging(socket) {
    const action = () => this.debug = true;
    socket.on('debugging', action);
  }
  connected(socket) {
    const action = () => {
      this.socket.emit('subscribe', { rooms: [this.mainRoom] });
    };
    socket.on('connected', action);
  }
  disconnect(socket) {
    const action = () => this.addMessage({
      room: this.mainRoom, username: 'ServerBot', msg: '----- Lost connection to server -----',
    });
    socket.on('disconnect', action);
  }
  reconnect(socket) {
    const action = () => this.addMessage({
      room: this.mainRoom, username: 'ServerBot', msg: '----- Reconnected to server -----',
    });
    socket.on('reconnect', action);
  }
  subscriptionConfirmed(socket) {
    const action = data => {
      if (!this.roomExists(data.room)) {
        this.selectAll('.active').forEach(element => element.classList.remove('active'));
        this.addRoomTab(data.room);
        this.addRoom(data.room);
      }
      this.socket.emit('getUsersInRoom', { room: data.room });
      this.hideModal(this.select('#modal_joinroom'));
    };
    socket.on('subscriptionConfirmed', action);
  }
  unsubscriptionConfirmed(socket) {
    const action = data => {
      if (!this.roomExists(data.room)) return;
      this.removeRoomTab(data.room);
      this.removeRoom(data.room);
    };
    socket.on('unsubscriptionConfirmed', action);
  }
  userJoinsRoom(socket) {
    const action = data => {
      this.addMessage(data);
      this.addUser(data);
    };
    socket.on('userJoinsRoom', action);
  }
  userLeavesRoom(socket) {
    const action = data => {
      this.addMessage(data);
      this.removeUser(data);
    };
    socket.on('userLeavesRoom', action);
  }
  newMessage(socket) {
    const action = data => {
      this.addMessage(data);
      const area = this.select(`#room_messages_${data.room}`);
      area.scrollTop = area.scrollHeight;
    };
    socket.on('newMessage', action);
  }
  usersInRoom(socket) {
    const action = data => data.users.forEach(user => this.addUser(user));
    socket.on('usersInRoom', action);
  }
  userNicknameUpdated(socket) {
    const action = data => {
      this.addMessage({
        room: data.room, username: 'ServerBot', msg: `----- ${data.oldUsername} is now ${data.newUsername} -----`,
      });
      this.updateNickname(data);
    };
    socket.on('userNicknameUpdated', action);
  }
  start() {
    return this;
  }
  onClick(element, action) {
    element.addEventListener('click', action);
  }
  generateElement(html, area) {
    const div = document.createElement('div');
    div.innerHTML = `<div class="generateElement">${html}</div>`;
    const elements = this.selectAll('.generateElement > *', div);
    if (!area) return elements;
    elements.forEach(element => area.append(element));
    return elements;
  }
  showModal(modal) {
    modal.style.display = "block";
    this.onClick(this.select('.close', modal), () => {
      modal.style.display = "none";
    });
    this.onClick(window, event => {
      if (event.target === modal) {
        modal.style.display = "none";
      }
    });
  }
  hideModal(modal) {
    modal.style.display = "none";
  }
  select(selector, element) {
    return (element || document).querySelector(selector);
  }
  selectAll(selector, element) {
    return [...(element || document).querySelectorAll(selector)];
  }
  genId(id) {
    return `id-${id.replace(/\\d+/, '')}`;
  }
  getTemplate(path) {
    if (Object.keys(this.templates).indexOf(path) !== -1) {
      return Promise.resolve(this.templates[path]);
    }
    return fetch(path)
    .then(res => res.text())
    .then(source => {
      this.templates[path] = Handlebars.compile(source);
      return this.templates[path];
    });
  }
  addMessage(msg) {
    this.getTemplate('js/templates/message.handlebars')
    .then(template => {
      const area = this.select(`#room_messages_${msg.room}`);
      const html = template(msg);
      if (area) {
        this.generateElement(html, area);
        return;
      }
      const roomInterval = setInterval(() => {
        const area = this.select(`#room_messages_${msg.room}`);
        if (area) {
          this.generateElement(html, area);
          clearInterval(roomInterval);
        }
      }, 220);
    });
  }
  addRoomTab(room) {
    this.getTemplate('js/templates/room_tab.handlebars')
    .then(template => {
      this.generateElement(template({ room }), this.select('#rooms_tabs'));
      this.onClick(this.select(`[data-href="#${this.genId(room)}"]`), () => this.setRoom(room));
    });
  }
  removeRoomTab(room) {
    this.select(`#${this.genId(room)}_tab`).remove();
  }
  addRoom(room) {
    this.getTemplate('js/templates/room.handlebars')
    .then(template => {
      this.generateElement(template({ room }), this.select('#rooms'));
    });
  }
  setRoom(room) {
    this.selectAll('.active').forEach(element => element.classList.remove('active'));
    this.select(`#${this.genId(room)}_tab`).classList.add('active');
    this.select(`#${this.genId(room)}`).classList.add('active');
  }
  removeRoom(room) {
    this.select(`#${this.genId(room)}`).remove();
  }
  roomExists(room) {
    return this.select(`#${this.genId(room)}_tab`);
  }
  addUser(user) {
    this.getTemplate('js/templates/user.handlebars')
    .then(template => {
      const area = this.select(`#${this.genId(user.room)}`);
      if (!area) return;
      if (this.select(`#${this.genId(user.id)}`, area)) return;
      this.generateElement(template({
        username: user.username,
        id: this.genId(user.id),
      }), this.select(`#room_users_${user.room}`, area));
    });
  }
  removeUser(user) {
    this.select(`#${this.genId(user.room)} #${this.genId(user.id)}`).remove();
  }
  getCurrentRoom() {
    return this.select('li[id$="_tab"][class="active"]').textContent;
  }
  getMessageText() {
    const text = this.select('#message_text').value;
    this.select('#message_text').value = '';
    return text;
  }
  getRoomName() {
    const name = this.select('#room_name').value.trim();
    this.select('#room_name').value = '';
    return name;
  }
  getNickname() {
    const nickname = this.select('#nickname').value;
    this.select('#nickname').value = '';
    return nickname;
  }
  updateNickname(data) {
    this.select(`#${this.genId(data.room)} #${this.genId(data.id)}`).textContent = data.newUsername;
  }
}
if (!window.c) {
  window.c = (async () => new Chat().start())();
}
