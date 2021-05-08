const express = require("express");
const session = require("express-session");
const parser = require("cookie-parser");
const mongoose = require("mongoose");
// const { request, response } = require("express");
const fs=require("fs")
const multer = require("multer");
const app = express();
const port = 2000;
let path = require("path");
const { stringify } = require("querystring");
// const { nextTick } = require("process");
let auth = (req, resp, next) => {
  // console.log(req.session);
  if (req.session.user) {
    return next();
  } else {
    return resp.redirect("/signup");
  }
};
app.use(parser());

app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname,"upload")))

app.use(
  session({
    secret: "keyboard cat",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60000000000000000000000 },
  })
);

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

const connect = async () => {
  try {
    await mongoose.connect("mongodb://localhost:27017/auth", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    // console.log("connected");
  } catch (e) {
    console.log(e.message);
  }
};
connect();

const schema = mongoose.Schema({
  email: String,
  password: String,
  upload:String,
  data:String
});

app.get("/signup", (req, resp) => {
  // console.log(req.body,req.session.user)
  if (req.session.user) {
    return resp.redirect("/profile");
  } else {
    return resp.render("signup.hbs");
  }
});

let model = mongoose.model("table", schema);

app.post("/signup", async (req, resp) => {
  // resp.json(req.body);
  let presentEmail = await model.findOne({
    email: req.body.email,
  });
  if (!presentEmail) {
    // console.log("not present")
    // console.log(presentEmail);
    let newUser = new model({
      ...req.body,
    });

    await newUser.save();
    req.session.user = newUser._id;
    // console.log(req.session);
    return resp.redirect("/profile");
  }
  return resp.render("signup.hbs", {
    ...req.body,
    msg: "Email Already exist",
  });
});

app.get("/profile", auth, async (req, resp) => {
  let id = mongoose.Types.ObjectId(req.session.user);
  let user = await model.findById(id);
  // console.log(user);
  return resp.render("userdetail.hbs", {
    user,
  });
});

app.post("/login", async (req, resp) => {
  let presentUser = await model.findOne({
    email: req.body.email,
  });
  if (presentUser) {
    if (req.body.password === presentUser.password) {
      req.session.user = presentUser._id;
      return resp.redirect("/profile");
    }
    return resp.render("login.hbs", {
      ...req.body,
      error_password: "Enter the correct password",
    });
  }
  return resp.render("login.hbs", {
    ...req.body,
    msg: "Enter the correct Email Id ` ",
  });
});

app.get("/logout", (req, resp) => {
  req.session.user = "";
  return resp.redirect("/login");
});

app.get("/login", (req, resp) => {
  // console.log(req.body,req.session.user)
  if (req.session.user) {
    return resp.redirect("/profile");
  } else {
    return resp.render("login.hbs");
  }
});

var storage = multer.diskStorage({
  //multers disk storage settings
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "upload"));
  },
  filename: function (req, file, cb) {
    var datetimestamp = Date.now();
    let filename=file.fieldname +
    "-" +
    datetimestamp +
    "." +
    file.originalname.split(".")[file.originalname.split(".").length - 1]
    // console.log(filename);
    req.filename=filename
    cb(
      null,
      filename
    );
  },
});

var upload = multer({
  storage: storage,
  fileFilter: function (req, file, callback) {
    var ext = path.extname(file.originalname);
    if (ext !== ".json") {
      return callback(new Error("Only json file are allowed"));
    }
    callback(null, true);
  },
  limits:{
      fileSize: 1 * 1000 * 1000
  }
}).single("josn");

app.post("/upload", (req, resp) => {
  upload(req, resp, async(err) => {
    if (err) {
      return resp.render("upload.hbs",{
        err:"Upload the json file only"
      })
    } else {
      let user=await model.findById(mongoose.Types.ObjectId(req.session.user))
      user.upload=req.filename
      await user.save()
      fs.readFile(path.resolve(`upload/${user.upload}`),'utf-8',async (err,data)=>{
        if(err){
          return resp.send(err);
        }
        else{
          console.log(typeof(data));
          user.data=data;

          await user.save();
          return resp.redirect('/readUploadfile')
        }
        
      })

    }
  });
});

app.get('/readUploadFile',auth,async(req,resp)=>{
  try{
  let user=await model.findById(mongoose.Types.ObjectId(req.session.user))
  if(user.upload==undefined){
    return resp.render('upload.hbs',{
      err:'please Upload to view files'
    })
  }
  resp.sendFile(path.resolve(`upload/${user.upload}`))
  }
  catch(e){
    return resp.render('upload.hbs',{
      err:'please Upload to view files'
    })
  }
})

app.get("/upload", auth, (req, resp) => {
  resp.render("upload.hbs");
});

app.get("*", (req, resp) => {
  resp.send("hello");
});

app.listen(port, () => {
  console.log("port = " + port);
});
