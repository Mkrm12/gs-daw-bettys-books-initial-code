const express = require("express")
const router = express.Router()

const redirectLogin = (req, res, next) => {
    if (!req.session.userId ) {
      res.redirect('/users/login') // redirect to the login page
    } else { 
        next (); // move to the next middleware function
    } 
}

router.get('/search',function(req, res, next){
    res.render("search.ejs")
})

router.get('/search_result', function (req, res, next) {
    // Search the database
    let sqlquery = "SELECT * FROM books WHERE name LIKE '%" + req.query.search_text + "%'" // query database to get all the books
    // execute sql query
    db.query(sqlquery, (err, result) => {
        if (err) {
            next(err)
        }
        res.render("list.ejs", {availableBooks:result})
     }) 
})


router.get('/list', function(req, res, next) {
    let sqlquery = "SELECT * FROM books" // query database to get all the books
    // execute sql query
    db.query(sqlquery, (err, result) => {
        if (err) {
            next(err)
        }
        res.render("list.ejs", {availableBooks:result})
     })
})




const { check, validationResult } = require('express-validator');

// Render the Add Book page
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
    check('price')
        .matches(/^\d+(\.\d{1,2})?$/).withMessage('Price must be a valid number with up to two decimal places and cannot contain letters or symbols.')
        .isFloat({ min: 0, max: 99999999 }).withMessage('Price must be between 0 and 99,999,999.')
], (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        // Render the add book page with errors and previous input
        return res.render('addbook.ejs', { 
            errors: errors.array(), 
            previousData: req.body 
        });
    }

    // Saving data in the database
    let sqlquery = "INSERT INTO books (name, price) VALUES (?, ?)";
    let newrecord = [req.body.name, req.body.price];
    db.query(sqlquery, newrecord, (err, result) => {
        if (err) {
            return next(err);
        }
        res.send('This book has been added to the database, name: ' + req.body.name + ' price: ' + req.body.price);
    });
});





router.get('/bargainbooks', function(req, res, next) {
    let sqlquery = "SELECT * FROM books WHERE price < 20"
    db.query(sqlquery, (err, result) => {
        if (err) {
            next(err)
        }
        res.render("bargains.ejs", {availableBooks:result})
    })
}) 


// Export the router object so index.js can access it
module.exports = router