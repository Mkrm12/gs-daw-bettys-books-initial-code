const express = require("express");
const router = express.Router();
const { check, validationResult } = require('express-validator');

// Middleware to ensure the user is logged in
const redirectLogin = (req, res, next) => {
    if (!req.session.userId) {
        res.redirect('/users/login'); // redirect to the login page
    } else {
        next(); // move to the next middleware function
    }
};

// Route for rendering the Add Book page
router.get('/addbook', redirectLogin, function (req, res, next) {
    res.render('addbook.ejs', { errors: [], previousData: {} });
});

// Handle the book addition
router.post('/bookadded', [
    check('name')
        .isAlphanumeric().withMessage('Book name must only contain letters and numbers.')
        .isLength({ min: 1, max: 100 }).withMessage('Book name must be between 1 and 100 characters long.')
        .trim()
        .escape(),
    check('author')
        .isLength({ min: 1 }).withMessage('Author is required.')
        .trim()
        .escape(),
    check('price')
        .matches(/^\d+(\.\d{1,2})?$/).withMessage('Price must be a valid number with up to two decimal places and cannot contain letters or symbols.')
        .isFloat({ min: 0, max: 99999999 }).withMessage('Price must be between 0 and 99,999,999.'),
    check('description')
        .isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters.')
        .trim()
        .escape(),
], (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.render('addbook.ejs', {
            errors: errors.array(),
            previousData: req.body
        });
    }

    // Saving data in the database (Modified to include author and description)
    let sqlquery = "INSERT INTO books (name, author, price, description) VALUES (?, ?, ?, ?)";
    let newrecord = [req.body.name, req.body.author, req.body.price, req.body.description];
    
    db.query(sqlquery, newrecord, (err, result) => {
        if (err) {
            return next(err);
        }
        res.send('This book has been added to the database: ' + req.body.name);
    });
});

// Route to list all books
router.get('/list', function(req, res, next) {
    let sqlquery = "SELECT * FROM books"; // query database to get all the books
    db.query(sqlquery, (err, result) => {
        if (err) {
            next(err);
        }
        res.render("list.ejs", { availableBooks: result });
    });
});

// Route to handle posting reviews for a book
router.post('/review', (req, res, next) => {
    const { bookId, userName, rating, comment } = req.body;

    // Validate rating (ensure it's between 1 and 5)
    if (rating < 1 || rating > 5) {
        return res.status(400).send('Rating must be between 1 and 5');
    }

    // Find the book by ID in the database
    let sqlquery = "SELECT * FROM books WHERE id = ?";
    db.query(sqlquery, [bookId], (err, result) => {
        if (err) {
            return next(err);
        }
        
        let book = result[0];

        // Add the new review to the reviews array
        let newReview = {
            userName: userName,
            rating: parseInt(rating),
            comment: comment
        };

        // Save the review in the database (add to the reviews array)
        let insertReviewQuery = "INSERT INTO reviews (book_id, user_name, rating, comment) VALUES (?, ?, ?, ?)";
        db.query(insertReviewQuery, [bookId, userName, rating, comment], (err, result) => {
            if (err) {
                return next(err);
            }

            // Recalculate the book's overall rating
            updateBookRating(bookId);

            res.redirect('/books/list');
        });
    });
});

// Function to update the book's overall rating
function updateBookRating(bookId) {
    let sqlquery = "SELECT AVG(rating) AS avgRating FROM reviews WHERE book_id = ?";
    db.query(sqlquery, [bookId], (err, result) => {
        if (err) {
            console.error('Error calculating average rating:', err);
            return;
        }

        let avgRating = result[0].avgRating;
        let updateRatingQuery = "UPDATE books SET rating = ? WHERE id = ?";
        db.query(updateRatingQuery, [avgRating, bookId], (err, result) => {
            if (err) {
                console.error('Error updating book rating:', err);
            }
        });
    });
}

// Route for searching books
router.get('/search', function(req, res, next) {
    res.render("search.ejs");
});

// Route for handling the search result
router.get('/search_result', function (req, res, next) {
    let sqlquery = "SELECT * FROM books WHERE name LIKE '%" + req.query.search_text + "%'"; 
    db.query(sqlquery, (err, result) => {
        if (err) {
            next(err);
        }
        res.render("list.ejs", { availableBooks: result });
    });
});

// Route to list bargain books (those with price < 20)
router.get('/bargainbooks', function(req, res, next) {
    let sqlquery = "SELECT * FROM books WHERE price < 20";
    db.query(sqlquery, (err, result) => {
        if (err) {
            next(err);
        }
        res.render("bargains.ejs", { availableBooks: result });
    });
});

// Export the router so it can be used in index.js
module.exports = router;
