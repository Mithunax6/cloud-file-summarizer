require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

function summarize(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  const wordFreq = {};

  sentences.forEach((sentence) => {
    sentence.toLowerCase().split(/\s+/).forEach((word) => {
      word = word.replace(/[^a-z]/g, "");
      if (word.length > 3) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });
  });

  const scored = sentences.map((sentence) => {
    const words = sentence.toLowerCase().split(/\s+/);
    const score = words.reduce((sum, word) => {
      word = word.replace(/[^a-z]/g, "");
      return sum + (wordFreq[word] || 0);
    }, 0);
    return { sentence: sentence.trim(), score };
  });

  const top = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.sentence);

  return top.join(" ");
}

app.post("/summarize", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath, "utf-8");
    fs.unlinkSync(filePath);

    if (!fileContent.trim()) {
      return res.status(400).json({ error: "File is empty." });
    }

    const summary = summarize(fileContent);
    res.json({ summary });

  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: "Failed to summarize." });
  }
});

app.get("/", (req, res) => {
  res.json({ status: "Cloud File Summarizer API is running." });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:5000`);
});