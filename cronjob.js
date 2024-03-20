const cron = require('node-cron');
const fs = require('fs/promises'); // Using fs/promises for asynchronous file operations
const path = require('path');
const Document = require('./models/document');

// Define a function to generate HTML pages
const generateHTMLPage = async (document) => {
    // Create HTML content from document fields (e.g., title, body)
    const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${document.title}</title>
        </head>
        <body>
            <h1>${document.title}</h1>
            ${JSON.parse(document.body)}
            <!-- Add more content here as needed -->
        </body>
        </html>
    `;
    // Define the directory where HTML pages will be saved
    const outputDir = path.join(__dirname, 'public', 'pages');

    // Ensure the output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Generate a unique filename based on document ID or title
    const filename = `${document.link}.html`; // Adjust filename generation as needed

    // Write HTML content to the file
    await fs.writeFile(path.join(outputDir, filename), htmlContent);

    // Return the URL of the generated HTML page
    return `/pages/${filename}`;
};


// Define a cron job to run every minute
const cronJob = () => {
    
    cron.schedule('* * * * *', async () => {
    try {
        // Get current date and time in UTC
        const currentDateUTC = new Date();

        // Get documents scheduled to be live in the past or within the next minute
        const upcomingDocuments = await Document.find({
            status: 'Scheduled',
            schedule: { $lte: currentDateUTC }
        }) // Set the maximum execution time to 30 seconds (30000 milliseconds)
        console.log("Upcoming pages to be live:", upcomingDocuments);

        // Make upcoming documents live
        for (const doc of upcomingDocuments) {
            // Generate HTML page
            const pageURL = await generateHTMLPage(doc);
            doc.status = 'Published';
            await doc.save();
            // Append the page URL to blog.ejs file
            await fs.appendFile(path.join(__dirname, 'views/pages', 'blogs.ejs'), `<a href="${pageURL}">${doc.title}</a><br>`);
                
            console.log(`Document "${doc.title}" is now live.`);
        }
    } catch (error) {
        console.error('Error in cron job:', error);
    }
}, {
    scheduled: true,
    timezone: "UTC" // Set timezone to UTC
})}

module.exports = cronJob