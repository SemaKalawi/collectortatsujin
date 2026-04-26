# CollectorTatsujin

**AI-powered collection tracking made effortless.**
Collector Tatsujin is a full-stack web application that helps users track and complete hobby collections using image recognition. Instead of manually logging items, users can simply upload a photo — the system identifies the item, assigns it to a collection, and updates progress automatically.

## Features
- AI Image Recognition
  - Upload an image + context (e.g., “NES game”)
  - Automatically identifies the item and its collection
- Collection Tracking
  - Track completion progress toward 100%
  - Automatically updates as items are added
- Smart Organization
  - Sort collections:
    - Alphabetically
    - Recently added
    - Estimated value
- AI-Powered Value Estimation
  - Generates approximate value based on item context
- User Accounts
  - Secure registration and login
  - Personal collections persist across sessions

## Tech Stack
**Frontend**
- React
- HTML/CSS
- JavaScript

**Backend**
- FastAPI (Python)

**Database**
- MongoDB Atlas

**AI Integration**
- Gemini API (Gemini 2.5 Flash)
