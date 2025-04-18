const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const Restaurant = require("./models/Restaurant");

// Load .env
dotenv.config();

const createAdmin = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const hashed = await bcrypt.hash("admin123", 10); // password

  const admin = new Restaurant({
    name: "Pizza Palace",
    email: "admin@pizza.com",
    passwordHash: hashed,
    logo: "",
    address: "Main Street",
  });

  await admin.save();
  console.log("✅ Admin restaurant created successfully!");

  mongoose.disconnect();
};

createAdmin();
