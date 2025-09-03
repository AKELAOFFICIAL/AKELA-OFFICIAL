# AKELA AI - Advanced Lottery Prediction System

AKELA AI is an advanced lottery prediction system that uses multiple AI models to predict lottery numbers with high accuracy.

## Features

- Multiple AI models (CNN, LSTM, GRU, Transformer, Hybrid, Ensemble)
- Real-time data fetching and processing
- Telegram notifications
- Pattern recognition for improved accuracy
- 24/7 operation with background tasks

## Deployment

1. Create a MongoDB Atlas account and database
2. Fork this repository
3. Deploy to Render.com:
   - Connect your GitHub repository
   - Set build command: `npm install`
   - Set start command: `node server.js`
   - Add environment variable: `MONGODB_URI` with your MongoDB connection string

## Environment Variables

- `MONGODB_URI`: MongoDB connection string
- `PORT`: Server port (default: 3000)

## Accuracy Improvement

The system uses multiple techniques to improve prediction accuracy:
1. Pattern recognition (repeating, sequential, alternating)
2. Frequency analysis of recent numbers
3. Ensemble learning combining multiple models
4. Continuous training with new data
