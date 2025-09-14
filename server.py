#!/usr/bin/env python3
"""
Local Context DB Server
A FastAPI server that manages QDrant vector databases for the Chrome extension.
"""

import os
import json
import uuid
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from qdrant_client import QdrantClient, models
from sentence_transformers import SentenceTransformer

# Pydantic models for API requests/responses
class DatabaseCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)

class TextAddRequest(BaseModel):
    database_name: str
    text: str = Field(..., min_length=1)
    metadata: Optional[Dict[str, Any]] = None

class SearchRequest(BaseModel):
    database_name: str
    query: str = Field(..., min_length=1)
    limit: int = Field(default=5, ge=1, le=50)
    min_score: float = Field(default=0.3, ge=0.0, le=1.0)  # Configurable similarity threshold

class SearchResult(BaseModel):
    id: str
    text: str
    score: float
    metadata: Dict[str, Any]

class DatabaseInfo(BaseModel):
    name: str
    document_count: int
    created_at: str
    vector_size: int

class HealthResponse(BaseModel):
    status: str
    version: str
    embedding_model: str
    databases_count: int

# Configuration
class Config:
    # Embedding model - you can change this to any of the recommended models
    EMBEDDING_MODEL = "all-MiniLM-L6-v2"  # Fast and efficient
    # EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"  # Alternative: good quality/size ratio

    # Data directories
    DATA_DIR = Path("context_dbs")
    METADATA_FILE = DATA_DIR / "databases.json"

    # Server settings
    HOST = "127.0.0.1"
    PORT = 8000

    # Vector search settings
    DEFAULT_SEARCH_LIMIT = 5
    MAX_SEARCH_LIMIT = 50

# Global variables
app = FastAPI(
    title="Context DB Server",
    description="Local vector database server for Chrome extension",
    version="1.0.0"
)

# CORS middleware to allow Chrome extension to access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["chrome-extension://*", "http://localhost:*", "https://*", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances
encoder: Optional[SentenceTransformer] = None
qdrant_clients: Dict[str, QdrantClient] = {}
database_metadata: Dict[str, Dict] = {}

def initialize_embedding_model():
    """Initialize the embedding model."""
    global encoder
    print(f"Loading embedding model: {Config.EMBEDDING_MODEL}")
    try:
        encoder = SentenceTransformer(Config.EMBEDDING_MODEL)
        print(f"Embedding model loaded successfully. Vector dimension: {encoder.get_sentence_embedding_dimension()}")
    except Exception as e:
        print(f"Error loading embedding model: {e}")
        raise

def load_database_metadata():
    """Load database metadata from file."""
    global database_metadata
    Config.METADATA_FILE.parent.mkdir(exist_ok=True)

    if Config.METADATA_FILE.exists():
        try:
            with open(Config.METADATA_FILE, 'r') as f:
                database_metadata = json.load(f)
        except Exception as e:
            print(f"Error loading database metadata: {e}")
            database_metadata = {}
    else:
        database_metadata = {}

def save_database_metadata():
    """Save database metadata to file."""
    try:
        with open(Config.METADATA_FILE, 'w') as f:
            json.dump(database_metadata, f, indent=2)
    except Exception as e:
        print(f"Error saving database metadata: {e}")

def get_qdrant_client(database_name: str) -> QdrantClient:
    """Get or create a QDrant client for a specific database."""
    if database_name not in qdrant_clients:
        db_path = Config.DATA_DIR / database_name
        db_path.mkdir(parents=True, exist_ok=True)
        qdrant_clients[database_name] = QdrantClient(path=str(db_path))
    return qdrant_clients[database_name]

def ensure_collection_exists(database_name: str):
    """Ensure the QDrant collection exists for a database."""
    client = get_qdrant_client(database_name)
    collection_name = "documents"

    try:
        # Check if collection exists
        client.get_collection(collection_name)
    except Exception:
        # Create collection if it doesn't exist
        vector_size = encoder.get_sentence_embedding_dimension()
        client.create_collection(
            collection_name=collection_name,
            vectors_config=models.VectorParams(
                size=vector_size,
                distance=models.Distance.COSINE
            )
        )
        print(f"Created collection '{collection_name}' for database '{database_name}'")

def generate_document_id(text: str, metadata: Dict = None) -> str:
    """Generate a unique document ID based on content."""
    content = text
    if metadata:
        content += json.dumps(metadata, sort_keys=True)
    # Create a deterministic UUID from content hash
    hash_bytes = hashlib.sha256(content.encode()).digest()[:16]
    # Convert to UUID format
    return str(uuid.UUID(bytes=hash_bytes))

@app.on_event("startup")
async def startup_event():
    """Initialize the server on startup."""
    print("Starting Context DB Server...")
    initialize_embedding_model()
    load_database_metadata()
    print(f"Server ready with {len(database_metadata)} databases loaded")

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="online",
        version="1.0.0",
        embedding_model=Config.EMBEDDING_MODEL,
        databases_count=len(database_metadata)
    )

@app.get("/databases", response_model=List[DatabaseInfo])
async def get_databases():
    """Get list of all databases."""
    result = []
    for name, metadata in database_metadata.items():
        try:
            client = get_qdrant_client(name)
            collection_info = client.get_collection("documents")
            doc_count = collection_info.points_count
        except Exception:
            doc_count = 0

        result.append(DatabaseInfo(
            name=name,
            document_count=doc_count,
            created_at=metadata.get("created_at", "unknown"),
            vector_size=metadata.get("vector_size", encoder.get_sentence_embedding_dimension())
        ))

    return result

@app.post("/databases")
async def create_database(request: DatabaseCreateRequest):
    """Create a new database."""
    database_name = request.name.strip()

    # Validate database name
    if not database_name.replace("_", "").replace("-", "").replace(" ", "").isalnum():
        raise HTTPException(status_code=400, detail="Database name can only contain letters, numbers, spaces, hyphens, and underscores")

    if database_name in database_metadata:
        raise HTTPException(status_code=400, detail="Database already exists")

    # Create database metadata
    database_metadata[database_name] = {
        "created_at": datetime.now().isoformat(),
        "vector_size": encoder.get_sentence_embedding_dimension(),
        "model": Config.EMBEDDING_MODEL
    }

    # Initialize QDrant collection
    ensure_collection_exists(database_name)

    # Save metadata
    save_database_metadata()

    return {"message": f"Database '{database_name}' created successfully"}

@app.delete("/databases/{database_name}")
async def delete_database(database_name: str):
    """Delete a database."""
    if database_name not in database_metadata:
        raise HTTPException(status_code=404, detail="Database not found")

    try:
        # Remove from metadata
        del database_metadata[database_name]

        # Remove QDrant client
        if database_name in qdrant_clients:
            del qdrant_clients[database_name]

        # Remove database directory
        db_path = Config.DATA_DIR / database_name
        if db_path.exists():
            import shutil
            shutil.rmtree(db_path)

        # Save metadata
        save_database_metadata()

        return {"message": f"Database '{database_name}' deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting database: {str(e)}")

@app.post("/add-text")
async def add_text(request: TextAddRequest):
    """Add text to a database."""
    database_name = request.database_name
    text = request.text.strip()

    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    # Create database if it doesn't exist
    if database_name not in database_metadata:
        database_metadata[database_name] = {
            "created_at": datetime.now().isoformat(),
            "vector_size": encoder.get_sentence_embedding_dimension(),
            "model": Config.EMBEDDING_MODEL
        }
        save_database_metadata()

    try:
        # Ensure collection exists
        ensure_collection_exists(database_name)

        # Generate embedding
        vector = encoder.encode(text).tolist()

        # Prepare metadata
        metadata = request.metadata or {}
        metadata.update({
            "text": text,
            "added_at": datetime.now().isoformat(),
            "text_length": len(text),
            "model": Config.EMBEDDING_MODEL
        })

        # Generate document ID
        doc_id = generate_document_id(text, metadata)

        # Add to QDrant
        client = get_qdrant_client(database_name)
        client.upsert(
            collection_name="documents",
            points=[
                models.PointStruct(
                    id=doc_id,
                    vector=vector,
                    payload=metadata
                )
            ],
            wait=True
        )

        return {
            "message": "Text added successfully",
            "document_id": doc_id,
            "database_name": database_name
        }

    except Exception as e:
        print(f"Error adding text: {e}")
        raise HTTPException(status_code=500, detail=f"Error adding text: {str(e)}")

@app.post("/search", response_model=List[SearchResult])
async def search_text(request: SearchRequest):
    """Search for text in a database."""
    database_name = request.database_name
    query = request.query.strip()
    limit = min(request.limit, Config.MAX_SEARCH_LIMIT)

    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    if database_name not in database_metadata:
        raise HTTPException(status_code=404, detail="Database not found")

    try:
        # Generate query embedding
        query_vector = encoder.encode(query).tolist()

        # Search in QDrant
        client = get_qdrant_client(database_name)
        search_results = client.search(
            collection_name="documents",
            query_vector=query_vector,
            limit=limit,
            with_payload=True
        )

        # Format results and filter by configurable score threshold
        score_threshold = request.min_score
        results = []
        for result in search_results:
            # Only include results with score >= threshold
            if result.score >= score_threshold:
                payload = result.payload or {}
                results.append(SearchResult(
                    id=str(result.id),
                    text=payload.get("text", ""),
                    score=float(result.score),
                    metadata={k: v for k, v in payload.items() if k != "text"}
                ))

        return results

    except Exception as e:
        print(f"Error searching: {e}")
        raise HTTPException(status_code=500, detail=f"Error searching: {str(e)}")

@app.get("/databases/{database_name}/stats")
async def get_database_stats(database_name: str):
    """Get detailed statistics for a database."""
    if database_name not in database_metadata:
        raise HTTPException(status_code=404, detail="Database not found")

    try:
        client = get_qdrant_client(database_name)
        collection_info = client.get_collection("documents")

        return {
            "name": database_name,
            "document_count": collection_info.points_count,
            "vector_size": collection_info.config.params.vectors.size,
            "distance_metric": collection_info.config.params.vectors.distance.name,
            "metadata": database_metadata[database_name]
        }
    except Exception as e:
        print(f"Error getting database stats: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting stats: {str(e)}")

if __name__ == "__main__":
    print("Starting Context DB Server...")
    print(f"Server will be available at: http://{Config.HOST}:{Config.PORT}")
    print(f"Using embedding model: {Config.EMBEDDING_MODEL}")
    print(f"Data directory: {Config.DATA_DIR}")

    uvicorn.run(
        app,
        host=Config.HOST,
        port=Config.PORT,
        log_level="info"
    )
