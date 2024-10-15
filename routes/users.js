const express = require("express");
const router = express.Router();
const bcrypt = require('bcrypt');
const saltRounds = 10;

// Middleware to redirect if the user is not logged in
const redirectLogin = (req, res, next) => {
    if (!req.session.userId) {
        res.redirect('./login'); // redirect to the login page
    } else {
        next(); // move to the next middleware function
    }
};

// Render the registration page
router.get('/register', function (req, res, next) {
    res.render('register.ejs');
});

// Handle registration logic
router.post('/registered', function (req, res, next) {
    const plainPassword = req.body.password;

    bcrypt.hash(plainPassword, saltRounds, function (err, hashedPassword) {
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

            res.send('Hello ' + req.body.first + ' ' + req.body.last + ', you are now registered! We will send an email to you at ' + req.body.email + '. <a href="/users/login">Login here</a>');
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
