import { EventEmitter } from "events";

// Singleton emitter for WhatsApp logs
declare global {
  var whatsappLogEmitter: EventEmitter | undefined;
}

if (!global.whatsappLogEmitter) {
  global.whatsappLogEmitter = new EventEmitter();
}

export const whatsappLogEmitter = global.whatsappLogEmitter;
