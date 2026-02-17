import User from "../../models/userModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { errorHandler } from "../../utils/error.js";

const COOKIE_NAME = "access_token";
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || process.env.ACCESS_TOKEN;
const COOKIE_MAX_30_DAYS = 30 * 24 * 60 * 60 * 1000;

export const vendorSignup = async (req, res, next) => {
  const { username, email, password } = req.body;
  try {
    if (!username || !email || !password) {
      return next(errorHandler(400, "username, email and password are required"));
    }
    const hashedPassword = bcrypt.hashSync(password, 10);
    const user = await User.create({
      username,
      password: hashedPassword,
      email,
      isVendor: true,
    });
    const userObj = user.toObject ? user.toObject() : user;
    delete userObj.password;
    res.status(201).json({ message: "vendor created successfully", user: userObj });
  } catch (error) {
    if (error.code === 11000) return next(errorHandler(409, "email already in use"));
    next(error);
  }
};

export const vendorSignin = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) return next(errorHandler(400, "email and password required"));
    const validVendor = await User.findOne({ email });
    if (!validVendor || !validVendor.isVendor) {
      return next(errorHandler(404, "user not found"));
    }
    const validPassword = bcrypt.compareSync(password, validVendor.password);
    if (!validPassword) {
      return next(errorHandler(401, "wrong credentials"));
    }

    const token = jwt.sign({ id: validVendor._id }, ACCESS_TOKEN_SECRET, {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "30d",
    });

    const vendorObj = validVendor.toObject();
    delete vendorObj.password;

    res
      .cookie(COOKIE_NAME, token, {
        httpOnly: true,
        maxAge: COOKIE_MAX_30_DAYS,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      })
      .status(200)
      .json(vendorObj);
  } catch (error) {
    next(error);
  }
};

export const vendorSignout = async (req, res, next) => {
  try {
    res
      .clearCookie(COOKIE_NAME, {
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      })
      .status(200)
      .json({ message: "vendor signed out successfully" });
  } catch (error) {
    next(error);
  }
};

// vendor login or signup with Google
export const vendorGoogle = async (req, res, next) => {
  try {
    const { email, name, photo } = req.body;
    if (!email) return next(errorHandler(400, "email is required"));

    let user = await User.findOne({ email });
    if (user && user.isVendor) {
      const userObj = user.toObject();
      delete userObj.password;
      const token = jwt.sign({ id: user._id }, ACCESS_TOKEN_SECRET, {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "30d",
      });
      return res
        .cookie(COOKIE_NAME, token, {
          httpOnly: true,
          expires: new Date(Date.now() + COOKIE_MAX_30_DAYS),
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
        })
        .status(200)
        .json(userObj);
    }

    // create new vendor user from Google profile
    const generatedPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
    const hashedPassword = bcrypt.hashSync(generatedPassword, 10);
    const usernameBase = (name || "user").split(" ").join("").toLowerCase();
    const username = usernameBase + Math.random().toString(36).slice(-8);

    const newUser = new User({
      profilePicture: photo,
      password: hashedPassword,
      username,
      email,
      isVendor: true,
    });

    try {
      const savedUser = await newUser.save();
      const userObject = savedUser.toObject();
      delete userObject.password;
      const token = jwt.sign({ id: savedUser._id }, ACCESS_TOKEN_SECRET, {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "30d",
      });
      return res
        .cookie(COOKIE_NAME, token, {
          httpOnly: true,
          expires: new Date(Date.now() + COOKIE_MAX_30_DAYS),
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
        })
        .status(201)
        .json(userObject);
    } catch (error) {
      if (error.code === 11000) return next(errorHandler(409, "email already in use"));
      return next(error);
    }
  } catch (error) {
    next(error);
  }
};
