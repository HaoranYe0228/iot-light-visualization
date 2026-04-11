const canvas = document.getElementById("ring");
const ctx = canvas.getContext("2d");
const valueEl = document.getElementById("value");
const rawValueEl = document.getElementById("rawValue");
const brightnessValueEl = document.getElementById("brightnessValue");
const lightStateEl = document.getElementById("lightState");
const levelTextEl = document.getElementById("levelText");
const deviceMessageEl = document.getElementById("deviceMessage");
const statusPillEl = document.getElementById("statusPill");
const signalDotEl = document.getElementById("signalDot");

const mqttConfig = {
  url: "wss://b23c9b5e766544f3bb19c6caf96385b1.s1.eu.hivemq.cloud:8884/mqtt",
  username: "Laikeyue",
  password: "Lky072741",
  topic: "esp32/light"
};

const client = mqtt.connect(mqttConfig.url, {
  username: mqttConfig.username,
  password: mqttConfig.password,
  connectTimeout: 10000,
  reconnectPeriod: 3000,
  clean: true
});

const numLEDs = 16;
let brightness = 0;
let messageCount = 0;

function drawRing() {
  ctx.clearRect(0, 0, 400, 400);

  const centerX = 200;
  const centerY = 200;
  const radius = 120;

  ctx.beginPath();
  ctx.arc(centerX, centerY, 95, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 18;
  ctx.stroke();

  for (let i = 0; i < numLEDs; i++) {
    const angle = (i / numLEDs) * Math.PI * 2;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    const alpha = 0.12 + (brightness / 255) * 0.88;

    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(89,208,255,${alpha})`;
    ctx.fill();
  }
}

function getLightState(light) {
  if (light <= 800) return "Very Bright";
  if (light <= 1800) return "Bright";
  if (light <= 2800) return "Normal";
  if (light <= 3600) return "Dim";
  return "Dark";
}

function getLevelText(light) {
  if (light <= 800) return "Strong ambient light detected";
  if (light <= 1800) return "Room is well lit";
  if (light <= 2800) return "Balanced indoor lighting";
  if (light <= 3600) return "Low light environment";
  return "Very dark environment";
}

function updateConnectionStatus(isOnline, message) {
  statusPillEl.textContent = isOnline ? "Online" : "Offline";
  signalDotEl.classList.toggle("online", isOnline);
  deviceMessageEl.textContent = message;
}

function normalizeLightPayload(rawMessage) {
  const text = rawMessage.toString().trim();

  if (!text) {
    return null;
  }

  const directNumber = Number(text);
  if (!Number.isNaN(directNumber)) {
    return directNumber;
  }

  try {
    const data = JSON.parse(text);

    if (typeof data === "number") {
      return data;
    }

    if (typeof data?.light === "number") {
      return data.light;
    }

    if (typeof data?.light === "string" && !Number.isNaN(Number(data.light))) {
      return Number(data.light);
    }

    if (typeof data?.value === "number") {
      return data.value;
    }

    if (typeof data?.value === "string" && !Number.isNaN(Number(data.value))) {
      return Number(data.value);
    }

    if (typeof data?.brightness === "number") {
      return data.brightness;
    }

    if (typeof data?.brightness === "string" && !Number.isNaN(Number(data.brightness))) {
      return Number(data.brightness);
    }

    return null;
  } catch (error) {
    console.warn("MQTT payload is not JSON:", text);
    return null;
  }
}

function updateUI(light) {
  brightness = 255 - (light / 4095) * 255;
  const brightnessPercent = Math.round((brightness / 255) * 100);

  valueEl.innerText = light;
  rawValueEl.innerText = light;
  brightnessValueEl.innerText = `${brightnessPercent}%`;
  lightStateEl.innerText = getLightState(light);
  levelTextEl.innerText = getLevelText(light);

  drawRing();
}

client.on("connect", () => {
  console.log("MQTT connected:", mqttConfig.url);
  client.subscribe(mqttConfig.topic, (err) => {
    if (err) {
      console.error("MQTT subscribe failed:", err);
      updateConnectionStatus(false, `Connected, but subscribe failed: ${err.message || err}`);
      return;
    }

    console.log("MQTT subscribed:", mqttConfig.topic);
    updateConnectionStatus(true, `Connected to ${mqttConfig.topic}, waiting for sensor messages.`);
  });
});

client.on("reconnect", () => {
  statusPillEl.textContent = "Reconnecting";
  deviceMessageEl.textContent = "Trying to reconnect to MQTT broker...";
  console.warn("MQTT reconnecting...");
});

client.on("close", () => {
  console.warn("MQTT connection closed");
  updateConnectionStatus(false, "MQTT connection lost. Waiting to reconnect.");
});

client.on("offline", () => {
  console.warn("MQTT client offline");
  updateConnectionStatus(false, "MQTT client is offline.");
});

client.on("error", (error) => {
  console.error("MQTT error:", error);
  updateConnectionStatus(false, `Unable to connect to MQTT broker: ${error.message || error}`);
});

client.on("message", (topic, message) => {
  const lightValue = normalizeLightPayload(message);
  messageCount += 1;

  console.log(`MQTT message #${messageCount} on ${topic}:`, message.toString());

  if (lightValue === null) {
    deviceMessageEl.textContent = `Message received, but payload format is unsupported: ${message.toString()}`;
    return;
  }

  updateUI(lightValue);
  deviceMessageEl.textContent = `Live data received from ${topic}. Messages: ${messageCount}`;
});

drawRing();
