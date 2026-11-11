import { defineWebSocketHandler } from "nitro";

import { messageLiveHooks } from "@/lib/messages/live-socket";

export default defineWebSocketHandler(messageLiveHooks);
