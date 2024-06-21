const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

const temporaryUsers = new Map();

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOtpEmail = (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your OTP Code',
    text: `Your OTP code is ${otp}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });
};

const generateOtp = () => Math.floor(100000 + Math.random() * 900000);

const register = async (req, res) => {
  try {
    const { name, email, phoneNumber, password } = req.body;

    // Check if user with the same email or phone number already exists in the database
    const existingUser = await User.findOne({ $or: [{ email }, { phoneNumber }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Check if user with the same email or phone number already exists in temporary storage
    if (temporaryUsers.has(email) || Array.from(temporaryUsers.values()).find(user => user.phoneNumber === phoneNumber)) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const otp = generateOtp();
    const hashedPassword = await bcrypt.hash(password, 10);

    // Temporarily store the user information
    temporaryUsers.set(email, {
      name,
      email,
      phoneNumber,
      password: hashedPassword,
      otp,
      otpExpires: Date.now() + 3600000, // OTP expires in 1 hour
    });

    // Send OTP email
    sendOtpEmail(email, otp);

    res.status(201).json({ message: 'OTP sent to email' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const tempUser = temporaryUsers.get(email);
    if (!tempUser || tempUser.otp !== otp) {
      return res.status(401).json({ message: "Invalid OTP" });
    }

    if (tempUser.otpExpires < Date.now()) {
      return res.status(401).json({ message: "OTP expired" });
    }

    // Save the user to the database
    const newUser = new User({
      name: tempUser.name,
      email: tempUser.email,
      phoneNumber: tempUser.phoneNumber,
      password: tempUser.password,
      registrationDate: new Date(),
    });

    await newUser.save();

    // Remove the user from temporary storage
    temporaryUsers.delete(email);

    res.status(200).json({ message: 'User verified and registered successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate OTP and send email
    const otp = generateOtp();
    user.otp = otp;
    user.otpExpires = Date.now() + 3600000; // OTP expires in 1 hour
    await user.save();

    sendOtpEmail(email, otp);

    res.status(200).json({ message: 'OTP sent to email' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.body;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { register, verifyOtp, login, getAllUsers, getUserById };
