const express = require('express');
const session = require('express-session');
const mysql = require('mysql2');
const app = express();
const port = 8000;

// Middleware for parsing form data
app.use(express.urlencoded({ extended: true }));

// Session management
app.use(session({
    secret: 'somerandomstuff', // Choose a secure secret for production
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 1 day
        httpOnly: true, // Prevent access to cookie via JavaScript
        secure: false // Set to true if using HTTPS in production
    }
}));

// Middleware to make session data available in all views
app.use((req, res, next) => {
    if (req.session.userId) {
        res.locals.user = {
            userId: req.session.userId,
            username: req.session.username,
            firstName: req.session.firstName // Ensure firstName is included
        };
    } else {
        res.locals.user = null;  // No user logged in
    }
    console.log('Middleware Session Data:', req.session); // Debug statement
    console.log('Middleware Locals:', res.locals); // Debug statement
    next();
});



  
// Middleware to check if the user is logged in, if not, sets default values
const optionalLogin = (req, res, next) => {
    if (req.session && req.session.userId) {
        if (!req.session.firstName) {
            req.session.firstName = req.session.username || "Guest";  // Default to 'Guest' if no firstName exists
        }
        next();
    } else {
        req.session.userId = null;
        req.session.firstName = "Guest";  // Default to Guest if no firstName in session
        next();
    }
};

app.get('/movies', async (req, res) => {
    const userId = req.session.userId; // Assuming user session contains userId
    const availableMovies = await getAvailableMovies(); // Fetch movies
    let favoriteMovies = []; // Default empty array
  
    if (userId) {
      favoriteMovies = await getUserFavoriteMovies(userId); // Fetch user's favorite movies
    }
  
    res.render('list', {
      shopData: { shopName: "Betty's Movies" },
      firstName: req.session.firstName,
      userId,
      availableMovies,
      favoriteMovies, // Pass favorite movies to the template
    });
  });

// Set EJS as the templating engine
app.set('view engine', 'ejs');

// Public folder for static files (e.g., CSS, JS)
app.use(express.static(__dirname + '/public'));

// MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'appuser',
    password: 'app2027',
    database: 'bettys_movies' // Updated database name
});

db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('Connected to database');
});
global.db = db;

// Routes
const mainRoutes = require('./routes/main');
app.use('/', mainRoutes);

const usersRoutes = require('./routes/users');
app.use('/users', usersRoutes);

const moviesRoutes = require('./routes/movies'); // Updated route for movies
app.use('/movies', moviesRoutes);

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
