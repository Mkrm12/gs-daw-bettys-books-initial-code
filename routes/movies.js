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
    const userName = req.session.firstName || "Guest";
    res.render("addMovie.ejs", { 
        errors: [], 
        previousData: {}, 
        shopData: { shopName: "Betty's Movies" },
        userName  // Pass userName to the template
    });
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
            .isFloat({ min: 0, max: 10 }) // Adjusted the max value
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
             r.user_id, r.rating AS review_rating, r.review_text, u.first_name 
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
                    rating: row.review_rating, // Ensure review rating is captured correctly
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

    if (rating < 0 || rating > 10) {
        return res.status(400).send("Rating must be between 0 and 10");
    }

    const insertReviewQuery = `
      INSERT INTO reviews (movie_id, user_id, rating, review_text) 
      VALUES (?, ?, ?, ?)
    `;
    db.query(insertReviewQuery, [movieId, userId, rating, comment], (err, result) => {
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
    const { title, minRating, maxRating, reviewContent, descriptionContent, releaseYear, sortBy } = req.query;

    // Build the SQL query dynamically based on provided filters
    let sqlQuery = `
        SELECT m.id, m.title, m.description, m.rating, m.release_date, COUNT(r.id) AS review_count
        FROM movies m
        LEFT JOIN reviews r ON m.id = r.movie_id
        WHERE 1=1
    `;
    const params = [];

    if (title) {
        sqlQuery += " AND m.title LIKE ?";
        params.push(`%${title}%`);
    }
    if (minRating) {
        sqlQuery += " AND m.rating >= ?";
        params.push(parseFloat(minRating));
    }
    if (maxRating) {
        sqlQuery += " AND m.rating <= ?";
        params.push(parseFloat(maxRating));
    }
    if (reviewContent) {
        sqlQuery += " AND r.review_text LIKE ?";
        params.push(`%${reviewContent}%`);
    }
    if (descriptionContent) {
        sqlQuery += " AND m.description LIKE ?";
        params.push(`%${descriptionContent}%`);
    }
    if (releaseYear) {
        sqlQuery += " AND YEAR(m.release_date) = ?";
        params.push(parseInt(releaseYear));
    }

    // Add sorting based on user selection
    if (sortBy === 'mostReviews') {
        sqlQuery += " GROUP BY m.id ORDER BY review_count DESC";
    } else if (sortBy === 'highestRating') {
        sqlQuery += " GROUP BY m.id ORDER BY m.rating DESC";
    } else if (sortBy === 'newestRelease') {
        sqlQuery += " GROUP BY m.id ORDER BY m.release_date DESC";
    } else {
        sqlQuery += " GROUP BY m.id";
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


// TMDB API configuration
const TMDB_API_KEY = 'b4c8f4d68cafb98598fa69cd18caccc3';
const TMDB_AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiNGM4ZjRkNjhjYWZiOTg1OThmYTY5Y2QxOGNhY2NjMyIsIm5iZiI6MTczMzc1MDQzNS42NzgwMDAyLCJzdWIiOiI2NzU2ZWVhMzllMTJmYTI1ZThmYmUwZmEiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.Z7S4vYgb4uaChz0Tf1XFXLlfE4kcT1A4ybZb1t9aSuM';

// Route to fetch and display the latest movies from TMDb and database
router.get("/latest", async (req, res, next) => {
    const userId = req.session.userId || null;
    const userName = req.session.firstName || "Guest";

    try {
        // Fetch the latest movies from TMDb
        const response = await axios.get('https://api.themoviedb.org/3/movie/now_playing', {
            headers: {
                'Authorization': `Bearer ${TMDB_AUTH_TOKEN}`
            },
            params: {
                'api_key': TMDB_API_KEY
            }
        });

        const latestMoviesFromAPI = response.data.results.slice(0, 5).map(movie => ({
            title: movie.title,
            releaseDate: movie.release_date
        }));

        // Fetch the latest five movie entries from your database
        const sqlQuery = `
            SELECT title, description, release_date
            FROM movies
            ORDER BY id DESC
            LIMIT 5
        `;

        db.query(sqlQuery, (err, dbResults) => {
            if (err) {
                return next(err);
            }

            const latestMoviesFromDB = dbResults.map(movie => ({
                title: movie.title,
                releaseDate: movie.release_date,
                description: movie.description
            }));

            res.render("latest", {
                latestMoviesFromAPI: latestMoviesFromAPI,
                latestMoviesFromDB: latestMoviesFromDB,
                shopData: { shopName: "Betty's Movies" },
                userName,  // Pass userName to the template
                userId     // Pass userId to the template
            });
        });
    } catch (error) {
        console.error('Error fetching latest movies:', error.message);
        next(error);
    }
});


// Helper to normalize strings (case-insensitive)
const normalize = (str) => str.toLowerCase().trim();

// Fetch and store movie recommendations
router.get("/fetch-recommendations", async (req, res, next) => {
    const { genres, keywords, releaseYear, description } = req.query;
    const genreParam = genres ? genres.split(',').map(g => g.trim()).join(',') : '';
    const keywordParam = keywords ? keywords.split(',').map(k => k.trim()).join(',') : '';

    try {
        const response = await axios.get('https://api.themoviedb.org/3/discover/movie', {
            headers: {
                'Authorization': `Bearer ${TMDB_AUTH_TOKEN}`
            },
            params: {
                api_key: TMDB_API_KEY,
                with_genres: genreParam || undefined,
                primary_release_year: releaseYear || undefined,
                query: description || undefined,
                sort_by: 'popularity.desc',
            }
        });

        const movies = response.data.results;

        // Clear existing recommendations
        await new Promise((resolve, reject) => {
            db.query('DELETE FROM recommendations', (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        // Process movie recommendations
        for (const movie of movies) {
            const movieDetailsResponse = await axios.get(`https://api.themoviedb.org/3/movie/${movie.id}`, {
                headers: {
                    'Authorization': `Bearer ${TMDB_AUTH_TOKEN}`
                },
                params: { api_key: TMDB_API_KEY }
            });

            const keywordsResponse = await axios.get(`https://api.themoviedb.org/3/movie/${movie.id}/keywords`, {
                headers: {
                    'Authorization': `Bearer ${TMDB_AUTH_TOKEN}`
                },
                params: { api_key: TMDB_API_KEY }
            });

            const movieDetails = movieDetailsResponse.data;
            const genres = movieDetails.genres.map(g => g.name).join(', ');
            const tags = keywordsResponse.data.keywords.map(k => k.name).join(', ');

            const allText = `${movieDetails.title} ${movieDetails.overview} ${genres} ${tags}`.toLowerCase();
            const keywordsArray = keywordParam ? keywordParam.toLowerCase().split(',') : [];

            // Only save relevant movies
            if (!keywordParam || keywordsArray.every(k => allText.includes(k.trim()))) {
                const sqlQuery = `
                    INSERT INTO recommendations (movie_id, title, description, genres, release_date, tags)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                        title = VALUES(title), 
                        description = VALUES(description), 
                        genres = VALUES(genres), 
                        release_date = VALUES(release_date), 
                        tags = VALUES(tags)
                `;

                const values = [
                    movieDetails.id,
                    movieDetails.title,
                    movieDetails.overview,
                    genres,
                    movieDetails.release_date,
                    tags
                ];

                await new Promise((resolve, reject) => {
                    db.query(sqlQuery, values, (err) => {
                        if (err) return reject(err);
                        resolve();
                    });
                });
            }
        }

        res.redirect("/movies/recommendations");
    } catch (error) {
        console.error('Error fetching recommendations:', error.message);
        next(error);
    }
});

// Route to display recommendations
router.get("/recommendations", (req, res, next) => {
    const userId = req.session.userId || null;
    const userName = req.session.firstName || "Guest";
    const { search, type } = req.query;

    let query = 'SELECT * FROM recommendations';
    const params = [];

    if (search) {
        if (type === 'genre') {
            query += ' WHERE LOWER(genres) LIKE ?';
            params.push(`%${normalize(search)}%`);
        } else if (type === 'tag') {
            query += ' WHERE LOWER(tags) LIKE ?';
            params.push(`%${normalize(search)}%`);
        }
    }

    query += ' ORDER BY release_date DESC';

    db.query(query, params, (err, results) => {
        if (err) return next(err);
        res.render('recommendations', { movies: results, shopData: { shopName: "Betty's Movies" }, userName });
    });
});

module.exports = router;
