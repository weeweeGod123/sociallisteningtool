// server/models/Post.js
const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      required: true,
      enum: ["reddit", "twitter", "facebook", "other"],
      index: true,
    },
    source_id: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      index: "text",
    },
    content: {
      type: String,
      index: "text",
    },
    author: {
      type: String,
      index: true,
    },
    url: {
      type: String,
    },
    created: {
      type: Date,
      default: Date.now,
      index: true,
    },
    subreddit: {
      type: String,
      index: true,
    },
    metadata: {
      upvotes: { type: Number, default: 0 },
      downvotes: { type: Number, default: 0 },
      score: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      awards: { type: Number, default: 0 },
      nsfw: { type: Boolean, default: false },
    },
    sentiment: 
    {
      positive: { type: Number, default: null },
      negative: { type: Number, default: null },
      neutral: { type: Number, default: null },
      compound: { type: Number, default: null },
      sentiment: { type: String, enum: ["Positive", "Negative", "Neutral", null], default: null },
      neutral_leaning: { 
        direction: { type: String, enum: ["Positive", "Negative", "Balanced", null], default: null },
        percentage: { type: Number, default: null }
      },
    },
    // Entities detected in the text (people, places, organizations, etc.)
    entities: [{
      text: String,
      label: String,
      start: Number,
      end: Number
    }],
    // Processed text after cleaning and normalization
    processed_text: {
      type: String,
      default: null
    },
    // Timestamp of when sentiment was last updated
    sentiment_updated_at: {
      type: Date,
      default: null
    },
    keywords: [
      {
        type: String,
      },
    ],
    collected_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// ✅ Ensure no duplicate post from the same source
PostSchema.index({ source: 1, source_id: 1 }, { unique: true });

// ✅ Improve searchability for title + content
PostSchema.index({ title: "text", content: "text" });

// ✅ Add index for sentiment to enable filtering by sentiment
PostSchema.index({ "sentiment.sentiment": 1 });

module.exports = mongoose.model("Post", PostSchema);