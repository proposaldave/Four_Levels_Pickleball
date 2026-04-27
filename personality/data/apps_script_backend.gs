/**
 * 4D Pickleball — Personality Quiz Backend
 *
 * Google Apps Script Web App that receives quiz submissions from
 * https://4dpickleball.com/personality and appends them as rows to a Google Sheet.
 *
 * The Sheet can be downloaded as .xlsx anytime → drops into the GnT player DB.
 *
 * ─── DEPLOYMENT (one-time, ~5 minutes) ───────────────────────────────────────
 *
 * 1.  Open Google Sheets → New blank sheet.
 *     Rename the first tab to:  responses
 *     Rename the file to:       Pickleball Personality Quiz Responses
 *
 * 2.  In the menu: Extensions → Apps Script.  Delete any default code,
 *     paste THIS WHOLE FILE, save (disk icon).  Project name: pq-backend.
 *
 * 3.  Deploy:  Deploy → New deployment → gear icon → Web app
 *       - Description:    pq-backend v1
 *       - Execute as:     Me (your Google account)
 *       - Who has access: Anyone
 *     → Deploy.  Copy the Web app URL.
 *
 * 4.  Open  /personality/index.html  → search for `SUBMIT_URL`
 *     Paste your Web app URL between the quotes.
 *     Commit + push.
 *
 * 5.  Open https://4dpickleball.com/personality, take the quiz, watch
 *     a row appear in the Sheet.
 *
 * That's it.  The Sheet is now the persistent store for personality data.
 * Download as .xlsx anytime: File → Download → Microsoft Excel (.xlsx).
 *
 * ─── HARDENING NOTES ─────────────────────────────────────────────────────────
 *
 * - The frontend POSTs with `mode: 'no-cors'` because Apps Script web apps
 *   don't return CORS headers when called from a custom domain.  This means
 *   the browser sees an opaque response — that's fine, the Sheet still gets
 *   written.  The frontend ALSO saves to localStorage as a safety net.
 *
 * - If you want a quick health-check, append `?ping=1` to the Web app URL
 *   in a browser tab — you should see {"ok":true,"rows":N}.
 *
 * - To rotate the URL:  Deploy → Manage deployments → New deployment.
 *   Old URL still works until you archive the old deployment.
 *
 * ─── SCHEMA ──────────────────────────────────────────────────────────────────
 * Columns are auto-created on first write.  Match what the frontend sends in
 * `buildSubmissionPayload()` — see `personality/index.html`.
 */

const SHEET_NAME = 'responses';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const ss   = SpreadsheetApp.getActiveSpreadsheet();
    let sheet  = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    // First write: lay down headers from the keys of the first row
    if (sheet.getLastRow() === 0) {
      const headers = Object.keys(body);
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#0E1F38')
        .setFontColor('#F5F3EE');
      sheet.setFrozenRows(1);
    }

    // Read header order, build row in that order so columns stay aligned
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = headers.map(h => (h in body ? body[h] : ''));

    // Add any new keys (in case the schema grew on the frontend) as new columns
    Object.keys(body).forEach(k => {
      if (headers.indexOf(k) === -1) {
        const newCol = sheet.getLastColumn() + 1;
        sheet.getRange(1, newCol).setValue(k)
          .setFontWeight('bold').setBackground('#0E1F38').setFontColor('#F5F3EE');
        row.push(body[k]);
      }
    });

    sheet.appendRow(row);
    return text_(JSON.stringify({ ok: true, rows: sheet.getLastRow() - 1 }));
  } catch (err) {
    return text_(JSON.stringify({ ok: false, error: String(err) }));
  }
}

// Browser GET → cheap health-check.  Append ?ping=1 to verify deployment.
function doGet(e) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const rows  = sheet ? Math.max(0, sheet.getLastRow() - 1) : 0;
  return text_(JSON.stringify({ ok: true, rows: rows, sheet: SHEET_NAME }));
}

function text_(s) {
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON);
}
