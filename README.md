# Cohere Chatbot — Ruby on Rails

A full-stack Rails chatbot that:

- Uses Cohere Chat API v2.
- Uses `command-a-plus-05-2026` for normal chat.
- Uses `command-a-vision-07-2025` when image files are attached.
- Uses Rails Active Storage for persistent file uploads.
- Shows every uploaded file inside the user's chat message.
- Supports up to 11 files per message, 25 MB per file.
- Extracts text from TXT/MD/CSV/JSON/code/XML/YAML, PDF, DOCX, XLSX shared strings, and PPTX slide text.
- Sends extracted file text as Cohere `documents`, enabling citations.
- Sends images as base64 data-URI image blocks for vision analysis.
- Stores conversations, messages, file attachments, model metadata, and citations in the database.
- Includes drag-and-drop uploads and a responsive UI.

## 1. Security first

The Cohere API key pasted into chat has been intentionally NOT copied into this project. Treat that key as exposed and rotate/revoke it in the Cohere dashboard before using a production deployment.

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Then add the newly rotated key:

```dotenv
COHERE_API_KEY=your_new_rotated_key
COHERE_MODEL=command-a-plus-05-2026
COHERE_VISION_MODEL=command-a-vision-07-2025
COHERE_BASE_URL=https://api.cohere.com
```

## 2. Requirements

- Ruby 3.3+
- Bundler
- Rails 8.1+
- SQLite for the included development setup
- `pdftotext` is NOT required because PDFs are parsed with the `pdf-reader` gem.
- Rails Active Storage can use local disk for development; use S3 or another supported service for production.

## 3. Install

```bash
bundle install
bin/rails active_storage:install
bin/rails db:prepare
bin/rails server
```

Open:

```text
http://localhost:3000
```

## 4. Windows PowerShell

```powershell
copy .env.example .env
bundle install
bin\rails active_storage:install
bin\rails db:prepare
bin\rails server
```

If PowerShell blocks Ruby scripts, use the Ruby/WSL terminal or change the execution policy only as appropriate for your machine.

## 5. Architecture

Browser -> Rails Chat UI -> MessagesController -> CohereClient -> Cohere `/v2/chat`

Files are stored by Active Storage. Text-like files are extracted and passed as `documents` to Cohere. Images are passed as `image_url` content blocks using base64 data URLs.

## 6. Production notes

Set environment variables in the VPS/container instead of committing `.env`.

For production file storage, configure an object-storage service in `config/storage.yml` and set:

```dotenv
ACTIVE_STORAGE_SERVICE=production
```

Also put Rails behind HTTPS, set `FORCE_SSL=1`, and use a production database/storage strategy rather than local SQLite for larger workloads.

## 7. Health check

```text
GET /health
```

## 8. Important model behavior

Cohere citations returned by the Chat API are stored in `messages.metadata["citations"]` and displayed in the assistant message. See the Cohere Chat API and RAG documentation for the supported `documents` and citation behavior.
