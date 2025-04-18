// routes/promotions.js
const express = require('express');
const router = express.Router();
const Promotion = require('../models/Promotion');
const multer = require('multer');
const path = require('path');

// Set up image storage using multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/promotions/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// POST route to upload promotional image
router.post('/upload', upload.single('image'), async (req, res) => {
  const { restaurantId, description, startDate, endDate } = req.body;
  const imageUrl = req.file ? `/uploads/promotions/${req.file.filename}` : '';

  const promotion = new Promotion({
    restaurantId,
    imageUrl,
    description,
    startDate,
    endDate,
  });

  try {
    await promotion.save();
    res.status(200).json({ message: 'Promotion uploaded successfully!' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload promotion' });
  }
});


router.get('/:restaurantId', async (req, res) => {
    const { restaurantId } = req.params;
    const today = new Date();
    try {
      const promotions = await Promotion.find({
        restaurantId: restaurantId, // Fetch only promotions related to the restaurantId
        startDate: { $lte: today },  // Only active promotions
        endDate: { $gte: today },
      });
      res.status(200).json(promotions);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch promotions' });
    }
  });
module.exports = router;
