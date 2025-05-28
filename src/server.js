import express from 'express';
import db from './db.js';  // note the .js extension is required in ES modules
import dotenv from 'dotenv';
import identifyRoutes from './routes/identifyRoutes.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/identify', identifyRoutes);

app.get('/', (req, res) => {
  db.query('SELECT NOW() AS currentTime', (err, results) => {
    if (err) {
      console.error('DB query error:', err);
      return res.status(500).send('Database error');
    }
    res.send(`Current database time is: ${results[0].currentTime}`);
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
