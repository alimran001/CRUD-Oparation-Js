const http = require("http");
const fs = require("fs");
const path = require("path");

const HOST = "0.0.0.0";
const PORT = 3000;
const DATA_FILE = path.join(__dirname, "data", "users.json");

const PUBLIC_DIR = __dirname;

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function serveStatic(url, res) {
  let safePath = url === "/" ? "/index.html" : url;
  safePath = safePath.split("?")[0];
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    return res.end("Bad request");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Not found" }));
    }
    res.writeHead(200, { "Content-Type": getContentType(filePath) });
    res.end(data);
  });
}

function ensureDataFile() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]", "utf8");
  } catch (e) {
    console.error("Data file init error:", e);
  }
}

function readUsers() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data;
    return [];
  } catch (e) {
    console.error("Read users error:", e);
    return [];
  }
}

function writeUsers(users, res) {
  try {
    const safe = JSON.stringify(users, null, 2);
    fs.writeFileSync(DATA_FILE, safe, "utf8");
    return true;
  } catch (e) {
    console.error("Write users error:", e);
    if (res) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Server error while saving data.");
    }
    return false;
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

function notFound(res) {
  res.writeHead(404, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify({ message: "Not found" }));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        const json = JSON.parse(body);
        resolve(json);
      } catch (e) {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function sanitizeUser(u) {
  const safe = {};
  const name = typeof u.name === "string" ? u.name.trim() : "";
  const email = typeof u.email === "string" ? u.email.trim() : "";
  const ageNum = Number(u.age);
  if (!name || !email || Number.isNaN(ageNum) || ageNum <= 0) {
    return null;
  }
  safe.name = name.slice(0, 80);
  safe.email = email.slice(0, 120);
  safe.age = ageNum;
  return safe;
}

const server = http.createServer(async (req, res) => {
  const { method, url } = req;

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  if (method === "GET" && !url.startsWith("/users")) {
    return serveStatic(url, res);
  }

  if (url === "/users" && method === "GET") {
    const users = readUsers();
    return sendJson(res, 200, users);
  }

  if (url === "/users" && method === "POST") {
    try {
      const body = await parseBody(req);
      const clean = sanitizeUser(body);
      if (!clean) {
        res.writeHead(400, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        });
        return res.end(JSON.stringify({ message: "Invalid user data" }));
      }
      const users = readUsers();
      const nextId = users.length ? Math.max(...users.map((u) => u.id || 0)) + 1 : 1;
      const user = { id: nextId, ...clean };
      users.push(user);
      if (!writeUsers(users, res)) return;
      return sendJson(res, 201, user);
    } catch (e) {
      res.writeHead(400, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      return res.end(JSON.stringify({ message: e.message || "Bad request" }));
    }
  }

  const match = url.match(/^\/users\/(\d+)$/);

  if (match && method === "GET") {
    const id = Number(match[1]);
    const users = readUsers();
    const user = users.find((u) => u.id === id);
    if (!user) return notFound(res);
    return sendJson(res, 200, user);
  }

  if (match && method === "PUT") {
    try {
      const id = Number(match[1]);
      const body = await parseBody(req);
      const clean = sanitizeUser(body);
      if (!clean) {
        res.writeHead(400, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        });
        return res.end(JSON.stringify({ message: "Invalid user data" }));
      }
      const users = readUsers();
      const idx = users.findIndex((u) => u.id === id);
      if (idx === -1) return notFound(res);
      users[idx] = { id, ...clean };
      if (!writeUsers(users, res)) return;
      return sendJson(res, 200, users[idx]);
    } catch (e) {
      res.writeHead(400, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      return res.end(JSON.stringify({ message: e.message || "Bad request" }));
    }
  }

  if (match && method === "DELETE") {
    const id = Number(match[1]);
    const users = readUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return notFound(res);
    const removed = users.splice(idx, 1)[0];
    if (!writeUsers(users, res)) return;
    return sendJson(res, 200, removed);
  }

  notFound(res);
});

ensureDataFile();

server.listen(PORT, HOST, () => {
  console.log(`User CRUD server running at http://${HOST}:${PORT}`);
});
