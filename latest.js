const express = require("express");
const router = express.Router();
const axios = require('axios');

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
