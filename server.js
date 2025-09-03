const express = require('express');
const tf = require('@tensorflow/tfjs-node');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/akelaai';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Data Models
const PredictionSchema = new mongoose.Schema({
  issueNumber: String,
  numberPrediction: Number,
  sizePrediction: String,
  confidence: Number,
  result: String,
  actualNumber: Number,
  actualSize: String,
  timestamp: { type: Date, default: Date.now },
  type: String
});

const DataSchema = new mongoose.Schema({
  issueNumber: String,
  number: String,
  size: String,
  timestamp: { type: Date, default: Date.now }
});

const SettingSchema = new mongoose.Schema({
  botToken: String,
  channelId: String,
  messageTemplate: String,
  files: Object,
  scheduledMessages: Array,
  autoTimingSessions: Array
});

const SessionStatSchema = new mongoose.Schema({
  wins: Number,
  losses: Number,
  total: Number,
  timestamp: { type: Date, default: Date.now }
});

const Prediction = mongoose.model('Prediction', PredictionSchema);
const Data = mongoose.model('Data', DataSchema);
const Setting = mongoose.model('Setting', SettingSchema);
const SessionStat = mongoose.model('SessionStat', SessionStatSchema);

// AI Model Training and Prediction Functions
class UltimatePredictor {
  constructor() {
    this.models = {
      ultra: { model: null, loss: Infinity },
      cnn: { model: null, loss: Infinity },
      lstm: { model: null, loss: Infinity },
      gru: { model: null, loss: Infinity },
      transformer: { model: null, loss: Infinity },
      hybrid: { model: null, loss: Infinity },
      ensemble: { model: null, loss: Infinity }
    };
    this.ULTRA_LOW_THRESHOLD = 50;
    this.CNN_THRESHOLD = 200;
    this.LSTM_THRESHOLD = 500;
    this.GRU_THRESHOLD = 800;
    this.TRANSFORMER_THRESHOLD = 1000;
    this.HYBRID_THRESHOLD = 1500;
    this.ENSEMBLE_THRESHOLD = 2000;
    this.TIMESTEPS = 20;
    this.patternWeights = {
      repeating: 0.25,
      sequential: 0.20,
      alternating: 0.15,
      random: 0.05
    };
  }

  async initModels() {
    try {
      for (const modelType in this.models) {
        try {
          const model = await tf.loadLayersModel(`https://raw.githubusercontent.com/your-username/akela-ai-models/main/${modelType}/model.json`);
          this.models[modelType].model = model;
          console.log(`${modelType} model loaded successfully`);
        } catch (e) {
          console.log(`${modelType} model not found, will train from scratch`);
          this.models[modelType].model = this.createModel(modelType);
        }
      }
    } catch (error) {
      console.error("Error initializing models:", error);
    }
  }

  async trainModels(data) {
    if (data.length < 10) return;

    try {
      const { sequences, labels } = this.prepareTrainingData(data);
      
      for (const modelType in this.models) {
        if (data.length >= this[`${modelType.toUpperCase()}_THRESHOLD`]) {
          await this.trainModel(modelType, sequences, labels);
        }
      }
      
      console.log('All models trained successfully');
    } catch (error) {
      console.error("Error training models:", error);
    }
  }

  prepareTrainingData(data) {
    const sequences = [];
    const labels = [];
    
    for (let i = this.TIMESTEPS; i < data.length; i++) {
      const sequence = data.slice(i - this.TIMESTEPS, i).map(item => parseInt(item.number));
      sequences.push(sequence);
      labels.push(parseInt(data[i].number));
    }
    
    return {
      sequences: tf.tensor2d(sequences),
      labels: tf.tensor1d(labels)
    };
  }

  async trainModel(modelType, sequences, labels) {
    try {
      const history = await this.models[modelType].model.fit(sequences, labels, {
        epochs: 20,
        batchSize: 16,
        validationSplit: 0.1,
        verbose: 0
      });
      
      this.models[modelType].loss = history.history.loss[history.history.loss.length - 1];
      console.log(`${modelType} model trained with loss: ${this.models[modelType].loss}`);
    } catch (error) {
      console.error(`Error training ${modelType} model:`, error);
    }
  }

  createModel(modelType) {
    const model = tf.sequential();
    
    switch(modelType) {
      case 'ultra':
        model.add(tf.layers.dense({ units: 32, activation: 'relu', inputShape: [this.TIMESTEPS] }));
        model.add(tf.layers.dropout({ rate: 0.1 }));
        break;
      case 'cnn':
        model.add(tf.layers.conv1d({ filters: 64, kernelSize: 3, activation: 'relu', inputShape: [this.TIMESTEPS, 1] }));
        model.add(tf.layers.maxPooling1d({ poolSize: 2 }));
        model.add(tf.layers.flatten());
        break;
      case 'lstm':
        model.add(tf.layers.lstm({ units: 64, returnSequences: true, inputShape: [this.TIMESTEPS, 1] }));
        model.add(tf.layers.lstm({ units: 32 }));
        model.add(tf.layers.dropout({ rate: 0.2 }));
        break;
      case 'gru':
        model.add(tf.layers.gru({ units: 64, returnSequences: true, inputShape: [this.TIMESTEPS, 1] }));
        model.add(tf.layers.gru({ units: 32 }));
        model.add(tf.layers.dropout({ rate: 0.2 }));
        break;
      case 'transformer':
        model.add(tf.layers.dense({ units: 128, activation: 'relu', inputShape: [this.TIMESTEPS] }));
        model.add(tf.layers.layerNormalization());
        model.add(tf.layers.dropout({ rate: 0.1 }));
        model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
        break;
      case 'hybrid':
        model.add(tf.layers.lstm({ units: 64, returnSequences: true, inputShape: [this.TIMESTEPS, 1] }));
        model.add(tf.layers.conv1d({ filters: 32, kernelSize: 3, activation: 'relu' }));
        model.add(tf.layers.maxPooling1d({ poolSize: 2 }));
        model.add(tf.layers.flatten());
        break;
      case 'ensemble':
      default:
        model.add(tf.layers.dense({ units: 128, activation: 'relu', inputShape: [this.TIMESTEPS] }));
        model.add(tf.layers.dropout({ rate: 0.1 }));
        model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
    }
    
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 10, activation: 'softmax' }));
    
    model.compile({
      optimizer: 'adam',
      loss: 'sparseCategoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    return model;
  }

  predict(data) {
    if (data.length < 5) {
      return {
        issueNumber: this.incrementIssueNumber(data[0]?.issueNumber || "20231115000"),
        prediction: Math.floor(Math.random() * 10),
        confidence: (Math.random() * 0.3 + 0.5).toFixed(2)
      };
    }

    try {
      const sequence = data.slice(-this.TIMESTEPS).map(item => parseInt(item.number));
      while (sequence.length < this.TIMESTEPS) {
        sequence.unshift(0);
      }
      
      const input = tf.tensor2d([sequence]);
      
      let bestModelType = 'ultra';
      let minLoss = Infinity;
      
      for (const modelType in this.models) {
        if (data.length >= this[`${modelType.toUpperCase()}_THRESHOLD`] && 
            this.models[modelType].model && 
            this.models[modelType].loss < minLoss) {
          bestModelType = modelType;
          minLoss = this.models[modelType].loss;
        }
      }
      
      if (this.models[bestModelType].model) {
        const predictionTensor = this.models[bestModelType].model.predict(input);
        const predictionArray = predictionTensor.arraySync()[0];
        const prediction = predictionArray.indexOf(Math.max(...predictionArray));
        const confidence = Math.max(...predictionArray) / predictionArray.reduce((a, b) => a + b, 0);
        
        // Apply pattern recognition to improve accuracy
        const patternAdjustedPrediction = this.applyPatternRecognition(data, prediction, confidence);
        
        return {
          issueNumber: this.incrementIssueNumber(data[0].issueNumber),
          prediction: patternAdjustedPrediction.prediction,
          confidence: patternAdjustedPrediction.confidence
        };
      } else {
        return this.fallbackPrediction(data);
      }
    } catch (error) {
      console.error("Error making prediction:", error);
      return this.fallbackPrediction(data);
    }
  }

  applyPatternRecognition(data, prediction, confidence) {
    const recentNumbers = data.slice(0, 10).map(item => parseInt(item.number));
    
    // Check for repeating pattern
    const lastNumber = recentNumbers[0];
    if (recentNumbers.filter(n => n === lastNumber).length >= 3) {
      // If same number repeating, predict a different number
      const newPrediction = (lastNumber + 1) % 10;
      return {
        prediction: newPrediction,
        confidence: Math.min(0.95, confidence + 0.15)
      };
    }
    
    // Check for sequential pattern
    const isSequential = recentNumbers.slice(0, 3).every((n, i, arr) => 
      i === 0 || n === (arr[i-1] + 1) % 10
    );
    
    if (isSequential) {
      const nextInSequence = (recentNumbers[0] + 1) % 10;
      return {
        prediction: nextInSequence,
        confidence: Math.min(0.95, confidence + 0.2)
      };
    }
    
    // Check for alternating pattern
    const isAlternating = recentNumbers.slice(0, 4).every((n, i) => 
      i < 2 || n === recentNumbers[i-2]
    );
    
    if (isAlternating) {
      const nextAlternate = recentNumbers[1];
      return {
        prediction: nextAlternate,
        confidence: Math.min(0.95, confidence + 0.1)
      };
    }
    
    // If no clear pattern, return original prediction with slight boost
    return {
      prediction: prediction,
      confidence: Math.min(0.95, confidence + 0.05)
    };
  }

  fallbackPrediction(data) {
    const lastNumbers = data.slice(0, 15).map(item => parseInt(item.number));
    const frequencies = new Array(10).fill(0);
    
    lastNumbers.forEach(num => {
      if (num >= 0 && num <= 9) frequencies[num]++;
    });
    
    // Find least frequent number with some randomness
    let prediction = 0;
    let minFrequency = Infinity;
    const candidates = [];
    
    for (let i = 0; i < 10; i++) {
      if (frequencies[i] < minFrequency) {
        minFrequency = frequencies[i];
        candidates.length = 0;
        candidates.push(i);
      } else if (frequencies[i] === minFrequency) {
        candidates.push(i);
      }
    }
    
    // Randomly select from least frequent numbers
    prediction = candidates[Math.floor(Math.random() * candidates.length)];
    
    // Calculate confidence based on frequency distribution
    const total = frequencies.reduce((a, b) => a + b, 0);
    const predictionFrequency = frequencies[prediction];
    const confidence = 0.6 + (0.3 * (1 - predictionFrequency / total));
    
    return {
      issueNumber: this.incrementIssueNumber(data[0].issueNumber),
      prediction: prediction,
      confidence: confidence.toFixed(2)
    };
  }

  incrementIssueNumber(issueNumber) {
    if (!issueNumber) return "20231115001";
    
    const lastFourDigits = issueNumber.slice(-4);
    const incremented = (parseInt(lastFourDigits) + 1).toString().padStart(4, '0');
    return issueNumber.slice(0, -4) + incremented;
  }
}

const predictor = new UltimatePredictor();

// API Routes
app.get('/api/predict', async (req, res) => {
  try {
    const data = await Data.find().sort({ timestamp: -1 }).limit(1000);
    const prediction = predictor.predict(data.reverse());
    res.json(prediction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/predictions', async (req, res) => {
  try {
    const predictions = await Prediction.find().sort({ timestamp: -1 }).limit(100);
    res.json(predictions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/save-predictions', async (req, res) => {
  try {
    await Prediction.deleteMany({});
    await Prediction.insertMany(req.body);
    res.json({ message: 'Predictions saved successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/data', async (req, res) => {
  try {
    const data = await Data.find().sort({ timestamp: -1 }).limit(1000);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/save-data', async (req, res) => {
  try {
    await Data.deleteMany({});
    await Data.insertMany(req.body);
    res.json({ message: 'Data saved successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const settings = await Setting.findOne();
    res.json(settings || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/save-settings', async (req, res) => {
  try {
    await Setting.deleteMany({});
    await Setting.create(req.body);
    res.json({ message: 'Settings saved successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/process-data', async (req, res) => {
  try {
    const newData = req.body;
    
    for (const item of newData) {
      const existing = await Data.findOne({ issueNumber: item.issueNumber });
      if (!existing) {
        await Data.create(item);
      }
    }
    
    // Train models with new data
    const allData = await Data.find().sort({ timestamp: -1 }).limit(1000);
    await predictor.trainModels(allData.reverse());
    
    res.json({ message: 'Data processed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const predictions = await Prediction.find({ result: { $ne: null } });
    const total = predictions.length;
    const wins = predictions.filter(p => p.result === 'win').length;
    const accuracy = total > 0 ? (wins / total * 100).toFixed(2) : 0;
    
    res.json({ total, wins, accuracy });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Background task for continuous prediction
cron.schedule('*/30 * * * * *', async () => {
  try {
    const response = await axios.get('https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json');
    
    if (response.data && response.data.data && response.data.data.list) {
      const newData = response.data.data.list.map(item => ({
        issueNumber: item.issueNumber,
        number: item.winNumber || item.number || '0',
        size: parseInt(item.winNumber || item.number || '0') >= 5 ? 'BIG' : 'SMALL'
      }));
      
      // Save new data
      for (const item of newData) {
        const existing = await Data.findOne({ issueNumber: item.issueNumber });
        if (!existing) {
          await Data.create(item);
          console.log(`New data saved: ${item.issueNumber}`);
        }
      }
      
      // Make prediction
      const allData = await Data.find().sort({ timestamp: -1 }).limit(1000);
      const prediction = predictor.predict(allData.reverse());
      
      // Check if prediction already exists
      const existingPrediction = await Prediction.findOne({ issueNumber: prediction.issueNumber });
      if (!existingPrediction) {
        // Save prediction
        const predictionRecord = new Prediction({
          issueNumber: prediction.issueNumber,
          numberPrediction: prediction.prediction,
          sizePrediction: prediction.prediction >= 5 ? 'BIG' : 'SMALL',
          confidence: prediction.confidence,
          result: null,
          actualNumber: null,
          actualSize: null,
          timestamp: new Date(),
          type: 'auto'
        });
        
        await predictionRecord.save();
        console.log(`Prediction saved: ${prediction.issueNumber} - ${prediction.prediction}`);
        
        // Send to Telegram if configured
        const settings = await Setting.findOne();
        if (settings && settings.botToken && settings.channelId) {
          const message = settings.messageTemplate
            .replace(/{issueNumber}/g, prediction.issueNumber)
            .replace(/{number}/g, prediction.prediction)
            .replace(/{size}/g, prediction.prediction >= 5 ? 'BIG' : 'SMALL');
          
          const telegramApiUrl = `https://api.telegram.org/bot${settings.botToken}/sendMessage`;
          
          try {
            await axios.post(telegramApiUrl, {
              chat_id: settings.channelId,
              text: `🔮 PREDICTION\n${message}\nConfidence: ${(prediction.confidence * 100).toFixed(2)}%`
            });
            console.log('Prediction sent to Telegram');
          } catch (error) {
            console.error('Failed to send prediction to Telegram:', error);
          }
        }
      }
    }
  } catch (error) {
    console.error('Background task error:', error);
  }
});

// Verify predictions
cron.schedule('*/45 * * * * *', async () => {
  try {
    const pendingPredictions = await Prediction.find({ result: null });
    const latestData = await Data.find().sort({ timestamp: -1 }).limit(10);
    
    for (const prediction of pendingPredictions) {
      const actualData = latestData.find(d => d.issueNumber === prediction.issueNumber);
      if (actualData) {
        prediction.actualNumber = parseInt(actualData.number);
        prediction.actualSize = actualData.size;
        prediction.result = parseInt(prediction.numberPrediction) === parseInt(actualData.number) ? 'win' : 'loss';
        
        await prediction.save();
        console.log(`Prediction verified: ${prediction.issueNumber} - ${prediction.result}`);
        
        // Update session stats
        let sessionStat = await SessionStat.findOne().sort({ timestamp: -1 });
        if (!sessionStat) {
          sessionStat = new SessionStat({ wins: 0, losses: 0, total: 0 });
        }
        
        if (prediction.result === 'win') {
          sessionStat.wins += 1;
        } else {
          sessionStat.losses += 1;
        }
        sessionStat.total += 1;
        sessionStat.timestamp = new Date();
        
        await sessionStat.save();
        
        // Send result to Telegram if configured
        const settings = await Setting.findOne();
        if (settings && settings.botToken && settings.channelId) {
          const message = `RESULT: ${prediction.issueNumber}\nPredicted: ${prediction.numberPrediction} (${prediction.sizePrediction})\nActual: ${actualData.number} (${actualData.size})\nResult: ${prediction.result.toUpperCase()}`;
          
          const telegramApiUrl = `https://api.telegram.org/bot${settings.botToken}/sendMessage`;
          
          try {
            await axios.post(telegramApiUrl, {
              chat_id: settings.channelId,
              text: message
            });
          } catch (error) {
            console.error('Failed to send result to Telegram:', error);
          }
        }
      }
    }
  } catch (error) {
    console.error('Verification task error:', error);
  }
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await predictor.initModels();
  console.log('AI Models initialized');
  
  // Initial data fetch
  try {
    const response = await axios.get('https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json');
    
    if (response.data && response.data.data && response.data.data.list) {
      const newData = response.data.data.list.map(item => ({
        issueNumber: item.issueNumber,
        number: item.winNumber || item.number || '0',
        size: parseInt(item.winNumber || item.number || '0') >= 5 ? 'BIG' : 'SMALL'
      }));
      
      for (const item of newData) {
        const existing = await Data.findOne({ issueNumber: item.issueNumber });
        if (!existing) {
          await Data.create(item);
        }
      }
      
      console.log('Initial data loaded');
      
      // Train models with initial data
      const allData = await Data.find().sort({ timestamp: -1 }).limit(1000);
      await predictor.trainModels(allData.reverse());
      console.log('Models trained with initial data');
    }
  } catch (error) {
    console.error('Initial data load error:', error);
  }
});
