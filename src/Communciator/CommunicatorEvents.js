const EventEmitter = require('events');


module.exports = class CommunicatorEvents extends EventEmitter {
  constructor(communicator) {
    super(); // Establish EventEmitter

    this.communicator = communicator;
    this.eventsRegistered = false;
  }

  setupEvents() {
    if (this.eventsRegistered) return; // We already added them to this instance

    // connecting all the events
    this.communicator.stream.on('connected', this.onConnected.bind(this));
    this.communicator.stream.on('disconnected', this.onDisconnect.bind(this));
    this.communicator.stream.on('session:started', this.onSessionStart.bind(this));
    this.communicator.stream.on('session:end', this.onSessionEnd.bind(this));

    this.eventsRegistered = true;
  }

  /**
   * Fire that the client has conncted (NOT FULLY ESTABLISHED!)
   */
  onConnected() {
    this.emit('connected');
  }

  /**
   * Fire that the client disconnceted
   * if `reconnect` true, it will try to reconnect.
   */
  onDisconnect() {
    this.emit('disconnected');
    if (this.reconnect) this.stream.connect();
  }

  /**
   * Fire that the current connection session is fully established
   */
  onSessionStart() {
    this.emit('session:started');
  }

  /**
   * Fire that the currrent session ended
   */
  onSessionEnd() {
    this.emit('session:ended');
  }
};
