# Context DB Manager

A Chrome extension that allows you to create and manage local context databases using QDrant vector database and open-source embedding models. Select text from any webpage and save it to your personal knowledge base for later retrieval and search.

## 🚀 Features

- **Text Selection**: Select any text on a webpage and save it to your context databases
- **Multiple Databases**: Create and manage multiple context databases for different topics
- **Local Processing**: All data stays on your machine - uses local embedding models and QDrant
- **Fast Search**: Semantic search across your saved contexts using vector similarity
- **Rich Metadata**: Automatically captures webpage URL, title, domain, and timestamp
- **Context Menu Integration**: Right-click selected text for quick actions
- **Modern UI**: Clean, modern interface with real-time server status

## 📋 Prerequisites

- **Python 3.8+** (required for the local server)
- **Chrome Browser** (or Chromium-based browser)
- **4GB+ RAM** (recommended for embedding models)
- **Internet connection** (for initial model download)

## 🛠 Installation & Setup

### Step 1: Set Up the Python Environment

1. **Clone or download this project**:
   ```bash
   cd /path/to/ContextDB
   ```

2. **Create a Python virtual environment** (recommended):
   ```bash
   python -m venv context_db_env

   # On macOS/Linux:
   source context_db_env/bin/activate

   # On Windows:
   context_db_env\Scripts\activate
   ```

3. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

### Step 2: Download Embedding Models

The server will automatically download the embedding model on first run, but you can pre-download it:

```python
from sentence_transformers import SentenceTransformer

# This will download the model (about 90MB)
model = SentenceTransformer('all-MiniLM-L6-v2')
print("Model downloaded successfully!")
```

### Step 3: Create Extension Icons (Optional)

Run the icon creation script to generate placeholder icons:

```bash
pip install Pillow  # If not already installed
python create_icons.py
```

### Step 4: Install Chrome Extension

1. **Open Chrome** and navigate to `chrome://extensions/`

2. **Enable Developer Mode** (toggle in the top right)

3. **Click "Load unpacked"** and select the ContextDB folder

4. **Pin the extension** to your toolbar for easy access

### Step 5: Start the Local Server

```bash
python server.py
```

The server will start on `http://localhost:8000`. You should see:
```
Starting Context DB Server...
Server will be available at: http://127.0.0.1:8000
Using embedding model: all-MiniLM-L6-v2
```

## 🎯 Usage

### Creating Your First Database

1. **Click the extension icon** in Chrome toolbar
2. **Check server status** - should show "Server online"
3. **Enter a database name** (e.g., "Research Notes")
4. **Click "Create Database"**

### Saving Text to Database

**Method 1: Text Selection Modal**
1. Select any text on a webpage
2. A modal will appear automatically
3. Choose a database or create a new one
4. Add optional tags
5. Click "Save to Database"

**Method 2: Right-Click Context Menu**
1. Select text on any webpage
2. Right-click and choose "Add to Context DB"
3. If you have a default database selected, it saves automatically
4. Otherwise, the extension popup opens for database selection

### Searching Your Context

1. **Open the extension popup**
2. **Go to the Search section**
3. **Select a database** to search
4. **Enter your query** and click "Search"
5. **View results** with similarity scores

## 🔧 Configuration

### Changing Embedding Models

Edit `server.py` and change the `EMBEDDING_MODEL` constant:

```python
# Current default (fast, efficient)
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# Alternative options:
# EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"  # Better quality
# EMBEDDING_MODEL = "sentence-transformers/all-mpnet-base-v2"  # Larger, higher quality
# EMBEDDING_MODEL = "nomic-ai/nomic-embed-text-v1"  # Good for longer texts
```

**Note**: Changing models requires recreating databases as vector dimensions may differ.

### Server Settings

In `server.py`, modify the `Config` class:

```python
class Config:
    HOST = "127.0.0.1"  # Server host
    PORT = 8000         # Server port
    DEFAULT_SEARCH_LIMIT = 5    # Default search results
    MAX_SEARCH_LIMIT = 50       # Maximum search results
```

### Extension Settings

Use the extension popup to configure:
- **Server URL**: Change if using different host/port
- **Context Menu**: Enable/disable right-click menu
- **Default Database**: Set a default for quick saving

## 📊 Recommended Embedding Models

Based on research and testing, here are the best open-source models for different use cases:

### **Fast & Efficient (Recommended for most users)**
- **`all-MiniLM-L6-v2`** (90MB, 384 dimensions)
  - Fastest inference
  - Good for real-time use
  - Best for short to medium texts

### **Balanced Quality & Speed**
- **`BAAI/bge-small-en-v1.5`** (130MB, 384 dimensions)
  - Better quality than MiniLM
  - Still fast inference
  - Good for general purpose

### **High Quality (Slower)**
- **`sentence-transformers/all-mpnet-base-v2`** (420MB, 768 dimensions)
  - Higher quality embeddings
  - Slower inference
  - Best for critical applications

### **Long Text Specialist**
- **`nomic-ai/nomic-embed-text-v1`** (500MB+, 768 dimensions)
  - Handles very long texts (8192+ tokens)
  - Good for documents and articles
  - Slower but comprehensive

## 🗂 File Structure

```
ContextDB/
├── manifest.json           # Chrome extension manifest
├── popup.html             # Extension popup interface
├── popup.css              # Popup styling
├── popup.js               # Popup functionality
├── content.js             # Content script for text selection
├── content.css            # Content script styles
├── background.js          # Extension background script
├── server.py              # FastAPI server
├── requirements.txt       # Python dependencies
├── create_icons.py        # Icon generation script
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── context_dbs/          # Created automatically
│   ├── databases.json    # Database metadata
│   └── [database_name]/  # Individual database folders
└── README.md             # This file
```

## 🔍 API Endpoints

The local server provides these endpoints:

- `GET /health` - Server health check
- `GET /databases` - List all databases
- `POST /databases` - Create new database
- `DELETE /databases/{name}` - Delete database
- `POST /add-text` - Add text to database
- `POST /search` - Search database
- `GET /databases/{name}/stats` - Database statistics

## 🚨 Troubleshooting

### Server Won't Start
- **Check Python version**: Must be 3.8+
- **Install dependencies**: `pip install -r requirements.txt`
- **Check port availability**: Port 8000 might be in use
- **Virtual environment**: Activate your venv if using one

### Extension Shows "Server Offline"
- **Start the server**: Run `python server.py`
- **Check server URL**: Verify in extension settings
- **Firewall**: Ensure localhost connections are allowed
- **Browser restart**: Try restarting Chrome

### Model Download Fails
- **Internet connection**: Required for first download
- **Disk space**: Models need 90MB-500MB+ space
- **Proxy/Corporate network**: May block Hugging Face downloads

### Text Selection Not Working
- **Permissions**: Extension needs "activeTab" permission
- **Content script**: Check browser console for errors
- **Settings**: Ensure context menu is enabled

### Search Returns No Results
- **Database exists**: Check database is created and has content
- **Text content**: Some texts may not embed well
- **Model compatibility**: Recreate databases after model changes

## 🔒 Privacy & Security

- **Local-only**: All data stays on your machine
- **No tracking**: No analytics or data collection
- **Secure storage**: QDrant stores data locally
- **HTTPS support**: Works with secure websites

## 🛣 Roadmap

- [ ] Export/import functionality
- [ ] Bulk text processing
- [ ] Advanced search filters
- [ ] Database backup/restore
- [ ] Custom embedding models
- [ ] Dark mode theme
- [ ] Batch operations API

## 🤝 Contributing

This is an open-source project! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests
- Improve documentation

## 📝 License

This project is open source. Use it however you like!

## 🙋‍♂️ Support

If you encounter issues:
1. Check the troubleshooting section above
2. Look at the browser console for errors
3. Check the Python server logs
4. Create an issue with detailed information

## 🎉 Credits

Built with:
- [QDrant](https://qdrant.tech/) - Vector database
- [Sentence Transformers](https://www.sbert.net/) - Embedding models
- [FastAPI](https://fastapi.tiangolo.com/) - Python web framework
- [Chrome Extensions API](https://developer.chrome.com/docs/extensions/) - Browser integration
