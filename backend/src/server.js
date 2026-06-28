require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const scanRoutes = require('./routes/scan');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', scanRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Env Leak Detector API running' });
});

// Connect to MongoDB then start server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
