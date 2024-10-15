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
router.get('/',function(req, res, next){
    res.render('index.ejs')
})

router.get('/index',function(req, res, next){
    res.render('index.ejs')
})

router.get('/about',function(req, res, next){
    res.render('about.ejs')
})



// Export the router object so index.js can access it
module.exports = router