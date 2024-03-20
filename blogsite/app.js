const express = require('express');
const mongoose = require('mongoose');
const ejs = require('ejs');

const app = express();
const PORT = 3000;

const uri = "mongodb+srv://bhargavjasoliya10:j8zWjjvNznSx3Cmv@users.krj9gax.mongodb.net/?retryWrites=true&w=majority&appName=users";
// Connect to MongoDB
mongoose.connect(uri).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('Error connecting to MongoDB:', err);
});

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Define routes
app.get('/', (req, res) => {

    const blogs = [];
    // Render homepage.ejs
    res.render('homepage', { blogs: blogs });
});


// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
