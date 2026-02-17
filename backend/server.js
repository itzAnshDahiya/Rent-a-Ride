import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import userRoute from "./routes/userRoute.js";
import authRoute from "./routes/authRoute.js";
import adminRoute from './routes/adminRoute.js'
import vendorRoute from './routes/venderRoute.js'
import cors from 'cors'
import cookieParser from "cookie-parser";
import { cloudinaryConfig } from "./utils/cloudinaryConfig.js";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const App = express();

// Load environment variables as early as possible (from backend/.env)
dotenv.config({ path: path.join(__dirname, '.env') });
// Prepare for Mongoose 7 change; explicitly set strictQuery to avoid the deprecation warning
mongoose.set("strictQuery", false);

App.use(express.json());
App.use(cookieParser())

const port = process.env.PORT || 3000;

// Support both `mongo_uri` and `MONGO_URI` env names
const mongoUri = process.env.mongo_uri || process.env.MONGO_URI;
if (!mongoUri) {
  console.error(
    "Missing MongoDB URI. Create a .env file with `mongo_uri` or `MONGO_URI` set. See .env.example"
  );
  process.exit(1);
}

// Connect to MongoDB first, then start the server
mongoose
  .connect(mongoUri)
  .then(() => {
    console.log("connected to MongoDB");
    App.listen(port, () => {
      console.log(`server listening on port ${port} !`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB:", error.message || error);

    // If using SRV URI and DNS lookup failed, provide a clear action for the user.
    if (error.code === "ENOTFOUND" || /querySrv/i.test(error.message || "")) {
      console.error(
        "DNS SRV lookup failed. If you're using a mongodb+srv URI, ensure the cluster host is correct in your MONGO_URI and that your network/DNS can resolve it."
      );

      // Show the host portion (redacted) to help debugging without printing credentials
      try {
        const uri = mongoUri;
        const atIndex = uri.indexOf("@");
        const hostAndRest = atIndex === -1 ? uri : uri.slice(atIndex + 1);
        const host = hostAndRest.split("/")[0];
        console.error("Current MONGO_URI host (redacted):", host);
      } catch (e) {
        console.error("Unable to parse MONGO_URI host for display.");
      }

      // Attempt a local fallback automatically (useful in development).
      const fallbackUri = process.env.LOCAL_MONGO_URI || "mongodb://127.0.0.1:27017/rent-a-ride-dev";
      console.warn("Attempting fallback MongoDB connection to:", fallbackUri);
      mongoose
        .connect(fallbackUri)
        .then(() => {
          console.log("connected to fallback MongoDB");
          App.listen(port, () => {
            console.log(`server listening on port ${port} !`);
          });
        })
        .catch((fallbackErr) => {
          console.error("Fallback MongoDB connection failed:", fallbackErr.message || fallbackErr);
          console.error("No working MongoDB connection. Update MONGO_URI in .env or start a local MongoDB instance.");
          process.exit(1);
        });
      return;
    }

    process.exit(1);
  });

const allowedOrigins = ['https://rent-a-ride-two.vercel.app', 'http://localhost:5173']; // Add allowed origins here

App.use(
  cors({
    origin: allowedOrigins,
    methods:['GET', 'PUT', 'POST' ,'PATCH','DELETE'],
    credentials: true, // Enables the Access-Control-Allow-Credentials header
  })
);


App.use(cloudinaryConfig);

// App.get('/*', (req, res) => res.sendFile(resolve(__dirname, '../public/index.html')));


App.use("/api/user", userRoute);
App.use("/api/auth", authRoute);
App.use("/api/admin",adminRoute);
App.use("/api/vendor",vendorRoute)



App.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "internal server error";
  return res.status(statusCode).json({
    succes: false,
    message,
    statusCode,
  });
});