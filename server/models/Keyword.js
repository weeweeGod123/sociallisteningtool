const mongoose = require('mongoose');

const KeywordSchema = new mongoose.Schema({
  term: {
    type: String,
    required: true,
    unique: true
  },
  category: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  frequency: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Keyword', KeywordSchema);