# AutoBlog Engine — Full Automation Flow Debug Report

## Executive Summary
An end-to-end debugging of the AutoBlog Engine automation flow was performed. Several critical issues were identified across scheduling, status tracking, path mapping, and database schema constraints. All issues have been resolved, and the pipeline is now functioning normally.

## Issues Identified and Fixed

### 1. Database Polling Loop (`content_writer.py` / `db.py`)
- **Issue:** The content writer was successfully querying the SQLite database for pending research topics, but it was **never marking them as used** after processing. This meant that the pipeline would endlessly attempt to write drafts for the exact same 10 topics on every run.
- **Fix:** Implemented a new `mark_topic_used()` function in `db.py` and updated `content_writer.py` to correctly flag each topic in the database after the drafting process attempts to complete.

### 2. Database Unique Constraint Failure (`content_writer.py`)
- **Issue:** The `posts` SQLite table has a strict `UNIQUE` constraint on the `slug` column. When the pipeline generated the English version of a draft, it successfully saved it with a slug (e.g. `new-kindle-paperwhite`). However, it immediately tried to save the Hindi version of the *exact same topic* using the *exact same slug*. This caused the database to reject the Hindi draft with an `IntegrityError`, crashing the drafting process for that topic.
- **Fix:** Modified the slug generation logic to automatically append a language suffix (e.g., `-hi`) for any drafted post that is not in the primary language (English). 

### 3. Docker Pathing Issue (`docker-compose.yml` / `.env`)
- **Issue:** The pipeline was generating drafts, but they were not appearing in the Obsidian Vault. This occurred because the `.env` file uses absolute Windows paths (e.g., `VAULT_PATH="c:/Jenish/demo/Automation/vault"`). When the Python pipeline ran inside the Linux Docker container, it literally created a new folder named `c:` inside the container instead of routing to the mapped `/app/vault` directory.
- **Fix:** Edited `docker-compose.yml` to explicitly pass correct Linux environment variables (`VAULT_PATH=/app/vault`) directly to the containers, cleanly overriding the `.env` variables which are now strictly used for local host execution. The stray files were manually migrated to your local vault.

### 4. Background Scheduler Crash (`scheduler.py`)
- **Issue:** The `autoblog-pipeline` background container was crashing immediately on startup. The version of `APScheduler` installed did not support direct access to `job.next_run_time` at initialization, resulting in an `AttributeError`.
- **Fix:** Wrapped the attribute access with `getattr(job, 'next_run_time', 'Unknown')` allowing the scheduler to boot and run reliably in the background.

### 5. Manual Run Button Crash (`status_tracker.py`)
- **Issue:** Clicking the "Start Pipeline" button on the Monitor Dashboard crashed silently. An indentation error placed a module-level function `force_stop()` directly in the middle of the `StatusTracker` class definition. This effectively broke the class layout, making critical logging functions inaccessible.
- **Fix:** Corrected the indentation and relocated `force_stop()` to the bottom of the file to restore class functionality.

## Current Status
- All containers are running and healthy.
- Background cron scheduling is functional.
- The pipeline correctly routes outputs directly to your host's Obsidian Vault.
- The pipeline correctly filters out completed tasks to make forward progress.

**Ready for full operation.**
