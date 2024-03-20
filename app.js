const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require('body-parser');
const Document = require('./models/document');
const User = require("./models/user");
const jwt = require('jsonwebtoken');
const signup = require("./controller/signup");
const login =  require("./controller/login");
const cookieParser = require('cookie-parser');
const multer = require('multer');
const cloudinary = require("cloudinary").v2;
const fs = require('fs').promises;
const sendMail = require('./emailSender');
const cron = require('node-cron');
const { getDocumentsToPublishToday } = require('./documentsToPublishToday');

const app = express();
const upload = multer();

const cronJob = require('./cronjob')
cronJob()

app.use(cookieParser());

// Increase payload size limit to 5MB (adjust the limit as needed)
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));


const uri = "mongodb+srv://bhargavjasoliya10:j8zWjjvNznSx3Cmv@users.krj9gax.mongodb.net/?retryWrites=true&w=majority&appName=users";

mongoose.connect(uri)
    .then(result => console.log("DB connected...."))
    .catch(err => console.log(err));

app.listen(5000);
console.log("app is listening on port 5000");

// Configure Cloudinary with your Cloud Name, API Key, and API Secret
cloudinary.config({
    cloud_name: "dgqir2izj",
    api_key: "392616514377112",
    api_secret: "hb0j0p7EODjN7CJFo7zT1H2_ec0"
});


// Middleware to parse form data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// register view engine
app.set('view engine', 'ejs');

app.use(express.static('public'));

app.get('/', async (req, res) => {
    const token = req.cookies.token;
    if (token) {
        try {
            jwt.verify(token, 'your-secret-key');
            const documentCount = await Document.countDocuments();
            Document.find({}).then(documents => res.render('pages/dashboard.ejs', { documents: documents, documentCount:documentCount }));
        } catch (error) {
            res.cookie('token', '', { expires: new Date(0), httpOnly: true });
            res.redirect('/login');
        }
    } else {
        res.render('pages/login.ejs');
    }
})

app.post('/signup', signup);

app.get('/signup', (req, res) => {
    res.render('pages/signup.ejs');
})

app.get('/login', (req, res) => {
    const token = req.cookies.token;
    if (token) {
        try {
            jwt.verify(token, 'your-secret-key');
            res.redirect('/');
        } catch (error) {
            res.cookie('token', '', { expires: new Date(0), httpOnly: true });
            res.redirect('/login');
        }
    } else {
        res.render('pages/login.ejs');
    }
})

app.post('/login', login)

app.get('/createpage', async (req, res) => {
    const token = req.cookies.token;
    if (token) {
        try {
            jwt.verify(token, 'your-secret-key');
            res.render('pages/webPage.ejs');
        } catch (error) {
            res.cookie('token', '', { expires: new Date(0), httpOnly: true });
            res.redirect('/login');
        }
    } else {
        res.render('pages/login.ejs');
    }
        

});

app.post('/createpage', (req, res) => {
    const { id } = req.body;
    Document.findById(id)
        .then(async(document) => {
            console.log("post method", document);
            await res.cookie('document', JSON.stringify(document));
            // Send a response indicating success
            res.status(200).send({ message: 'Document found and cookie set successfully' });
            // res.render('pages/webPage', { document }); // Pass the document object to the template
        })
        .catch(error => console.log("some error:", error));
});

// Endpoint to handle file uploads to Cloudinary
app.post("/upload-images", async (req, res) => {
    try {
        const htmlContent = req.body.htmlContent;
        console.log("Image upload called................");
        console.log(htmlContent);
        const imgRegex = /<img[^>]+src="([^">]+)"/g;
        const imgUrls = [...htmlContent.matchAll(imgRegex)].map(match => match[1]);
        const uploadedUrls = [];
        for (const imgUrl of imgUrls) {
            const uploadResponse = await cloudinary.uploader.upload(imgUrl);
            console.log("this is urls: ", uploadResponse);
            uploadedUrls.push(uploadResponse.secure_url);
        }

        res.json({ uploadedUrls });
    } catch (error) {
        console.error("Error uploading images:", error);
        res.status(500).json({ error: "Failed to upload images" });
    }
});

// Endpoint to handle document uploads
app.post('/upload-document', upload.single('file'), async (req, res) => {
    try {
        // Write the file buffer to a temporary file
        const tempFilePath = `/tmp/${Date.now()}_${req.file.originalname}`;
        await fs.writeFile(tempFilePath, req.file.buffer);
        const result = await cloudinary.uploader.upload(tempFilePath, {
            resource_type: 'raw'
        });
        res.json({ url: result.secure_url });
    } catch (error) {
        console.error('Error uploading document:', error);
        res.status(500).json({ error: 'Failed to upload document' });
    }
});

// Handle POST request to save document
app.post('/save-document', async (req, res) => {
    try {
        // Parse data from request body
        const { title, subtext, body, attachments, link, author, showAuthor, status, schedule } = req.body;
        const user = JSON.parse(req.cookies.user)

        // console.log(user);
        // Create new document instance
        const newDocument = new Document({
            title,
            subtext,
            body,
            attachments,
            link,
            author,
            showAuthor,
            status,
            schedule,
            createdBy: user._id // Assuming req.user contains user information
        });

        // Save the document to the database
        await newDocument.save();

        res.status(200).json({ message: "Document saved successfully" });
    } catch (error) {
        console.error("Error saving document:", error);
        res.status(500).json({ error: "Failed to save document" });
    }
});

// Handle POST request to update document
app.post('/update-document', async (req, res) => {
    try {
        const { id, title, subtext, body, attachments, link, author, showAuthor, status, schedule } = req.body;
        const user = JSON.parse(req.cookies.user);

        // Check if the document ID is provided and valid
        if (!id) {
            return res.status(400).json({ error: "Document ID is required" });
        }

        // Update the document using findByIdAndUpdate
        const updatedDocument = await Document.findByIdAndUpdate(
            id,
            {
                title,
                subtext,
                body,
                attachments,
                link,
                author,
                showAuthor,
                status,
                schedule,
                lastModifiedBy: user._id // Assuming req.user contains user information
            },
            { new: true } // To return the updated document
        );

        // Check if the document was found and updated
        if (!updatedDocument) {
            return res.status(404).json({ error: "Document not found" });
        }

        res.status(200).json({ message: "Document updated successfully" });
    } catch (error) {
        console.error("Error updating document:", error);
        res.status(500).json({ error: "Failed to update document" });
    }
});

// API endpoint to delete a document by ID
app.post('/delete-document', async (req, res) => {
    const { itemId } = req.body;

    try {
        // Find the document by ID and delete it
        const deletedDocument = await Document.findByIdAndDelete(itemId);

        if (deletedDocument) {
            // Document successfully deleted
            res.status(200).json({ message: 'Document deleted successfully' });
        } else {
            // Document with the given ID not found
            res.status(404).json({ error: 'Document not found' });
        }
    } catch (error) {
        // Error occurred during deletion
        console.error('Error deleting document:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Define a cron job to run every morning at 8 o'clock Indian time
cron.schedule('0 8 * * *', () => {
    console.log("schedulewr called");
    callEmailSender();    
}, {
    scheduled: true,
    timezone: "Asia/Kolkata" // Set timezone to Indian Standard Time
});

async function callEmailSender() {
    const emailTitleList = await getDocumentsToPublishToday();
    console.log(emailTitleList);
    sendMail(emailTitleList);
}

app.get('/blogs', async (req, res) => {
    try {
        // Query the database for published documents
        // const publishedDocuments = await Document.find({ status: 'Published' });

        // Render a view or send JSON response containing the published documents
        res.render('pages/blogs'); // Assuming you have a view engine configured
        // or res.json({ documents: publishedDocuments }); // Sending JSON response
    } catch (error) {
        console.error('Error fetching published documents:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route for checking URL uniqueness
app.post('/check-url-uniqueness', async (req, res) => {
    const { url } = req.body;

    try {
        // Check if the URL already exists in the database
        const existingDocument = await Document.findOne({ link: url });

        // If the document exists, URL is not unique
        if (existingDocument) {
            res.json({ isUnique: false });
        } else {
            res.json({ isUnique: true });
        }
    } catch (error) {
        console.error('Error checking URL uniqueness:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});