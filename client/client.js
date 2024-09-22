//CLIENT_NAME - name of the client, distinct for each client
// SERVER_IP_ADDRESS - enter IP address of the server
// SERVER_PORT - port number of the server

const io = require("socket.io-client");
const os = require("os");
const si = require("systeminformation");

const name = "CLIENT_NAME";

// Function to get the MAC address
function getMacAddress() {
  const interfaces = os.networkInterfaces();
  for (let name in interfaces) {
    for (let iface of interfaces[name]) {
      if (iface.mac && iface.mac !== "00:00:00:00:00:00") {
        return iface.mac;
      }
    }
  }
  return null;
}

// Get the MAC address
const macAddress = getMacAddress();

// Connect to the server
const socket = io("http://SERVER_IP_ADDRESS:SERVER_PORT");

socket.on("connect", () => {
  console.log("Connected to server", socket.id);

  // Send the name and MAC address to the server
  socket.emit("client-initial", { name, macAddress });

  // Send CPU utilization data periodically
  tick_tock = setInterval(async () => {
    const cpuLoad = await si.currentLoad();
    socket.emit("client-changing", { name, cpu: cpuLoad.currentLoad });
  }, 1000);
});

socket.on("disconnect", () => {
  console.log("Server Disconnected");
  if (tick_tock) {
    clearInterval(tick_tock);
    tick_tock = null;
  }
});
