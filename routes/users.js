const express = require("express");
const router = express.Router();
const bcrypt = require('bcrypt');
const saltRounds = 10;

const { check, validationResult } = require('express-validator');

// Middleware to redirect if the user is not logged in
const redirectLogin = (req, res, next) => {
    if (!req.session.userId) {
        res.redirect('./login'); // redirect to the login page
    } else {
        next(); // move to the next middleware function
    }
};






// Render the registration page
router.get('/register', (req, res) => {
    res.render('register.ejs', { errors: [], previousData: {} });
});

router.post('/registered', [
    check('email').isEmail().withMessage('Invalid email address'),
    check('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    check('username').notEmpty().withMessage('Username is required'),
    check('first').notEmpty().withMessage('First name is required'),
    check('last').notEmpty().withMessage('Last name is required')
], (req, res, next) => {
    // Sanitize input fields
    req.body.first = req.sanitize(req.body.first);
    req.body.last = req.sanitize(req.body.last);
    req.body.email = req.sanitize(req.body.email);
    req.body.username = req.sanitize(req.body.username);
    req.body.password = req.sanitize(req.body.password);

    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        // Pass errors and previous input back to the registration page
        return res.render('register.ejs', { 
            errors: errors.array(), 
            previousData: req.body
        });
    }

    const plainPassword = req.body.password;

    bcrypt.hash(plainPassword, saltRounds, (err, hashedPassword) => {
        if (err) {
            return next(err);
        }

        // Insert user details into the database
        const query = 'INSERT INTO users (username, first_name, last_name, email, hashed_password) VALUES (?, ?, ?, ?, ?)';
        const values = [req.body.username, req.body.first, req.body.last, req.body.email, hashedPassword];

        db.query(query, values, (err, result) => {
            if (err) {
                return next(err);
            }

            res.send(`Hello ${req.body.first} ${req.body.last}, you are now registered! We will send an email to you at ${req.body.email}. <a href="/users/login">Login here</a>`);
        });
    });
});



// Handle Reset Password Route (GET)
router.get('/resetpassword', (req, res) => {
    res.render('resetpassword.ejs', { error: null });
});

// Handle Reset Password (POST)
router.post('/resetpassword', (req, res) => {
    const email = req.body.email;
    const newPassword = req.body.newPassword;

    // Validate new password length
    if (newPassword.length < 8) {
        return res.render('resetpassword.ejs', { error: 'Password must be at least 8 characters long' });
    }

    // Check if the email exists in the database
    const query = 'SELECT * FROM users WHERE email = ?';
    db.query(query, [email], (err, result) => {
        if (err) {
            return next(err);
        }

        if (result.length === 0) {
            return res.render('resetpassword.ejs', { error: 'No user found with this email' });
        }

        // Generate new hashed password and update the database
        const plainPassword = newPassword;
        bcrypt.hash(plainPassword, saltRounds, (err, hashedPassword) => {
            if (err) {
                return next(err);
            }

            // Update the user's password in the database
            const updateQuery = 'UPDATE users SET hashed_password = ?, plain_password = ? WHERE email = ?';
            db.query(updateQuery, [hashedPassword, plainPassword, email], (err, result) => {
                if (err) {
                    return next(err);
                }

                res.send(`
                    <p>Your password has been reset successfully. You can now log in with your new password.</p>
                    <p>Already registered? <a href="/users/login">Login here</a></p>
                `);
            });
        });
    });
});




// Render the login page
router.get('/login', function (req, res, next) {
    res.render('login.ejs');
});

// Handle login logic
router.post('/loggedin', function (req, res, next) {
    const username = req.body.username;
    const plainPassword = req.body.password;

    // Fetch user by username
    const query = 'SELECT hashed_password FROM users WHERE username = ?';
    db.query(query, [username], (err, result) => {
        if (err || result.length === 0) {
            return res.send('Invalid username or password.');
        }

        const hashedPassword = result[0].hashed_password;

        // Compare the password entered by the user with the hashed password from the DB
        bcrypt.compare(plainPassword, hashedPassword, function (err, match) {
            if (err) {
                return next(err);
            }

            if (match) {
                // Save user session here, when login is successful
                req.session.userId = req.body.username;
                res.redirect('/index'); // Redirect to the main index.ejs or some other page after successful login
            } else {
                res.send('Invalid username or password.');
            }
        });
    });
});

// List users (without passwords)
router.get('/userList', redirectLogin, function (req, res, next) {
    let sqlquery = "SELECT username, first_name, last_name, email FROM users"; // query to get users without passwords
    db.query(sqlquery, (err, result) => {
        if (err) {
            return next(err); // handle error
        }
        res.render("userList.ejs", { users: result }); // pass users to the template
    });
});

// Handle logout logic
router.get('/logout', redirectLogin, (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('index.ejs'); // Redirect to home if there's an error
        }
        res.redirect('/'); // Redirect to landing page after successful logout
    });
});

module.exports = router;
