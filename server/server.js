//ENTER_PORT - enter server port

const cluster = require("cluster");
const http = require("http");
const { Server } = require("socket.io");
const { setupMaster, setupWorker } = require("@socket.io/sticky");
const { createAdapter, setupPrimary } = require("@socket.io/cluster-adapter");
const fs = require("fs").promises;

// const numCPUs = require("os").cpus().length;

if (cluster.isPrimary) {
  console.log(`Master ${process.pid} is running`);

  const httpServer = http.createServer();

  setupMaster(httpServer, {
    loadBalancingMethod: "least-connection",
  });

  setupPrimary();

  cluster.setupPrimary({
    serialization: "advanced",
  });

  httpServer.listen(ENTER_PORT);

  for (let i = 0; i < 2; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  console.log(`Worker ${process.pid} started`);

  const httpServer = http.createServer();
  const io = new Server(httpServer, {
    cors: {
      origin: "*", // Allow all origins, you can specify a specific origin instead
      methods: ["GET", "POST"],
    },
  });

  io.adapter(createAdapter());
  setupWorker(io);

  async function writeObjectToText(object) {
    const objString = JSON.stringify(object, null, 2);

    try {
      await fs.writeFile("clientData.json", objString);
      console.log("FILE-INFO:Successfully wrote to clientData.json");
    } catch (err) {
      console.log("FILE-ERROR: Error writing to clientData.json", err);
    }
  }

  async function giveMeObject() {
    try {
      const data = await fs.readFile("clientData.json", "utf8");
      const clientData = JSON.parse(data);
      return clientData;
    } catch (err) {
      console.log("FILE-ERROR: Error reading file clientData.json", err);
      return {};
    }
  }

  async function addClient(property, value) {
    try {
      const clientObj = await giveMeObject();
      clientObj[property] = value;
      await writeObjectToText(clientObj);
      console.log(`Successfully added client ${property}`);
    } catch (err) {
      console.log(`Error adding client ${property}`, err);
    }
  }

  async function hasProperty(property) {
    const clientObj = await giveMeObject();
    return property in clientObj;
  }

  io.on("connection", (socket) => {
    let clientName;
    console.log("a client connected:", socket.id);

    socket.on("dashboard-sendJson", async () => {
      try {
        const obj = await giveMeObject();
        socket.emit("server-buildTable", obj);
      } catch (err) {
        console.error("Error handling dashboard-sendJson event", err);
      }
    });

    socket.on("client-initial", async (initialData) => {
      try {
        const notFirstTime = await hasProperty(initialData.name);
        clientName = initialData.name;
        if (notFirstTime) {
          console.log(`We already got ${initialData.name}`);
        } else {
          console.log(`First time getting ${initialData.name}`);

          await addClient(initialData.name, initialData.macAddress);
          console.log(initialData);
          io.emit("server-initial", initialData);
        }
      } catch (err) {
        console.error("Error handling client-initial event", err);
      }
    });

    socket.on("client-changing", async (changingData) => {
      io.emit("server-changing", changingData);
    });

    socket.on("disconnect", (socket) => {
      console.log("Client disconnected:", socket);
      io.emit("server-changing", { name: clientName, cpu: "Offline" });
    });
  });
}
