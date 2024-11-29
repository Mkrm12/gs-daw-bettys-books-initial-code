const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");

// Middleware to check if the user is logged in
const redirectLogin = (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/users/login');
    } else {
        next();
    }
};

// Route for rendering the Add Book page
router.get("/addbook", redirectLogin, (req, res) => {
    res.render("addBook.ejs", { errors: [], previousData: {}, shopData: { shopName: "Betty's Books" } });
});

// Handle the book addition with validation and sanitization
router.post(
    "/bookadded",
    redirectLogin,
    [
        check("name")
            .isLength({ min: 1, max: 50 })
            .withMessage("Book name must be between 1 and 50 characters long.")
            .trim()
            .escape(),
        check("author")
            .isLength({ min: 1, max: 255 })
            .withMessage("Author is required and must be less than 255 characters.")
            .trim()
            .escape(),
        check("price")
            .matches(/^\d+(\.\d{1,2})?$/)
            .withMessage("Price must be a valid number with up to two decimal places.")
            .isFloat({ min: 0, max: 99999.99 })
            .withMessage("Price must be between 0 and 99,999.99."),
        check("description")
            .isLength({ min: 10, max: 1000 })
            .withMessage("Description must be between 10 and 1000 characters.")
            .trim()
            .escape(),
    ],
    (req, res, next) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.render("addBook.ejs", {
                errors: errors.array(),
                previousData: req.body,
                shopData: { shopName: "Betty's Books" }
            });
        }

        const sqlquery = "INSERT INTO books (name, author, price, description) VALUES (?, ?, ?, ?)";
        const newRecord = [
            req.body.name,
            req.body.author,
            req.body.price,
            req.body.description,
        ];

        db.query(sqlquery, newRecord, (err, result) => {
            if (err) {
                return res.render("addBook.ejs", {
                    errors: [{ msg: "Error inserting into database. Please try again." }],
                    previousData: req.body,
                    shopData: { shopName: "Betty's Books" }
                });
            }
            res.redirect('/books/list');
        });
    }
);

// Route to list all books with their reviews
router.get("/list", (req, res, next) => {
    const userId = req.session.userId || null;
    const userName = req.session.firstName || "Guest";

    const sqlquery = `
      SELECT b.id, b.name, b.price, b.description, b.author, b.rating, 
             r.user_id, r.rating AS review_rating, r.review_text, u.first_name 
      FROM books b 
      LEFT JOIN reviews r ON b.id = r.book_id 
      LEFT JOIN users u ON r.user_id = u.id
    `;
  
    db.query(sqlquery, (err, result) => {
        if (err) {
            return next(err);
        }

        const books = {};
        result.forEach((row) => {
            if (!books[row.id]) {
                books[row.id] = {
                    id: row.id,
                    name: row.name,
                    price: row.price,
                    description: row.description,
                    author: row.author,
                    rating: row.rating,
                    reviews: [],
                };
            }
            if (row.review_text) {
                books[row.id].reviews.push({
                    userId: row.user_id,
                    userName: row.first_name,
                    rating: row.review_rating,
                    comment: row.review_text,
                });
            }
        });
  
        res.render("list", {
            availableBooks: Object.values(books),
            shopData: { shopName: "Betty's Books" },
            userId: userId,
            firstName: userName,
        });
    });
});

// Add a check to set userId properly for the logged-in user.
router.post("/review", (req, res, next) => {
    const { bookId, rating, comment } = req.body;
    const userId = req.session.userId;

    if (!userId) {
        return res.status(403).send("You must be logged in to submit a review.");
    }

    if (isNaN(userId) || userId <= 0) {
        return res.status(400).send("Invalid user ID");
    }

    if (rating < 1 || rating > 5) {
        return res.status(400).send("Rating must be between 1 and 5");
    }

    const insertReviewQuery = `
      INSERT INTO reviews (book_id, user_id, rating, review_text) 
      VALUES (?, ?, ?, ?)
    `;
    db.query(insertReviewQuery, [bookId, userId, rating, comment], (err, result) => {
        if (err) {
            return next(err);
        }

        updateBookRating(bookId);
        res.redirect("/books/list");
    });
});

// Function to update the book's overall rating
function updateBookRating(bookId) {
    const sqlquery = "SELECT AVG(rating) AS avgRating FROM reviews WHERE book_id = ?";
    db.query(sqlquery, [bookId], (err, result) => {
        if (err) {
            console.error("Error calculating average rating:", err);
            return;
        }

        const avgRating = result[0].avgRating;
        const updateRatingQuery = "UPDATE books SET rating = ? WHERE id = ?";
        db.query(updateRatingQuery, [avgRating, bookId], (err, result) => {
            if (err) {
                console.error("Error updating book rating:", err);
            }
        });
    });
}

module.exports = router;
