const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const DB_FILE = path.join(__dirname, "db.json");

// Helper: read posts from db.json
function readPosts() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([]));
    return [];
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

// Helper: write posts to db.json
function writePosts(posts) {
  fs.writeFileSync(DB_FILE, JSON.stringify(posts, null, 2));
}

// GET: Fetch active posts
app.get("/api/posts", (req, res) => {
  const { zone } = req.query;
  const now = Date.now();
  const posts = readPosts();

  let activePosts = posts.filter(
    (post) => !post.expiresAt || post.expiresAt > now
  );

  if (zone) {
    activePosts = activePosts.filter((post) => post.zone === zone);
  }

  activePosts.sort((a, b) => b.createdAt - a.createdAt);
  res.json(activePosts);
});

// POST: Create a new post
app.post("/api/posts", (req, res) => {
  const { content, zone, ttlMinutes = 60 } = req.body;

  if (!content || !zone) {
    return res.status(400).json({ error: "Missing content or zone" });
  }

  const now = Date.now();
  const expiresAt = now + Number(ttlMinutes) * 60 * 1000;

  const newPost = {
    id: crypto.randomUUID(),
    content,
    zone,
    createdAt: now,
    expiresAt,
  };

  const posts = readPosts();
  posts.push(newPost);
  writePosts(posts);

  res.status(201).json(newPost);
});

// Background job: Purge expired posts from file every 60 seconds
setInterval(() => {
  const posts = readPosts();
  const now = Date.now();
  const validPosts = posts.filter(
    (post) => !post.expiresAt || post.expiresAt > now
  );
  if (validPosts.length !== posts.length) {
    writePosts(validPosts);
    console.log(`[Auto-Cleanup] Purged ${posts.length - validPosts.length} expired posts.`);
  }
}, 60 * 1000);

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});