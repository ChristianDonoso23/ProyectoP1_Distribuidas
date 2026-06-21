const express = require('express');
const router = express.Router();
const { register, login, recover } = require('../controller/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/recover', recover);

module.exports = router;