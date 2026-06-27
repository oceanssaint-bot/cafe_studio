# Architecture

## Philosophy

Simple.
Local-first.
Single user.

No authentication.
No cloud.
No multi-user support.
No APIs unless absolutely necessary.

## Data Flow

Store Data
→ Monthly Tasks
→ Reports
→ Australia Submission

## Modules

### Dashboard
Month-end progress.

### Month End
Task tracking.

### Stores
Store information and monthly data.

### Reports
Generate outputs.

## Database

SQLite

### Tables

- stores
- monthly_entries
- tasks
- reports
- attachments

## Reporting Layers

### Head Office Pack
Uses:
- Oceans Mall
- Express Stores

### Franchise Pack
Uses:
- All Franchise Stores

### Australia Pack
Uses:
- Oceans Mall
- Gateway
- Florida Road
- Pavilion
- Lakefield

Excludes:
- Point Waterfront
- Express Stores
