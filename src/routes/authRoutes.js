const express = require('express');
const authController = require('../controllers/authcontroller');

const router = express.Router();

// Register
router.post('/register', authController.register);

// Login
router.post('/login', authController.login);

// Verify OTP
router.post('/verify-otp', authController.verifyOtp);

// Get All Users
router.get('/users', authController.getAllUsers);

// Get User by ID
router.post('/users', authController.getUserById);

module.exports = router;
