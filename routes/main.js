// Create a new router
const express = require("express")
const router = express.Router()

// Define redirectLogin middleware
const redirectLogin = (req, res, next) => {
    if (!req.session.userId) {
        res.redirect('/users/login'); // Redirect to the login page
    } else {
        next(); // Move to the next middleware function
    }
};

// Handle our routes
// Route for the homepage
router.get("/", (req, res, next) => {
    const userId = req.session?.userId || null; // Get userId from session or set to null
    const userName = req.session?.firstName || "Guest"; // Get user's first name or default to "Guest"
    
    // Render the index page, passing user information
    res.render("index", { userId, userName });
});


router.get('/about',function(req, res, next){
    res.render('about.ejs')
})

// Route to render API Provision page 
router.get('/api-provision', (req, res) => { 
    res.render('apiProvision'); });


// Export the router object so index.js can access it
module.exports = router