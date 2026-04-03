const express = require('express');
const path = require('path');
const app = express();

const PORT = 3000;

// Serve all static files (HTML, CSS, JS, images, video, JSON)
app.use(express.static(path.join(__dirname), {
    extensions: ['html'] // allows /about instead of /about.html
}));

// 404 fallback
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '404.html'));
});

app.listen(PORT, () => {
    console.log(`Site running at http://localhost:${PORT}`);
});
