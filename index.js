const express = require("express");
const app = express();
const cors = require("cors");
const admin = require("firebase-admin");
require("dotenv").config();
const ObjectId = require("mongodb").ObjectId;
const { MongoClient } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const fileUpload = require("express-fileupload");

const port = process.env.PORT || 4000;

const serviceAccount = require("./valley-hospital-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(cors());
app.use(express.json());
app.use(fileUpload());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1wea1.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// jwt;
async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1];
    console.log(token);
    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }
  next();
}

async function run() {
  try {
    await client.connect();

    const database = client.db("valley-clinic");
    const servicesCollection = database.collection("services");
    const usersCollection = database.collection("users");
    const doctorCollection = database.collection("doctors");
    const reviewCollection = database.collection("reviews");
    const appointmentCollection = database.collection("appointments");

    //all services api start

    //get available appointments

    app.get("/services", async (req, res) => {
      const page = req.query.page;
      const size = parseInt(req.query.size);
      const count = await servicesCollection.countDocuments();
      let services;
      if (page) {
        services = await servicesCollection
          .find({})
          .skip(page * size)
          .limit(size)
          .toArray();
      } else {
        services = await servicesCollection.find({}).toArray();
      }
      res.send({ services: services, count });
    });

    //get service by id
    app.get("/service/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await servicesCollection.findOne(query);
      res.json(result);
    });

    //add service
    app.post("/services", async (req, res) => {
      const service = req.body;
      const result = await servicesCollection.insertOne(service);
      res.json(result);
    });

    //delete services
    app.delete("/service/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await servicesCollection.deleteOne(query);
      res.json(result);
    });

    // service api end -----------------------````````````````````

    //delete available appointments
    app.delete("/appointments/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await appointmentCollection.deleteOne(query);
      res.json(result);
    });

    // post make appointments
    app.post("/appointments", async (req, res) => {
      const service = req.body;
      const result = await appointmentCollection.insertOne(service);
      res.json(result);
    });

    //get appointments
    app.get("/appointments", async (req, res) => {
      const cursor = await appointmentCollection.find({}).toArray();
      res.json(cursor);
    });

    //appointments get by email
    app.get("/appointment/:email", async (req, res) => {
      const result = await appointmentCollection
        .find({ email: req.params.email.toString() })
        .toArray();
      res.json(result);
    });
    //appointments get by id
    app.get("/appointments/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await appointmentCollection.findOne(query);
      res.json(result);
    });

    // get single appointment for payment

    //  confirm appointments
    app.put("/appointments/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "confirm",
        },
      };
      const result = await appointmentCollection.updateOne(query, updateDoc);
      res.json(result);
    });

    //--------start review section------------//
    app.post("/reviews", async (req, res) => {
      const name = req.body.name;
      const email = req.body.email;
      const occupation = req.body.occupation;
      const message = req.body.message;
      const rating = req.body.value;
      const pic = req.files.image;
      const picData = pic.data;
      const encodedPic = picData.toString("base64");
      const imageBuffer = Buffer.from(encodedPic, "base64");
      const comment = {
        name,
        email,
        occupation,
        message,
        rating,

        image: imageBuffer,
      };
      const result = await reviewCollection.insertOne(comment);
      res.json(result);
    });

    //get reviews
    app.get("/reviews", async (req, res) => {
      const cursor = await reviewCollection.find({}).toArray();
      res.json(cursor);
    });

    //confirm review
    app.put("/reviews/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "published",
        },
      };
      const result = await reviewCollection.updateOne(query, updateDoc);
      res.json(result);
    });

    //delete review
    app.delete("/reviews/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await reviewCollection.deleteOne(query);
      res.json(result);
    });

    //post doctors
    app.post("/doctors", async (req, res) => {
      const doctor = req.body;
      const result = await doctorCollection.insertOne(doctor);
      res.json(result);
    });
    //get doctors
    app.get("/doctors", async (req, res) => {
      const cursor = await doctorCollection.find({}).toArray();
      res.json(cursor);
    });

    // save users
    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const result = await usersCollection.insertOne(user);
      res.json(result);
    });

    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.json(result);
    });

    //
    // make admin

    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      console.log(req.decodedEmail);
      const requester = req.decodedEmail;
      console.log(requester);
      if (requester) {
        const requesterAccount = await usersCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: user.email };
          const updateDoc = { $set: { role: "admin" } };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      } else {
        req.status(403).json({ message: "you don not have " });
      }
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });

    //-----Payment section start -----//
    app.get("/appPayments/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await appointmentCollection.findOne(query);
      res.json(result);
    });

    app.put("/appPayments/:id", async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          payment: payment,
        },
      };
      const result = await appointmentCollection.updateOne(filter, updateDoc);
      res.json(result);
    });

    app.post("/create-payment-intent", async (req, res) => {
      const paymentInfo = req.body;
      const amount = paymentInfo.price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });
      res.json({ clientSecret: paymentIntent.client_secret });
    });

    //-----Payment section end -----//
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Valley - Clinic");
});

app.listen(port, () => {
  console.log(`Find port:${port}`);
});
