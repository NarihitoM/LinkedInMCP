import { renderPage, type Page } from "../../shared/utils/html.ts";

const CONNECT_STYLES = `
header, main, footer { max-width: 1312px; margin: 0 auto; padding: 0 16px; }
header { display: flex; gap: 16px; align-items: center; justify-content: space-between; padding-top: 16px; padding-bottom: 16px; }
h1 { margin: 0; font-size: 18px; }
#status { margin: 2px 0 0; color: var(--muted); }
#status.error { color: var(--danger); }
.button { flex-shrink: 0; padding: 6px 16px; border: 1px solid var(--accent); border-radius: 999px; color: var(--accent); font-weight: 600; text-decoration: none; }
canvas { display: block; width: 100%; height: auto; background: var(--surface); border-radius: 8px; box-shadow: 0 1px 3px rgb(0 0 0 / 12%); outline: none; }
canvas:focus-visible { box-shadow: 0 0 0 2px var(--accent); }
footer { padding-top: 12px; padding-bottom: 24px; color: var(--muted); font-size: 13px; }
`;

const CONNECT_BODY = `
<header>
  <div>
    <h1>Connect your LinkedIn session</h1>
    <p id="status">Connecting...</p>
  </div>
  <a id="skip" class="button" href="#">Skip for now</a>
</header>
<main>
  <canvas id="screen" width="1280" height="800" tabindex="0" aria-label="Remote LinkedIn login. Click to focus, then type."></canvas>
</main>
<footer>
  This runs a private browser on the server. Nothing opens on your computer. Your password goes straight to LinkedIn and is never stored.
</footer>
`;

const CONNECT_SCRIPT = `
(() => {
  const token = new URLSearchParams(location.search).get("t") || "";
  history.replaceState(null, "", location.pathname);

  const canvas = document.getElementById("screen");
  const context = canvas.getContext("2d");
  const status = document.getElementById("status");
  const skip = document.getElementById("skip");
  skip.href = "/session/skip?t=" + encodeURIComponent(token);

  const namedKeys = new Set(["Enter", "Backspace", "Tab", "Escape", "Delete", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"]);
  const buttons = ["left", "middle", "right"];
  let viewport = { width: canvas.width, height: canvas.height };
  let finished = false;

  const setStatus = (message, isError) => {
    status.textContent = message;
    status.classList.toggle("error", Boolean(isError));
  };

  if (!token) {
    setStatus("This link is missing its token. Ask Claude for a new connect link.", true);
    return;
  }

  const socket = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/session/ws");
  const send = (message) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };

  const pointFrom = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.round(((event.clientX - rect.left) / rect.width) * viewport.width),
      y: Math.round(((event.clientY - rect.top) / rect.height) * viewport.height),
    };
  };

  socket.addEventListener("open", () => send({ type: "hello", token }));

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "frame") {
      const image = new Image();
      image.onload = () => {
        if (canvas.width !== message.width || canvas.height !== message.height) {
          canvas.width = message.width;
          canvas.height = message.height;
        }
        viewport = { width: message.width, height: message.height };
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
      };
      image.src = "data:image/jpeg;base64," + message.data;
    } else if (message.type === "status") {
      setStatus(message.message);
    } else if (message.type === "error") {
      setStatus(message.message, true);
    } else if (message.type === "done") {
      finished = true;
      if (message.next) {
        setStatus("Connected. Returning to Claude...");
        location.href = message.next;
      } else {
        setStatus("Connected. You can close this tab and go back to Claude.");
        skip.remove();
      }
    }
  });

  socket.addEventListener("close", () => {
    if (!finished && !status.classList.contains("error")) {
      setStatus("Connection closed. Ask Claude for a new connect link.", true);
    }
  });

  let lastMove = 0;
  canvas.addEventListener("mousemove", (event) => {
    const now = performance.now();
    if (now - lastMove < 40) return;
    lastMove = now;
    send({ type: "mouse", action: "move", ...pointFrom(event), button: "left" });
  });

  canvas.addEventListener("mousedown", (event) => {
    canvas.focus();
    send({ type: "mouse", action: "down", ...pointFrom(event), button: buttons[event.button] || "left" });
  });

  canvas.addEventListener("mouseup", (event) => {
    send({ type: "mouse", action: "up", ...pointFrom(event), button: buttons[event.button] || "left" });
  });

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    send({ type: "wheel", ...pointFrom(event), deltaX: event.deltaX, deltaY: event.deltaY });
  }, { passive: false });

  canvas.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") return;
    if (namedKeys.has(event.key)) {
      event.preventDefault();
      send({ type: "key", key: event.key });
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      send({ type: "text", text: event.key });
    }
  });

  document.addEventListener("paste", (event) => {
    const text = (event.clipboardData && event.clipboardData.getData("text")) || "";
    if (text) {
      event.preventDefault();
      send({ type: "text", text: text.slice(0, 2000) });
    }
  });

  canvas.focus();
})();
`;

export function renderConnectPage(socketOrigin: string): Page {
  return renderPage({
    title: "Connect LinkedIn",
    styles: CONNECT_STYLES,
    body: CONNECT_BODY,
    script: CONNECT_SCRIPT,
    connectSrc: socketOrigin,
  });
}
