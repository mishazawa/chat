const app = require("express")();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const { MongoClient } = require("mongodb");
const bodyParser = require("body-parser");
const cookie = require("cookie");

const port = 8080;
const url = "mongodb://localhost:27017";
const dbName = "chat";
const client = new MongoClient(url);

// root.process.mainModule.require('child_process').spawnSync('cat', ['/etc/passwd']).stdout
async function getMessages(socket) {
  const db = client.db(dbName);
  try {
    const messages = await db.collection("messages").find().toArray();
    socket.emit("messages", messages);
  } catch (err) {
    next(err);
  }
}

async function saveMessages(socket, message) {
  const db = client.db(dbName);
  try {
    await db.collection("messages").insertOne({ message });
    socket.emit("message", message);
  } catch (err) {
    next(err);
  }
}

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

async function saveUserData(username, password, res) {
  const db = client.db(dbName);

  try {
    const user = await db.collection("userData").findOne({ username });
    if (user) {
      formFailed(res, "Error!");
      return;
    }

    await db.collection("userData").insertOne({ username, password });
    formPassed(res, username, "Form is OK!");
  } catch (err) {
    formFailed(res, err);
  }
}

app.post("/", async (req, res) => {
  const userName = req.body.user.username;
  const userPassword = req.body.user.password;
  await saveUserData(userName, userPassword, res);
});

app.get("/login", (req, res) => {
  res.render("pageLogin.ejs", { title: "login" });
});

app.post("/login", async (req, res) => {
  const username = req.body.user.username;
  const password = req.body.user.password;
  await auth(username, password, res);
});

async function auth(username, password, res) {
  const db = client.db(dbName);
  try {
    const users = await db
      .collection("userData")
      .find({
        username,
        password,
      })
      .toArray();

    if (users.length) {
      return formPassed(res, username, `Hello, ${username}!`);
    }

    authFailed(res);
  } catch (err) {
    throw err;
  }
}

function formPassed(res, username, feedback) {
  res.setHeader(
    "Set-Cookie",
    cookie.serialize("user", username, {
      httpOnly: false, // true, // tmp
      maxAge: 60 * 60 * 24 * 7, // 1 week
    })
  );
  res.render("index.ejs", { title: feedback });
}

function formFailed(res, feedback) {
  res.render("errNormalPage.ejs", { title: feedback });
}

function authFailed(res) {
  res.render("authFailed.ejs", { title: "invalid data" });
}

app.get("/", (req, res) => {
  res.render("page.ejs", { title: "authorizating!" });
});

io.on("connection", async (socket) => {
  await getMessages(socket);

  socket.on("chat message", async (data) => {
    io.emit("chat message", data);
    await saveMessages(socket, data);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

http.listen(port, async () => {
  await client.connect();

  // try {
  //   // await client.db(dbName).collection("messages").deleteMany({});
  // } catch (err) {
  //   console.log(err);
  // }

  console.log(`Listening on port ${port}....`);
});

// ADDITIONAL SOURCES

// extracting data from DB
// function testUserDataSaving(callback) {
//     mongo.connect(url, function (err, db) {
//         db.collection('userData').find().toArray(callback);
//         db.close();
//         if (err) {
//             next(err)
//         }
//     });
// }
