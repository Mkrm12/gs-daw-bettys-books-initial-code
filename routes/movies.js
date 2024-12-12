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




const availableGenres = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller'];
const availableTags = ['Epic', 'Heroic', 'Magical', 'Survival', 'Romantic', 'Space', 'Suspenseful', 'Gritty', 'Lighthearted', 'Dark'];

function getRandomItems(arr, num) {
    const shuffled = arr.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, num).join(', ');
}

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
            .isFloat({ min: 0, max: 10 })
            .withMessage("Rating must be between 0 and 10."),
        check("release_date")
            .isDate()
            .withMessage("Release date must be a valid date.")
            .trim()
            .escape(),
        check("genres")
            .optional()
            .trim()
            .escape(),
        check("tags")
            .optional()
            .trim()
            .escape(),
        check("keywords")
            .optional()
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

        // Assign random genres and tags if not provided
        const genres = req.body.genres || getRandomItems(availableGenres, 3);
        const tags = req.body.tags || getRandomItems(availableTags, 3);
        const keywords = req.body.keywords || '';

        const sqlquery = "INSERT INTO movies (title, description, rating, release_date, genres, tags, keywords) VALUES (?, ?, ?, ?, ?, ?, ?)";
        const newRecord = [
            req.body.title,
            req.body.description,
            req.body.rating,
            req.body.release_date,
            genres,
            tags,
            keywords
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
router.get("/list", async (req, res, next) => {
    const userId = req.session.userId || null;
    const userName = req.session.firstName || "Guest";

    try {
        const sqlquery = `
            SELECT m.id, m.title, m.description, m.rating, m.release_date, 
                   r.user_id, r.rating AS review_rating, r.review_text, u.first_name,
                   uf.user_id IS NOT NULL AS isFavorited
            FROM movies m
            LEFT JOIN reviews r ON m.id = r.movie_id
            LEFT JOIN users u ON r.user_id = u.id
            LEFT JOIN user_favorites uf ON m.id = uf.movie_id AND uf.user_id = ?
        `;

        const [rows] = await new Promise((resolve, reject) => {
            db.query(sqlquery, [userId], (err, results) => {
                if (err) return reject(err);
                resolve([results]);
            });
        });

        // Group movies by their ID and attach reviews
        const movies = {};
        rows.forEach((row) => {
            if (!movies[row.id]) {
                movies[row.id] = {
                    id: row.id,
                    title: row.title,
                    description: row.description,
                    rating: row.rating,
                    release_date: row.release_date,
                    isFavorited: !!row.isFavorited,
                    reviews: [],
                };
            }
            if (row.review_text) {
                movies[row.id].reviews.push({
                    userId: row.user_id,
                    userName: row.first_name,
                    rating: row.review_rating,
                    comment: row.review_text,
                });
            }
        });

        const favoriteMovies = Object.values(movies).filter(movie => movie.isFavorited);

        // Render the page with updated movie data, favorite status, and user info
        res.render("list", {
            availableMovies: Object.values(movies),
            favoriteMovies, // Add this line for the movies favorited by the user
            shopData: { shopName: "Betty's Movies" },
            userId: userId,
            firstName: userName,
        });

    } catch (error) {
        console.error('Error fetching movies:', error);
        res.status(500).send('Internal Server Error');
    }
});





// Add movie to favorites
router.post('/favorite', (req, res) => {
    const userId = req.session.userId;
    const movieId = req.body.movieId;

    const query = `
        INSERT INTO user_favorites (user_id, movie_id)
        SELECT ?, ?
        WHERE NOT EXISTS (
            SELECT 1 FROM user_favorites WHERE user_id = ? AND movie_id = ?
        );
    `;
    db.query(query, [userId, movieId, userId, movieId], (err, result) => {
        if (err) {
            console.error('Database error while adding favorite:', err);
            return res.status(500).send('Failed to add favorite.');
        }

        res.redirect('/movies/list'); // Redirect back to the movie list
    });
});

// Remove movie from favorites
router.post('/unfavorite', (req, res) => {
    const userId = req.session.userId;
    const movieId = req.body.movieId;

    const query = `DELETE FROM user_favorites WHERE user_id = ? AND movie_id = ?`;

    db.query(query, [userId, movieId], (err, result) => {
        if (err) {
            console.error('Error removing favorite:', err);
            return res.status(500).send('Failed to remove favorite.');
        }

        res.redirect('/movies/list'); // Redirect back to the movie list
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


// Recommendations route
router.get('/recommendations', (req, res, next) => {
    const userId = req.session.userId;

    if (!userId) {
        return res.status(401).json({ error: "User not logged in." });
    }

    // Fetch the user's favorite genres, tags, keywords, etc.
    const query = `
        SELECT u.username,
               GROUP_CONCAT(DISTINCT m.genres SEPARATOR '|') AS favorite_genres,
               GROUP_CONCAT(DISTINCT m.tags SEPARATOR '|') AS favorite_tags,
               GROUP_CONCAT(DISTINCT m.keywords SEPARATOR '|') AS favorite_keywords,
               GROUP_CONCAT(DISTINCT m.id SEPARATOR ',') AS favorite_movie_ids
        FROM users u
        JOIN user_favorites uf ON u.id = uf.user_id
        JOIN movies m ON uf.movie_id = m.id
        WHERE u.id = ?
        GROUP BY u.username;
    `;

    db.query(query, [userId], (err, results) => {
        if (err) return next(err);

        const preferences = results.length ? results[0] : null;
        const genres = preferences.favorite_genres ? preferences.favorite_genres.split('|') : [];
        const tags = preferences.favorite_tags ? preferences.favorite_tags.split('|') : [];
        const keywords = preferences.favorite_keywords ? preferences.favorite_keywords.split('|') : [];
        const favoriteMovieIds = preferences.favorite_movie_ids ? preferences.favorite_movie_ids.split(',') : [];

        // Create a frequency map for each category
        const genreFrequency = countFrequency(genres);
        const tagFrequency = countFrequency(tags);
        const keywordFrequency = countFrequency(keywords);

        // Get the most frequent genre, tag, and keyword
        const mostFrequentGenre = getMostFrequent(genreFrequency);
        const mostFrequentTag = getMostFrequent(tagFrequency);
        const mostFrequentKeyword = getMostFrequent(keywordFrequency);

        // Query for movie recommendations based on the most frequent genres, tags, and keywords, excluding favorite movies
        const recommendationQuery = `
            SELECT m.id, m.title, m.genres, m.tags, m.keywords
            FROM movies m
            WHERE (m.genres LIKE ? OR m.tags LIKE ? OR m.keywords LIKE ?)
              AND m.id NOT IN (?)
        `;

        db.query(recommendationQuery, [`%${mostFrequentGenre}%`, `%${mostFrequentTag}%`, `%${mostFrequentKeyword}%`, favoriteMovieIds], (err, recommendations) => {
            if (err) return next(err);

            res.render('recommendations', {
                username: preferences.username,
                recommendations: recommendations
            });
        });
    });
});

// Helper function to count frequency of items in an array
function countFrequency(arr) {
    const freq = {};
    arr.forEach(item => {
        freq[item] = (freq[item] || 0) + 1;
    });
    return freq;
}

// Helper function to get the most frequent item
function getMostFrequent(freqMap) {
    return Object.keys(freqMap).reduce((a, b) => freqMap[a] > freqMap[b] ? a : b);
}







/// User preferences route
router.get('/user-preferences', (req, res, next) => {
    const userId = req.session.userId;

    if (!userId) {
        return res.status(401).json({ error: "User not logged in." });
    }

    const query = `
        SELECT u.username,
               GROUP_CONCAT(DISTINCT m.title ORDER BY m.id) AS favorite_titles,
               GROUP_CONCAT(DISTINCT m.genres ORDER BY m.id SEPARATOR '|') AS favorite_genres,
               GROUP_CONCAT(DISTINCT m.tags ORDER BY m.id SEPARATOR '|') AS favorite_tags,
               GROUP_CONCAT(DISTINCT m.release_date ORDER BY m.id SEPARATOR ',') AS favorite_years,
               GROUP_CONCAT(DISTINCT m.description ORDER BY m.id SEPARATOR '|') AS favorite_descriptions,
               GROUP_CONCAT(DISTINCT m.keywords ORDER BY m.id SEPARATOR '|') AS favorite_keywords,
               COUNT(m.id) AS favorite_count
        FROM users u
        JOIN user_favorites uf ON u.id = uf.user_id
        JOIN movies m ON uf.movie_id = m.id
        WHERE u.id = ?
        GROUP BY u.username;
    `;

    db.query(query, [userId], (err, results) => {
        if (err) return next(err);

        const preferences = results.length ? results[0] : null;

        // Define the message
        let message = '';
        if (preferences.favorite_count < 4) {
            message = `You need at least 4 favorite movies to get recommendations. You have ${preferences.favorite_count}.`;
        }

        res.render('user-preferences', {
            username: preferences?.username,
            favorite_titles: preferences?.favorite_titles || "",
            favorite_genres: preferences?.favorite_genres || "",
            favorite_tags: preferences?.favorite_tags || "",
            favorite_years: preferences?.favorite_years || "",
            favorite_descriptions: preferences?.favorite_descriptions || "",
            favorite_keywords: preferences?.favorite_keywords || "",
            favorite_count: preferences.favorite_count,
            message  // Pass the message variable to the template
        });
    });
});

module.exports = router;



// // Helper to normalize strings (case-insensitive)
// const normalize = (str) => str ? str.toLowerCase().trim() : '';

// // Fetch and store movie recommendations
// router.get("/fetch-recommendations", async (req, res, next) => {
//     const userId = req.session.userId;

//     if (!userId) {
//         return res.status(401).json({ error: "User not logged in." });
//     }

//     try {
//         // Fetch user favorites with relevant details
//         const [favorites] = await new Promise((resolve, reject) => {
//             db.query(
//                 `SELECT m.id, m.title, m.description, m.release_date, m.genres, m.tags, m.keywords
//                  FROM user_favorites uf
//                  JOIN movies m ON uf.movie_id = m.id
//                  WHERE uf.user_id = ?`,
//                 [userId],
//                 (err, results) => {
//                     if (err) return reject(err);
//                     resolve(results);
//                 }
//             );
//         });

//         if (favorites.length === 0) {
//             return res.status(400).json({ error: "No favorite movies found." });
//         }

//         // Aggregate user preferences
//         let genrePreferences = {};
//         let tagPreferences = {};
//         let keywordPreferences = {};

//         favorites.forEach(movie => {
//             const genres = movie.genres.split(',').map(normalize);
//             genres.forEach(genre => {
//                 genrePreferences[genre] = (genrePreferences[genre] || 0) + 1;
//             });

//             const tags = movie.tags.split(',').map(normalize);
//             tags.forEach(tag => {
//                 tagPreferences[tag] = (tagPreferences[tag] || 0) + 1;
//             });

//             const keywords = movie.keywords.split(',').map(normalize);
//             keywords.forEach(keyword => {
//                 keywordPreferences[keyword] = (keywordPreferences[keyword] || 0) + 1;
//             });
//         });

//         const sortedGenres = Object.keys(genrePreferences).sort((a, b) => genrePreferences[b] - genrePreferences[a]);
//         const sortedTags = Object.keys(tagPreferences).sort((a, b) => tagPreferences[b] - tagPreferences[a]);
//         const sortedKeywords = Object.keys(keywordPreferences).sort((a, b) => keywordPreferences[b] - keywordPreferences[a]);

//         // Fetch movie recommendations based on aggregated preferences
//         const response = await axios.get('https://api.themoviedb.org/3/discover/movie', {
//             params: {
//                 api_key: process.env.TMDB_API_KEY,
//                 with_genres: sortedGenres.slice(0, 3).join(','),
//                 sort_by: 'popularity.desc'
//             }
//         });

//         const movies = response.data.results;

//         // Clear existing recommendations for the user
//         await new Promise((resolve, reject) => {
//             db.query('DELETE FROM recommendations WHERE user_id = ?', [userId], (err) => {
//                 if (err) return reject(err);
//                 resolve();
//             });
//         });

//         // Process and store movie recommendations
//         for (const movie of movies) {
//             const movieDetailsResponse = await axios.get(`https://api.themoviedb.org/3/movie/${movie.id}`, {
//                 params: { api_key: process.env.TMDB_API_KEY }
//             });

//             const keywordsResponse = await axios.get(`https://api.themoviedb.org/3/movie/${movie.id}/keywords`, {
//                 params: { api_key: process.env.TMDB_API_KEY }
//             });

//             const movieDetails = movieDetailsResponse.data;
//             const keywords = keywordsResponse.data.keywords.map(k => k.name.toLowerCase()).join(', ');

//             const genres = movieDetails.genres.map(g => g.name.toLowerCase()).join(', ');
//             const tags = keywords.split(', ');

//             // Only save relevant movies
//             const isRelevantByGenres = genres.split(', ').some(g => sortedGenres.includes(g));
//             const isRelevantByTags = tags.some(t => sortedTags.includes(t));

//             if (isRelevantByGenres || isRelevantByTags) {
//                 const sqlQuery = `
//                     INSERT INTO recommendations (user_id, movie_id, title, description, genres, release_date, tags, keywords)
//                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
//                     ON DUPLICATE KEY UPDATE 
//                         title = VALUES(title), 
//                         description = VALUES(description), 
//                         genres = VALUES(genres), 
//                         release_date = VALUES(release_date), 
//                         tags = VALUES(tags),
//                         keywords = VALUES(keywords)
//                 `;

//                 const values = [
//                     userId,
//                     movieDetails.id,
//                     movieDetails.title,
//                     movieDetails.overview,
//                     genres,
//                     movieDetails.release_date,
//                     tags.join(', '),
//                     keywords
//                 ];

//                 await new Promise((resolve, reject) => {
//                     db.query(sqlQuery, values, (err) => {
//                         if (err) return reject(err);
//                         resolve();
//                     });
//                 });
//             }
//         }

//         res.redirect("/movies/recommendations");
//     } catch (error) {
//         console.error('Error fetching recommendations:', error.message);
//         next(error);
//     }
// });