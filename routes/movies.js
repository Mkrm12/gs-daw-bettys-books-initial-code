const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");
const axios = require('axios');

// Middleware to check if the user is logged in
const redirectLogin = (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/users/login');
    } else {
        next();
    }
};

// Route for rendering the Add Movie page
router.get("/addmovie", redirectLogin, (req, res) => {
    res.render("addMovie.ejs", { errors: [], previousData: {}, shopData: { shopName: "Betty's Movies" } });
});

// Handle the movie addition with validation and sanitization
router.post(
    "/movieadded",
    redirectLogin,
    [
        check("title")
            .isLength({ min: 1, max: 100 })
            .withMessage("Movie title must be between 1 and 100 characters long.")
            .trim()
            .escape(),
        check("description")
            .isLength({ min: 10, max: 1000 })
            .withMessage("Description must be between 10 and 1000 characters.")
            .trim()
            .escape(),
        check("rating")
            .matches(/^\d+(\.\d{1,2})?$/)
            .withMessage("Rating must be a valid number with up to two decimal places.")
            .isFloat({ min: 0, max: 10 })
            .withMessage("Rating must be between 0 and 10."),
        check("release_date")
            .isDate()
            .withMessage("Release date must be a valid date.")
            .trim()
            .escape(),
    ],
    (req, res, next) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.render("addMovie.ejs", {
                errors: errors.array(),
                previousData: req.body,
                shopData: { shopName: "Betty's Movies" }
            });
        }

        const sqlquery = "INSERT INTO movies (title, description, rating, release_date) VALUES (?, ?, ?, ?)";
        const newRecord = [
            req.body.title,
            req.body.description,
            req.body.rating,
            req.body.release_date,
        ];

        db.query(sqlquery, newRecord, (err, result) => {
            if (err) {
                return res.render("addMovie.ejs", {
                    errors: [{ msg: "Error inserting into database. Please try again." }],
                    previousData: req.body,
                    shopData: { shopName: "Betty's Movies" }
                });
            }
            res.redirect('/movies/list');
        });
    }
);

// Route to list all movies with their reviews
router.get("/list", (req, res, next) => {
    const userId = req.session.userId || null;
    const userName = req.session.firstName || "Guest";

    const sqlquery = `
      SELECT m.id, m.title, m.description, m.rating, m.release_date,
             r.user_id, r.review_text, u.first_name 
      FROM movies m 
      LEFT JOIN reviews r ON m.id = r.movie_id 
      LEFT JOIN users u ON r.user_id = u.id
    `;

    db.query(sqlquery, (err, result) => {
        if (err) {
            return next(err);
        }

        const movies = {};
        result.forEach((row) => {
            if (!movies[row.id]) {
                movies[row.id] = {
                    id: row.id,
                    title: row.title,
                    description: row.description,
                    rating: row.rating,
                    release_date: row.release_date,
                    reviews: [],
                };
            }
            if (row.review_text) {
                movies[row.id].reviews.push({
                    userId: row.user_id,
                    userName: row.first_name,
                    comment: row.review_text,
                });
            }
        });

        res.render("list", {
            availableMovies: Object.values(movies),
            shopData: { shopName: "Betty's Movies" },
            userId: userId,
            firstName: userName,
        });
    });
});

// Add a check to set userId properly for the logged-in user.
router.post("/review", (req, res, next) => {
    const { movieId, rating, comment } = req.body;
    const userId = req.session.userId;

    if (!userId) {
        return res.status(403).send("You must be logged in to submit a review.");
    }

    if (isNaN(userId) || userId <= 0) {
        return res.status(400).send("Invalid user ID");
    }

    if (rating < 1 || rating > 10) {
        return res.status(400).send("Rating must be between 1 and 10");
    }

    const insertReviewQuery = `
      INSERT INTO reviews (movie_id, user_id, review_text) 
      VALUES (?, ?, ?)
    `;
    db.query(insertReviewQuery, [movieId, userId, comment], (err, result) => {
        if (err) {
            return next(err);
        }

        updateMovieRating(movieId);
        res.redirect("/movies/list");
    });
});

// Function to update the movie's overall rating
function updateMovieRating(movieId) {
    const sqlquery = "SELECT AVG(rating) AS avgRating FROM reviews WHERE movie_id = ?";
    db.query(sqlquery, [movieId], (err, result) => {
        if (err) {
            console.error("Error calculating average rating:", err);
            return;
        }

        const avgRating = result[0].avgRating;
        const updateRatingQuery = "UPDATE movies SET rating = ? WHERE id = ?";
        db.query(updateRatingQuery, [avgRating, movieId], (err, result) => {
            if (err) {
                console.error("Error updating movie rating:", err);
            }
        });
    });
}

router.get('/search', (req, res) => {
    res.render('search', { shopData: { shopName: "Betty's Movies" } });
});

router.get('/search_result', (req, res, next) => {
    const { title, minRating, maxRating, release_date } = req.query;

    // Build the SQL query dynamically based on provided filters
    let sqlQuery = "SELECT * FROM movies WHERE 1=1"; // Default query that matches all movies
    const params = [];

    if (title) {
        sqlQuery += " AND title LIKE ?";
        params.push(`%${title}%`);
    }
    if (minRating) {
        sqlQuery += " AND rating >= ?";
        params.push(parseFloat(minRating));
    }
    if (maxRating) {
        sqlQuery += " AND rating <= ?";
        params.push(parseFloat(maxRating));
    }
    if (release_date) {
        sqlQuery += " AND release_date = ?";
        params.push(release_date);
    }

    // Execute the query
    db.query(sqlQuery, params, (err, results) => {
        if (err) {
            return next(err);
        }

        if (results.length === 0) {
            // No movies matched the criteria
            return res.render('search_result', { shopData: { shopName: "Betty's Movies" }, movies: null });
        }

        res.render('search_result', { shopData: { shopName: "Betty's Movies" }, movies: results });
    });
});

// Route to fetch and display the latest movies
router.get("/latest", async (req, res, next) => {
    try {
        const response = await axios.get('https://api.themoviedb.org/3/movie/now_playing', {
            headers: {
                'Authorization': `Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiNGM4ZjRkNjhjYWZiOTg1OThmYTY5Y2QxOGNhY2NjMyIsIm5iZiI6MTczMzc1MDQzNS42NzgwMDAyLCJzdWIiOiI2NzU2ZWVhMzllMTJmYTI1ZThmYmUwZmEiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.Z7S4vYgb4uaChz0Tf1XFXLlfE4kcT1A4ybZb1t9aSuM`
            },
            params: {
                'api_key': 'b4c8f4d68cafb98598fa69cd18caccc3'
            }
        });

        const latestMovies = response.data.results.slice(0, 5).map(movie => ({
            title: movie.title,
            releaseDate: movie.release_date
        }));

        res.render("latest", {
            latestMovies: latestMovies,
            shopData: { shopName: "Betty's Movies" }
        });
    } catch (error) {
        console.error('Error fetching latest movies:', error.message);
        next(error);
    }
});

module.exports = router;
