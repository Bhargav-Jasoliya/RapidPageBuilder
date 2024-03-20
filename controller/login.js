const User = require("../models/user");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

function login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).send('Email and password are required');
    }

    User.findOne({ email })
        .then(user => {
            if (!user) {
                return res.status(401).send('Invalid email or password');
            } else {
                bcrypt.compare(password, user.password)
                    .then(isMatch => {
                        if (isMatch) {
                            const token = jwt.sign({ userId: user._id }, 'your-secret-key', { expiresIn: '1h' });

                            res.cookie('user', JSON.stringify(user));
                            res.cookie('token', token, { httpOnly: true });

                            res.redirect('/');
                        } else {
                            return res.status(401).send('Invalid email or password');
                        }
                    })
                    .catch(err => {
                        console.error(err);
                    });
            }
        })
        .catch(err => {
            console.error('Error finding user:', err);
            res.status(500).send('Error finding user');
        });
}

module.exports = login;